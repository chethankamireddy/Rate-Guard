import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/services/storageService.js';
import { rateLimiter } from '../src/services/rateLimiterService.js';

describe('RateGuard Core Storage & Management', () => {
  beforeEach(() => {
    storage.seedInitialData();
  });

  it('should seed 5 API keys and 4 policies initially', () => {
    const keys = storage.listApiKeys();
    const policies = storage.listPolicies();
    expect(keys.length).toBe(5);
    expect(policies.length).toBe(4);
  });

  it('should hash API keys and never store raw keys', () => {
    const { apiKey, rawKey } = storage.createApiKey({ name: 'Integration Test Key' });
    expect(rawKey).toContain('rg_live_');
    expect(apiKey.keyHash).not.toBe(rawKey);
    expect(apiKey.keyHash.length).toBe(64); // SHA-256 is 64 hex characters

    // Lookup by hash should succeed
    const found = storage.getApiKeyByHash(apiKey.keyHash);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Integration Test Key');
  });

  it('should allow revoking an active API key', () => {
    const { apiKey } = storage.createApiKey({ name: 'Revoke Test Key' });
    expect(apiKey.status).toBe('ACTIVE');

    const revoked = storage.revokeApiKey(apiKey.id);
    expect(revoked?.status).toBe('REVOKED');

    const recheck = storage.getApiKeyById(apiKey.id);
    expect(recheck?.status).toBe('REVOKED');
  });

  it('should create and update a rate limit policy', () => {
    const policy = storage.createPolicy({
      name: 'Custom Burst Policy',
      algorithm: 'TOKEN_BUCKET',
      requestLimit: 150,
      windowDuration: 30,
      burstCapacity: 200,
    });
    expect(policy.name).toBe('Custom Burst Policy');
    expect(policy.requestLimit).toBe(150);
    expect(policy.burstCapacity).toBe(200);

    const updated = storage.updatePolicy(policy.id, { requestLimit: 250 });
    expect(updated?.requestLimit).toBe(250);
  });
});

describe('RateGuard Rate Limiter Engine & Middleware Semantics', () => {
  beforeEach(() => {
    storage.seedInitialData();
  });

  it('should allow requests under the limit for Token Bucket', async () => {
    const { apiKey } = storage.createApiKey({ name: 'TB Client' });
    const policy = storage.createPolicy({
      name: 'TB 5 Limit',
      algorithm: 'TOKEN_BUCKET',
      requestLimit: 5,
      windowDuration: 60,
      burstCapacity: 5,
    });
    storage.updateApiKey(apiKey.id, { policyId: policy.id });
    const fullKey = storage.getApiKeyById(apiKey.id)!;

    for (let i = 0; i < 5; i++) {
      const res = await rateLimiter.evaluateRequest({
        apiKey: fullKey,
        endpoint: '/api/demo/products',
        method: 'GET',
      });
      expect(res.allowed).toBe(true);
      expect(res.decision).toBe('ALLOWED');
    }
  });

  it('should reject requests when limit is exceeded and return HTTP 429 semantics', async () => {
    const { apiKey } = storage.createApiKey({ name: 'Throttled Client' });
    const policy = storage.createPolicy({
      name: 'Strict 2 Limit',
      algorithm: 'TOKEN_BUCKET',
      requestLimit: 2,
      windowDuration: 60,
      burstCapacity: 2,
    });
    storage.updateApiKey(apiKey.id, { policyId: policy.id });
    const fullKey = storage.getApiKeyById(apiKey.id)!;

    // First 2 allowed
    await rateLimiter.evaluateRequest({ apiKey: fullKey, endpoint: '/api/demo/checkout', method: 'POST' });
    await rateLimiter.evaluateRequest({ apiKey: fullKey, endpoint: '/api/demo/checkout', method: 'POST' });

    // 3rd should be rejected
    const throttled = await rateLimiter.evaluateRequest({
      apiKey: fullKey,
      endpoint: '/api/demo/checkout',
      method: 'POST',
    });

    expect(throttled.allowed).toBe(false);
    expect(throttled.decision).toBe('REJECTED');
    expect(throttled.remaining).toBe(0);
    expect(throttled.retryAfterSec).toBeGreaterThan(0);
    expect(throttled.resetEpochSec).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should correctly evaluate Sliding Window policies', async () => {
    const { apiKey } = storage.createApiKey({ name: 'SW Client' });
    const policy = storage.createPolicy({
      name: 'SW 3 Limit',
      algorithm: 'SLIDING_WINDOW',
      requestLimit: 3,
      windowDuration: 10,
    });
    storage.updateApiKey(apiKey.id, { policyId: policy.id });
    const fullKey = storage.getApiKeyById(apiKey.id)!;

    // Requests 1, 2, 3 allowed
    for (let i = 0; i < 3; i++) {
      const res = await rateLimiter.evaluateRequest({
        apiKey: fullKey,
        endpoint: '/api/demo/orders',
        method: 'GET',
      });
      expect(res.allowed).toBe(true);
      expect(res.algorithm).toBe('SLIDING_WINDOW');
    }

    // 4th rejected
    const rejected = await rateLimiter.evaluateRequest({
      apiKey: fullKey,
      endpoint: '/api/demo/orders',
      method: 'GET',
    });
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSec).toBeGreaterThan(0);
  });
});
