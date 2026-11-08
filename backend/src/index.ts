import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import apiRouter from './routes/api.js';
import { trafficStream } from './websocket/trafficStream.js';
import { cppEngine } from './services/cppEngineClient.js';
import { redisLimiter } from './services/redisService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'X-RateLimit-Engine', 'X-RateLimit-Algorithm'],
}));

app.use(express.json());

// Global request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/ws') && !req.path.includes('.')) {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const isRedisUp = redisLimiter.isRedisConnected();
  const cppHealth = await cppEngine.checkHealth();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      apiServer: 'UP',
      redisDistributed: isRedisUp ? 'CONNECTED' : 'STANDALONE_FALLBACK',
      cppRateLimiterEngine: cppHealth.status === 'healthy' ? 'CONNECTED' : 'LOCAL_FALLBACK',
    },
  });
});

// Mount RateGuard API routes
app.use('/api', apiRouter);

// Serve Frontend Static Build if available
const candidateDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
];

let frontendDist: string | null = null;
for (const p of candidateDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    frontendDist = p;
    break;
  }
}

if (frontendDist) {
  console.log(`[RateGuard] Serving unified frontend dashboard from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist!, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[RateGuard Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Initialize WebSocket Traffic Stream on the same HTTP server
trafficStream.init(server);

// Start Server
const PORT = config.port;
server.listen(PORT, async () => {
  console.log(`
=============================================================
  RateGuard Distributed Traffic Control Platform (Unified)
  Dashboard & API: http://localhost:${PORT}
  WebSocket stream: ws://localhost:${PORT}/ws/traffic
=============================================================
  `);

  // Automatically start and connect C++ engine
  await cppEngine.autoStartEngine();
});

export { app, server };
