import React, { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { LiveTrafficPage } from './pages/LiveTrafficPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { BenchmarksPage } from './pages/BenchmarksPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';

export function App() {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [timeRange, setTimeRange] = useState<string>('1h');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage timeRange={timeRange} onNavigate={setActivePage} />;
      case 'api-keys':
        return <ApiKeysPage />;
      case 'policies':
        return <PoliciesPage />;
      case 'playground':
        return <PlaygroundPage />;
      case 'live-traffic':
        return <LiveTrafficPage />;
      case 'analytics':
        return <AnalyticsPage timeRange={timeRange} />;
      case 'benchmarks':
        return <BenchmarksPage />;
      case 'settings':
        return <SettingsPage />;
      case 'docs':
        return <DocsPage />;
      default:
        return <DashboardPage timeRange={timeRange} onNavigate={setActivePage} />;
    }
  };

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={setActivePage}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
    >
      {renderPage()}
    </AppLayout>
  );
}

export default App;
