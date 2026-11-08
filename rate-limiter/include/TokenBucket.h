#pragma once

#include "RateLimiter.h"
#include <unordered_map>
#include <mutex>
#include <chrono>

namespace rateguard {

struct BucketState {
    double tokens{0.0};
    double capacity{100.0};
    double refill_rate_per_sec{1.0};
    std::chrono::steady_clock::time_point last_refill_time;
    uint64_t limit{100};
    uint64_t window_duration_sec{60};
    mutable std::mutex bucket_mutex;

    BucketState()
        : tokens(100.0), capacity(100.0), refill_rate_per_sec(100.0 / 60.0),
          last_refill_time(std::chrono::steady_clock::now()),
          limit(100), window_duration_sec(60) {}

    BucketState(uint64_t req_limit, uint64_t window_sec, uint64_t burst)
        : tokens(static_cast<double>(burst)),
          capacity(static_cast<double>(burst)),
          refill_rate_per_sec(static_cast<double>(req_limit) / static_cast<double>(window_sec > 0 ? window_sec : 1)),
          last_refill_time(std::chrono::steady_clock::now()),
          limit(req_limit), window_duration_sec(window_sec) {}
};

class TokenBucketRateLimiter : public IRateLimiter {
public:
    explicit TokenBucketRateLimiter(RateLimitConfig default_config = RateLimitConfig());
    ~TokenBucketRateLimiter() override = default;

    RateLimitResult evaluate(const std::string& key, uint64_t tokens_requested = 1) override;
    void set_config(const std::string& key, const RateLimitConfig& config) override;
    RateLimitConfig get_config(const std::string& key) const override;
    void reset(const std::string& key) override;
    std::string get_algorithm_name() const override { return "TOKEN_BUCKET"; }

private:
    RateLimitConfig default_config_;
    mutable std::mutex map_mutex_;   // single mutex (C++14 compatible)
    std::unordered_map<std::string, std::shared_ptr<BucketState>> buckets_;

    std::shared_ptr<BucketState> get_or_create_bucket(const std::string& key);
};

} // namespace rateguard
