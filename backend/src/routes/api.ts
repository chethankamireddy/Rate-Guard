import { Router } from 'express';
import {
  listApiKeys,
  getApiKeyDetails,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  assignPolicyToKey,
} from '../controllers/apiKeyController.js';
import {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from '../controllers/policyController.js';
import {
  getDashboardOverview,
  getDetailedAnalytics,
  getLiveTraffic,
} from '../controllers/analyticsController.js';
import {
  getDemoProducts,
  getDemoOrders,
  getDemoProfile,
  postDemoCheckout,
  resetDemoEnvironment,
} from '../controllers/demoController.js';
import { runBenchmark } from '../controllers/benchmarkController.js';
import { getSystemSettings, updateSystemSettings, getSystemHealth } from '../controllers/systemController.js';
import { rateguardMiddleware } from '../middleware/rateguardMiddleware.js';

const router = Router();

// --- API Key Management ---
router.get('/keys', listApiKeys);
router.post('/keys', createApiKey);
router.get('/keys/:id', getApiKeyDetails);
router.post('/keys/:id/revoke', revokeApiKey);
router.delete('/keys/:id', deleteApiKey);
router.put('/keys/:id/policy', assignPolicyToKey);

// --- Rate-Limit Policy Management ---
router.get('/policies', listPolicies);
router.post('/policies', createPolicy);
router.get('/policies/:id', getPolicy);
router.put('/policies/:id', updatePolicy);
router.delete('/policies/:id', deletePolicy);

// --- Analytics & Live Traffic ---
router.get('/analytics/overview', getDashboardOverview);
router.get('/analytics/detailed', getDetailedAnalytics);
router.get('/analytics/traffic', getLiveTraffic);
router.get('/traffic/live', getLiveTraffic);

// --- Benchmarks ---
router.post('/benchmarks/run', runBenchmark);

// --- Settings & System Health ---
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.get('/system/health', getSystemHealth);

// --- Demo Environment Reset ---
router.post('/demo/reset', resetDemoEnvironment);

// --- Sample Protected Demo Endpoints (Protected by RateGuard Middleware) ---
router.get('/demo/products', rateguardMiddleware, getDemoProducts);
router.get('/demo/orders', rateguardMiddleware, getDemoOrders);
router.get('/demo/profile', rateguardMiddleware, getDemoProfile);
router.post('/demo/checkout', rateguardMiddleware, postDemoCheckout);

export default router;
