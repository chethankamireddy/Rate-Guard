import React, { useState } from 'react';
import {
  Zap,
  Play,
  Download,
  Clock,
  Layers,
  Activity,
  CheckCircle,
  XCircle,
  BarChart2,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../services/api';

export const BenchmarksPage: React.FC = () => {
  const [algorithm, setAlgorithm] = useState<'TOKEN_BUCKET' | 'SLIDING_WINDOW'>('TOKEN_BUCKET');
  const [requests, setRequests] = useState<number>(2000);
  const [limit, setLimit] = useState<number>(500);
  const [window, setWindow] = useState<number>(60);
  const [burst, setBurst] = useState<number>(600);
  const [concurrency, setConcurrency] = useState<number>(10);

  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [results, setResults] = useState<any[]>([]);

  const runBenchmark = async () => {
    try {
      setBenchmarking(true);
      const res = await api.runBenchmark({
        algorithm,
        limit,
        window,
        burst: algorithm === 'TOKEN_BUCKET' ? burst : limit,
        requests,
        concurrency,
      });

      setResults((prev) => [
        {
          id: `bench_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          algorithm,
          totalRequests: requests,
          rps: res.requestsPerSec,
          avgLatencyUs: res.avgLatencyUs,
          p50LatencyUs: res.p50LatencyUs,
          p95LatencyUs: res.p95LatencyUs,
          p99LatencyUs: res.p99LatencyUs,
          rejectionRate: res.rejectionRate,
          durationSec: res.durationSec,
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(err.message || 'Benchmark execution failed');
    } finally {
      setBenchmarking(false);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const headers = 'ID,Timestamp,Algorithm,TotalRequests,RPS,AvgLatencyUs,P50LatencyUs,P95LatencyUs,P99LatencyUs,RejectionRate,DurationSec\n';
    const rows = results
      .map(
        (r) =>
          `${r.id},${r.timestamp},${r.algorithm},${r.totalRequests},${r.rps},${r.avgLatencyUs},${r.p50LatencyUs},${r.p95LatencyUs},${r.p99LatencyUs},${r.rejectionRate}%,${r.durationSec}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rateguard-benchmark-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">Algorithm Performance Benchmarks</h1>
          <p className="text-xs text-slate-400">
            Stress-test Token Bucket and Sliding Window implementations under high concurrency
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141824] hover:bg-[#1E2333] text-slate-200 border border-[#23293B] rounded-lg text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Export CSV
          </button>
        )}
      </div>

      {/* CONFIGURABLE BENCHMARK RUNNER */}
      <div className="bg-[#11131E] border border-[#1E2333] p-5 rounded-xl space-y-4">
        <h2 className="text-sm font-semibold text-white">Benchmark Configuration</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="TOKEN_BUCKET">Token Bucket (C++ / Redis)</option>
              <option value="SLIDING_WINDOW">Sliding Window (C++ / Redis)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Total Requests ({requests})</label>
            <input
              type="range"
              min="200"
              max="10000"
              step="200"
              value={requests}
              onChange={(e) => setRequests(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer mt-2"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Concurrency Threads</label>
            <input
              type="number"
              min="1"
              max="50"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Request Limit Quota</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10) || 100)}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Window Duration (s)</label>
            <input
              type="number"
              value={window}
              onChange={(e) => setWindow(parseInt(e.target.value, 10) || 60)}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Burst Capacity</label>
            <input
              type="number"
              disabled={algorithm === 'SLIDING_WINDOW'}
              value={burst}
              onChange={(e) => setBurst(parseInt(e.target.value, 10) || limit)}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-40"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={runBenchmark}
            disabled={benchmarking}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-600/25 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            {benchmarking ? 'Running Benchmark...' : 'Run Benchmark'}
          </button>
        </div>
      </div>

      {/* BENCHMARK COMPARISON CHARTS */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Throughput Chart */}
          <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Throughput Comparison (Requests / Sec)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="algorithm" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121522',
                      borderColor: '#23293B',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="rps" name="Throughput (RPS)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency Percentiles Chart */}
          <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Latency Percentiles (µs - Microseconds)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="algorithm" stroke="#475569" fontSize={11} tickLine={false} />
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
                  <Bar dataKey="p50LatencyUs" name="p50 (µs)" fill="#10B981" />
                  <Bar dataKey="p95LatencyUs" name="p95 (µs)" fill="#F59E0B" />
                  <Bar dataKey="p99LatencyUs" name="p99 (µs)" fill="#F43F5E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* BENCHMARK RESULTS TABLE */}
      <div className="bg-[#11131E] border border-[#1E2333] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#1E2333]">
          <h3 className="text-sm font-semibold text-white">Benchmark Execution History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold text-slate-400 bg-[#0C0E16] border-b border-[#1E2333]">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Algorithm</th>
                <th className="py-2.5 px-4 text-right">Requests</th>
                <th className="py-2.5 px-4 text-right">Throughput (RPS)</th>
                <th className="py-2.5 px-4 text-right">Avg Latency</th>
                <th className="py-2.5 px-4 text-right">p99 Latency</th>
                <th className="py-2.5 px-4 text-right">Rejection Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C212E] font-mono">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-[#151928] transition font-sans">
                  <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{r.timestamp}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-200">{r.algorithm}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-300">{r.totalRequests}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-indigo-400 font-bold">{r.rps}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-300">{r.avgLatencyUs} µs</td>
                  <td className="py-2.5 px-4 text-right font-mono text-rose-400">{r.p99LatencyUs} µs</td>
                  <td className="py-2.5 px-4 text-right font-mono text-amber-400 font-semibold">{r.rejectionRate}%</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No benchmarks executed yet. Click &quot;Run Benchmark&quot; to test algorithm performance.
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
