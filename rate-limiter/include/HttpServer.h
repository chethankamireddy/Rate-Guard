#pragma once
// Minimal single-header HTTP server for the C++ rate-limiter service
// Uses Winsock2 + Windows CreateThread — MinGW/GCC 6.3 compatible

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <string>
#include <functional>
#include <unordered_map>
#include <sstream>
#include <atomic>
#include <iostream>
#include <vector>
#include <algorithm>
#include <cstdlib>

namespace http {

struct Request {
    std::string method;
    std::string path;
    std::unordered_map<std::string, std::string> headers;
    std::string body;
    std::unordered_map<std::string, std::string> query_params;
};

struct Response {
    int status_code{200};
    std::string status_text{"OK"};
    std::unordered_map<std::string, std::string> headers;
    std::string body;

    void set_json(const std::string& json_body, int code = 200) {
        status_code = code;
        switch (code) {
            case 204: status_text = "No Content"; break;
            case 400: status_text = "Bad Request"; break;
            case 404: status_text = "Not Found"; break;
            case 429: status_text = "Too Many Requests"; break;
            default:  status_text = "OK"; break;
        }
        headers["Content-Type"] = "application/json";
        headers["Access-Control-Allow-Origin"] = "*";
        headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key, Authorization";
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        body = json_body;
    }
};

using Handler = std::function<void(const Request&, Response&)>;

inline std::string parse_path(const std::string& raw) {
    auto q = raw.find('?');
    return q == std::string::npos ? raw : raw.substr(0, q);
}

inline std::unordered_map<std::string, std::string> parse_query(const std::string& raw) {
    std::unordered_map<std::string, std::string> params;
    auto q = raw.find('?');
    if (q == std::string::npos) return params;
    std::string query = raw.substr(q + 1);
    std::istringstream ss(query);
    std::string pair;
    while (std::getline(ss, pair, '&')) {
        auto eq = pair.find('=');
        if (eq != std::string::npos) {
            params[pair.substr(0, eq)] = pair.substr(eq + 1);
        }
    }
    return params;
}

// Per-thread data passed to Windows thread proc
struct ClientThreadData {
    SOCKET client;
    void* server_ptr;
};

class Server {
public:
    Server() : running_(0), server_socket_(INVALID_SOCKET) {
        WSADATA wsa;
        WSAStartup(MAKEWORD(2,2), &wsa);
    }

    ~Server() {
        stop();
        WSACleanup();
    }

    void get(const std::string& path, Handler h)     { routes_["GET"][path] = h; }
    void post(const std::string& path, Handler h)    { routes_["POST"][path] = h; }
    void put(const std::string& path, Handler h)     { routes_["PUT"][path] = h; }
    void del(const std::string& path, Handler h)     { routes_["DELETE"][path] = h; }
    void options(const std::string& path, Handler h) { routes_["OPTIONS"][path] = h; }

    bool listen(int port) {
        server_socket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (server_socket_ == INVALID_SOCKET) return false;

        int opt = 1;
        setsockopt(server_socket_, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));

        sockaddr_in addr;
        memset(&addr, 0, sizeof(addr));
        addr.sin_family = AF_INET;
        addr.sin_port = htons(static_cast<u_short>(port));
        addr.sin_addr.s_addr = INADDR_ANY;

        if (bind(server_socket_, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
            std::cerr << "bind failed: " << WSAGetLastError() << std::endl;
            return false;
        }
        if (::listen(server_socket_, SOMAXCONN) == SOCKET_ERROR) return false;

        InterlockedExchange(&running_, 1);
        std::cout << "[RateGuard C++ Engine] Listening on port " << port << std::endl;
        accept_loop();
        return true;
    }

    void stop() {
        InterlockedExchange(&running_, 0);
        if (server_socket_ != INVALID_SOCKET) {
            closesocket(server_socket_);
            server_socket_ = INVALID_SOCKET;
        }
    }

    // Public so the Windows thread proc can call it
    void handle_client(SOCKET client) {
        char buffer[65536];
        memset(buffer, 0, sizeof(buffer));
        int received = recv(client, buffer, sizeof(buffer) - 1, 0);
        if (received <= 0) { closesocket(client); return; }

        Request req = parse_request(std::string(buffer, received));
        Response res;

        bool handled = false;
        auto method_it = routes_.find(req.method);
        if (method_it != routes_.end()) {
            auto path_it = method_it->second.find(req.path);
            if (path_it != method_it->second.end()) {
                path_it->second(req, res);
                handled = true;
            }
        }

        if (!handled) {
            res.set_json("{\"error\":\"Not found\"}", 404);
        }

        send_response(client, res);
        closesocket(client);
    }

private:
    volatile LONG running_;
    SOCKET server_socket_;
    std::unordered_map<std::string, std::unordered_map<std::string, Handler>> routes_;

    static DWORD WINAPI thread_proc(LPVOID param) {
        ClientThreadData* data = reinterpret_cast<ClientThreadData*>(param);
        Server* srv = reinterpret_cast<Server*>(data->server_ptr);
        SOCKET client = data->client;
        delete data;
        srv->handle_client(client);
        return 0;
    }

    void accept_loop() {
        while (InterlockedCompareExchange(&running_, 1, 1) == 1) {
            SOCKET client = accept(server_socket_, nullptr, nullptr);
            if (client == INVALID_SOCKET) break;
            ClientThreadData* data = new ClientThreadData{client, this};
            HANDLE th = CreateThread(nullptr, 0, thread_proc, data, 0, nullptr);
            if (th) CloseHandle(th);
            else { delete data; closesocket(client); }
        }
    }

    void send_response(SOCKET client, const Response& res) {
        std::ostringstream oss;
        oss << "HTTP/1.1 " << res.status_code << " " << res.status_text << "\r\n";
        oss << "Content-Length: " << res.body.size() << "\r\n";
        for (auto& h : res.headers) {
            oss << h.first << ": " << h.second << "\r\n";
        }
        oss << "Connection: close\r\n\r\n" << res.body;
        std::string response_str = oss.str();
        send(client, response_str.c_str(), (int)response_str.size(), 0);
    }

    Request parse_request(const std::string& raw) {
        Request req;
        std::istringstream ss(raw);
        std::string line;
        if (std::getline(ss, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            std::istringstream rline(line);
            std::string raw_path;
            rline >> req.method >> raw_path;
            req.path = parse_path(raw_path);
            req.query_params = parse_query(raw_path);
        }
        while (std::getline(ss, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.empty()) break;
            auto colon = line.find(':');
            if (colon != std::string::npos) {
                std::string hname = line.substr(0, colon);
                std::string hval  = line.size() > colon + 2 ? line.substr(colon + 2) : "";
                req.headers[hname] = hval;
            }
        }
        std::string body_line;
        while (std::getline(ss, body_line)) {
            req.body += body_line + "\n";
        }
        return req;
    }
};

} // namespace http
