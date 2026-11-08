import React, { useState } from 'react';
import {
  BookOpen,
  Zap,
  Clock,
  Database,
  Cpu,
  Layers,
  Code,
  CheckCircle,
} from 'lucide-react';

export const DocsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'token-bucket' | 'sliding-window' | 'redis' | 'cpp'>('token-bucket');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div>
        <h1 className="text-base font-semibold text-white">RateGuard Technical Documentation</h1>
        <p className="text-xs text-slate-400">
          In-depth guide to distributed rate-limiting algorithms, C++ concurrency, and Redis Lua scripts
        </p>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#1E2333] text-xs font-medium space-x-6">
        <button
          onClick={() => setActiveTab('token-bucket')}
          className={`pb-2.5 flex items-center gap-1.5 transition ${
            activeTab === 'token-bucket'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Token Bucket Algorithm
        </button>
        <button
          onClick={() => setActiveTab('sliding-window')}
          className={`pb-2.5 flex items-center gap-1.5 transition ${
            activeTab === 'sliding-window'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Sliding Window Algorithm
        </button>
        <button
          onClick={() => setActiveTab('redis')}
          className={`pb-2.5 flex items-center gap-1.5 transition ${
            activeTab === 'redis'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Redis Distributed Mode (Lua)
        </button>
        <button
          onClick={() => setActiveTab('cpp')}
          className={`pb-2.5 flex items-center gap-1.5 transition ${
            activeTab === 'cpp'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          C++ Microservice Engine
        </button>
      </div>

      {/* TAB 1: TOKEN BUCKET */}
      {activeTab === 'token-bucket' && (
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-6 space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 text-indigo-400">
            <Zap className="w-5 h-5" />
            <h2 className="text-sm font-bold text-white">Token Bucket Algorithm</h2>
          </div>

          <p>
            The <strong>Token Bucket algorithm</strong> models rate limiting by accumulating discrete tokens into a bucket of fixed capacity.
            Tokens refill continuously at a defined replenishment rate (r = limit / window).
          </p>

          <div className="p-4 bg-[#0C0E16] rounded-lg border border-[#1E2333] font-mono text-[11px] text-indigo-300 space-y-1">
            <p>// Continuous Token Replenishment Formula</p>
            <p>elapsed_seconds = now - last_refill_timestamp;</p>
            <p>tokens = min(burst_capacity, tokens + (elapsed_seconds * (limit / window_duration)));</p>
            <p>{'if (tokens >= 1) { tokens -= 1; allow(); } else { reject_with_429(); }'}</p>
          </div>

          <h3 className="text-xs font-bold text-white pt-2">Key Advantages</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li><strong>Burst tolerance:</strong> Idle clients accumulate tokens up to `burst_capacity`, absorbing traffic spikes smoothly.</li>
            <li><strong>Constant memory:</strong> State per client consists of just two numerical values: `tokens` (double) and `last_refill` (timestamp).</li>
            <li><strong>Precise recovery:</strong> Accurately computes exact seconds until the next token becomes available (`Retry-After`).</li>
          </ul>
        </div>
      )}

      {/* TAB 2: SLIDING WINDOW */}
      {activeTab === 'sliding-window' && (
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-6 space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 text-cyan-400">
            <Clock className="w-5 h-5" />
            <h2 className="text-sm font-bold text-white">Sliding Window Algorithm</h2>
          </div>

          <p>
            The <strong>Sliding Window algorithm</strong> evaluates request limits over a moving dynamic time window [t - W, t], eliminating
            the boundary attack flaw present in fixed-window limiters where clients can send 2x limit at the window transition.
          </p>

          <div className="p-4 bg-[#0C0E16] rounded-lg border border-[#1E2333] font-mono text-[11px] text-cyan-300 space-y-1">
            <p>// Sliding Window Deque Eviction</p>
            <p>threshold = now - window_duration;</p>
            <p>{'while (!timestamps.empty() && timestamps.front() <= threshold) timestamps.pop_front();'}</p>
            <p>{'if (timestamps.size() < limit) { timestamps.push_back(now); allow(); } else { reject_with_429(); }'}</p>
          </div>

          <h3 className="text-xs font-bold text-white pt-2">Comparison with Token Bucket</h3>
          <p className="text-slate-400">
            While Token Bucket permits bursts up to capacity, Sliding Window guarantees that across <em>any arbitrary</em> moving interval of length W,
            the total request count never exceeds the limit.
          </p>
        </div>
      )}

      {/* TAB 3: REDIS DISTRIBUTED MODE */}
      {activeTab === 'redis' && (
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-6 space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400">
            <Database className="w-5 h-5" />
            <h2 className="text-sm font-bold text-white">Distributed Mode with Redis & Atomic Lua Scripts</h2>
          </div>

          <p>
            When scaling to multiple API server instances, local in-memory counters cannot prevent synchronized over-limit attacks.
            RateGuard uses <strong>Redis</strong> with <strong>atomic Lua scripts</strong> to achieve strictly linearizable rate limiting across clusters.
          </p>

          <div className="p-4 bg-[#0C0E16] rounded-lg border border-[#1E2333] font-mono text-[11px] text-emerald-300 space-y-1">
            <p>-- Atomic Redis Lua: Token Bucket Execution</p>
            <p>local data = redis.call(&apos;HMGET&apos;, KEYS[1], &apos;tokens&apos;, &apos;last_refill_ms&apos;)</p>
            <p>-- Calculate refill and mutate atomically in a single network round-trip</p>
            <p>redis.call(&apos;HMSET&apos;, KEYS[1], &apos;tokens&apos;, tokens, &apos;last_refill_ms&apos;, now_ms)</p>
            <p>redis.call(&apos;EXPIRE&apos;, KEYS[1], window_sec * 2) -- Automatic state cleanup</p>
          </div>

          <h3 className="text-xs font-bold text-white pt-2">Key Highlights</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li><strong>Single round-trip:</strong> Entire read-compute-write cycle executes inside Redis engine without network race conditions.</li>
            <li><strong>Automatic TTL eviction:</strong> Inactive keys expire automatically after 2x window duration, preventing unbounded memory growth.</li>
          </ul>
        </div>
      )}

      {/* TAB 4: C++ ENGINE */}
      {activeTab === 'cpp' && (
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-6 space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 text-purple-400">
            <Cpu className="w-5 h-5" />
            <h2 className="text-sm font-bold text-white">C++ Microservice Rate-Limiting Engine</h2>
          </div>

          <p>
            The core algorithms are implemented in <strong>native C++</strong> (compiled with GCC / MSVC) and served via a lightweight HTTP microservice on port 7070.
          </p>

          <h3 className="text-xs font-bold text-white">Why a Separate Microservice over Node.js C++ N-API?</h3>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong>Fault Isolation:</strong> Memory violations or panics in C++ cannot crash the Node.js API gateway.
            </li>
            <li>
              <strong>Independent Horizontal Scalability:</strong> Can be deployed as a dedicated container sidecar or cluster gateway (similar to Lyft / Envoy RateLimit).
            </li>
            <li>
              <strong>Sub-millisecond Latency:</strong> Local loopback evaluation completes in under <strong>0.5ms</strong>, far faster than typical cloud network hops.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
