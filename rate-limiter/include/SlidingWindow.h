#pragma once

#include "RateLimiter.h"
#include <unordered_map>
#include <deque>
#include <mutex>
#include <chrono>

namespace rateguard {

struct WindowState {
    uint64_t limit{100};
    uint64_t window_duration_sec{60};
    std::deque<std::chrono::steady_clock::time_point> timestamps;
    mutable std::mutex window_mutex;

    WindowState() : limit(100), window_duration_sec(60) {}
    WindowState(uint64_t req_limit, uint64_t window_sec)
        : limit(req_limit), window_duration_sec(window_sec) {}
};

class SlidingWindowRateLimiter : public IRateLimiter {
public:
    explicit SlidingWindowRateLimiter(RateLimitConfig default_config = RateLimitConfig());
    ~SlidingWindowRateLimiter() override = default;

    RateLimitResult evaluate(const std::string& key, uint64_t tokens_requested = 1) override;
    void set_config(const std::string& key, const RateLimitConfig& config) override;
    RateLimitConfig get_config(const std::string& key) const override;
    void reset(const std::string& key) override;
    std::string get_algorithm_name() const override { return "SLIDING_WINDOW"; }

private:
    RateLimitConfig default_config_;
    mutable std::mutex map_mutex_;   // single mutex (C++14 compatible)
    std::unordered_map<std::string, std::shared_ptr<WindowState>> windows_;

    std::shared_ptr<WindowState> get_or_create_window(const std::string& key);
};

} // namespace rateguard
