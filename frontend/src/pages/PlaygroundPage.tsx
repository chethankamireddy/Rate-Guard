import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Send,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Key,
  Code,
  FileText,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKey } from '../types';

export const PlaygroundPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');

  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [path, setPath] = useState<string>('/api/demo/products');
  const [requestBody, setRequestBody] = useState<string>('{\n  "cartItems": ["item_1", "item_2"],\n  "paymentMethod": "credit_card"\n}');
  const [sending, setSending] = useState<boolean>(false);

  // Single Response State
  const [response, setResponse] = useState<any | null>(null);

  // Burst 20 Requests State
  const [burstResults, setBurstResults] = useState<Array<{ index: number; status: number; allowed: boolean; timeMs: number }> | null>(null);
  const [bursting, setBursting] = useState<boolean>(false);

  useEffect(() => {
    api.listApiKeys().then((data) => {
      setKeys(data);
      if (data.length > 0) {
        // Find rawKey or default key
        setSelectedKey(data[0].id);
      }
    });
  }, []);

  const handleSelectPreset = (m: 'GET' | 'POST', p: string, defaultBody?: string) => {
    setMethod(m);
    setPath(p);
    if (defaultBody) setRequestBody(defaultBody);
  };

  const handleSendSingle = async () => {
    try {
      setSending(true);
      setBurstResults(null);
      const res = await api.sendTestRequest({
        method,
        path,
        apiKey: selectedKey || undefined,
        body: method === 'POST' ? requestBody : undefined,
      });
      setResponse(res);
    } catch (err: any) {
      alert(err.message || 'Request failed');
    } finally {
      setSending(false);
    }
  };

  const handleSendBurst20 = async () => {
    try {
      setBursting(true);
      setBurstResults([]);
      const results: Array<{ index: number; status: number; allowed: boolean; timeMs: number }> = [];

      for (let i = 1; i <= 20; i++) {
        const res = await api.sendTestRequest({
          method,
          path,
          apiKey: selectedKey || undefined,
          body: method === 'POST' ? requestBody : undefined,
        });

        const entry = {
          index: i,
          status: res.status,
          allowed: res.status !== 429,
          timeMs: res.timeMs,
        };
        results.push(entry);
        setBurstResults([...results]);
        // Last response into main panel
        if (i === 20) setResponse(res);
      }
    } catch (err: any) {
      alert(err.message || 'Burst test failed');
    } finally {
      setBursting(false);
    }
  };

  const allowedBurstCount = burstResults ? burstResults.filter((r) => r.allowed).length : 0;
  const rejectedBurstCount = burstResults ? burstResults.filter((r) => !r.allowed).length : 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">Interactive API Playground</h1>
          <p className="text-xs text-slate-400">
            Execute real HTTP requests against RateGuard-protected endpoints and inspect response headers
          </p>
        </div>
      </div>

      {/* PRESET ENDPOINT BUTTONS */}
      <div className="bg-[#11131E] border border-[#1E2333] p-4 rounded-xl space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Quick Endpoint Presets
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSelectPreset('GET', '/api/demo/products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
              path === '/api/demo/products'
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-[#0C0E16] text-slate-300 border-[#23293B] hover:border-slate-500'
            }`}
          >
            <span className="text-indigo-400 font-bold mr-1.5">GET</span>/api/demo/products
          </button>

          <button
            onClick={() => handleSelectPreset('GET', '/api/demo/orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
              path === '/api/demo/orders'
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-[#0C0E16] text-slate-300 border-[#23293B] hover:border-slate-500'
            }`}
          >
            <span className="text-indigo-400 font-bold mr-1.5">GET</span>/api/demo/orders
          </button>

          <button
            onClick={() => handleSelectPreset('GET', '/api/demo/profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
              path === '/api/demo/profile'
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-[#0C0E16] text-slate-300 border-[#23293B] hover:border-slate-500'
            }`}
          >
            <span className="text-indigo-400 font-bold mr-1.5">GET</span>/api/demo/profile
          </button>

          <button
            onClick={() => handleSelectPreset('POST', '/api/demo/checkout', '{\n  "cartItems": ["item_1", "item_2"],\n  "paymentMethod": "credit_card",\n  "customerEmail": "customer@acme.com"\n}')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
              path === '/api/demo/checkout'
                ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40'
                : 'bg-[#0C0E16] text-slate-300 border-[#23293B] hover:border-slate-500'
            }`}
          >
            <span className="text-cyan-400 font-bold mr-1.5">POST</span>/api/demo/checkout
          </button>
        </div>
      </div>

      {/* REQUEST BUILDER */}
      <div className="bg-[#11131E] border border-[#1E2333] p-5 rounded-xl space-y-4">
        {/* Method, URL, and Send Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Method selector */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="bg-[#0C0E16] border border-[#23293B] text-slate-200 font-bold font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          {/* Path Input */}
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/api/demo/..."
            className="flex-1 bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />

          {/* Send Single Button */}
          <button
            onClick={handleSendSingle}
            disabled={sending || bursting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending...' : 'Send Request'}
          </button>

          {/* SEND 20 REQUESTS BURST BUTTON */}
          <button
            onClick={handleSendBurst20}
            disabled={sending || bursting}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-white" />
            {bursting ? 'Simulating Burst...' : 'Send 20 Requests'}
          </button>
        </div>

        {/* API Key Selector */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#1C212E] text-xs">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px] font-medium">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            Authenticate As:
          </span>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="bg-[#0C0E16] border border-[#23293B] rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer flex-1 max-w-md"
          >
            <option value="">Anonymous / IP Client</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id} className="bg-[#121522]">
                {k.name} ({k.policy ? `${k.policy.name} - ${k.policy.requestLimit} req` : 'Default'})
              </option>
            ))}
          </select>
        </div>

        {/* Body Editor for POST */}
        {method === 'POST' && (
          <div className="space-y-1.5 pt-2 border-t border-[#1C212E]">
            <span className="text-[11px] text-slate-400 font-medium">Request JSON Body</span>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              rows={4}
              className="w-full bg-[#0C0E16] border border-[#23293B] rounded-lg p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* BURST SIMULATION RESULTS BANNER (When "Send 20 Requests" is clicked) */}
      {burstResults && (
        <div className="bg-[#11131E] border border-amber-500/30 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Burst Rate-Limit Simulation Result</h3>
                <p className="text-xs text-slate-400">Sent 20 consecutive requests to test policy threshold</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                {allowedBurstCount} Accepted (200 OK)
              </span>
              <span className="text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30">
                {rejectedBurstCount} Throttled (429)
              </span>
            </div>
          </div>

          {/* Visual dots progression */}
          <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5 pt-2">
            {burstResults.map((r) => (
              <div
                key={r.index}
                title={`Request #${r.index}: ${r.status} (${r.timeMs}ms)`}
                className={`h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  r.allowed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                #{r.index}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESPONSE INSPECTOR PANEL */}
      {response && (
        <div className="bg-[#11131E] border border-[#1E2333] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2333]">
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold ${
                  response.status === 200 || response.status === 201
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {response.status} {response.status === 200 ? 'OK' : response.status === 201 ? 'CREATED' : 'TOO MANY REQUESTS'}
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                {response.timeMs} ms
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">Response Payload</span>
          </div>

          {/* Rate Limit Headers Callout */}
          <div className="bg-[#0C0E16] border border-[#1E2333] rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Evaluated Rate-Limit Headers
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2 rounded bg-[#111420] border border-[#1D2232]">
                <p className="text-[10px] text-slate-400 font-sans">X-RateLimit-Limit</p>
                <p className="font-bold text-slate-200 mt-0.5">{response.rateLimitHeaders.limit || 'N/A'}</p>
              </div>
              <div className="p-2 rounded bg-[#111420] border border-[#1D2232]">
                <p className="text-[10px] text-slate-400 font-sans">X-RateLimit-Remaining</p>
                <p className="font-bold text-emerald-400 mt-0.5">{response.rateLimitHeaders.remaining || '0'}</p>
              </div>
              <div className="p-2 rounded bg-[#111420] border border-[#1D2232]">
                <p className="text-[10px] text-slate-400 font-sans">X-RateLimit-Reset</p>
                <p className="font-bold text-slate-300 mt-0.5">{response.rateLimitHeaders.reset || 'N/A'}</p>
              </div>
              <div className="p-2 rounded bg-[#111420] border border-[#1D2232]">
                <p className="text-[10px] text-slate-400 font-sans">Retry-After (Seconds)</p>
                <p className="font-bold text-rose-400 mt-0.5">{response.rateLimitHeaders.retryAfter || '0'}</p>
              </div>
            </div>
          </div>

          {/* Response JSON Body */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Response Body</span>
            <pre className="p-4 rounded-lg bg-[#0C0E16] border border-[#1E2333] text-xs font-mono text-slate-200 overflow-x-auto max-h-72">
              {JSON.stringify(response.body, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
