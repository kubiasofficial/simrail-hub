import {useCallback,useEffect,useRef,useState} from 'react';
import {ChevronDown,X,Check,ArrowLeft} from 'lucide-react';
import countries from '@/data/countries.json';
import {LANGUAGE_NAMES,type AppLocale} from '@/types/locale';
import {useSettings} from '@/stores/settings';
const choices:Record<string,AppLocale[]>={be:['nl','fr','de'],cy:['el','tr'],fi:['fi','sv'],ie:['en','ga'],lu:['fr','de','lb'],mt:['mt','en']};
export function LanguageMenu(){
 const {settings,update}=useSettings();const [open,setOpen]=useState(false);
 return <><button className="language-toggle no-drag" aria-label="Vybrat jazyk aplikace" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><img src={'./assets/flags/'+settings.appCountry+'.png'} alt=""/>{LANGUAGE_NAMES[settings.appLanguage]}<ChevronDown size={13}/></button>{open&&<LanguageDialog close={()=>setOpen(false)} select={(country,locale)=>{void update({appCountry:country,appLanguage:locale});setOpen(false);}}/>}</>;
}
function LanguageDialog({close,select}:{close:()=>void;select:(country:string,locale:AppLocale)=>void}){
 const ref=useRef<HTMLDialogElement>(null),[country,setCountry]=useState<string|null>(null);const current=useSettings(s=>s.settings.appCountry);
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{const d=ref.current!;d.showModal();const listener=()=>closeRef.current();d.addEventListener('close',listener);return()=>{d.removeEventListener('close',listener);d.close();};},[]);
 const displayName=(code:string)=>{try{return new Intl.DisplayNames([useSettings.getState().settings.appLanguage],{type:'region'}).of(code.toUpperCase())??code;}catch{return code;}};
 return <dialog ref={ref} className="language-panel" aria-labelledby="language-title" onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
 <header className="language-head"><div><div className="eyebrow">SIMRAIL HUB</div><h2 id="language-title">Vyber si jazyk.</h2></div><button className="icon-button" onClick={close} aria-label="Zavřít"><X size={18}/></button></header>
 {country?<div className="language-options"><button onClick={()=>setCountry(null)} className="country-option"><ArrowLeft size={14}/>Zpět</button>{choices[country].map(locale=><button key={locale} className="country-option" onClick={()=>select(country,locale)}><img src={'./assets/flags/'+country+'.png'} alt=""/><strong>{LANGUAGE_NAMES[locale]}</strong></button>)}</div>:
 <div className="language-options">{countries.map(([code,name,native,locale])=><button key={code} className="country-option" aria-pressed={current===code} onClick={()=>choices[code]?setCountry(code):select(code,locale as AppLocale)}><img src={'./assets/flags/'+code+'.png'} alt=""/><span className="country-text"><strong>{native}</strong><small>{displayName(code)}</small></span>{current===code&&<span className="selection-check"><Check size={12}/></span>}</button>)}</div>}
 <footer className="language-footer"><span>Evropská unie · 27 zemí</span><button onClick={()=>select('gb','en')}><img src="./assets/flags/gb.png" alt=""/>English</button></footer></dialog>;
}
