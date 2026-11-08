// RateGuard C++ Rate-Limiting Engine — HTTP Microservice
// Architecture note: runs as a standalone HTTP service on port 7070.
// The Node.js backend calls POST /evaluate per request for rate-limit decisions.
//
// WHY A SEPARATE HTTP SERVICE (not a native Node.js addon)?
//   - Native addons (node-gyp / N-API) require MSVC or a matching ABI for
//     the exact Node.js version. The system has MinGW GCC 6.3 which is ABI-
//     incompatible with Node 22's N-API expectations.
//   - A separate HTTP microservice avoids all ABI coupling, is trivially
//     Dockerisable, independently scalable, and separately testable.
//   - Loopback HTTP overhead is <0.5 ms in practice, negligible vs real-world
//     API latency.

#include <winsock2.h>
#include <windows.h>
#include <iostream>
#include <string>
#include <unordered_map>
#include <memory>
#include <cstdlib>
#include <sstream>
#include <chrono>
#include <vector>
#include <algorithm>

#include "RateLimiter.h"
#include "TokenBucket.h"
#include "SlidingWindow.h"
#include "RateLimiterFactory.h"
#include "HttpServer.h"
#include "JsonBuilder.h"

using namespace rateguard;

// ---- Global limiter registry (CRITICAL_SECTION — MinGW/GCC 6 compatible) ---

struct LimiterEntry {
    std::unique_ptr<IRateLimiter> limiter;
    RateLimitConfig config;
};

struct Registry {
    std::unordered_map<std::string, LimiterEntry> entries;
    CRITICAL_SECTION cs;

    Registry()  { InitializeCriticalSection(&cs); }
    ~Registry() { DeleteCriticalSection(&cs); }

    void lock()   { EnterCriticalSection(&cs); }
    void unlock() { LeaveCriticalSection(&cs); }
} g_registry;

// ---- Helpers ----------------------------------------------------------------

static std::string registry_key(const std::string& api_key, const std::string& endpoint) {
    return api_key + "::" + endpoint;
}

static IRateLimiter& get_or_create_limiter(const std::string& reg_key, const RateLimitConfig& cfg) {
    g_registry.lock();
    auto it = g_registry.entries.find(reg_key);
    if (it != g_registry.entries.end()) {
        auto& ref = *(it->second.limiter);
        g_registry.unlock();
        return ref;
    }
    LimiterEntry entry;
    entry.config = cfg;
    entry.limiter = RateLimiterFactory::create(cfg.algorithm, cfg);
    auto& ref = *(entry.limiter);
    g_registry.entries[reg_key] = std::move(entry);
    g_registry.unlock();
    return ref;
}

// Very minimal JSON value extractor for flat {"key": value} bodies
static std::string json_get(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\"";
    auto pos = body.find(search);
    if (pos == std::string::npos) return "";
    pos = body.find(':', pos + search.size());
    if (pos == std::string::npos) return "";
    ++pos;
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) ++pos;
    if (pos >= body.size()) return "";
    if (body[pos] == '"') {
        ++pos;
        auto end = body.find('"', pos);
        if (end == std::string::npos) return "";
        return body.substr(pos, end - pos);
    }
    auto end = pos;
    while (end < body.size() && body[end] != ',' && body[end] != '}' && body[end] != ']' && body[end] != '\n') ++end;
    std::string val = body.substr(pos, end - pos);
    while (!val.empty() && (val.back() == ' ' || val.back() == '\n' || val.back() == '\r')) val.pop_back();
    return val;
}

// ---- Route handlers ---------------------------------------------------------

