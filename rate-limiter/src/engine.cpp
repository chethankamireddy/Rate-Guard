// RateGuard C++ Rate-Limiting Engine — Self-contained HTTP Microservice
// Compatible with MinGW GCC 6.3 (no std::mutex, no std::thread)
// Uses Windows CRITICAL_SECTION and CreateThread for concurrency.

#include <winsock2.h>
#include <windows.h>

#include <iostream>
#include <string>
#include <unordered_map>
#include <deque>
#include <vector>
#include <algorithm>
#include <sstream>
#include <cstdlib>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <ctime>

// High-precision monotonic millisecond clock compatible with all Win32 compilers
static ULONGLONG get_time_ms() {
    static LARGE_INTEGER freq;
    static BOOL initialized = FALSE;
    if (!initialized) {
        QueryPerformanceFrequency(&freq);
        initialized = TRUE;
    }
    LARGE_INTEGER counter;
    QueryPerformanceCounter(&counter);
    return (ULONGLONG)((counter.QuadPart * 1000ULL) / freq.QuadPart);
}

// ===========================================================================
// RAII Critical Section wrapper
// ===========================================================================

struct CritSec {
    CRITICAL_SECTION cs;
    CritSec()  { InitializeCriticalSection(&cs); }
    ~CritSec() { DeleteCriticalSection(&cs); }
    void lock()   { EnterCriticalSection(&cs); }
    void unlock() { LeaveCriticalSection(&cs); }
};

struct CritSecLock {
    CritSec& cs_;
    CritSecLock(CritSec& cs) : cs_(cs) { cs_.lock(); }
    ~CritSecLock() { cs_.unlock(); }
};

// ===========================================================================
// Algorithm types
// ===========================================================================

enum AlgorithmType { TOKEN_BUCKET = 0, SLIDING_WINDOW = 1 };

struct Config {
    AlgorithmType algorithm;
    uint64_t limit;
    uint64_t window_sec;
    uint64_t burst;

    Config() : algorithm(TOKEN_BUCKET), limit(100), window_sec(60), burst(100) {}
};

// ===========================================================================
// Token Bucket
// ===========================================================================

struct TokenBucketState {
    double tokens;
    double capacity;
    double refill_rate;      // tokens per second
    ULONGLONG last_refill_ms; // GetTickCount64() ms
    uint64_t limit;
    uint64_t window_sec;
    CritSec cs;

    TokenBucketState(uint64_t lim, uint64_t wsec, uint64_t brst)
        : limit(lim), window_sec(wsec) {
        capacity    = (double)(brst > 0 ? brst : lim);
        tokens      = capacity;
        refill_rate = (double)lim / (double)(wsec > 0 ? wsec : 1);
        last_refill_ms = get_time_ms();
    }
};

// ===========================================================================
// Sliding Window
// ===========================================================================

struct SlidingWindowState {
    uint64_t limit;
    uint64_t window_ms;
    std::deque<ULONGLONG> timestamps; // GetTickCount64() ms
    CritSec cs;

    SlidingWindowState(uint64_t lim, uint64_t wsec)
        : limit(lim), window_ms(wsec * 1000ULL) {}
};

// ===========================================================================
// Result
// ===========================================================================

struct RateResult {
    bool allowed;
    uint64_t remaining;
    uint64_t limit;
    int64_t  reset_epoch_sec;
    uint64_t retry_after_sec;
    double   latency_us;
    const char* algorithm;
    std::string reason;
};

// ===========================================================================
// Limiter entry — holds either a TB or SW state
// ===========================================================================

struct LimiterEntry {
    AlgorithmType algorithm;
    TokenBucketState* tb;
    SlidingWindowState* sw;

    LimiterEntry() : algorithm(TOKEN_BUCKET), tb(nullptr), sw(nullptr) {}
    ~LimiterEntry() { delete tb; delete sw; }

