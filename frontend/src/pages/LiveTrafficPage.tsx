import React, { useState } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Zap,
  Clock,
  Radio,
} from 'lucide-react';
import { useTrafficStream } from '../hooks/useTrafficStream';
import { RequestLog } from '../types';

export const LiveTrafficPage: React.FC = () => {
  const { logs, rps, allowedRps, rejectedRps, isConnected, isPaused, clearLogs, togglePause } =
    useTrafficStream();

  const [search, setSearch] = useState<string>('');
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'timestamp' | 'latency'>('timestamp');
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  // Filter & sort
  let displayedLogs = logs.filter((l) => {
    if (filterDecision !== 'ALL' && l.decision !== filterDecision) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const matchEndpoint = l.endpoint.toLowerCase().includes(q);
      const matchMethod = l.method.toLowerCase().includes(q);
      const matchKey = l.apiKeyId ? l.apiKeyId.toLowerCase().includes(q) : false;
      if (!matchEndpoint && !matchMethod && !matchKey) return false;
    }
    return true;
  });

  displayedLogs.sort((a, b) => {
    if (sortBy === 'timestamp') {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sortDesc ? diff : -diff;
    } else {
      const diff = b.latencyMs - a.latencyMs;
      return sortDesc ? diff : -diff;
    }
  });

  return (
    <div className="space-y-6">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">Live Traffic Stream</h1>
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              <Radio className={`w-3 h-3 ${isConnected ? 'animate-pulse text-emerald-400' : 'text-rose-400'}`} />
              {isConnected ? 'LIVE WEBSOCKET' : 'CONNECTING'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time sub-millisecond evaluation stream from the C++ & Redis rate limiters
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isPaused
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                : 'bg-[#151928] text-slate-300 border-[#23293B] hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#151928] hover:bg-[#1E2338] text-slate-400 hover:text-rose-400 border border-[#23293B] transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* REAL-TIME THROUGHPUT METRICS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Incoming RPS</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white">{rps}</span>
            <span className="text-xs text-slate-400 font-mono">req/sec</span>
          </div>
        </div>

        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Allowed RPS</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-400">{allowedRps}</span>
            <span className="text-xs text-slate-400 font-mono">req/sec</span>
          </div>
        </div>

        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Throttled RPS</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-rose-400">{rejectedRps}</span>
            <span className="text-xs text-slate-400 font-mono">req/sec</span>
          </div>
        </div>

        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Buffer Depth</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-cyan-400">{logs.length}</span>
            <span className="text-xs text-slate-400 font-mono">events</span>
          </div>
        </div>
      </div>

      {/* FILTER & SORT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#11131E] border border-[#1E2333] p-3 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoint, method, or key..."
            className="bg-transparent text-slate-200 placeholder-slate-400 focus:outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Decision Filter */}
          <div className="flex items-center gap-1 bg-[#0C0E16] border border-[#23293B] rounded-lg p-0.5">
            <button
              onClick={() => setFilterDecision('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                filterDecision === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterDecision('ALLOWED')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                filterDecision === 'ALLOWED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Allowed
            </button>
            <button
              onClick={() => setFilterDecision('REJECTED')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                filterDecision === 'REJECTED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Sort Button */}
          <button
            onClick={() => {
              if (sortBy === 'timestamp') {
                setSortBy('latency');
              } else {
                setSortBy('timestamp');
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141824] border border-[#23293B] text-slate-300 hover:text-white transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sort: {sortBy === 'timestamp' ? 'Time' : 'Latency'}</span>
          </button>
        </div>
      </div>

      {/* LIVE REQUESTS TABLE */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-[#0C0E16] border-b border-[#1E2333]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Target Endpoint</th>
                <th className="py-3 px-4">Client / Key</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Algorithm</th>
                <th className="py-3 px-4 text-right">Engine Overhead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C212E] font-mono">
              {displayedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#151928] transition font-sans">
                  <td className="py-2.5 px-4 text-slate-400 text-[11px] font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        log.method === 'POST'
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                          : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {log.method}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-200">
                    {log.endpoint}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-400">
                    {log.apiKeyId || log.ipAddress || 'anonymous'}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        log.decision === 'ALLOWED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {log.decision === 'ALLOWED' ? (
                        <CheckCircle className="w-2.5 h-2.5" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5" />
                      )}
                      {log.decision} ({log.statusCode})
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-300 font-mono">
                    {log.algorithm}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[11px] text-cyan-400 font-semibold">
                    {log.latencyMs} ms
                  </td>
                </tr>
              ))}
              {displayedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="w-6 h-6 text-slate-600 animate-pulse" />
                      <p>Listening for real incoming requests...</p>
                      <p className="text-[11px] text-slate-600">
                        Trigger requests using the API Playground or demo endpoints to see live events.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
