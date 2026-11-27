import {Clock,Home,Server,Map,Monitor,Package,Settings,CalendarClock,Layers,TrainFront,type LucideIcon} from 'lucide-react';
import {useNavigation,type PageId} from '@/stores/navigation';
const items:{id:PageId;label:string;icon:LucideIcon}[]=[
 {id:'home',label:'Domů',icon:Home},{id:'servers',label:'Online servery',icon:Server},{id:'map',label:'Živá mapa',icon:Map},{id:'dashboard',label:'Palubní počítač',icon:Monitor},{id:'shift',label:'Směna',icon:CalendarClock},{id:'history',label:'Historie a oblíbené',icon:Clock},{id:'dlc',label:'Dostupná DLC',icon:Layers},{id:'mods',label:'Rozšíření launcheru',icon:Package},{id:'settings',label:'Nastavení',icon:Settings}
];
export function Sidebar(){const {page,setPage}=useNavigation();return <nav className="railway-sidebar" aria-label="Hlavní navigace">{items.map(({id,label,icon:Icon})=><button key={id} className={id==='dlc'?'nav-separated':''} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><Icon size={21}/><span>{label}</span></button>)}<footer><TrainFront size={28}/><div>SimRail Hub<small>Komunitní launcher</small></div></footer></nav>;}