    void init(const Config& cfg) {
        delete tb; tb = nullptr;
        delete sw; sw = nullptr;
        algorithm = cfg.algorithm;
        if (cfg.algorithm == TOKEN_BUCKET) {
            tb = new TokenBucketState(cfg.limit, cfg.window_sec, cfg.burst);
        } else {
            sw = new SlidingWindowState(cfg.limit, cfg.window_sec);
        }
    }
};

// ===========================================================================
// Evaluate Token Bucket
// ===========================================================================

static RateResult evaluate_tb(TokenBucketState* s) {
    LARGE_INTEGER freq, start_ticks, end_ticks;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&start_ticks);

    CritSecLock lock(s->cs);

    ULONGLONG now_ms = get_time_ms();
    double elapsed_sec = (double)(now_ms - s->last_refill_ms) / 1000.0;
    s->last_refill_ms = now_ms;

    s->tokens += elapsed_sec * s->refill_rate;
    if (s->tokens > s->capacity) s->tokens = s->capacity;

    RateResult r;
    r.algorithm = "TOKEN_BUCKET";
    r.limit     = s->limit;

    time_t epoch_sec;
    time(&epoch_sec);

    double need_full = s->capacity - s->tokens;
    if (need_full < 0.0) need_full = 0.0;
    double secs_to_full = (s->refill_rate > 0.0) ? (need_full / s->refill_rate) : 0.0;
    r.reset_epoch_sec = (int64_t)epoch_sec + (int64_t)ceil(secs_to_full);

    if (s->tokens >= 1.0) {
        s->tokens -= 1.0;
        r.allowed  = true;
        r.remaining = (uint64_t)floor(s->tokens);
        r.retry_after_sec = 0;
        r.reason = "Token bucket allowed";
    } else {
        double deficit = 1.0 - s->tokens;
        double wait    = (s->refill_rate > 0.0) ? (deficit / s->refill_rate) : 1.0;
        r.allowed  = false;
        r.remaining = 0;
        r.retry_after_sec = (uint64_t)ceil(wait);
        r.reason = "Token bucket exceeded";
    }

    QueryPerformanceCounter(&end_ticks);
    r.latency_us = (double)(end_ticks.QuadPart - start_ticks.QuadPart) * 1e6 / (double)freq.QuadPart;
    return r;
}

// ===========================================================================
// Evaluate Sliding Window
// ===========================================================================

static RateResult evaluate_sw(SlidingWindowState* s) {
    LARGE_INTEGER freq, start_ticks, end_ticks;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&start_ticks);

    CritSecLock lock(s->cs);

    ULONGLONG now_ms = get_time_ms();
    ULONGLONG threshold = (now_ms > s->window_ms) ? (now_ms - s->window_ms) : 0;

    while (!s->timestamps.empty() && s->timestamps.front() <= threshold) {
        s->timestamps.pop_front();
    }

    RateResult r;
    r.algorithm = "SLIDING_WINDOW";
    r.limit     = s->limit;

    time_t epoch_sec;
    time(&epoch_sec);

    size_t count = s->timestamps.size();

    if (count < (size_t)s->limit) {
        s->timestamps.push_back(now_ms);
        r.allowed   = true;
        r.remaining = s->limit - count - 1;
        r.retry_after_sec = 0;
        r.reason = "Sliding window allowed";

        if (!s->timestamps.empty()) {
            ULONGLONG oldest = s->timestamps.front();
            ULONGLONG elapsed_ms = now_ms - oldest;
            int64_t remaining_ms = (int64_t)s->window_ms - (int64_t)elapsed_ms;
            r.reset_epoch_sec = epoch_sec + (remaining_ms > 0 ? remaining_ms / 1000 + 1 : 0);
        } else {
            r.reset_epoch_sec = epoch_sec + (int64_t)(s->window_ms / 1000);
        }
    } else {
        r.allowed   = false;
        r.remaining = 0;
        r.reason    = "Sliding window exceeded";

        if (!s->timestamps.empty()) {
            ULONGLONG oldest = s->timestamps.front();
            ULONGLONG elapsed_ms = now_ms - oldest;
            int64_t wait_ms = (int64_t)s->window_ms - (int64_t)elapsed_ms;
            r.retry_after_sec = (wait_ms > 0) ? (uint64_t)(wait_ms / 1000 + 1) : 1;
        } else {
            r.retry_after_sec = s->window_ms / 1000;
        }
        r.reset_epoch_sec = epoch_sec + (int64_t)r.retry_after_sec;
    }

    QueryPerformanceCounter(&end_ticks);
    r.latency_us = (double)(end_ticks.QuadPart - start_ticks.QuadPart) * 1e6 / (double)freq.QuadPart;
    return r;
}

