export type AlgorithmType = 'TOKEN_BUCKET' | 'SLIDING_WINDOW';
export type PolicyScope = 'API_KEY' | 'ENDPOINT' | 'GLOBAL';
export type PolicyStatus = 'ACTIVE' | 'INACTIVE';
export type KeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type RequestDecision = 'ALLOWED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitPolicy {
  id: string;
  name: string;
  description?: string | null;
  algorithm: AlgorithmType;
  requestLimit: number;
  windowDuration: number; // in seconds
  burstCapacity: number;
  scope: PolicyScope;
  status: PolicyStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    apiKeys: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  userId: string;
  policyId?: string | null;
  status: KeyStatus;
  createdAt: Date;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
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
  timestamp: Date;
  apiKey?: ApiKey | null;
}

export interface RateLimitEvaluationResult {
  allowed: boolean;
  decision: RequestDecision;
  remaining: number;
  limit: number;
  resetEpochSec: number;
  retryAfterSec: number;
  latencyUs: number;
  algorithm: string;
  reason?: string;
  engine: 'CPP_MICROSERVICE' | 'REDIS_DISTRIBUTED' | 'LOCAL_FALLBACK';
}
