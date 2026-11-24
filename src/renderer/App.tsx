import { useEffect } from 'react';
import { TitleBar } from '@/components/TitleBar';
import { Sidebar } from '@/components/Sidebar';
import { HomePage } from '@/pages/HomePage';
import { ServersPage } from '@/pages/ServersPage';
import { MapPage } from '@/pages/MapPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ModsPage } from '@/pages/ModsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useNavigation } from '@/stores/navigation';
import { useSettings } from '@/stores/settings';

const isStandaloneDashboard = () => location.hash.startsWith('#dashboard');

export function App() {
  const page = useNavigation((s) => s.page);
  const load = useSettings((s) => s.load);
  useEffect(() => { void load(); }, [load]);

  if (isStandaloneDashboard()) {
    return <div className="h-full overflow-y-auto"><DashboardPage standalone /></div>;
  }
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className={`min-w-0 flex-1 ${page === 'map' ? 'overflow-hidden' : 'overflow-y-auto p-8'}`}>
          {page === 'home' && <HomePage />}
          {page === 'servers' && <ServersPage />}
          {page === 'map' && <MapPage />}
          {page === 'dashboard' && <DashboardPage />}
          {page === 'mods' && <ModsPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
