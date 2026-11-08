import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Server,
  Cpu,
  RotateCcw,
  Save,
  CheckCircle,
  AlertTriangle,
  Layers,
  Shield,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings, AlgorithmType } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states
  const [defaultAlgorithm, setDefaultAlgorithm] = useState<AlgorithmType>('TOKEN_BUCKET');
  const [defaultLimit, setDefaultLimit] = useState<number>(100);
  const [defaultWindow, setDefaultWindow] = useState<number>(60);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      setDefaultAlgorithm(data.general.defaultAlgorithm);
      setDefaultLimit(data.general.defaultLimit);
      setDefaultWindow(data.general.defaultWindowDuration);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateSettings({
        defaultAlgorithm,
        defaultLimit,
        defaultWindowDuration: defaultWindow,
      });
      setMessage('Settings updated successfully');
      setTimeout(() => setMessage(null), 3000);
      fetchSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Reset the demo environment? This will restore initial sample API keys, policies, and demo traffic.')) return;
    try {
      setResetting(true);
      const msg = await api.resetDemo();
      alert(msg);
      fetchSettings();
    } catch (err: any) {
      alert(err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  if (loading && !settings) {
    return <div className="p-8 text-slate-400 text-xs">Loading platform settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">System & Engine Settings</h1>
          <p className="text-xs text-slate-400">
            Configure system defaults, Redis cluster connectivity, and reset the demo workspace
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {/* GENERAL SETTINGS */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          General Platform Settings
        </h2>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Application Name</label>
              <input
                type="text"
                disabled
                value={settings?.general.applicationName}
                className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Environment</label>
              <input
                type="text"
                disabled
                value={settings?.general.environment}
                className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Default Algorithm</label>
              <select
                value={defaultAlgorithm}
                onChange={(e) => setDefaultAlgorithm(e.target.value as AlgorithmType)}
                className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TOKEN_BUCKET">Token Bucket</option>
                <option value="SLIDING_WINDOW">Sliding Window</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Default Request Limit</label>
              <input
                type="number"
                min="1"
                value={defaultLimit}
                onChange={(e) => setDefaultLimit(parseInt(e.target.value, 10) || 100)}
                className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Default Window Duration (s)</label>
              <input
                type="number"
                min="1"
                value={defaultWindow}
                onChange={(e) => setDefaultWindow(parseInt(e.target.value, 10) || 60)}
                className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* REDIS SETTINGS */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Redis Distributed Limiter Settings
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333] space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Connection Status
            </span>
            <p className="font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {settings?.redis.status}
            </p>
          </div>

          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333] space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Limiter Mode
            </span>
            <p className="font-semibold text-slate-200 font-mono">
              {settings?.redis.mode}
            </p>
          </div>

          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333] space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Cluster URL (Masked)
            </span>
            <p className="font-mono text-slate-300">{settings?.redis.urlMasked}</p>
          </div>

          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333] space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Key Expiration TTL
            </span>
            <p className="font-mono text-slate-300">{settings?.redis.keyExpirationTtlSec} seconds</p>
          </div>
        </div>
      </div>

      {/* C++ ENGINE & SYSTEM HEALTH */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          C++ Rate Limiting Microservice & Runtime
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333]">
            <p className="text-[10px] text-slate-400 font-sans">C++ Microservice</p>
            <p className="text-slate-200 font-bold mt-1">{settings?.system.cppEngineStatus}</p>
          </div>
          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333]">
            <p className="text-[10px] text-slate-400 font-sans">Compiler Toolchain</p>
            <p className="text-slate-300 mt-1">{settings?.system.cppEngineVersion}</p>
          </div>
          <div className="bg-[#0C0E16] p-3 rounded-lg border border-[#1E2333]">
            <p className="text-[10px] text-slate-400 font-sans">Memory Used</p>
            <p className="text-slate-200 font-bold mt-1">{settings?.system.memoryUsageMb} MB</p>
          </div>
        </div>
      </div>

      {/* RESET DEMO ENVIRONMENT */}
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Reset Demo Environment
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Restore sample API keys, policies, and telemetry logs back to the clean initial demo state.
          </p>
        </div>
        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-rose-600/20 disabled:opacity-50 flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {resetting ? 'Resetting...' : 'Reset Workspace'}
        </button>
      </div>
    </div>
  );
};
