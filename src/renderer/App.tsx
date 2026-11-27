import {DrivingHost} from '@/components/DrivingControls';
import {MusicRadioHost} from '@/components/MusicRadio';
import {ShiftStatus} from '@/components/ShiftStatus';
import {ShiftPage} from '@/pages/ShiftPage';
import {DlcPage} from '@/pages/DlcPage';
import {ReleaseHighlights} from '@/components/ReleaseHighlights';
import {HistoryPage} from '@/pages/HistoryPage';
import {Localization} from '@/components/Localization';
import { useEffect } from 'react';
import { UpdatePanel } from '@/components/UpdatePanel';
import { useAutomaticUpdates } from '@/stores/automaticUpdates';
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
  const animations = useSettings(s=>s.settings.animations);
  useEffect(()=>{document.documentElement.dataset.animations=animations?'on':'off';},[animations]);
  const load = useSettings((s) => s.load);
  useEffect(() => { void load(); }, [load]);

  useEffect(()=>{if(isStandaloneDashboard())return;void useAutomaticUpdates.getState().refresh();const id=setInterval(()=>void useAutomaticUpdates.getState().refresh(),2000);return()=>clearInterval(id);},[]);

  if (isStandaloneDashboard()) {
    return <div className="railway-standalone h-full overflow-y-auto"><Localization/><DashboardPage standalone /></div>;
  }
  return (
    <div className="railway-shell flex h-full flex-col">
      <Localization/><TitleBar /><ReleaseHighlights/><MusicRadioHost/>
      <UpdatePanel compact/><ShiftStatus/><DrivingHost/>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main data-page={page} className={`min-w-0 flex-1 ${page === 'map' ? 'overflow-hidden' : 'overflow-y-auto p-8'}`}>
          {page === 'home' && <HomePage />}
          {page === 'servers' && <ServersPage />}
          {page === 'map' && <MapPage />}
          <div hidden={page !== 'dashboard'} className={page==='dashboard'?'page-enter':''}><DashboardPage active={page==='dashboard'}/></div>
          {page === 'shift' && <ShiftPage />}
          {page === 'dlc' && <DlcPage />}
          {page === 'history' && <HistoryPage />}
          {page === 'mods' && <ModsPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