// ===========================================================================
// Global registry
// ===========================================================================

struct Registry {
    std::unordered_map<std::string, LimiterEntry*> entries;
    CritSec cs;

    Registry() {}
    ~Registry() { for (auto& p : entries) delete p.second; }

    LimiterEntry* get_or_create(const std::string& key, const Config& cfg) {
        CritSecLock lock(cs);
        auto it = entries.find(key);
        if (it != entries.end()) return it->second;
        LimiterEntry* e = new LimiterEntry();
        e->init(cfg);
        entries[key] = e;
        return e;
    }

    void configure(const std::string& key, const Config& cfg) {
        CritSecLock lock(cs);
        auto it = entries.find(key);
        if (it != entries.end()) {
            it->second->init(cfg);
        } else {
            LimiterEntry* e = new LimiterEntry();
            e->init(cfg);
            entries[key] = e;
        }
    }

    void reset(const std::string& key) {
        CritSecLock lock(cs);
        auto it = entries.find(key);
        if (it != entries.end()) {
            delete it->second;
            entries.erase(it);
        }
    }

    size_t size() {
        CritSecLock lock(cs);
        return entries.size();
    }
} g_registry;

// ===========================================================================
// Evaluate a request
// ===========================================================================

static RateResult evaluate(const std::string& reg_key, const Config& cfg) {
    LimiterEntry* e = g_registry.get_or_create(reg_key, cfg);
    if (e->algorithm == TOKEN_BUCKET && e->tb) {
        return evaluate_tb(e->tb);
    } else if (e->algorithm == SLIDING_WINDOW && e->sw) {
        return evaluate_sw(e->sw);
    }
    RateResult r;
    r.allowed = true; r.remaining = 0; r.limit = 0;
    r.reset_epoch_sec = 0; r.retry_after_sec = 0; r.latency_us = 0;
    r.algorithm = "NONE"; r.reason = "No limiter";
    return r;
}

// ===========================================================================
// JSON helpers (no external deps)
// ===========================================================================

static std::string json_str(const std::string& s) {
    return "\"" + s + "\"";
}

static std::string json_bool(bool v) { return v ? "true" : "false"; }

static std::string json_num_u64(uint64_t v) {
    std::ostringstream oss; oss << v; return oss.str();
}

static std::string json_num_i64(int64_t v) {
    std::ostringstream oss; oss << v; return oss.str();
}

static std::string json_num_dbl(double v) {
    if (std::isnan(v) || std::isinf(v)) return "0";
    std::ostringstream oss; oss << v; return oss.str();
}

static std::string result_to_json(const RateResult& r) {
    std::string out = "{";
    out += "\"allowed\":"      + json_bool(r.allowed)              + ",";
    out += "\"decision\":"     + json_str(r.allowed ? "ALLOWED" : "REJECTED") + ",";
    out += "\"remaining\":"    + json_num_u64(r.remaining)         + ",";
    out += "\"limit\":"        + json_num_u64(r.limit)             + ",";
    out += "\"reset\":"        + json_num_i64(r.reset_epoch_sec)   + ",";
    out += "\"retryAfter\":"   + json_num_u64(r.retry_after_sec)   + ",";
    out += "\"latencyUs\":"    + json_num_dbl(r.latency_us)        + ",";
    out += "\"algorithm\":"    + json_str(r.algorithm)             + ",";
    out += "\"reason\":"       + json_str(r.reason)                ;
    out += "}";
    return out;
}