// POST /evaluate
static void handle_evaluate(const http::Request& req, http::Response& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    std::string algo_str = json_get(req.body, "algorithm");
    std::string limit_s  = json_get(req.body, "limit");
    std::string window_s = json_get(req.body, "window");
    std::string burst_s  = json_get(req.body, "burst");

    if (api_key.empty()) api_key = "default";
    if (endpoint.empty()) endpoint = "/";
    if (algo_str.empty()) algo_str = "TOKEN_BUCKET";

    RateLimitConfig cfg;
    cfg.algorithm          = RateLimiterFactory::parse_algorithm(algo_str);
    cfg.limit              = limit_s.empty()  ? 100 : (uint64_t)std::stoull(limit_s);
    cfg.window_duration_sec= window_s.empty() ? 60  : (uint64_t)std::stoull(window_s);
    cfg.burst_capacity     = burst_s.empty()  ? cfg.limit : (uint64_t)std::stoull(burst_s);

    std::string reg_key = registry_key(api_key, endpoint);
    auto& limiter = get_or_create_limiter(reg_key, cfg);
    RateLimitResult result = limiter.evaluate(reg_key);

    json::Object obj;
    obj.add_bool("allowed",     result.is_allowed());
    obj.add_str ("decision",    result.is_allowed() ? "ALLOWED" : "REJECTED");
    obj.add_num ("remaining",   result.remaining);
    obj.add_num ("limit",       result.limit);
    obj.add_num ("reset",       result.reset_epoch_sec);
    obj.add_num ("retryAfter",  result.retry_after_sec);
    obj.add_num ("latencyUs",   result.latency_us);
    obj.add_str ("algorithm",   result.algorithm_name);
    obj.add_str ("reason",      result.reason);

    res.set_json(obj.build(), result.is_allowed() ? 200 : 429);
}

// POST /configure
static void handle_configure(const http::Request& req, http::Response& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    std::string algo_str = json_get(req.body, "algorithm");
    std::string limit_s  = json_get(req.body, "limit");
    std::string window_s = json_get(req.body, "window");
    std::string burst_s  = json_get(req.body, "burst");

    if (api_key.empty()) { res.set_json("{\"error\":\"api_key required\"}", 400); return; }
    if (endpoint.empty()) endpoint = "/";
    if (algo_str.empty()) algo_str = "TOKEN_BUCKET";

    RateLimitConfig cfg;
    cfg.algorithm          = RateLimiterFactory::parse_algorithm(algo_str);
    cfg.limit              = limit_s.empty()  ? 100 : (uint64_t)std::stoull(limit_s);
    cfg.window_duration_sec= window_s.empty() ? 60  : (uint64_t)std::stoull(window_s);
    cfg.burst_capacity     = burst_s.empty()  ? cfg.limit : (uint64_t)std::stoull(burst_s);

    std::string reg_key = registry_key(api_key, endpoint);
    g_registry.lock();
    LimiterEntry entry;
    entry.config = cfg;
    entry.limiter = RateLimiterFactory::create(cfg.algorithm, cfg);
    g_registry.entries[reg_key] = std::move(entry);
    g_registry.unlock();

    res.set_json("{\"status\":\"configured\",\"ok\":true}");
}

// DELETE /reset
static void handle_reset(const http::Request& req, http::Response& res) {
    std::string api_key  = json_get(req.body, "api_key");
    std::string endpoint = json_get(req.body, "endpoint");
    if (endpoint.empty()) endpoint = "/";
    std::string reg_key = registry_key(api_key, endpoint);
    g_registry.lock();
    g_registry.entries.erase(reg_key);
    g_registry.unlock();
    res.set_json("{\"status\":\"reset\",\"ok\":true}");
}

// GET /health
static void handle_health(const http::Request&, http::Response& res) {
    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    g_registry.lock();
    size_t active = g_registry.entries.size();
    g_registry.unlock();

    json::Object obj;
    obj.add_str("status",         "healthy");
    obj.add_str("service",        "rateguard-cpp-engine");
    obj.add_str("version",        "1.0.0");
    obj.add_num("activeLimiters", (uint64_t)active);
    obj.add_num("uptimeMs",       (uint64_t)now_ms);
    res.set_json(obj.build());
}

// GET /info
static void handle_info(const http::Request&, http::Response& res) {
    json::Object obj;
    obj.add_str("service",     "rateguard-cpp-engine");
    obj.add_str("version",     "1.0.0");
    obj.add_str("compiler",    "GCC " __VERSION__);
    obj.add_str("algorithms",  "TOKEN_BUCKET,SLIDING_WINDOW");
    obj.add_str("mode",        "LOCAL");
    obj.add_str("description", "C++ rate-limiting engine HTTP microservice");
    res.set_json(obj.build());
}

