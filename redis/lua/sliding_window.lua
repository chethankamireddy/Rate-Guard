-- RateGuard Redis Lua Script: Atomic Sliding Window Rate Limiting
-- KEYS[1]: Window ZSET key (e.g., "ratelimit:sw:{apiKey}:{endpoint}")
-- ARGV[1]: Request limit
-- ARGV[2]: Window duration in seconds
-- ARGV[3]: Current timestamp in milliseconds
-- ARGV[4]: Unique request identifier / random salt

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_sec = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local request_id = ARGV[4] or tostring(now_ms)

local window_ms = window_sec * 1000
local threshold_ms = now_ms - window_ms

-- Step 1: Remove all requests older than the sliding window threshold
redis.call('ZREMRANGEBYSCORE', key, 0, threshold_ms)

-- Step 2: Get current request count in active sliding window
local current_count = redis.call('ZCARD', key)

local allowed = 0
local remaining = 0
local retry_after_sec = 0
local oldest_score = nil

if current_count < limit then
    -- Request is allowed: record timestamp in sorted set
    redis.call('ZADD', key, now_ms, request_id)
    allowed = 1
    remaining = limit - (current_count + 1)
    retry_after_sec = 0
else
    -- Limit reached: reject
    allowed = 0
    remaining = 0
    -- Query the oldest request timestamp in the active window
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest and #oldest >= 2 then
        oldest_score = tonumber(oldest[2])
        local elapsed_since_oldest_ms = now_ms - oldest_score
        local wait_ms = math.max(0, window_ms - elapsed_since_oldest_ms)
        retry_after_sec = math.max(1, math.ceil(wait_ms / 1000.0))
    else
        retry_after_sec = window_sec
    end
end

-- Refresh TTL so idle keys expire automatically
redis.call('EXPIRE', key, math.max(window_sec * 2, 60))

local now_epoch_sec = math.floor(now_ms / 1000)
local reset_epoch_sec = now_epoch_sec + (retry_after_sec > 0 and retry_after_sec or window_sec)

return { allowed, remaining, limit, reset_epoch_sec, retry_after_sec }
