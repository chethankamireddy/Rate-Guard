import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'rateguard-super-secret-jwt-key-2026',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rateguard?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  cppEngineUrl: process.env.CPP_ENGINE_URL || 'http://127.0.0.1:7070',
  rateLimiterMode: (process.env.RATE_LIMITER_MODE || 'AUTO') as 'CPP' | 'REDIS' | 'AUTO',
  defaultAlgorithm: (process.env.DEFAULT_ALGORITHM || 'TOKEN_BUCKET') as 'TOKEN_BUCKET' | 'SLIDING_WINDOW',
  defaultLimit: parseInt(process.env.DEFAULT_LIMIT || '100', 10),
  defaultWindowDuration: parseInt(process.env.DEFAULT_WINDOW_DURATION || '60', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
