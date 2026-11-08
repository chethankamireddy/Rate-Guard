import { Request, Response, NextFunction } from 'express';
import { storage } from '../services/storageService.js';
import { rateLimiter } from '../services/rateLimiterService.js';
import { trafficStream } from '../websocket/trafficStream.js';
import { ApiKey } from '../types/index.js';

export const rateguardMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const tStart = process.hrtime.bigint();

  // 1. Extract API Key from 'x-api-key' or 'Authorization: Bearer <key>'
  let rawKey = req.header('x-api-key') || req.header('X-API-Key');
  if (!rawKey) {
    const authHeader = req.header('authorization') || req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.substring(7).trim();
    }
  }

  let apiKey: ApiKey | null = null;
  if (rawKey) {
    const keyHash = storage.hashApiKey(rawKey);
    apiKey = storage.getApiKeyByHash(keyHash);

    // Also support direct ID reference (used by playground and test runners)
    if (!apiKey) {
      apiKey = storage.getApiKeyById(rawKey) || storage.getApiKeyById(rawKey.replace(/^rg_live_/, ''));
    }

    // If key is present but revoked or expired, reject with 401/403
    if (apiKey && apiKey.status === 'REVOKED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This API key has been revoked by an administrator.',
        status: 'REVOKED',
      });
    }

    if (apiKey && apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This API key has expired.',
        status: 'EXPIRED',
      });
    }
  }

  const endpoint = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

  // 2. Evaluate rate limit
  const evaluation = await rateLimiter.evaluateRequest({
    apiKey,
    endpoint,
    method: req.method,
    ipAddress,
  });

  const tEnd = process.hrtime.bigint();
  const latencyMs = Number(tEnd - tStart) / 1000000;

  // 3. Inject Rate Limit Headers
  res.setHeader('X-RateLimit-Limit', evaluation.limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, evaluation.remaining).toString());
  res.setHeader('X-RateLimit-Reset', evaluation.resetEpochSec.toString());
  res.setHeader('X-RateLimit-Engine', evaluation.engine);
  res.setHeader('X-RateLimit-Algorithm', evaluation.algorithm);

  if (!evaluation.allowed) {
    res.setHeader('Retry-After', evaluation.retryAfterSec.toString());
  }

  // 4. Asynchronously log request and broadcast to live traffic WebSocket
  const logEntry = storage.addRequestLog({
    apiKeyId: apiKey ? apiKey.id : null,
    endpoint,
    method: req.method,
    statusCode: evaluation.allowed ? 200 : 429,
    decision: evaluation.decision,
    latencyMs: Math.round(latencyMs * 100) / 100,
    algorithm: evaluation.algorithm,
    ipAddress,
  });

  trafficStream.broadcastRequest(logEntry);

  // 5. Allow or Reject
  if (!evaluation.allowed) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please throttle your requests.',
      algorithm: evaluation.algorithm,
      limit: evaluation.limit,
      remaining: 0,
      reset: evaluation.resetEpochSec,
      retryAfter: evaluation.retryAfterSec,
      engine: evaluation.engine,
    });
  }

  next();
};
