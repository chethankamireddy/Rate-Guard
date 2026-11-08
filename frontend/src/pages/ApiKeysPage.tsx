import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  Ban,
  ExternalLink,
  ShieldAlert,
  Clock,
  Sliders,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKey, RateLimitPolicy } from '../types';

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [policies, setPolicies] = useState<RateLimitPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [expirationDays, setExpirationDays] = useState<string>('never');
  const [creating, setCreating] = useState<boolean>(false);

  // One-time newly generated raw key display
  const [generatedKey, setGeneratedKey] = useState<{ rawKey: string; key: ApiKey } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Key Details Modal
  const [selectedKeyDetails, setSelectedKeyDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [keysData, policiesData] = await Promise.all([
        api.listApiKeys(),
        api.listPolicies(),
      ]);
      setKeys(keysData);
      setPolicies(policiesData);
      if (policiesData.length > 0 && !selectedPolicyId) {
        setSelectedPolicyId(policiesData[0].id);
      }
    } catch (err) {
      console.error('Failed to load keys data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      let expDate: string | undefined = undefined;
      if (expirationDays !== 'never') {
        const days = parseInt(expirationDays, 10);
        expDate = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
      }

      const res = await api.createApiKey({
        name: newKeyName.trim(),
        policyId: selectedPolicyId || undefined,
        expiresAt: expDate,
      });

      setGeneratedKey({ rawKey: res.rawKey, key: res.apiKey });
      setShowCreateModal(false);
      setNewKeyName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action takes effect immediately.')) return;
    try {
      await api.revokeApiKey(id);
      fetchData();
      if (selectedKeyDetails && selectedKeyDetails.id === id) {
        setSelectedKeyDetails((prev: any) => ({ ...prev, status: 'REVOKED' }));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Permanently delete this API key from the database?')) return;
    try {
      await api.deleteApiKey(id);
      fetchData();
      if (selectedKeyDetails && selectedKeyDetails.id === id) {
        setSelectedKeyDetails(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete key');
    }
  };

  const handleOpenDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      const details = await api.getApiKeyDetails(id);
      setSelectedKeyDetails(details);
    } catch (err) {
      console.error('Failed to load key details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredKeys = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.keyPrefix.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">API Keys</h1>
          <p className="text-xs text-slate-400">
            Create, inspect, and revoke authenticated developer API keys
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="flex items-center gap-3 bg-[#11131E] border border-[#1E2333] px-3.5 py-2 rounded-xl text-xs">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by key name or prefix..."
          className="bg-transparent text-slate-200 placeholder-slate-400 focus:outline-none flex-1"
        />
        <span className="text-[11px] text-slate-400 font-mono">{filteredKeys.length} keys</span>
      </div>

      {/* API KEYS TABLE */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-[#0C0E16] border-b border-[#1E2333]">
              <tr>
                <th className="py-3 px-4">Key Name</th>
                <th className="py-3 px-4">Masked Key Hash</th>
                <th className="py-3 px-4">Assigned Policy</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C212E]">
              {filteredKeys.map((k) => (
                <tr key={k.id} className="hover:bg-[#151928] transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">{k.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{k.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-[#090A0F] border border-[#1C212E]">
                      {k.keyPrefix}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {k.policy ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <Sliders className="w-3 h-3 text-indigo-400" />
                        {k.policy.name}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Default Global</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        k.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : k.status === 'REVOKED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {k.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenDetails(k.id)}
                        className="px-2 py-1 rounded bg-[#161B29] hover:bg-[#1E2538] text-slate-300 hover:text-white border border-[#232B3E] transition text-[11px]"
                      >
                        Details
                      </button>
                      {k.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          title="Revoke key"
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        title="Delete key"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredKeys.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching API keys found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE API KEY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121522] border border-[#252B3E] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#202638]">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Create New API Key</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Key Name *</label>
                <input
                  type="text"
                  required
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Billing Microservice"
                  className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Assigned Rate Limit Policy
                </label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#121522]">
                      {p.name} ({p.algorithm} - {p.requestLimit} req / {p.windowDuration}s)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Expiration</label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="never" className="bg-[#121522]">Never Expires</option>
                  <option value="30" className="bg-[#121522]">30 Days</option>
                  <option value="90" className="bg-[#121522]">90 Days</option>
                  <option value="365" className="bg-[#121522]">1 Year</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-[#1B2133] hover:bg-[#252C42] text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition"
                >
                  {creating ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME RAW KEY PRESENTATION MODAL */}
      {generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#121522] border border-amber-500/40 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-white">Save Your API Key Now</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This secret key is hashed in the database using <strong>SHA-256</strong>. For security
              reasons, <strong>you cannot view this raw secret key again</strong> once you dismiss this dialog.
            </p>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400">API Secret Key</span>
              <div className="flex items-center gap-2 bg-[#090A0F] border border-[#23293B] rounded-lg p-2.5">
                <code className="text-xs font-mono text-emerald-400 break-all select-all flex-1">
                  {generatedKey.rawKey}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedKey.rawKey)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center gap-1.5 transition flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setGeneratedKey(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
              >
                I have saved this key safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API KEY DETAILS MODAL */}
      {selectedKeyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#121522] border border-[#252B3E] rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#202638]">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">{selectedKeyDetails.name}</h3>
              </div>
              <button
                onClick={() => setSelectedKeyDetails(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#0C0E16] p-2.5 rounded-lg border border-[#1E2333]">
                <p className="text-slate-400 text-[10px]">Total Requests</p>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {selectedKeyDetails.metrics?.totalRequests || 0}
                </p>
              </div>
              <div className="bg-[#0C0E16] p-2.5 rounded-lg border border-[#1E2333]">
                <p className="text-slate-400 text-[10px]">Allowed</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {selectedKeyDetails.metrics?.allowedRequests || 0}
                </p>
              </div>
              <div className="bg-[#0C0E16] p-2.5 rounded-lg border border-[#1E2333]">
                <p className="text-slate-400 text-[10px]">Rejected (429)</p>
                <p className="text-base font-bold text-rose-400 font-mono mt-0.5">
                  {selectedKeyDetails.metrics?.rejectedRequests || 0}
                </p>
              </div>
              <div className="bg-[#0C0E16] p-2.5 rounded-lg border border-[#1E2333]">
                <p className="text-slate-400 text-[10px]">Status</p>
                <p className="text-xs font-semibold text-indigo-400 mt-1">
                  {selectedKeyDetails.status}
                </p>
              </div>
            </div>

            {/* Associated Policy */}
            <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333] space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Associated Policy
              </span>
              <p className="font-semibold text-slate-200">
                {selectedKeyDetails.policy?.name || 'Default Global Policy'}
              </p>
              <p className="text-slate-400 text-[11px]">
                Algorithm: {selectedKeyDetails.policy?.algorithm || 'TOKEN_BUCKET'} | Limit:{' '}
                {selectedKeyDetails.policy?.requestLimit || 100} req /{' '}
                {selectedKeyDetails.policy?.windowDuration || 60}s
              </p>
            </div>

            {/* Recent Requests from this Key */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300">Recent Request Activity</h4>
              <div className="max-h-48 overflow-y-auto border border-[#1E2333] rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase text-slate-400 bg-[#0C0E16]">
                    <tr>
                      <th className="p-2">Method</th>
                      <th className="p-2">Endpoint</th>
                      <th className="p-2">Decision</th>
                      <th className="p-2 text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C212E]">
                    {(selectedKeyDetails.recentLogs || []).map((l: any) => (
                      <tr key={l.id}>
                        <td className="p-2 font-mono text-[11px] text-slate-300">{l.method}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-300">{l.endpoint}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              l.decision === 'ALLOWED'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {l.decision}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-[11px] text-slate-400">
                          {l.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                    {(selectedKeyDetails.recentLogs || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          No recent logs recorded for this key.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              {selectedKeyDetails.status === 'ACTIVE' && (
                <button
                  onClick={() => handleRevokeKey(selectedKeyDetails.id)}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-lg text-xs font-semibold transition"
                >
                  Revoke Key
                </button>
              )}
              <button
                onClick={() => setSelectedKeyDetails(null)}
                className="px-4 py-1.5 bg-[#1B2133] hover:bg-[#252C42] text-slate-200 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
