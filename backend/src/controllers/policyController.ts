import { Request, Response } from 'express';
import { storage } from '../services/storageService.js';
import { AlgorithmType, PolicyScope, PolicyStatus } from '../types/index.js';

export const listPolicies = (req: Request, res: Response) => {
  const policies = storage.listPolicies();
  res.json({ success: true, data: policies });
};

export const getPolicy = (req: Request, res: Response) => {
  const { id } = req.params;
  const policy = storage.getPolicyById(id);
  if (!policy) {
    return res.status(404).json({ success: false, error: 'Policy not found' });
  }
  res.json({ success: true, data: policy });
};

export const createPolicy = (req: Request, res: Response) => {
  const { name, description, algorithm, requestLimit, windowDuration, burstCapacity, scope, status } = req.body;

  if (!name || !requestLimit || !windowDuration) {
    return res.status(400).json({
      success: false,
      error: 'Name, requestLimit, and windowDuration are required fields',
    });
  }

  const validAlgo: AlgorithmType = algorithm === 'SLIDING_WINDOW' ? 'SLIDING_WINDOW' : 'TOKEN_BUCKET';
  const validScope: PolicyScope = scope === 'ENDPOINT' ? 'ENDPOINT' : (scope === 'GLOBAL' ? 'GLOBAL' : 'API_KEY');
  const validStatus: PolicyStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const policy = storage.createPolicy({
    name,
    description,
    algorithm: validAlgo,
    requestLimit: parseInt(requestLimit, 10),
    windowDuration: parseInt(windowDuration, 10),
    burstCapacity: burstCapacity ? parseInt(burstCapacity, 10) : parseInt(requestLimit, 10),
    scope: validScope,
    status: validStatus,
  });

  res.status(201).json({ success: true, data: policy, message: 'Policy created successfully' });
};

export const updatePolicy = (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, algorithm, requestLimit, windowDuration, burstCapacity, scope, status } = req.body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (algorithm !== undefined) updates.algorithm = algorithm;
  if (requestLimit !== undefined) updates.requestLimit = parseInt(requestLimit, 10);
  if (windowDuration !== undefined) updates.windowDuration = parseInt(windowDuration, 10);
  if (burstCapacity !== undefined) updates.burstCapacity = parseInt(burstCapacity, 10);
  if (scope !== undefined) updates.scope = scope;
  if (status !== undefined) updates.status = status;

  const updated = storage.updatePolicy(id, updates);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Policy not found' });
  }

  res.json({ success: true, data: updated, message: 'Policy updated successfully' });
};

export const deletePolicy = (req: Request, res: Response) => {
  const { id } = req.params;
  const success = storage.deletePolicy(id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Policy not found' });
  }
  res.json({ success: true, message: 'Policy deleted successfully' });
};
