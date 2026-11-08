import crypto from 'crypto';
import { ApiKey, RateLimitPolicy, RequestLog, User, KeyStatus, AlgorithmType, PolicyScope, PolicyStatus } from '../types/index.js';

export class StorageService {
  private users: Map<string, User> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private policies: Map<string, RateLimitPolicy> = new Map();
  private requestLogs: RequestLog[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.seedInitialData();
  }

  public hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  public generateApiKey(prefix: string = 'rg_live'): { rawKey: string; keyPrefix: string; keyHash: string } {
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `${prefix}_${randomHex}`;
    const keyPrefix = `${prefix}_${randomHex.substring(0, 6)}...${randomHex.substring(randomHex.length - 4)}`;
    const keyHash = this.hashApiKey(rawKey);
    return { rawKey, keyPrefix, keyHash };
  }

  public seedInitialData() {
    this.users.clear();
    this.apiKeys.clear();
    this.policies.clear();
    this.requestLogs = [];

    // 1. Admin User
    const adminUser: User = {
      id: 'usr_admin_default',
      name: 'System Administrator',
      email: 'admin@rateguard.io',
      passwordHash: '$2a$10$wT2829y8uNl8wR6lD/tGze6ZtL4tO3/qO30W1K084a9vR4wE4l/Vq', // "admin123"
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // 2. Initial Rate Limit Policies
    const policiesList: RateLimitPolicy[] = [
      {
        id: 'pol_standard_tier',
        name: 'Standard Tier Policy',
        description: 'Default Token Bucket rate limit for standard consumer APIs (100 req / min with 120 burst)',
        algorithm: 'TOKEN_BUCKET',
        requestLimit: 100,
        windowDuration: 60,
        burstCapacity: 120,
        scope: 'API_KEY',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'pol_high_burst',
        name: 'High Burst Ingestion Policy',
        description: 'Token Bucket tuned for sudden high-volume telemetry surges (500 req / min, 750 burst capacity)',
        algorithm: 'TOKEN_BUCKET',
        requestLimit: 500,
        windowDuration: 60,
        burstCapacity: 750,
        scope: 'API_KEY',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'pol_sliding_window_strict',
        name: 'Strict Payment & Checkout Window',
        description: 'Sliding Window policy preventing fraud & double-spends on checkout endpoints (30 req / 60s)',
        algorithm: 'SLIDING_WINDOW',
        requestLimit: 30,
        windowDuration: 60,
        burstCapacity: 30,
        scope: 'ENDPOINT',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'pol_sliding_window_relaxed',
        name: 'Read-Only Catalog Sliding Window',
        description: 'Moving time-window policy for public catalog endpoints with smooth distribution (200 req / 60s)',
        algorithm: 'SLIDING_WINDOW',
        requestLimit: 200,
        windowDuration: 60,
        burstCapacity: 200,
        scope: 'GLOBAL',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
        updatedAt: new Date(),
      },
    ];

    for (const pol of policiesList) {
      this.policies.set(pol.id, pol);
    }

    // 3. Initial 5 API Keys
    const keysData = [
      {
        id: 'key_prod_ecommerce',
        name: 'Production E-Commerce Web App',
        rawKey: 'rg_live_ecom9941a27488bc110f01c89012345678ab',
        policyId: 'pol_standard_tier',
        status: 'ACTIVE' as KeyStatus,
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      },
      {
        id: 'key_mobile_ios',
        name: 'Mobile App Client (iOS/Android)',
        rawKey: 'rg_live_mobl12847291048102381203912093812038',
        policyId: 'pol_standard_tier',
        status: 'ACTIVE' as KeyStatus,
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      },
      {
        id: 'key_payment_gateway',
        name: 'Payment Service Worker',
        rawKey: 'rg_live_paym77218391823901823901283019283019',
        policyId: 'pol_sliding_window_strict',
        status: 'ACTIVE' as KeyStatus,
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      },
      {
        id: 'key_partner_analytics',
        name: 'Partner Analytics Ingestion Pipeline',
        rawKey: 'rg_live_part55019283019283019283019283019283',
        policyId: 'pol_high_burst',
        status: 'ACTIVE' as KeyStatus,
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
      {
        id: 'key_legacy_service',
        name: 'Deprecated Legacy Reporting Webhook',
        rawKey: 'rg_live_revo99999999999999999999999999999999',
        policyId: 'pol_sliding_window_relaxed',
        status: 'REVOKED' as KeyStatus,
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
      },
    ];

    for (const k of keysData) {
      const keyPrefix = `${k.rawKey.substring(0, 15)}...${k.rawKey.substring(k.rawKey.length - 4)}`;
      const keyHash = this.hashApiKey(k.rawKey);
      this.apiKeys.set(k.id, {
        id: k.id,
        name: k.name,
        keyPrefix,
        keyHash,
        userId: adminUser.id,
        policyId: k.policyId,
        status: k.status,
        createdAt: k.createdAt,
        expiresAt: null,
        lastUsedAt: new Date(Date.now() - Math.floor(Math.random() * 3600 * 1000)),
        policy: this.policies.get(k.policyId) || null,
      });
    }

    // 4. Seed realistic sample logs across the last 2 hours
    const endpoints = [
      { path: '/api/demo/products', method: 'GET' },
      { path: '/api/demo/orders', method: 'GET' },
      { path: '/api/demo/profile', method: 'GET' },
      { path: '/api/demo/checkout', method: 'POST' },
    ];

    const activeKeyList = Array.from(this.apiKeys.values()).filter(k => k.status === 'ACTIVE');
    const now = Date.now();

    for (let i = 0; i < 240; i++) {
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const k = activeKeyList[Math.floor(Math.random() * activeKeyList.length)];
      const isRejected = Math.random() < 0.12; // ~12% realistic rejection rate
      const logTime = new Date(now - (240 - i) * 30 * 1000 + Math.floor(Math.random() * 10000));
      const pol = k.policyId ? this.policies.get(k.policyId) : null;
      const algo = pol ? pol.algorithm : 'TOKEN_BUCKET';

      this.requestLogs.push({
        id: `log_seed_${i}`,
        apiKeyId: k.id,
        endpoint: ep.path,
        method: ep.method,
        statusCode: isRejected ? 429 : (ep.method === 'POST' ? 201 : 200),
        decision: isRejected ? 'REJECTED' : 'ALLOWED',
        latencyMs: Math.round((Math.random() * 1.8 + 0.4) * 100) / 100,
        algorithm: algo,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 250) + 1}`,
        timestamp: logTime,
        apiKey: k,
      });
    }

    this.isInitialized = true;
    console.log('[StorageService] In-memory storage initialized with 5 API Keys, 4 Policies, and 240 Activity Logs.');
  }

  // --- API Key Methods ---
  public listApiKeys(): ApiKey[] {
    return Array.from(this.apiKeys.values()).map(k => ({
      ...k,
      policy: k.policyId ? this.policies.get(k.policyId) || null : null,
    }));
  }

  public getApiKeyById(id: string): ApiKey | null {
    const key = this.apiKeys.get(id);
    if (!key) return null;
    return {
      ...key,
      policy: key.policyId ? this.policies.get(key.policyId) || null : null,
    };
  }

  public getApiKeyByHash(hash: string): ApiKey | null {
    for (const key of this.apiKeys.values()) {
      if (key.keyHash === hash) {
        return {
          ...key,
          policy: key.policyId ? this.policies.get(key.policyId) || null : null,
        };
      }
    }
    return null;
  }

  public createApiKey(params: {
    name: string;
    userId?: string;
    policyId?: string;
    expiresAt?: Date | null;
  }): { apiKey: ApiKey; rawKey: string } {
    const { rawKey, keyPrefix, keyHash } = this.generateApiKey();
    const id = `key_${crypto.randomBytes(8).toString('hex')}`;
    const newKey: ApiKey = {
      id,
      name: params.name,
      keyPrefix,
      keyHash,
      userId: params.userId || 'usr_admin_default',
      policyId: params.policyId || null,
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt: params.expiresAt || null,
      lastUsedAt: null,
      policy: params.policyId ? this.policies.get(params.policyId) || null : null,
    };
    this.apiKeys.set(id, newKey);
    return { apiKey: newKey, rawKey };
  }

  public revokeApiKey(id: string): ApiKey | null {
    const key = this.apiKeys.get(id);
    if (!key) return null;
    key.status = 'REVOKED';
    this.apiKeys.set(id, key);
    return key;
  }

  public updateApiKey(id: string, updates: Partial<ApiKey>): ApiKey | null {
    const key = this.apiKeys.get(id);
    if (!key) return null;
    const updated = { ...key, ...updates };
    this.apiKeys.set(id, updated);
    return updated;
  }

  public deleteApiKey(id: string): boolean {
    return this.apiKeys.delete(id);
  }

  public updateApiKeyLastUsed(id: string) {
    const key = this.apiKeys.get(id);
    if (key) {
      key.lastUsedAt = new Date();
      this.apiKeys.set(id, key);
    }
  }

  // --- Policy Methods ---
  public listPolicies(): (RateLimitPolicy & { keyCount: number })[] {
    return Array.from(this.policies.values()).map(pol => {
      const keyCount = Array.from(this.apiKeys.values()).filter(k => k.policyId === pol.id).length;
      return { ...pol, keyCount };
    });
  }

  public getPolicyById(id: string): RateLimitPolicy | null {
    return this.policies.get(id) || null;
  }

  public createPolicy(params: {
    name: string;
    description?: string;
    algorithm: AlgorithmType;
    requestLimit: number;
    windowDuration: number;
    burstCapacity?: number;
    scope?: PolicyScope;
    status?: PolicyStatus;
  }): RateLimitPolicy {
    const id = `pol_${crypto.randomBytes(6).toString('hex')}`;
    const pol: RateLimitPolicy = {
      id,
      name: params.name,
      description: params.description || null,
      algorithm: params.algorithm,
      requestLimit: params.requestLimit,
      windowDuration: params.windowDuration,
      burstCapacity: params.burstCapacity || params.requestLimit,
      scope: params.scope || 'API_KEY',
      status: params.status || 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.policies.set(id, pol);
    return pol;
  }

  public updatePolicy(id: string, updates: Partial<RateLimitPolicy>): RateLimitPolicy | null {
    const pol = this.policies.get(id);
    if (!pol) return null;
    const updated: RateLimitPolicy = {
      ...pol,
      ...updates,
      updatedAt: new Date(),
    };
    this.policies.set(id, updated);
    return updated;
  }

  public deletePolicy(id: string): boolean {
    return this.policies.delete(id);
  }

  // --- Request Log Methods ---
  public addRequestLog(log: Omit<RequestLog, 'id' | 'timestamp'> & { timestamp?: Date }): RequestLog {
    const newLog: RequestLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date(),
      apiKey: log.apiKeyId ? this.apiKeys.get(log.apiKeyId) || null : null,
    };
    this.requestLogs.push(newLog);

    // Keep max 5000 in-memory logs
    if (this.requestLogs.length > 5000) {
      this.requestLogs.splice(0, this.requestLogs.length - 5000);
    }
    return newLog;
  }

  public getRecentLogs(limit: number = 50, filters?: {
    apiKeyId?: string;
    endpoint?: string;
    decision?: string;
    status?: string;
  }): RequestLog[] {
    let result = [...this.requestLogs].reverse();
    if (filters) {
      if (filters.apiKeyId) {
        result = result.filter(l => l.apiKeyId === filters.apiKeyId);
      }
      if (filters.endpoint) {
        result = result.filter(l => l.endpoint.toLowerCase().includes(filters.endpoint!.toLowerCase()));
      }
      if (filters.decision) {
        result = result.filter(l => l.decision === filters.decision);
      }
    }
    return result.slice(0, limit);
  }

  // --- Analytics & Aggregates ---
  public getAnalytics(timeRange: string = '1h'): {
    totalRequests: number;
    allowedRequests: number;
    rejectedRequests: number;
    hitRate: number;
    avgLatencyMs: number;
    timeSeries: Array<{ time: string; total: number; allowed: number; rejected: number }>;
    endpointDistribution: Array<{ endpoint: string; count: number; rejected: number }>;
    topKeys: Array<{ keyId: string; keyName: string; total: number; rejected: number; hitRate: number }>;
    latencyDistribution: Array<{ range: string; count: number }>;
  } {
    const now = Date.now();
    let durationMs = 3600 * 1000;
    let bucketIntervalMs = 60 * 1000; // 1 min

    switch (timeRange) {
      case '5m':
        durationMs = 5 * 60 * 1000;
        bucketIntervalMs = 15 * 1000;
        break;
      case '15m':
        durationMs = 15 * 60 * 1000;
        bucketIntervalMs = 30 * 1000;
        break;
      case '1h':
        durationMs = 60 * 60 * 1000;
        bucketIntervalMs = 2 * 60 * 1000;
        break;
      case '24h':
        durationMs = 24 * 3600 * 1000;
        bucketIntervalMs = 30 * 60 * 1000;
        break;
      case '7d':
        durationMs = 7 * 24 * 3600 * 1000;
        bucketIntervalMs = 4 * 3600 * 1000;
        break;
    }

    const cutoff = new Date(now - durationMs);
    const logs = this.requestLogs.filter(l => l.timestamp >= cutoff);

    const totalRequests = logs.length;
    const allowedRequests = logs.filter(l => l.decision === 'ALLOWED').length;
    const rejectedRequests = logs.filter(l => l.decision === 'REJECTED').length;
    const hitRate = totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0;
    const avgLatencyMs = totalRequests > 0
      ? Math.round((logs.reduce((acc, l) => acc + l.latencyMs, 0) / totalRequests) * 100) / 100
      : 0;

    // Time-series grouping
    const buckets: Map<number, { total: number; allowed: number; rejected: number }> = new Map();
    const startBucket = Math.floor((now - durationMs) / bucketIntervalMs) * bucketIntervalMs;

    for (let t = startBucket; t <= now; t += bucketIntervalMs) {
      buckets.set(t, { total: 0, allowed: 0, rejected: 0 });
    }

    for (const log of logs) {
      const bKey = Math.floor(log.timestamp.getTime() / bucketIntervalMs) * bucketIntervalMs;
      const b = buckets.get(bKey);
      if (b) {
        b.total++;
        if (log.decision === 'ALLOWED') b.allowed++;
        else b.rejected++;
      }
    }

    const timeSeries = Array.from(buckets.entries()).map(([ts, counts]) => {
      const d = new Date(ts);
      const timeStr = timeRange === '24h' || timeRange === '7d'
        ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:00`
        : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return {
        time: timeStr,
        total: counts.total,
        allowed: counts.allowed,
        rejected: counts.rejected,
      };
    });

    // Endpoint distribution
    const epMap: Map<string, { count: number; rejected: number }> = new Map();
    for (const log of logs) {
      const cur = epMap.get(log.endpoint) || { count: 0, rejected: 0 };
      cur.count++;
      if (log.decision === 'REJECTED') cur.rejected++;
      epMap.set(log.endpoint, cur);
    }
    const endpointDistribution = Array.from(epMap.entries()).map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      rejected: data.rejected,
    }));

    // Top API Keys
    const keyMap: Map<string, { total: number; rejected: number }> = new Map();
    for (const log of logs) {
      if (log.apiKeyId) {
        const cur = keyMap.get(log.apiKeyId) || { total: 0, rejected: 0 };
        cur.total++;
        if (log.decision === 'REJECTED') cur.rejected++;
        keyMap.set(log.apiKeyId, cur);
      }
    }
    const topKeys = Array.from(keyMap.entries())
      .map(([keyId, data]) => {
        const k = this.apiKeys.get(keyId);
        return {
          keyId,
          keyName: k ? k.name : 'Unknown Key',
          total: data.total,
          rejected: data.rejected,
          hitRate: data.total > 0 ? Math.round((data.rejected / data.total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.rejected - a.rejected)
      .slice(0, 5);

    // Latency Distribution (<1ms, 1-2ms, 2-5ms, 5-10ms, >10ms)
    const latRanges = [
      { range: '< 1ms', count: 0 },
      { range: '1-2ms', count: 0 },
      { range: '2-5ms', count: 0 },
      { range: '5-10ms', count: 0 },
      { range: '> 10ms', count: 0 },
    ];
    for (const l of logs) {
      if (l.latencyMs < 1) latRanges[0].count++;
      else if (l.latencyMs < 2) latRanges[1].count++;
      else if (l.latencyMs < 5) latRanges[2].count++;
      else if (l.latencyMs < 10) latRanges[3].count++;
      else latRanges[4].count++;
    }

    return {
      totalRequests,
      allowedRequests,
      rejectedRequests,
      hitRate: Math.round(hitRate * 10) / 10,
      avgLatencyMs,
      timeSeries,
      endpointDistribution,
      topKeys,
      latencyDistribution: latRanges,
    };
  }
}

export const storage = new StorageService();
