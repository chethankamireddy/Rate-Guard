import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { RateLimitEvaluationResult } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CppEngineClient {
  private baseUrl: string;
  private isAvailable: boolean = false;
  private lastHealthCheck: number = 0;
  private engineProcess: ChildProcess | null = null;

  constructor() {
    this.baseUrl = config.cppEngineUrl;
  }

  public async checkHealth(): Promise<{ status: string; service?: string; activeLimiters?: number }> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json() as any;
        this.isAvailable = true;
        this.lastHealthCheck = Date.now();
        return data;
      }
    } catch {
      this.isAvailable = false;
    }
    return { status: 'down' };
  }

  public async autoStartEngine(): Promise<boolean> {
    const health = await this.checkHealth();
    if (health.status === 'healthy') {
      console.log('[RateGuard] C++ Engine is already running and healthy at', this.baseUrl);
      return true;
    }

    // Attempt to locate and spawn the engine binary
    const candidateBinaries = [
      path.resolve(__dirname, '../../../rate-limiter/engine.exe'),
      path.resolve(__dirname, '../../../rate-limiter/engine'),
      path.resolve(process.cwd(), '../rate-limiter/engine.exe'),
      path.resolve(process.cwd(), 'rate-limiter/engine.exe'),
      path.resolve(process.cwd(), '../rate-limiter/engine'),
      path.resolve(process.cwd(), 'rate-limiter/engine'),
    ];

    let binaryPath: string | null = null;
    for (const b of candidateBinaries) {
      if (fs.existsSync(b)) {
        binaryPath = b;
        break;
      }
    }

    if (!binaryPath) {
      console.log('[RateGuard] C++ binary not found at default paths. Using local fallback rate limiter.');
      return false;
    }

    try {
      console.log(`[RateGuard] Automatically starting C++ engine: ${binaryPath} 7070`);
      this.engineProcess = spawn(binaryPath, ['7070'], {
        detached: false,
        stdio: 'ignore',
      });

      // Cleanup on exit
      process.on('exit', () => this.stopEngine());
      process.on('SIGINT', () => {
        this.stopEngine();
        process.exit();
      });
      process.on('SIGTERM', () => {
        this.stopEngine();
        process.exit();
      });

      // Wait 600ms and check health
      await new Promise((r) => setTimeout(r, 600));
      const postHealth = await this.checkHealth();
      if (postHealth.status === 'healthy') {
        console.log('[RateGuard] C++ Engine successfully spawned and active on port 7070!');
        this.isAvailable = true;
        return true;
      }
    } catch (err) {
      console.warn('[RateGuard] Could not automatically spawn C++ engine process:', err);
    }

    return false;
  }

  public stopEngine() {
    if (this.engineProcess) {
      try {
        this.engineProcess.kill();
      } catch {
        // Ignore kill errors
      }
      this.engineProcess = null;
    }
  }

  public async evaluate(params: {
    apiKey: string;
    endpoint: string;
    algorithm: 'TOKEN_BUCKET' | 'SLIDING_WINDOW';
    limit: number;
    windowDurationSec: number;
    burstCapacity?: number;
  }): Promise<RateLimitEvaluationResult | null> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${this.baseUrl}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: params.apiKey,
          endpoint: params.endpoint,
          algorithm: params.algorithm,
          limit: params.limit,
          window: params.windowDurationSec,
          burst: params.burstCapacity || params.limit,
        }),
        signal: controller.signal,
      });

      clearTimeout(id);
      const data = await res.json() as any;

      this.isAvailable = true;
      return {
        allowed: Boolean(data.allowed),
        decision: data.allowed ? 'ALLOWED' : 'REJECTED',
        remaining: Number(data.remaining ?? 0),
        limit: Number(data.limit ?? params.limit),
        resetEpochSec: Number(data.reset ?? Math.floor(Date.now() / 1000) + params.windowDurationSec),
        retryAfterSec: Number(data.retryAfter ?? 0),
        latencyUs: Number(data.latencyUs ?? 0),
        algorithm: data.algorithm || params.algorithm,
        reason: data.reason,
        engine: 'CPP_MICROSERVICE',
      };
    } catch {
      this.isAvailable = false;
      return null;
    }
  }

  public async runBenchmark(params: {
    algorithm: 'TOKEN_BUCKET' | 'SLIDING_WINDOW';
    limit: number;
    window: number;
    burst: number;
    requests: number;
  }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  }

  public isEngineAvailable(): boolean {
    return this.isAvailable;
  }
}

export const cppEngine = new CppEngineClient();
