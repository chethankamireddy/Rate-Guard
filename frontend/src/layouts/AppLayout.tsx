import React, { useState } from 'react';
import {
  ShieldAlert,
  LayoutDashboard,
  Key,
  Sliders,
  Terminal,
  Activity,
  BarChart3,
  Zap,
  Settings,
  BookOpen,
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Bell,
  ChevronRight,
  User,
  Sparkles,
} from 'lucide-react';

interface AppLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  live?: boolean;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activePage,
  onNavigate,
  timeRange,
  onTimeRangeChange,
  children,
}) => {
  const [environment, setEnvironment] = useState('Development');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navigation: NavGroup[] = [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'TRAFFIC MANAGEMENT',
      items: [
        { id: 'api-keys', label: 'API Keys', icon: Key },
        { id: 'policies', label: 'Rate Limit Policies', icon: Sliders },
        { id: 'playground', label: 'API Playground', icon: Terminal, badge: 'Interactive' },
      ],
    },
    {
      group: 'OBSERVABILITY',
      items: [
        { id: 'live-traffic', label: 'Live Traffic', icon: Activity, live: true },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'benchmarks', label: 'Benchmarks', icon: Zap },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'docs', label: 'Documentation', icon: BookOpen },
      ],
    },
  ];

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Global traffic telemetry, active limits, and rate-limiting KPIs' },
    'api-keys': { title: 'API Key Management', subtitle: 'Manage client authentication tokens, hashing, and quota assignments' },
    policies: { title: 'Rate Limit Policies', subtitle: 'Configure Token Bucket and Sliding Window traffic-shaping rules' },
    playground: { title: 'API Testing Playground', subtitle: 'Test endpoints, simulate bursts, and verify rate-limit HTTP headers' },
    'live-traffic': { title: 'Live Request Stream', subtitle: 'Real-time WebSocket telemetry of incoming API evaluations' },
    analytics: { title: 'Traffic Analytics', subtitle: 'Deep observability, latency distributions, and computed insights' },
    benchmarks: { title: 'Algorithm Benchmarks', subtitle: 'Compare throughput, p99 latency, and rejection rates in real time' },
    settings: { title: 'System & Engine Settings', subtitle: 'Redis clustering, C++ microservice configs, and environment health' },
    docs: { title: 'Architecture & Docs', subtitle: 'Technical manual on Token Bucket, Sliding Window, and Redis Lua' },
  };

  const searchableItems = [
    { id: 'dashboard', label: 'Dashboard Overview', group: 'Overview' },
    { id: 'api-keys', label: 'Create New API Key', group: 'Traffic Management' },
    { id: 'policies', label: 'Configure Rate Limit Policies', group: 'Traffic Management' },
    { id: 'playground', label: 'API Playground (Send 20 Requests)', group: 'Testing' },
    { id: 'live-traffic', label: 'Live WebSocket Traffic Monitor', group: 'Observability' },
    { id: 'analytics', label: 'Traffic & Latency Analytics', group: 'Observability' },
    { id: 'benchmarks', label: 'Run Algorithm Benchmark (k6 / Native)', group: 'Benchmarking' },
    { id: 'settings', label: 'Redis & C++ Engine Settings', group: 'System' },
    { id: 'docs', label: 'Read Architecture Documentation', group: 'System' },
  ];

  const filteredSearch = searchQuery.trim() === ''
    ? searchableItems
    : searchableItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F] text-slate-100 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#1C212E] bg-[#0C0E16]">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-[#1C212E] gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">RateGuard</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">v2.4</span>
            </div>
            <p className="text-[11px] text-slate-400">Traffic & Rate Limiting</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigation.map((group) => (
            <div key={group.group} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {group.group}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151824]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.live && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Health & Environment */}
        <div className="p-3 border-t border-[#1C212E] bg-[#0A0C13] space-y-2.5 text-xs">
          <div className="bg-[#121522] rounded-lg p-2.5 border border-[#1E2333] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Redis State
              </span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono font-medium text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                ACTIVE
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                C++ Engine
              </span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono font-medium text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                HEALTHY
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-semibold text-[10px]">
                CR
              </div>
              <div className="truncate">
                <p className="font-medium text-slate-200 text-xs">Chethan Reddy</p>
                <p className="text-[10px] text-slate-400">Platform Admin</p>
              </div>
            </div>
            <div className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Dev
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="h-16 flex-shrink-0 border-b border-[#1C212E] bg-[#0C0E16]/90 backdrop-blur px-6 flex items-center justify-between z-10">
          {/* Breadcrumbs & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>RateGuard</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-200 font-semibold capitalize">
                {pageTitles[activePage]?.title || activePage}
              </span>
            </div>
          </div>

          {/* Controls: Search, TimeRange, Env, Actions */}
          <div className="flex items-center gap-3">
            {/* Global Quick Search Button */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141824] border border-[#23293B] text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search platform...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#1E2333] rounded border border-[#2C3347]">
                Ctrl K
              </kbd>
            </button>

            {/* Global Time Range Selector */}
            <div className="flex items-center gap-1.5 bg-[#141824] border border-[#23293B] rounded-lg px-2.5 py-1 text-xs">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={timeRange}
                onChange={(e) => onTimeRangeChange(e.target.value)}
                className="bg-transparent text-slate-300 text-xs font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="5m" className="bg-[#121522] text-slate-200">Last 5 minutes</option>
                <option value="15m" className="bg-[#121522] text-slate-200">Last 15 minutes</option>
                <option value="1h" className="bg-[#121522] text-slate-200">Last 1 hour</option>
                <option value="24h" className="bg-[#121522] text-slate-200">Last 24 hours</option>
                <option value="7d" className="bg-[#121522] text-slate-200">Last 7 days</option>
              </select>
            </div>

            {/* Environment Dropdown */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#141824] border border-[#23293B] rounded-lg px-2.5 py-1 text-xs text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="Development" className="bg-[#121522]">Development</option>
                <option value="Staging" className="bg-[#121522]">Staging</option>
                <option value="Production" className="bg-[#121522]">Production</option>
              </select>
            </div>

            {/* Notifications */}
            <button className="w-8 h-8 rounded-lg bg-[#141824] border border-[#23293B] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-600 transition">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#090A0F]">
          {children}
        </main>
      </div>

      {/* QUICK COMMAND / SEARCH MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#121522] border border-[#252B3E] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center px-4 py-3 border-b border-[#202638] gap-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints, policies, tools, or press Esc to close..."
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-xs px-2 py-0.5 rounded bg-[#1B2133] text-slate-400 hover:text-slate-200"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredSearch.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setShowSearchModal(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs hover:bg-[#1A1F30] transition text-slate-300 hover:text-white"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.group}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
