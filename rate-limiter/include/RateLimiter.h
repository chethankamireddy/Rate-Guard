#pragma once

#include <string>
#include <chrono>
#include <cstdint>

namespace rateguard {

enum class AlgorithmType {
    TOKEN_BUCKET,
    SLIDING_WINDOW
};

enum class RateLimitDecision {
    ALLOWED,
    REJECTED
};

struct RateLimitConfig {
    AlgorithmType algorithm{AlgorithmType::TOKEN_BUCKET};
    uint64_t limit{100};              // Max tokens or max requests
    uint64_t window_duration_sec{60}; // Window duration in seconds
    uint64_t burst_capacity{100};     // Burst capacity for Token Bucket
};

struct RateLimitResult {
    RateLimitDecision decision{RateLimitDecision::ALLOWED};
    uint64_t remaining{0};
    uint64_t limit{0};
    int64_t reset_epoch_sec{0};
    uint64_t retry_after_sec{0};
    double latency_us{0.0};
    std::string algorithm_name;
    std::string reason;

    bool is_allowed() const { return decision == RateLimitDecision::ALLOWED; }
};

class IRateLimiter {
public:
    virtual ~IRateLimiter() = default;

    // Evaluates a request for a specific key (e.g., API key or endpoint:key)
    virtual RateLimitResult evaluate(const std::string& key, uint64_t tokens_requested = 1) = 0;

    // Updates or configures the policy for a given key
    virtual void set_config(const std::string& key, const RateLimitConfig& config) = 0;

    // Retrieves current config
    virtual RateLimitConfig get_config(const std::string& key) const = 0;

    // Resets limiter state for a given key
    virtual void reset(const std::string& key) = 0;

    // Returns the algorithm name
    virtual std::string get_algorithm_name() const = 0;
};

} // namespace rateguard
