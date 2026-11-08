export type AlgorithmType = 'TOKEN_BUCKET' | 'SLIDING_WINDOW';
export type KeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type PolicyScope = 'API_KEY' | 'ENDPOINT' | 'GLOBAL';
export type PolicyStatus = 'ACTIVE' | 'INACTIVE';
export type RequestDecision = 'ALLOWED' | 'REJECTED';

export interface RateLimitPolicy {
  id: string;
  name: string;
  description?: string | null;
  algorithm: AlgorithmType;
  requestLimit: number;
  windowDuration: number;
  burstCapacity: number;
  scope: PolicyScope;
  status: PolicyStatus;
  createdAt: string;
  updatedAt: string;
  keyCount?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  userId: string;
  policyId?: string | null;
  status: KeyStatus;
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  policy?: RateLimitPolicy | null;
}

export interface RequestLog {
  id: string;
  apiKeyId?: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  decision: RequestDecision;
  latencyMs: number;
  algorithm: string;
  ipAddress?: string | null;
  timestamp: string;
  apiKey?: ApiKey | null;
}

export interface DashboardOverview {
  summary: {
    totalRequests: number;
    allowedRequests: number;
    rejectedRequests: number;
    hitRate: number;
    avgLatencyMs: number;
    activeApiKeys: number;
  };
  timeSeries: Array<{ time: string; total: number; allowed: number; rejected: number }>;
  donut: Array<{ name: string; value: number; color: string }>;
  topRateLimitedKeys: Array<{ keyId: string; keyName: string; total: number; rejected: number; hitRate: number }>;
  recentActivity: RequestLog[];
  systemHealth: {
    apiServer: string;
    redis: string;
    database: string;
    cppEngine: string;
    currentLatencyMs: number;
  };
}

export interface AnalyticsData {
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  hitRate: number;
  avgLatencyMs: number;
  timeSeries: Array<{ time: string; total: number; allowed: number; rejected: number }>;
  endpointDistribution: Array<{ endpoint: string; count: number; rejected: number }>;
  topKeys: Array<{ keyId: string; keyName: string; total: number; rejected: number; hitRate: number }>;
  latencyDistribution: Array<{ range: string; count: number }>;
  insights: Array<{ title: string; description: string; type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' }>;
}

export interface SystemSettings {
  general: {
    applicationName: string;
    environment: string;
    defaultAlgorithm: AlgorithmType;
    defaultLimit: number;
    defaultWindowDuration: number;
    port: number;
  };
  redis: {
    status: string;
    mode: string;
    urlMasked: string;
    keyExpirationTtlSec: number;
  };
  system: {
    backendHealth: string;
    cppEngineVersion: string;
    cppEngineStatus: string;
    databaseStatus: string;
    loggingLevel: string;
    retentionHours: number;
    serverUptimeSec: number;
    memoryUsageMb: number;
    systemLoad: number;
    totalApiKeys: number;
    totalPolicies: number;
  };
}
