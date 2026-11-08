-- RateGuard Redis Lua Script: Atomic Token Bucket Rate Limiting
-- KEYS[1]: Bucket key (e.g., "ratelimit:tb:{apiKey}:{endpoint}")
-- ARGV[1]: Request limit (tokens per window)
-- ARGV[2]: Window duration in seconds
-- ARGV[3]: Burst capacity (maximum tokens bucket can hold)
-- ARGV[4]: Current timestamp in milliseconds
-- ARGV[5]: Tokens requested (typically 1)

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_sec = tonumber(ARGV[2])
local burst_capacity = tonumber(ARGV[3])
local now_ms = tonumber(ARGV[4])
local requested = tonumber(ARGV[5]) or 1

if burst_capacity == nil or burst_capacity <= 0 then
    burst_capacity = limit
end

local refill_rate_per_sec = limit / window_sec
local refill_rate_per_ms = refill_rate_per_sec / 1000.0

-- Fetch current state from Redis Hash
local current_data = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens = tonumber(current_data[1])
local last_refill_ms = tonumber(current_data[2])

if tokens == nil or last_refill_ms == nil then
    -- First request for this key: initialize to burst capacity
    tokens = burst_capacity
    last_refill_ms = now_ms
else
    -- Calculate elapsed time and replenish tokens
    local elapsed_ms = math.max(0, now_ms - last_refill_ms)
    tokens = math.min(burst_capacity, tokens + (elapsed_ms * refill_rate_per_ms))
    last_refill_ms = now_ms
end

local allowed = 0
local remaining = 0
local retry_after_sec = 0

if tokens >= requested then
    allowed = 1
    tokens = tokens - requested
    remaining = math.floor(tokens)
    retry_after_sec = 0
else
    allowed = 0
    remaining = math.floor(math.max(0, tokens))
    local deficit = requested - tokens
    retry_after_sec = math.ceil(deficit / refill_rate_per_sec)
end

-- Save updated state
redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', last_refill_ms)

-- Set TTL to 2x window duration to auto-expire unused state
redis.call('EXPIRE', key, math.max(window_sec * 2, 60))

local reset_epoch_sec = math.floor(now_ms / 1000) + math.ceil((burst_capacity - tokens) / refill_rate_per_sec)

return { allowed, remaining, limit, reset_epoch_sec, retry_after_sec }
