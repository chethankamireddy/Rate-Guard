import { ApiKey, RateLimitPolicy, DashboardOverview, AnalyticsData, RequestLog, SystemSettings } from '../types';

const API_BASE = '/api';

export const api = {
  // Dashboard & Analytics
  getOverview: async (timeRange: string = '1h'): Promise<DashboardOverview> => {
    const res = await fetch(`${API_BASE}/analytics/overview?timeRange=${timeRange}`);
    const json = await res.json();
    return json.data;
  },

  getAnalytics: async (timeRange: string = '1h'): Promise<AnalyticsData> => {
    const res = await fetch(`${API_BASE}/analytics/detailed?timeRange=${timeRange}`);
    const json = await res.json();
    return json.data;
  },

  getLiveTraffic: async (limit: number = 50, filters: Record<string, string> = {}): Promise<RequestLog[]> => {
    const query = new URLSearchParams({ limit: limit.toString(), ...filters }).toString();
    const res = await fetch(`${API_BASE}/traffic/live?${query}`);
    const json = await res.json();
    return json.data;
  },

  // API Keys
  listApiKeys: async (): Promise<ApiKey[]> => {
    const res = await fetch(`${API_BASE}/keys`);
    const json = await res.json();
    return json.data;
  },

  createApiKey: async (data: { name: string; policyId?: string; expiresAt?: string }): Promise<{ apiKey: ApiKey; rawKey: string }> => {
    const res = await fetch(`${API_BASE}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create API key');
    return { apiKey: json.data, rawKey: json.rawKey };
  },

  getApiKeyDetails: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/keys/${id}`);
    const json = await res.json();
    return json.data;
  },

  revokeApiKey: async (id: string): Promise<ApiKey> => {
    const res = await fetch(`${API_BASE}/keys/${id}/revoke`, { method: 'POST' });
    const json = await res.json();
    return json.data;
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/keys/${id}`, { method: 'DELETE' });
  },

  assignPolicyToKey: async (id: string, policyId: string): Promise<ApiKey> => {
    const res = await fetch(`${API_BASE}/keys/${id}/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId }),
    });
    const json = await res.json();
    return json.data;
  },

  // Policies
  listPolicies: async (): Promise<RateLimitPolicy[]> => {
    const res = await fetch(`${API_BASE}/policies`);
    const json = await res.json();
    return json.data;
  },

  createPolicy: async (data: Partial<RateLimitPolicy>): Promise<RateLimitPolicy> => {
    const res = await fetch(`${API_BASE}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create policy');
    return json.data;
  },

  updatePolicy: async (id: string, data: Partial<RateLimitPolicy>): Promise<RateLimitPolicy> => {
    const res = await fetch(`${API_BASE}/policies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },

  deletePolicy: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/policies/${id}`, { method: 'DELETE' });
  },

  // Benchmarks
  runBenchmark: async (params: {
    algorithm: string;
    limit: number;
    window: number;
    burst: number;
    requests: number;
    concurrency: number;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE}/benchmarks/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    return json.data;
  },

  // Settings & System
  getSettings: async (): Promise<SystemSettings> => {
    const res = await fetch(`${API_BASE}/settings`);
    const json = await res.json();
    return json.data;
  },

  updateSettings: async (settings: Partial<SystemSettings['general']>): Promise<void> => {
    await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  resetDemo: async (): Promise<string> => {
    const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
    const json = await res.json();
    return json.message;
  },

  // Playground Direct Invocation
  sendTestRequest: async (params: {
    method: string;
    path: string;
    apiKey?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{
    status: number;
    timeMs: number;
    headers: Record<string, string>;
    body: any;
    rateLimitHeaders: {
      limit: string | null;
      remaining: string | null;
      reset: string | null;
      retryAfter: string | null;
      engine: string | null;
      algorithm: string | null;
    };
  }> => {
    const t0 = performance.now();
    const reqHeaders: Record<string, string> = {
      ...(params.headers || {}),
    };

    if (params.apiKey) {
      reqHeaders['x-api-key'] = params.apiKey;
    }
    if (params.method === 'POST') {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(params.path, {
      method: params.method,
      headers: reqHeaders,
      body: params.method === 'POST' ? (params.body || '{}') : undefined,
    });
    const t1 = performance.now();

    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    let respBody: any = null;
    try {
      respBody = await res.json();
    } catch {
      respBody = { text: 'Non-JSON response' };
    }

    return {
      status: res.status,
      timeMs: Math.round((t1 - t0) * 10) / 10,
      headers: respHeaders,
      body: respBody,
      rateLimitHeaders: {
        limit: res.headers.get('x-ratelimit-limit'),
        remaining: res.headers.get('x-ratelimit-remaining'),
        reset: res.headers.get('x-ratelimit-reset'),
        retryAfter: res.headers.get('retry-after'),
        engine: res.headers.get('x-ratelimit-engine'),
        algorithm: res.headers.get('x-ratelimit-algorithm'),
      },
    };
  },
};