// POST /benchmark
static void handle_benchmark(const http::Request& req, http::Response& res) {
    std::string algo_str  = json_get(req.body, "algorithm");
    std::string limit_s   = json_get(req.body, "limit");
    std::string window_s  = json_get(req.body, "window");
    std::string burst_s   = json_get(req.body, "burst");
    std::string req_s     = json_get(req.body, "requests");

    if (algo_str.empty()) algo_str = "TOKEN_BUCKET";

    RateLimitConfig cfg;
    cfg.algorithm          = RateLimiterFactory::parse_algorithm(algo_str);
    cfg.limit              = limit_s.empty()  ? 100   : (uint64_t)std::stoull(limit_s);
    cfg.window_duration_sec= window_s.empty() ? 60    : (uint64_t)std::stoull(window_s);
    cfg.burst_capacity     = burst_s.empty()  ? cfg.limit : (uint64_t)std::stoull(burst_s);
    uint64_t total_requests= req_s.empty()    ? 1000  : (uint64_t)std::stoull(req_s);
    if (total_requests > 100000) total_requests = 100000;

    auto limiter = RateLimiterFactory::create(cfg.algorithm, cfg);
    std::string bench_key = "benchmark::test";
    limiter->set_config(bench_key, cfg);

    uint64_t allowed = 0, rejected = 0;
    double total_latency = 0.0;
    std::vector<double> latencies;
    latencies.reserve((size_t)total_requests);

    auto t_start = std::chrono::high_resolution_clock::now();
    for (uint64_t i = 0; i < total_requests; ++i) {
        auto r = limiter->evaluate(bench_key);
        if (r.is_allowed()) ++allowed; else ++rejected;
        total_latency += r.latency_us;
        latencies.push_back(r.latency_us);
    }
    auto t_end = std::chrono::high_resolution_clock::now();
    double duration_sec = std::chrono::duration<double>(t_end - t_start).count();
    double rps = total_requests / (duration_sec > 0.0 ? duration_sec : 1.0);
    double avg_latency = total_latency / (double)total_requests;

    std::sort(latencies.begin(), latencies.end());
    double p50 = latencies[latencies.size() * 50 / 100];
    double p95 = latencies[latencies.size() * 95 / 100];
    double p99 = latencies[latencies.size() * 99 / 100];
    double rejection_rate = (double)rejected / (double)total_requests * 100.0;

    json::Object obj;
    obj.add_str("algorithm",       algo_str);
    obj.add_num("totalRequests",   total_requests);
    obj.add_num("allowed",         allowed);
    obj.add_num("rejected",        rejected);
    obj.add_num("durationSec",     duration_sec);
    obj.add_num("requestsPerSec",  rps);
    obj.add_num("avgLatencyUs",    avg_latency);
    obj.add_num("p50LatencyUs",    p50);
    obj.add_num("p95LatencyUs",    p95);
    obj.add_num("p99LatencyUs",    p99);
    obj.add_num("rejectionRate",   rejection_rate);
    res.set_json(obj.build());
}

// ---- Main -------------------------------------------------------------------

int main(int argc, char* argv[]) {
    int port = 7070;
    if (argc > 1) port = std::atoi(argv[1]);

    std::cout << "=== RateGuard C++ Rate-Limiting Engine ===" << std::endl;
    std::cout << "Compiler: GCC " << __VERSION__ << std::endl;
    std::cout << "Algorithms: Token Bucket, Sliding Window" << std::endl;
    std::cout << "Starting HTTP server on port " << port << "..." << std::endl;

    http::Server server;

    server.post("/evaluate",   handle_evaluate);
    server.post("/configure",  handle_configure);
    server.del ("/reset",      handle_reset);
    server.get ("/health",     handle_health);
    server.get ("/info",       handle_info);
    server.post("/benchmark",  handle_benchmark);

    // CORS pre-flight
    auto cors_handler = [](const http::Request&, http::Response& r) {
        r.set_json("", 204);
    };
    server.options("/evaluate",  cors_handler);
    server.options("/configure", cors_handler);
    server.options("/benchmark", cors_handler);
    server.options("/reset",     cors_handler);

    if (!server.listen(port)) {
        std::cerr << "[ERROR] Failed to start server on port " << port << std::endl;
        return 1;
    }

    return 0;
}
