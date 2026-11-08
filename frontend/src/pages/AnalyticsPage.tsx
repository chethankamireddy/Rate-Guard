import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  PieChart as PieIcon,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { api } from '../services/api';
import { AnalyticsData } from '../types';

interface AnalyticsPageProps {
  timeRange: string;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ timeRange }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAnalytics(timeRange);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Computing telemetry analytics...</p>
        </div>
      </div>
    );
  }

  const insights = data?.insights || [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-base font-semibold text-white">Traffic Analytics & Insights</h1>
        <p className="text-xs text-slate-400">
          High-resolution traffic distribution, latency percentiles, and algorithm behavior
        </p>
      </div>

      {/* COMPUTED INSIGHTS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {insights.map((insight, idx) => {
          let borderCol = 'border-indigo-500/30';
          let bgCol = 'bg-indigo-500/10';
          let textCol = 'text-indigo-400';
          let Icon = Info;

          if (insight.type === 'ALERT') {
            borderCol = 'border-rose-500/30';
            bgCol = 'bg-rose-500/10';
            textCol = 'text-rose-400';
            Icon = AlertTriangle;
          } else if (insight.type === 'WARNING') {
            borderCol = 'border-amber-500/30';
            bgCol = 'bg-amber-500/10';
            textCol = 'text-amber-400';
            Icon = TrendingUp;
          } else if (insight.type === 'SUCCESS') {
            borderCol = 'border-emerald-500/30';
            bgCol = 'bg-emerald-500/10';
            textCol = 'text-emerald-400';
            Icon = CheckCircle;
          }

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${borderCol} ${bgCol} flex flex-col justify-between space-y-2`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${textCol}`} />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${textCol}`}>
                  {insight.title}
                </h3>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{insight.description}</p>
            </div>
          );
        })}
      </div>

      {/* CHARTS ROW 1: Traffic by Endpoint & Latency Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints Bar Chart */}
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Requests by Target Endpoint</h2>
            <p className="text-xs text-slate-400">Total volume vs throttled (429) requests per URI</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.endpointDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="endpoint" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121522',
                    borderColor: '#23293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="count" name="Total Requests" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" name="Throttled (429)" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Distribution Histogram */}
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Engine Processing Latency Distribution</h2>
            <p className="text-xs text-slate-400">Evaluation overhead time brackets across all checks</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.latencyDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121522',
                    borderColor: '#23293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Requests" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TOP RATE LIMITED KEYS TABLE */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">API Keys with Highest Throttling Frequency</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-[#0C0E16] border-b border-[#1E2333]">
              <tr>
                <th className="py-2.5 px-3">API Key Name</th>
                <th className="py-2.5 px-3 text-right">Total Requests</th>
                <th className="py-2.5 px-3 text-right">Allowed</th>
                <th className="py-2.5 px-3 text-right">Rejected</th>
                <th className="py-2.5 px-3 text-right">Violation Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C212E] font-mono">
              {(data?.topKeys || []).map((k) => (
                <tr key={k.keyId} className="hover:bg-[#151928] transition font-sans">
                  <td className="py-2.5 px-3 font-medium text-slate-200">{k.keyName}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{k.total}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{k.total - k.rejected}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-bold">{k.rejected}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/20">
                      {k.hitRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
