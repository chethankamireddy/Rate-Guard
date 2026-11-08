import { Request, Response } from 'express';
import os from 'os';
import { config } from '../config/index.js';
import { redisLimiter } from '../services/redisService.js';
import { cppEngine } from '../services/cppEngineClient.js';
import { storage } from '../services/storageService.js';

export const getSystemSettings = async (req: Request, res: Response) => {
  const isRedisUp = redisLimiter.isRedisConnected();
  const cppHealth = await cppEngine.checkHealth();

  res.json({
    success: true,
    data: {
      general: {
        applicationName: 'RateGuard Distributed Traffic Control',
        environment: config.nodeEnv,
        defaultAlgorithm: config.defaultAlgorithm,
        defaultLimit: config.defaultLimit,
        defaultWindowDuration: config.defaultWindowDuration,
        port: config.port,
      },
      redis: {
        status: isRedisUp ? 'CONNECTED' : 'DISCONNECTED',
        mode: isRedisUp ? 'DISTRIBUTED_CLUSTER' : 'LOCAL_EMULATOR',
        urlMasked: 'redis://***:6379',
        keyExpirationTtlSec: 120,
      },
      system: {
        backendHealth: 'HEALTHY',
        cppEngineVersion: cppHealth.status === 'healthy' ? 'v1.0.0 (MinGW C++14/C++17)' : 'Offline / Standalone',
        cppEngineStatus: cppHealth.status === 'healthy' ? 'CONNECTED' : 'DISCONNECTED',
        databaseStatus: 'HEALTHY (In-Memory Persistence + Prisma PostgreSQL)',
        loggingLevel: 'INFO',
        retentionHours: 48,
        serverUptimeSec: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        systemLoad: os.loadavg ? os.loadavg()[0] : 0.15,
        totalApiKeys: storage.listApiKeys().length,
        totalPolicies: storage.listPolicies().length,
      },
    },
  });
};

export const getSystemHealth = async (req: Request, res: Response) => {
  const isRedisUp = redisLimiter.isRedisConnected();
  const cppHealth = await cppEngine.checkHealth();
  const isCppUp = cppHealth.status === 'healthy';

  res.json({
    success: true,
    data: {
      status: 'HEALTHY',
      apiServer: 'HEALTHY',
      redis: isRedisUp ? 'HEALTHY' : 'DEGRADED',
      database: 'HEALTHY',
      cppEngine: isCppUp ? 'HEALTHY' : 'DEGRADED',
      uptimeSec: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      cppEngineUrl: 'http://127.0.0.1:7070',
      cppEngineVersion: isCppUp ? 'v1.0.0 (MinGW C++14/C++17)' : 'Offline',
    },
  });
};

export const updateSystemSettings = (req: Request, res: Response) => {
  const { defaultAlgorithm, defaultLimit, defaultWindowDuration } = req.body;
  if (defaultAlgorithm) config.defaultAlgorithm = defaultAlgorithm;
  if (defaultLimit) config.defaultLimit = parseInt(defaultLimit, 10);
  if (defaultWindowDuration) config.defaultWindowDuration = parseInt(defaultWindowDuration, 10);

  res.json({
    success: true,
    message: 'System settings updated successfully',
    data: {
      defaultAlgorithm: config.defaultAlgorithm,
      defaultLimit: config.defaultLimit,
      defaultWindowDuration: config.defaultWindowDuration,
    },
  });
};
