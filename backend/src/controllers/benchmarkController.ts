import { Request, Response } from 'express';
import { cppEngine } from '../services/cppEngineClient.js';
import { rateLimiter } from '../services/rateLimiterService.js';

export const runBenchmark = async (req: Request, res: Response) => {
  const {
    algorithm = 'TOKEN_BUCKET',
    limit = 100,
    window = 60,
    burst = 100,
    requests = 1000,
    concurrency = 10,
  } = req.body;

  const totalRequests = Math.min(Math.max(parseInt(requests, 10) || 1000, 100), 50000);
  const reqLimit = parseInt(limit, 10) || 100;
  const winSec = parseInt(window, 10) || 60;
  const burstCap = parseInt(burst, 10) || reqLimit;
  const algo = algorithm === 'SLIDING_WINDOW' ? 'SLIDING_WINDOW' : 'TOKEN_BUCKET';

  // 1. If C++ engine is available, run direct native C++ benchmark
  if (cppEngine.isEngineAvailable()) {
    try {
      const cppResult = await cppEngine.runBenchmark({
        algorithm: algo,
        limit: reqLimit,
        window: winSec,
        burst: burstCap,
        requests: totalRequests,
      });
      return res.json({
        success: true,
        source: 'C++ Native Engine (port 7070)',
        data: cppResult,
      });
    } catch {
      // Fall through to JS benchmark runner
    }
  }

  // 2. High-performance benchmark runner
  const latencies: number[] = [];
  let allowed = 0;
  let rejected = 0;

  const tStart = process.hrtime.bigint();

  for (let i = 0; i < totalRequests; i++) {
    const t0 = process.hrtime.bigint();
    const result = await rateLimiter.evaluateRequest({
      endpoint: '/benchmark/test',
      method: 'GET',
      ipAddress: `bench_client_${i % Math.max(1, parseInt(concurrency, 10))}`,
    });
    const t1 = process.hrtime.bigint();
    const latUs = Number(t1 - t0) / 1000;

    latencies.push(latUs);
    if (result.allowed) allowed++;
    else rejected++;
  }

  const tEnd = process.hrtime.bigint();
  const durationSec = Number(tEnd - tStart) / 1e9;
  const requestsPerSec = Math.round(totalRequests / (durationSec || 0.001));

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avgLatencyUs = Math.round((sum / totalRequests) * 100) / 100;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const rejectionRate = Math.round((rejected / totalRequests) * 1000) / 10;

  res.json({
    success: true,
    source: 'RateGuard Backend Engine',
    data: {
      algorithm: algo,
      totalRequests,
      allowed,
      rejected,
      durationSec: Math.round(durationSec * 1000) / 1000,
      requestsPerSec,
      avgLatencyUs,
      p50LatencyUs: p50,
      p95LatencyUs: p95,
      p99LatencyUs: p99,
      rejectionRate,
    },
  });
};
