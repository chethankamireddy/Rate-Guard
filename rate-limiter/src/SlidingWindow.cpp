#include "SlidingWindow.h"
#include <algorithm>
#include <cmath>

namespace rateguard {

SlidingWindowRateLimiter::SlidingWindowRateLimiter(RateLimitConfig default_config)
    : default_config_(default_config) {}

std::shared_ptr<WindowState> SlidingWindowRateLimiter::get_or_create_window(const std::string& key) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    auto it = windows_.find(key);
    if (it != windows_.end()) {
        return it->second;
    }
    auto win = std::make_shared<WindowState>(default_config_.limit, default_config_.window_duration_sec);
    windows_[key] = win;
    return win;
}

void SlidingWindowRateLimiter::set_config(const std::string& key, const RateLimitConfig& config) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    auto win = std::make_shared<WindowState>(config.limit, config.window_duration_sec);
    windows_[key] = win;
}

RateLimitConfig SlidingWindowRateLimiter::get_config(const std::string& key) const {
    std::lock_guard<std::mutex> lock(map_mutex_);
    auto it = windows_.find(key);
    if (it != windows_.end()) {
        const auto& w = *(it->second);
        RateLimitConfig cfg;
        cfg.algorithm = AlgorithmType::SLIDING_WINDOW;
        cfg.limit = w.limit;
        cfg.window_duration_sec = w.window_duration_sec;
        cfg.burst_capacity = w.limit;
        return cfg;
    }
    return default_config_;
}

void SlidingWindowRateLimiter::reset(const std::string& key) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    windows_.erase(key);
}

RateLimitResult SlidingWindowRateLimiter::evaluate(const std::string& key, uint64_t tokens_requested) {
    const auto start_time = std::chrono::steady_clock::now();
    auto window = get_or_create_window(key);

    std::lock_guard<std::mutex> lock(window->window_mutex);
    const auto now = std::chrono::steady_clock::now();
    const auto window_duration = std::chrono::seconds(static_cast<long long>(window->window_duration_sec));
    const auto threshold_time = now - window_duration;

    while (!window->timestamps.empty() && window->timestamps.front() <= threshold_time) {
        window->timestamps.pop_front();
    }

    RateLimitResult result;
    result.limit = window->limit;
    result.algorithm_name = "SLIDING_WINDOW";

    auto system_now = std::chrono::system_clock::now();
    auto epoch_sec = std::chrono::duration_cast<std::chrono::seconds>(system_now.time_since_epoch()).count();

    const size_t current_count = window->timestamps.size();

    if (current_count + tokens_requested <= window->limit) {
        for (uint64_t i = 0; i < tokens_requested; ++i) {
            window->timestamps.push_back(now);
        }
        result.decision = RateLimitDecision::ALLOWED;
        result.remaining = window->limit - (current_count + tokens_requested);
        result.retry_after_sec = 0;
        result.reason = "Request allowed within sliding time window";

        if (!window->timestamps.empty()) {
            auto oldest = window->timestamps.front();
            auto oldest_elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - oldest).count();
            int64_t remaining_window = static_cast<int64_t>(window->window_duration_sec) - oldest_elapsed;
            result.reset_epoch_sec = epoch_sec + std::max<int64_t>(0, remaining_window);
        } else {
            result.reset_epoch_sec = epoch_sec + window->window_duration_sec;
        }
    } else {
        result.decision = RateLimitDecision::REJECTED;
        result.remaining = window->limit >= current_count ? (window->limit - current_count) : 0;
        result.reason = "Sliding window request limit exceeded";

        if (!window->timestamps.empty()) {
            auto oldest = window->timestamps.front();
            auto time_since_oldest = std::chrono::duration<double>(now - oldest).count();
            double wait_needed = static_cast<double>(window->window_duration_sec) - time_since_oldest;
            result.retry_after_sec = static_cast<uint64_t>(std::max(1.0, std::ceil(wait_needed)));
            result.reset_epoch_sec = epoch_sec + result.retry_after_sec;
        } else {
            result.retry_after_sec = window->window_duration_sec;
            result.reset_epoch_sec = epoch_sec + window->window_duration_sec;
        }
    }

    const auto end_time = std::chrono::steady_clock::now();
    std::chrono::duration<double, std::micro> latency = end_time - start_time;
    result.latency_us = latency.count();

    return result;
}

} // namespace rateguard
