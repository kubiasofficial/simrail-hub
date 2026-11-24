import { Home, Server, Map, Gauge, Package, Settings, type LucideIcon } from 'lucide-react';
import { useNavigation, type PageId } from '@/stores/navigation';

const items: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Domů', icon: Home },
  { id: 'servers', label: 'Online servery', icon: Server },
  { id: 'map', label: 'Živá mapa', icon: Map },
  { id: 'dashboard', label: 'Palubní počítač', icon: Gauge },
  { id: 'mods', label: 'Rozšíření', icon: Package },
  { id: 'settings', label: 'Nastavení', icon: Settings }
];

export function Sidebar() {
  const { page, setPage } = useNavigation();
  return (
    <nav className="flex w-60 shrink-0 flex-col gap-1 border-r border-line bg-ink-950/50 p-3" aria-label="Hlavní navigace">
      <div className="sidebar-brand">SIMRAIL / HUB</div>
      {items.map(({ id, label, icon: Icon }) => {
        const active = page === id;
        return (
          <button
            key={id}
            onClick={() => setPage(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
              active ? 'bg-sky-brand/15 text-white ring-1 ring-sky-brand/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`}
          >
            <Icon size={18} className={active ? 'text-sky-soft' : ''} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