// Very simple JSON field extractor for flat objects
static std::string json_get(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\"";
    size_t pos = body.find(search);
    if (pos == std::string::npos) return "";
    pos = body.find(':', pos + search.size());
    if (pos == std::string::npos) return "";
    ++pos;
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) ++pos;
    if (pos >= body.size()) return "";
    if (body[pos] == '"') {
        ++pos;
        size_t end = body.find('"', pos);
        if (end == std::string::npos) return "";
        return body.substr(pos, end - pos);
    }
    size_t end = pos;
    while (end < body.size() && body[end] != ',' && body[end] != '}' && body[end] != ']' && body[end] != '\r' && body[end] != '\n') ++end;
    std::string val = body.substr(pos, end - pos);
    while (!val.empty() && (val.back() == ' ')) val.pop_back();
    return val;
}

static AlgorithmType parse_algo(const std::string& s) {
    if (s == "SLIDING_WINDOW" || s == "sliding_window" || s == "slidingWindow") return SLIDING_WINDOW;
    return TOKEN_BUCKET;
}

static uint64_t to_u64(const std::string& s, uint64_t def) {
    if (s.empty()) return def;
    return (uint64_t)strtoull(s.c_str(), nullptr, 10);
}

static Config parse_config(const std::string& body, uint64_t def_limit = 100, uint64_t def_window = 60) {
    Config cfg;
    cfg.algorithm = parse_algo(json_get(body, "algorithm"));
    cfg.limit     = to_u64(json_get(body, "limit"),  def_limit);
    cfg.window_sec= to_u64(json_get(body, "window"), def_window);
    cfg.burst     = to_u64(json_get(body, "burst"),  cfg.limit);
    if (cfg.burst == 0) cfg.burst = cfg.limit;
    return cfg;
}

// ===========================================================================
// HTTP structs
// ===========================================================================

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::unordered_map<std::string, std::string> headers;
};

struct HttpResponse {
    int status_code;
    std::string body;
    std::unordered_map<std::string, std::string> headers;

    HttpResponse() : status_code(200) {
        headers["Access-Control-Allow-Origin"]  = "*";
        headers["Access-Control-Allow-Headers"] = "Content-Type,X-API-Key,Authorization";
        headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
        headers["Content-Type"]                 = "application/json";
    }

    void json(const std::string& j, int code = 200) {
        status_code = code;
        body = j;
    }

    std::string status_text() const {
        switch (status_code) {
            case 200: return "OK";
            case 204: return "No Content";
            case 400: return "Bad Request";
            case 404: return "Not Found";
            case 429: return "Too Many Requests";
            default:  return "Internal Server Error";
        }
    }

    std::string build() const {
        std::ostringstream oss;
        oss << "HTTP/1.1 " << status_code << " " << status_text() << "\r\n";
        oss << "Content-Length: " << body.size() << "\r\n";
        for (auto& h : headers) oss << h.first << ": " << h.second << "\r\n";
        oss << "Connection: close\r\n\r\n" << body;
        return oss.str();
    }
};

// ===========================================================================
// HTTP parser
// ===========================================================================

