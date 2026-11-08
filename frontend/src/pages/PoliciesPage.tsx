import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Layers,
  Zap,
  Activity,
  CheckCircle,
  X,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { RateLimitPolicy, AlgorithmType, PolicyScope, PolicyStatus } from '../types';

export const PoliciesPage: React.FC = () => {
  const [policies, setPolicies] = useState<RateLimitPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('TOKEN_BUCKET');
  const [requestLimit, setRequestLimit] = useState<number>(100);
  const [windowDuration, setWindowDuration] = useState<number>(60);
  const [burstCapacity, setBurstCapacity] = useState<number>(120);
  const [scope, setScope] = useState<PolicyScope>('API_KEY');
  const [status, setStatus] = useState<PolicyStatus>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.listPolicies();
      setPolicies(data);
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const openCreateModal = () => {
    setEditingPolicyId(null);
    setName('');
    setDescription('');
    setAlgorithm('TOKEN_BUCKET');
    setRequestLimit(100);
    setWindowDuration(60);
    setBurstCapacity(120);
    setScope('API_KEY');
    setStatus('ACTIVE');
    setShowModal(true);
  };

  const openEditModal = (policy: RateLimitPolicy) => {
    setEditingPolicyId(policy.id);
    setName(policy.name);
    setDescription(policy.description || '');
    setAlgorithm(policy.algorithm);
    setRequestLimit(policy.requestLimit);
    setWindowDuration(policy.windowDuration);
    setBurstCapacity(policy.burstCapacity);
    setScope(policy.scope);
    setStatus(policy.status);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      if (editingPolicyId) {
        await api.updatePolicy(editingPolicyId, {
          name: name.trim(),
          description: description.trim() || undefined,
          algorithm,
          requestLimit,
          windowDuration,
          burstCapacity: algorithm === 'TOKEN_BUCKET' ? burstCapacity : requestLimit,
          scope,
          status,
        });
      } else {
        await api.createPolicy({
          name: name.trim(),
          description: description.trim() || undefined,
          algorithm,
          requestLimit,
          windowDuration,
          burstCapacity: algorithm === 'TOKEN_BUCKET' ? burstCapacity : requestLimit,
          scope,
          status,
        });
      }
      setShowModal(false);
      fetchPolicies();
    } catch (err: any) {
      alert(err.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate limit policy?')) return;
    try {
      await api.deletePolicy(id);
      fetchPolicies();
    } catch (err: any) {
      alert(err.message || 'Failed to delete policy');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">Rate Limit Policies</h1>
          <p className="text-xs text-slate-400">
            Define Token Bucket and Sliding Window rate-limiting rules enforced in C++ and Redis
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          Create Policy
        </button>
      </div>

      {/* POLICIES GRID / TABLE */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-[#0C0E16] border-b border-[#1E2333]">
              <tr>
                <th className="py-3 px-4">Policy Name</th>
                <th className="py-3 px-4">Algorithm</th>
                <th className="py-3 px-4">Quota Limit</th>
                <th className="py-3 px-4">Window</th>
                <th className="py-3 px-4">Burst Capacity</th>
                <th className="py-3 px-4">Keys Using</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C212E]">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-[#151928] transition">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-semibold text-slate-200">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-xs">{p.description || 'No description'}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        p.algorithm === 'TOKEN_BUCKET'
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {p.algorithm === 'TOKEN_BUCKET' ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {p.algorithm.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-200">
                    {p.requestLimit} reqs
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    {p.windowDuration}s
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    {p.algorithm === 'TOKEN_BUCKET' ? `${p.burstCapacity} tokens` : 'N/A (Sliding Frame)'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">
                    {p.keyCount ?? 0} keys
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded bg-[#161B29] hover:bg-[#1E2538] text-slate-300 hover:text-white border border-[#232B3E] transition"
                        title="Edit policy"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                        title="Delete policy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT POLICY MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#121522] border border-[#252B3E] rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#202638]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  {editingPolicyId ? 'Edit Rate-Limit Policy' : 'Create Rate-Limit Policy'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Policy Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard Tier Ingestion"
                  className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Policy purpose, target clients or endpoints..."
                  className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Algorithm Selection with Visual Explanatory Cards */}
              <div>
                <label className="block text-slate-300 font-medium mb-2">Algorithm Selection</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setAlgorithm('TOKEN_BUCKET')}
                    className={`cursor-pointer p-3 rounded-lg border transition ${
                      algorithm === 'TOKEN_BUCKET'
                        ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                        : 'bg-[#0C0E16] border-[#23293B] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      Token Bucket
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Tokens replenish continuously. Allows controlled bursts up to bucket capacity while enforcing an average rate limit.
                    </p>
                  </div>

                  <div
                    onClick={() => setAlgorithm('SLIDING_WINDOW')}
                    className={`cursor-pointer p-3 rounded-lg border transition ${
                      algorithm === 'SLIDING_WINDOW'
                        ? 'bg-cyan-600/15 border-cyan-500 text-white shadow-sm shadow-cyan-500/20'
                        : 'bg-[#0C0E16] border-[#23293B] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Sliding Window
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Maintains a moving time window using timestamp queues. Eliminates double-limit boundary attacks at window resets.
                    </p>
                  </div>
                </div>
              </div>

              {/* Algorithm Visual Diagram */}
              <div className="p-3 bg-[#0C0E16] rounded-lg border border-[#1E2333] flex items-center gap-3">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div className="text-[11px] text-slate-300">
                  {algorithm === 'TOKEN_BUCKET' ? (
                    <span>
                      <strong>Token Bucket Mechanics:</strong> Tokens refill at{' '}
                      <span className="font-mono text-indigo-400">
                        {requestLimit / windowDuration} tokens/sec
                      </span>
                      . Incoming requests consume 1 token. When bucket reaches{' '}
                      <span className="font-mono text-indigo-400">{burstCapacity}</span>, requests are permitted in bursts.
                    </span>
                  ) : (
                    <span>
                      <strong>Sliding Window Mechanics:</strong> A moving window of{' '}
                      <span className="font-mono text-cyan-400">{windowDuration}s</span> is tracked using a timestamp deque. Requests are accepted if count in the last {windowDuration}s is &lt;{' '}
                      <span className="font-mono text-cyan-400">{requestLimit}</span>.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Requests Allowed *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={requestLimit}
                    onChange={(e) => setRequestLimit(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Window Duration (Seconds) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={windowDuration}
                    onChange={(e) => setWindowDuration(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {algorithm === 'TOKEN_BUCKET' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Burst Capacity (Tokens)</label>
                  <input
                    type="number"
                    min={requestLimit}
                    value={burstCapacity}
                    onChange={(e) => setBurstCapacity(parseInt(e.target.value, 10) || requestLimit)}
                    className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Maximum tokens bucket can accumulate during idle periods.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Enforcement Scope</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as PolicyScope)}
                    className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="API_KEY">Per API Key</option>
                    <option value="ENDPOINT">Per Endpoint</option>
                    <option value="GLOBAL">Global / System-Wide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Policy Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PolicyStatus)}
                    className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#202638]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 bg-[#1B2133] hover:bg-[#252C42] text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition"
                >
                  {saving ? 'Saving...' : (editingPolicyId ? 'Update Policy' : 'Create Policy')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
