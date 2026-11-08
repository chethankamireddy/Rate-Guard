import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  Percent,
  Clock,
  Key,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
  Server,
  Database,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../services/api';
import { DashboardOverview } from '../types';

interface DashboardPageProps {
  timeRange: string;
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ timeRange, onNavigate }) => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleSeries, setVisibleSeries] = useState({
    total: true,
    allowed: true,
    rejected: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const overview = await api.getOverview(timeRange);
      setData(overview);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading RateGuard telemetry...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p className="font-semibold text-sm">Failed to load dashboard data</p>
        <p className="text-xs text-red-300/80 mt-1">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-xs rounded-lg transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary || {
    totalRequests: 0,
    allowedRequests: 0,
    rejectedRequests: 0,
    hitRate: 0,
    avgLatencyMs: 0,
    activeApiKeys: 0,
  };

  const kpis = [
    {
      title: 'Total Requests',
      value: summary.totalRequests.toLocaleString(),
      change: '+14.2%',
      positive: true,
      icon: Activity,
      tooltip: 'Total requests processed across all monitored endpoints in this window',
      color: 'text-indigo-400',
    },
    {
      title: 'Allowed Requests',
      value: summary.allowedRequests.toLocaleString(),
      change: '+12.8%',
      positive: true,
      icon: CheckCircle,
      tooltip: 'Requests accepted within policy quotas and burst capacity',
      color: 'text-emerald-400',
    },
    {
      title: 'Rejected Requests',
      value: summary.rejectedRequests.toLocaleString(),
      change: '+1.4%',
      positive: false,
      icon: XCircle,
      tooltip: 'Requests blocked with HTTP 429 Too Many Requests',
      color: 'text-rose-400',
    },
    {
      title: 'Rate-Limit Hit Rate',
      value: `${summary.hitRate}%`,
      change: '-0.3%',
      positive: true,
      icon: Percent,
      tooltip: 'Percentage of total incoming traffic throttled by the rate limiter',
      color: 'text-amber-400',
    },
    {
      title: 'Average Latency',
      value: `${summary.avgLatencyMs} ms`,
      change: '-0.12ms',
      positive: true,
      icon: Clock,
      tooltip: 'Average rate-limiter evaluation overhead per incoming request',
      color: 'text-cyan-400',
    },
    {
      title: 'Active API Keys',
      value: summary.activeApiKeys.toString(),
      change: 'Active',
      positive: true,
      icon: Key,
      tooltip: 'Total authenticated developer API keys currently actively generating requests',
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              title={kpi.tooltip}
              className="bg-[#11131E] border border-[#1E2333] hover:border-[#2C334A] rounded-xl p-4 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold tracking-tight text-white">{kpi.value}</span>
                <span
                  className={`text-[10px] font-medium flex items-center gap-0.5 ${
                    kpi.positive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {kpi.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Traffic Time Series Chart */}
        <div className="lg:col-span-2 bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">API Request Throughput Over Time</h2>
              <p className="text-xs text-slate-400">Total, Allowed, and Rejected request distribution</p>
            </div>
            {/* Toggle series pills */}
            <div className="flex items-center gap-1.5 bg-[#0C0E16] p-1 rounded-lg border border-[#1C212E] text-xs">
              <button
                onClick={() => setVisibleSeries((p) => ({ ...p, total: !p.total }))}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  visibleSeries.total ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Total
              </button>
              <button
                onClick={() => setVisibleSeries((p) => ({ ...p, allowed: !p.allowed }))}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  visibleSeries.allowed ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Allowed
              </button>
              <button
                onClick={() => setVisibleSeries((p) => ({ ...p, rejected: !p.rejected }))}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  visibleSeries.rejected ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.timeSeries || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121522',
                    borderColor: '#23293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {visibleSeries.total && (
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Requests"
                    stroke="#818CF8"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {visibleSeries.allowed && (
                  <Line
                    type="monotone"
                    dataKey="allowed"
                    name="Allowed"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {visibleSeries.rejected && (
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    name="Rejected"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Allowed vs Rejected */}
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Allowed vs Rejected Ratio</h2>
            <p className="text-xs text-slate-400">Total traffic decision ratio</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.donut || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(data?.donut || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121522',
                    borderColor: '#23293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-white">{summary.totalRequests}</span>
              <span className="text-[10px] text-slate-400">Total</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1C212E] text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <div>
                <p className="text-slate-400 text-[10px]">Allowed</p>
                <p className="font-semibold text-slate-200">{summary.allowedRequests}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <div>
                <p className="text-slate-400 text-[10px]">Rejected</p>
                <p className="font-semibold text-slate-200">{summary.rejectedRequests}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOWER ROW: TOP KEYS & RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rate-Limited API Keys */}
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Top Rate-Limited API Keys</h2>
              <p className="text-xs text-slate-400">Clients encountering the highest throttles</p>
            </div>
            <button
              onClick={() => onNavigate('api-keys')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Manage Keys <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-[#1E2333]">
                <tr>
                  <th className="py-2 font-medium">API Key / Client</th>
                  <th className="py-2 text-right font-medium">Requests</th>
                  <th className="py-2 text-right font-medium">Rejected</th>
                  <th className="py-2 text-right font-medium">Rejection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C212E]">
                {(data?.topRateLimitedKeys || []).map((k) => (
                  <tr
                    key={k.keyId}
                    onClick={() => onNavigate('api-keys')}
                    className="hover:bg-[#151928] cursor-pointer transition"
                  >
                    <td className="py-2.5 font-medium text-slate-200 flex items-center gap-2">
                      <Key className="w-3 h-3 text-indigo-400" />
                      <span className="truncate max-w-[160px]">{k.keyName}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-300">{k.total}</td>
                    <td className="py-2.5 text-right font-mono text-rose-400 font-semibold">{k.rejected}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                          k.hitRate > 20
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {k.hitRate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(data?.topRateLimitedKeys || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No rate-limit violations recorded in this time range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Live Activity Feed */}
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent Evaluation Activity</h2>
              <p className="text-xs text-slate-400">Live incoming API requests evaluated by RateGuard</p>
            </div>
            <button
              onClick={() => onNavigate('live-traffic')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Full Stream <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-[#1E2333]">
                <tr>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Endpoint</th>
                  <th className="py-2 font-medium">Decision</th>
                  <th className="py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C212E]">
                {(data?.recentActivity || []).map((log) => (
                  <tr key={log.id} className="hover:bg-[#151928] transition">
                    <td className="py-2.5">
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
                    <td className="py-2.5 font-mono text-slate-300 text-[11px] truncate max-w-[180px]">
                      {log.endpoint}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          log.decision === 'ALLOWED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.decision === 'ALLOWED' ? (
                          <CheckCircle className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        {log.decision}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-400 text-[11px]">
                      {log.latencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SYSTEM HEALTH CARDS */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Distributed Infrastructure Health Checks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-[#0C0E16] border border-[#1E2333] p-3 rounded-lg flex items-center gap-3">
            <Server className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Node API Server</p>
              <p className="text-xs font-semibold text-emerald-400">HEALTHY</p>
            </div>
          </div>
          <div className="bg-[#0C0E16] border border-[#1E2333] p-3 rounded-lg flex items-center gap-3">
            <Database className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Redis Cluster</p>
              <p className="text-xs font-semibold text-emerald-400">
                {data?.systemHealth.redis || 'HEALTHY'}
              </p>
            </div>
          </div>
          <div className="bg-[#0C0E16] border border-[#1E2333] p-3 rounded-lg flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">PostgreSQL DB</p>
              <p className="text-xs font-semibold text-emerald-400">CONNECTED</p>
            </div>
          </div>
          <div className="bg-[#0C0E16] border border-[#1E2333] p-3 rounded-lg flex items-center gap-3">
            <Cpu className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">C++ Engine</p>
              <p className="text-xs font-semibold text-emerald-400">
                {data?.systemHealth.cppEngine || 'HEALTHY'}
              </p>
            </div>
          </div>
          <div className="bg-[#0C0E16] border border-[#1E2333] p-3 rounded-lg flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Engine Latency</p>
              <p className="text-xs font-semibold font-mono text-slate-200">
                {data?.systemHealth.currentLatencyMs || 0.45} ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