static HttpRequest parse_http(const char* buf, int len) {
    HttpRequest req;
    std::string raw(buf, len);
    std::istringstream ss(raw);
    std::string line;

    // Request line
    if (std::getline(ss, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        std::istringstream rl(line);
        std::string raw_path;
        rl >> req.method >> raw_path;
        // strip query
        size_t q = raw_path.find('?');
        req.path = (q == std::string::npos) ? raw_path : raw_path.substr(0, q);
    }

    // Headers
    while (std::getline(ss, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) break;
        size_t colon = line.find(':');
        if (colon != std::string::npos) {
            std::string k = line.substr(0, colon);
            std::string v = (line.size() > colon + 2) ? line.substr(colon + 2) : "";
            req.headers[k] = v;
        }
    }

    // Body
    while (std::getline(ss, line)) {
        req.body += line + "\n";
    }
    return req;
}

// ===========================================================================
// Route handlers
// ===========================================================================

static void handle_evaluate(const HttpRequest& req, HttpResponse& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    if (api_key.empty()) api_key = "default";
    if (endpoint.empty()) endpoint = "/";
    Config cfg = parse_config(req.body);
    std::string reg_key = api_key + "::" + endpoint;
    RateResult r = evaluate(reg_key, cfg);
    res.json(result_to_json(r), r.allowed ? 200 : 429);
}

static void handle_configure(const HttpRequest& req, HttpResponse& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    if (api_key.empty()) { res.json("{\"error\":\"api_key required\"}", 400); return; }
    if (endpoint.empty()) endpoint = "/";
    Config cfg = parse_config(req.body);
    std::string reg_key = api_key + "::" + endpoint;
    g_registry.configure(reg_key, cfg);
    res.json("{\"status\":\"configured\",\"ok\":true}");
}

static void handle_reset(const HttpRequest& req, HttpResponse& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    if (endpoint.empty()) endpoint = "/";
    std::string reg_key = api_key + "::" + endpoint;
    g_registry.reset(reg_key);
    res.json("{\"status\":\"reset\",\"ok\":true}");
}

static void handle_health(const HttpRequest&, HttpResponse& res) {
    std::ostringstream j;
    j << "{\"status\":\"healthy\",\"service\":\"rateguard-cpp-engine\","
      << "\"version\":\"1.0.0\",\"activeLimiters\":" << g_registry.size() << "}";
    res.json(j.str());
}

static void handle_info(const HttpRequest&, HttpResponse& res) {
    res.json("{\"service\":\"rateguard-cpp-engine\",\"version\":\"1.0.0\","
             "\"compiler\":\"GCC " __VERSION__ "\","
             "\"algorithms\":\"TOKEN_BUCKET,SLIDING_WINDOW\",\"mode\":\"LOCAL\"}");
}

static void handle_benchmark(const HttpRequest& req, HttpResponse& res) {
    Config cfg = parse_config(req.body);
    uint64_t total = to_u64(json_get(req.body, "requests"), 1000);
    if (total > 100000) total = 100000;

    // Create isolated limiter for benchmark
    LimiterEntry* e = new LimiterEntry();
    e->init(cfg);

    uint64_t allowed = 0, rejected = 0;
    std::vector<double> latencies;
    latencies.reserve((size_t)total);

    LARGE_INTEGER freq, t0, t1;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&t0);

    for (uint64_t i = 0; i < total; ++i) {
        RateResult r;
        if (e->algorithm == TOKEN_BUCKET && e->tb) r = evaluate_tb(e->tb);
        else if (e->sw) r = evaluate_sw(e->sw);
        if (r.allowed) ++allowed; else ++rejected;
        latencies.push_back(r.latency_us);
    }

    QueryPerformanceCounter(&t1);
    double dur_sec = (double)(t1.QuadPart - t0.QuadPart) / (double)freq.QuadPart;
    double rps = total / (dur_sec > 0.0 ? dur_sec : 1.0);

    std::sort(latencies.begin(), latencies.end());
    double sum = 0; for (double v : latencies) sum += v;
    double avg = sum / (double)total;
    double p50 = latencies[latencies.size() * 50 / 100];
    double p95 = latencies[latencies.size() * 95 / 100];
    double p99 = latencies[latencies.size() * 99 / 100];
    double rej_rate = (double)rejected / (double)total * 100.0;

    delete e;

    std::ostringstream j;
    j << "{\"algorithm\":\"" << (cfg.algorithm == TOKEN_BUCKET ? "TOKEN_BUCKET" : "SLIDING_WINDOW") << "\","
      << "\"totalRequests\":" << total << ","
      << "\"allowed\":" << allowed << ","
      << "\"rejected\":" << rejected << ","
      << "\"durationSec\":" << dur_sec << ","
      << "\"requestsPerSec\":" << rps << ","
      << "\"avgLatencyUs\":" << avg << ","
      << "\"p50LatencyUs\":" << p50 << ","
      << "\"p95LatencyUs\":" << p95 << ","
      << "\"p99LatencyUs\":" << p99 << ","
      << "\"rejectionRate\":" << rej_rate << "}";
    res.json(j.str());
}

