import { Request, Response } from 'express';
import { storage } from '../services/storageService.js';

export const getDemoProducts = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'prod_901', name: 'High-Throughput API Gateway Node', price: 299.00, inStock: true, tier: 'Enterprise' },
      { id: 'prod_902', name: 'Distributed Redis Sharding Cluster', price: 499.00, inStock: true, tier: 'Scale' },
      { id: 'prod_903', name: 'Dedicated Envoy Proxy Sidecar', price: 149.00, inStock: true, tier: 'Standard' },
      { id: 'prod_904', name: 'Wasm Rate Limiting Filter Plugin', price: 79.00, inStock: true, tier: 'Developer' },
      { id: 'prod_905', name: 'Real-Time Telemetry & eBPF Monitor', price: 349.00, inStock: false, tier: 'Enterprise' },
    ],
    timestamp: new Date().toISOString(),
  });
};

export const getDemoOrders = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { orderId: 'ord_1001', customer: 'Acme Corp', status: 'COMPLETED', total: 1290.00, items: 3, createdAt: '2026-11-08T10:15:00Z' },
      { orderId: 'ord_1002', customer: 'Stripe Integrations Ltd', status: 'PROCESSING', total: 499.00, items: 1, createdAt: '2026-11-08T12:30:00Z' },
      { orderId: 'ord_1003', customer: 'Linear Tech Partners', status: 'COMPLETED', total: 848.00, items: 2, createdAt: '2026-11-08T14:45:00Z' },
      { orderId: 'ord_1004', customer: 'Vercel Deployment Labs', status: 'PENDING_PAYMENT', total: 299.00, items: 1, createdAt: '2026-11-08T15:20:00Z' },
    ],
    timestamp: new Date().toISOString(),
  });
};

export const getDemoProfile = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      userId: 'usr_dev_4821',
      name: 'Chethan Reddy',
      organization: 'RateGuard Distributed Systems Lab',
      role: 'Platform Architect',
      rateLimitTier: 'Enterprise Tier - Uncapped Bursts',
      activePipelines: 12,
      registeredClusters: ['us-east-1', 'eu-central-1', 'ap-south-1'],
    },
    timestamp: new Date().toISOString(),
  });
};

export const postDemoCheckout = (req: Request, res: Response) => {
  const { cartItems, paymentMethod, customerEmail } = req.body;
  res.status(201).json({
    success: true,
    data: {
      transactionId: `txn_${Math.random().toString(36).substring(2, 10)}`,
      status: 'CONFIRMED',
      amountCharged: 499.00,
      currency: 'USD',
      customer: customerEmail || 'guest@example.com',
      paymentMethod: paymentMethod || 'credit_card',
      itemsCount: Array.isArray(cartItems) ? cartItems.length : 1,
      processedAt: new Date().toISOString(),
    },
    message: 'Checkout transaction processed successfully under strict sliding-window protection.',
  });
};

export const resetDemoEnvironment = (req: Request, res: Response) => {
  storage.seedInitialData();
  res.json({
    success: true,
    message: 'Demo environment reset successfully! Restored 5 API keys, 4 policies, and 240 request logs.',
  });
};
