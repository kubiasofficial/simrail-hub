import {LanguageMenu} from '@/components/LanguageMenu';
import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, TrainFront } from 'lucide-react';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [fixtures, setFixtures] = useState(false);
  const [testChannel,setTestChannel]=useState(false);
  const [version,setVersion]=useState('');

  useEffect(() => {
    const api = window.simrailHub;
    if (!api) return;
    void api.getAppInfo().then(info=>{setTestChannel(info.channel==='test');setVersion(info.version);}).catch(()=>undefined);
    void api.call('diag:info').then((d) => setFixtures(d.fixtures)).catch(() => undefined);
    void api.getWindowState().then((s) => setMaximized(s.maximized));
    return api.onWindowStateChanged((s) => setMaximized(s.maximized));
  }, []);

  const btn = 'no-drag grid h-9 w-12 place-items-center text-slate-400 transition-colors hover:bg-white/10 hover:text-white';

  return (
    <header className="release-titlebar drag flex h-9 items-center justify-between border-b border-line bg-ink-950/80">
      <div className="flex items-center gap-2 pl-3 text-[13px] text-slate-300">
        <TrainFront size={30} className="text-sky-brand" />
        <span className="railway-wordmark">SimRail Hub<small>COMMUNITY EDITION</small></span><span className="railway-version">v{version||'—'} · {testChannel?'TEST':'BETA'}</span>{testChannel&&<span className="test-channel-badge">TESTOVACÍ VERZE</span>}
        {fixtures && <span className="ml-3 rounded bg-fuchsia-500/90 px-2 py-0.5 text-[11px] font-bold text-white">UKÁZKOVÁ DATA – ne živý provoz</span>}
      </div>
      <div className="flex items-center"><LanguageMenu/>
        <button className={btn} aria-label="Minimalizovat" onClick={() => void window.simrailHub?.minimize()}>
          <Minus size={15} />
        </button>
        <button
          className={btn}
          aria-label={maximized ? 'Obnovit velikost okna' : 'Maximalizovat'}
          onClick={() => void window.simrailHub?.toggleMaximize().then((s) => setMaximized(s.maximized))}
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button className={`${btn} hover:!bg-red-600`} aria-label="Zavřít" onClick={() => void window.simrailHub?.close()}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
