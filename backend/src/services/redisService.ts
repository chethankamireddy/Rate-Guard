import { Redis } from 'ioredis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { RateLimitEvaluationResult } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RedisRateLimiterService {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private tokenBucketScriptSha: string | null = null;
  private slidingWindowScriptSha: string | null = null;
  private tokenBucketLua: string = '';
  private slidingWindowLua: string = '';

  constructor() {
    this.loadLuaScripts();
    this.initRedis();
  }

  private loadLuaScripts() {
    try {
      const candidatePaths = [
        path.resolve(__dirname, '../../../redis/lua'),
        path.resolve(process.cwd(), '../redis/lua'),
        path.resolve(process.cwd(), 'redis/lua'),
      ];

      for (const p of candidatePaths) {
        const tbPath = path.join(p, 'token_bucket.lua');
        const swPath = path.join(p, 'sliding_window.lua');
        if (fs.existsSync(tbPath) && fs.existsSync(swPath)) {
          this.tokenBucketLua = fs.readFileSync(tbPath, 'utf8');
          this.slidingWindowLua = fs.readFileSync(swPath, 'utf8');
          break;
        }
      }
    } catch (err) {
      console.warn('[RedisRateLimiterService] Warning: Could not pre-load Lua script files from disk:', err);
    }
  }

  private initRedis() {
    try {
      this.redis = new Redis(config.redisUrl, {
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('[RateGuard] Connected to Redis at', config.redisUrl);
      });

      this.redis.on('error', () => {
        this.isConnected = false;
      });

      // Attempt async connection without blocking boot
      this.redis.connect().catch(() => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.redis?.status === 'ready';
  }

  public async evaluate(params: {
    apiKey: string;
    endpoint: string;
    algorithm: 'TOKEN_BUCKET' | 'SLIDING_WINDOW';
    limit: number;
    windowDurationSec: number;
    burstCapacity?: number;
  }): Promise<RateLimitEvaluationResult | null> {
    if (!this.isRedisConnected() || !this.redis) {
      return null;
    }

    const t0 = process.hrtime.bigint();
    const nowMs = Date.now();
    const burst = params.burstCapacity || params.limit;

    try {
      if (params.algorithm === 'TOKEN_BUCKET') {
        const key = `ratelimit:tb:${params.apiKey}:${params.endpoint}`;
        // eval Lua script
        const result = await this.redis.eval(
          this.tokenBucketLua,
          1,
          key,
          params.limit.toString(),
          params.windowDurationSec.toString(),
          burst.toString(),
          nowMs.toString(),
          '1'
        ) as [number, number, number, number, number];

        const t1 = process.hrtime.bigint();
        const latencyUs = Number(t1 - t0) / 1000;

        const allowed = result[0] === 1;
        return {
          allowed,
          decision: allowed ? 'ALLOWED' : 'REJECTED',
          remaining: Number(result[1]),
          limit: Number(result[2]),
          resetEpochSec: Number(result[3]),
          retryAfterSec: Number(result[4]),
          latencyUs,
          algorithm: 'TOKEN_BUCKET',
          reason: allowed ? 'Allowed by Redis distributed token bucket' : 'Rejected: Redis token bucket capacity exhausted',
          engine: 'REDIS_DISTRIBUTED',
        };
      } else {
        const key = `ratelimit:sw:${params.apiKey}:${params.endpoint}`;
        const requestId = `${nowMs}-${Math.random().toString(36).substring(2, 9)}`;

        const result = await this.redis.eval(
          this.slidingWindowLua,
          1,
          key,
          params.limit.toString(),
          params.windowDurationSec.toString(),
          nowMs.toString(),
          requestId
        ) as [number, number, number, number, number];

        const t1 = process.hrtime.bigint();
        const latencyUs = Number(t1 - t0) / 1000;

        const allowed = result[0] === 1;
        return {
          allowed,
          decision: allowed ? 'ALLOWED' : 'REJECTED',
          remaining: Number(result[1]),
          limit: Number(result[2]),
          resetEpochSec: Number(result[3]),
          retryAfterSec: Number(result[4]),
          latencyUs,
          algorithm: 'SLIDING_WINDOW',
          reason: allowed ? 'Allowed by Redis distributed sliding window' : 'Rejected: Redis sliding window limit reached',
          engine: 'REDIS_DISTRIBUTED',
        };
      }
    } catch (err) {
      console.error('[RedisRateLimiterService] Evaluation error:', err);
      return null;
    }
  }
}

export const redisLimiter = new RedisRateLimiterService();
