import { Request, Response } from 'express';
import { storage } from '../services/storageService.js';

export const listApiKeys = (req: Request, res: Response) => {
  const keys = storage.listApiKeys();
  res.json({ success: true, data: keys });
};

export const getApiKeyDetails = (req: Request, res: Response) => {
  const { id } = req.params;
  const key = storage.getApiKeyById(id);
  if (!key) {
    return res.status(404).json({ success: false, error: 'API key not found' });
  }

  const recentLogs = storage.getRecentLogs(30, { apiKeyId: id });
  const total = recentLogs.length;
  const rejected = recentLogs.filter(l => l.decision === 'REJECTED').length;
  const allowed = total - rejected;

  res.json({
    success: true,
    data: {
      ...key,
      metrics: {
        totalRequests: total,
        allowedRequests: allowed,
        rejectedRequests: rejected,
        rejectionRate: total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0,
      },
      recentLogs,
    },
  });
};

export const createApiKey = (req: Request, res: Response) => {
  const { name, policyId, expiresAt } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'API key name is required' });
  }

  const expDate = expiresAt ? new Date(expiresAt) : null;
  const { apiKey, rawKey } = storage.createApiKey({
    name,
    policyId,
    expiresAt: expDate,
  });

  // Display raw key only once at creation
  res.status(201).json({
    success: true,
    data: apiKey,
    rawKey,
    message: 'API key created successfully. Save this secret key now; you cannot retrieve it again.',
  });
};

export const revokeApiKey = (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = storage.revokeApiKey(id);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'API key not found' });
  }
  res.json({ success: true, data: updated, message: 'API key revoked successfully' });
};

export const deleteApiKey = (req: Request, res: Response) => {
  const { id } = req.params;
  const success = storage.deleteApiKey(id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'API key not found' });
  }
  res.json({ success: true, message: 'API key deleted successfully' });
};

export const assignPolicyToKey = (req: Request, res: Response) => {
  const { id } = req.params;
  const { policyId } = req.body;

  const updated = storage.updateApiKey(id, { policyId });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'API key not found' });
  }
  res.json({ success: true, data: updated, message: 'Policy assigned successfully' });
};
