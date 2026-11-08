import { cppEngine } from './cppEngineClient.js';
import { redisLimiter } from './redisService.js';
import { storage } from './storageService.js';
import { config } from '../config/index.js';
import { RateLimitEvaluationResult, RateLimitPolicy, ApiKey } from '../types/index.js';

// Local in-memory fallback state in case both C++ Engine and Redis are unreachable
interface LocalBucket {
  tokens: number;
  lastRefillMs: number;
}
interface LocalWindow {
  timestamps: number[];
}

export class RateLimiterService {
  private localBuckets: Map<string, LocalBucket> = new Map();
  private localWindows: Map<string, LocalWindow> = new Map();

  public async evaluateRequest(params: {
    apiKey?: ApiKey | null;
    endpoint: string;
    method: string;
    ipAddress?: string;
  }): Promise<RateLimitEvaluationResult> {
    const policy = params.apiKey?.policy || {
      id: 'default',
      name: 'Default System Policy',
      algorithm: config.defaultAlgorithm,
      requestLimit: config.defaultLimit,
      windowDuration: config.defaultWindowDuration,
      burstCapacity: config.defaultLimit,
      scope: 'GLOBAL',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as RateLimitPolicy;

    const keyIdentifier = params.apiKey ? params.apiKey.id : (params.ipAddress || 'anonymous');
    const limiterKey = `${keyIdentifier}:${params.endpoint}`;

    let result: RateLimitEvaluationResult | null = null;

    // Mode Dispatch:
    // 1. Try Redis Distributed Mode if Redis is connected
    if (config.rateLimiterMode === 'REDIS' || (config.rateLimiterMode === 'AUTO' && redisLimiter.isRedisConnected())) {
      result = await redisLimiter.evaluate({
        apiKey: keyIdentifier,
        endpoint: params.endpoint,
        algorithm: policy.algorithm,
        limit: policy.requestLimit,
        windowDurationSec: policy.windowDuration,
        burstCapacity: policy.burstCapacity,
      });
    }

    // 2. Try C++ High-Performance Engine
    if (!result) {
      result = await cppEngine.evaluate({
        apiKey: keyIdentifier,
        endpoint: params.endpoint,
        algorithm: policy.algorithm,
        limit: policy.requestLimit,
        windowDurationSec: policy.windowDuration,
        burstCapacity: policy.burstCapacity,
      });
    }

    // 3. Resilient Local Engine Fallback
    if (!result) {
      result = this.evaluateLocalFallback(limiterKey, policy);
    }

    // Update API Key lastUsed
    if (params.apiKey) {
      storage.updateApiKeyLastUsed(params.apiKey.id);
    }

    return result;
  }

  private evaluateLocalFallback(limiterKey: string, policy: RateLimitPolicy): RateLimitEvaluationResult {
    const t0 = process.hrtime.bigint();
    const nowMs = Date.now();
    const limit = policy.requestLimit;
    const windowSec = policy.windowDuration;
    const burst = policy.burstCapacity || limit;

    let allowed = false;
    let remaining = 0;
    let retryAfterSec = 0;
    let resetEpochSec = Math.floor(nowMs / 1000) + windowSec;

    if (policy.algorithm === 'TOKEN_BUCKET') {
      let b = this.localBuckets.get(limiterKey);
      const refillRate = limit / windowSec; // tokens/sec

      if (!b) {
        b = { tokens: burst, lastRefillMs: nowMs };
      } else {
        const elapsedSec = Math.max(0, (nowMs - b.lastRefillMs) / 1000);
        b.tokens = Math.min(burst, b.tokens + elapsedSec * refillRate);
        b.lastRefillMs = nowMs;
      }

      if (b.tokens >= 1) {
        allowed = true;
        b.tokens -= 1;
        remaining = Math.floor(b.tokens);
        retryAfterSec = 0;
      } else {
        allowed = false;
        remaining = 0;
        const deficit = 1 - b.tokens;
        retryAfterSec = Math.max(1, Math.ceil(deficit / refillRate));
      }
      this.localBuckets.set(limiterKey, b);
      resetEpochSec = Math.floor(nowMs / 1000) + Math.ceil((burst - b.tokens) / refillRate);
    } else {
      // SLIDING_WINDOW
      let w = this.localWindows.get(limiterKey);
      const windowMs = windowSec * 1000;
      const threshold = nowMs - windowMs;

      if (!w) {
        w = { timestamps: [] };
      } else {
        w.timestamps = w.timestamps.filter(t => t > threshold);
      }

      if (w.timestamps.length < limit) {
        allowed = true;
        w.timestamps.push(nowMs);
        remaining = limit - w.timestamps.length;
        retryAfterSec = 0;
      } else {
        allowed = false;
        remaining = 0;
        const oldest = w.timestamps[0] || nowMs;
        const waitMs = Math.max(0, windowMs - (nowMs - oldest));
        retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
      }
      this.localWindows.set(limiterKey, w);
      resetEpochSec = Math.floor(nowMs / 1000) + (retryAfterSec > 0 ? retryAfterSec : windowSec);
    }

    const t1 = process.hrtime.bigint();
    const latencyUs = Number(t1 - t0) / 1000;

    return {
      allowed,
      decision: allowed ? 'ALLOWED' : 'REJECTED',
      remaining,
      limit,
      resetEpochSec,
      retryAfterSec,
      latencyUs,
      algorithm: policy.algorithm,
      reason: allowed ? 'Allowed by RateGuard engine' : 'Rate limit exceeded',
      engine: 'LOCAL_FALLBACK',
    };
  }
}

export const rateLimiter = new RateLimiterService();
