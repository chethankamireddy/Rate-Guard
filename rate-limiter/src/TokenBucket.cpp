#include "TokenBucket.h"
#include <algorithm>
#include <cmath>

namespace rateguard {

TokenBucketRateLimiter::TokenBucketRateLimiter(RateLimitConfig default_config)
    : default_config_(default_config) {
    if (default_config_.burst_capacity == 0) {
        default_config_.burst_capacity = default_config_.limit;
    }
}

std::shared_ptr<BucketState> TokenBucketRateLimiter::get_or_create_bucket(const std::string& key) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    auto it = buckets_.find(key);
    if (it != buckets_.end()) {
        return it->second;
    }
    uint64_t burst = default_config_.burst_capacity > 0 ? default_config_.burst_capacity : default_config_.limit;
    auto bucket = std::make_shared<BucketState>(default_config_.limit, default_config_.window_duration_sec, burst);
    buckets_[key] = bucket;
    return bucket;
}

void TokenBucketRateLimiter::set_config(const std::string& key, const RateLimitConfig& config) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    uint64_t burst = config.burst_capacity > 0 ? config.burst_capacity : config.limit;
    auto bucket = std::make_shared<BucketState>(config.limit, config.window_duration_sec, burst);
    buckets_[key] = bucket;
}

RateLimitConfig TokenBucketRateLimiter::get_config(const std::string& key) const {
    std::lock_guard<std::mutex> lock(map_mutex_);
    auto it = buckets_.find(key);
    if (it != buckets_.end()) {
        const auto& b = *(it->second);
        RateLimitConfig cfg;
        cfg.algorithm = AlgorithmType::TOKEN_BUCKET;
        cfg.limit = b.limit;
        cfg.window_duration_sec = b.window_duration_sec;
        cfg.burst_capacity = static_cast<uint64_t>(b.capacity);
        return cfg;
    }
    return default_config_;
}

void TokenBucketRateLimiter::reset(const std::string& key) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    buckets_.erase(key);
}

RateLimitResult TokenBucketRateLimiter::evaluate(const std::string& key, uint64_t tokens_requested) {
    const auto start_time = std::chrono::steady_clock::now();
    auto bucket = get_or_create_bucket(key);

    std::lock_guard<std::mutex> lock(bucket->bucket_mutex);
    const auto now = std::chrono::steady_clock::now();

    std::chrono::duration<double> elapsed = now - bucket->last_refill_time;
    bucket->last_refill_time = now;

    double added_tokens = elapsed.count() * bucket->refill_rate_per_sec;
    bucket->tokens = std::min(bucket->capacity, bucket->tokens + added_tokens);

    RateLimitResult result;
    result.limit = bucket->limit;
    result.algorithm_name = "TOKEN_BUCKET";

    auto system_now = std::chrono::system_clock::now();
    auto epoch_sec = std::chrono::duration_cast<std::chrono::seconds>(system_now.time_since_epoch()).count();

    double tokens_needed_for_full = std::max(0.0, bucket->capacity - bucket->tokens);
    double seconds_to_full = bucket->refill_rate_per_sec > 0.0 ? (tokens_needed_for_full / bucket->refill_rate_per_sec) : 0.0;
    result.reset_epoch_sec = epoch_sec + static_cast<int64_t>(std::ceil(seconds_to_full));

    const double requested = static_cast<double>(tokens_requested);

    if (bucket->tokens >= requested) {
        bucket->tokens -= requested;
        result.decision = RateLimitDecision::ALLOWED;
        result.remaining = static_cast<uint64_t>(std::floor(bucket->tokens));
        result.retry_after_sec = 0;
        result.reason = "Request allowed within token capacity";
    } else {
        result.decision = RateLimitDecision::REJECTED;
        result.remaining = static_cast<uint64_t>(std::floor(std::max(0.0, bucket->tokens)));
        double deficit = requested - bucket->tokens;
        double wait_sec = bucket->refill_rate_per_sec > 0.0 ? (deficit / bucket->refill_rate_per_sec) : 1.0;
        result.retry_after_sec = static_cast<uint64_t>(std::ceil(wait_sec));
        result.reason = "Token bucket empty - rate limit exceeded";
    }

    const auto end_time = std::chrono::steady_clock::now();
    std::chrono::duration<double, std::micro> latency = end_time - start_time;
    result.latency_us = latency.count();

    return result;
}

} // namespace rateguard
