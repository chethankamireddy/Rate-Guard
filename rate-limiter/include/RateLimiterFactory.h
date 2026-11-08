#pragma once

#include "RateLimiter.h"
#include "TokenBucket.h"
#include "SlidingWindow.h"
#include <memory>
#include <string>

namespace rateguard {

class RateLimiterFactory {
public:
    static std::unique_ptr<IRateLimiter> create(AlgorithmType type, const RateLimitConfig& config = RateLimitConfig()) {
        switch (type) {
            case AlgorithmType::TOKEN_BUCKET:
                return std::make_unique<TokenBucketRateLimiter>(config);
            case AlgorithmType::SLIDING_WINDOW:
                return std::make_unique<SlidingWindowRateLimiter>(config);
            default:
                return std::make_unique<TokenBucketRateLimiter>(config);
        }
    }

    static AlgorithmType parse_algorithm(const std::string& name) {
        if (name == "SLIDING_WINDOW" || name == "sliding_window" || name == "slidingWindow") {
            return AlgorithmType::SLIDING_WINDOW;
        }
        return AlgorithmType::TOKEN_BUCKET;
    }

    static std::string to_string(AlgorithmType type) {
        switch (type) {
            case AlgorithmType::SLIDING_WINDOW:
                return "SLIDING_WINDOW";
            case AlgorithmType::TOKEN_BUCKET:
            default:
                return "TOKEN_BUCKET";
        }
    }
};

} // namespace rateguard