// ===========================================================================
// HTTP Server (using CreateThread + Winsock)
// ===========================================================================

static SOCKET g_server_socket = INVALID_SOCKET;
static volatile LONG g_running = 0;

struct ClientData { SOCKET sock; };

static void dispatch(const HttpRequest& req, HttpResponse& res) {
    // OPTIONS (CORS pre-flight)
    if (req.method == "OPTIONS") {
        res.status_code = 204;
        return;
    }

    if (req.method == "GET"  && req.path == "/health")    { handle_health(req, res); return; }
    if (req.method == "GET"  && req.path == "/info")      { handle_info(req, res);   return; }
    if (req.method == "POST" && req.path == "/evaluate")  { handle_evaluate(req, res);  return; }
    if (req.method == "POST" && req.path == "/configure") { handle_configure(req, res); return; }
    if (req.method == "POST" && req.path == "/benchmark") { handle_benchmark(req, res); return; }
    if (req.method == "DELETE" && req.path == "/reset")   { handle_reset(req, res);    return; }

    res.json("{\"error\":\"Not found\"}", 404);
}

static DWORD WINAPI client_thread(LPVOID param) {
    ClientData* cd = (ClientData*)param;
    SOCKET sock = cd->sock;
    delete cd;

    char buf[65536];
    memset(buf, 0, sizeof(buf));
    int recv_len = recv(sock, buf, sizeof(buf) - 1, 0);

    if (recv_len > 0) {
        HttpRequest req = parse_http(buf, recv_len);
        HttpResponse res;
        dispatch(req, res);
        std::string raw = res.build();
        send(sock, raw.c_str(), (int)raw.size(), 0);
    }

    closesocket(sock);
    return 0;
}

// ===========================================================================
// Main
// ===========================================================================

int main(int argc, char* argv[]) {
    int port = 7070;
    if (argc > 1) port = atoi(argv[1]);

    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2,2), &wsa) != 0) {
        std::cerr << "WSAStartup failed\n";
        return 1;
    }

    std::cout << "=== RateGuard C++ Rate-Limiting Engine ===\n";
    std::cout << "Compiler: GCC " << __VERSION__ << "\n";
    std::cout << "Algorithms: Token Bucket, Sliding Window\n";
    std::cout << "Port: " << port << "\n";

    g_server_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (g_server_socket == INVALID_SOCKET) {
        std::cerr << "socket() failed\n";
        WSACleanup(); return 1;
    }

    int opt = 1;
    setsockopt(g_server_socket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));

    sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons((u_short)port);
    addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(g_server_socket, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "bind() failed: " << WSAGetLastError() << "\n";
        closesocket(g_server_socket); WSACleanup(); return 1;
    }

    if (listen(g_server_socket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "listen() failed\n";
        closesocket(g_server_socket); WSACleanup(); return 1;
    }

    InterlockedExchange(&g_running, 1);
    std::cout << "Listening on 0.0.0.0:" << port << " ...\n";

    while (InterlockedCompareExchange(&g_running, 1, 1) == 1) {
        SOCKET client = accept(g_server_socket, nullptr, nullptr);
        if (client == INVALID_SOCKET) break;
        ClientData* cd = new ClientData{client};
        HANDLE th = CreateThread(nullptr, 0, client_thread, cd, 0, nullptr);
        if (th) CloseHandle(th);
        else { delete cd; closesocket(client); }
    }

    closesocket(g_server_socket);
    WSACleanup();
    return 0;
}
