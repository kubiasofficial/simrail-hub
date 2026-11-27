'use strict';
// Pairing credentials are kept only in the HttpOnly cookie, never in shared URLs.
if(new URLSearchParams(location.search).has('pair'))history.replaceState(null,'','/');
const el=id=>document.getElementById(id),set=(id,value)=>{el(id).textContent=value;};
const MOBILE_REVISION='2026-11-28.1';
let ageAtReceipt=0,receivedAt=0,requestEpoch=0,controller=null,lastResume=-Infinity;
const dataAge=()=>latest?ageAtReceipt+Math.max(0,performance.now()-receivedAt):Infinity;
let latest=null,busy=false,expired=false,networkError=false,tab='overview',map=null,trainMarker=null,leafletPromise=null,route=null,routeBusy=false,routeFailed=false,following=true,previousPosition=null,heading=null;
let routeGeneration=0;
const stations=new Map(),rows=new Map(),routeLayers=new Map();let routeKey='',routeIndex=null;
const trainSVG='<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="2" width="14" height="17" rx="5"/><path d="M5 10h14M12 3v7M8 22l2-3m6 3-2-3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>';
const stationSVG='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>';
const textNode=s=>{const n=document.createElement('span');n.textContent=s;return n;};
function connection(){
 const age=dataAge();
 const state=expired||networkError||age>=30000||latest?.model?.connection==='lost'?'lost':age>=15000||latest?.model?.connection==='stale'?'stale':'live';
 document.body.dataset.connection=state;
 if(latest&&state!=='live'){set('current','ČEKÁM NA DATA');set('motion-caption','Poslední známá poloha');el('journey-panel').dataset.near='false';}
 el('connection').dataset.state=state;set('connection',expired?'Párování vypršelo':!latest?'Připojuji…':state==='lost'?'Spojení ztraceno':state==='stale'?'Zastaralá data':'Živá data');
 set('age',latest?'Data před '+Math.floor(age/1000)+' s':'Čekám na data');
 if(!expired&&latest&&state!=='live')set('message','Zobrazuji poslední přijatá data. Ověřte připojení a spuštěný launcher.');
 else if(!expired&&latest&&!networkError)set('message','');
}
function render(){
 const m=latest?.model;if(!m)return;
 const presentation=latest.presentation,category=latest.category;
 set('train','Vlak '+m.trainNumber);set('route',(m.start||'—')+' → '+(m.end||'—'));
 set('category',category?.label||'');el('category').hidden=!category?.label;
 document.documentElement.style.setProperty('--train-color',/^#[a-f0-9]{6}$/i.test(category?.color||'')?category.color:'#54717e');
 set('previous',m.previous||'Začátek trasy');set('current',presentation?.motion?.label||(m.current?'VE STANICI':m.phase==='moving'?'NA TRATI':'POLOHA NEPOTVRZENA'));
 set('motion-caption',m.trainNumber);set('current-station',presentation?.motion?.caption||m.current||'Mezi stanicemi');set('next',m.next||'Další zastávka není známá');
 el('journey-panel').dataset.phase=m.phase;el('journey-panel').dataset.near=String(dataAge()<15000&&m.phase==='moving'&&!!m.next&&m.distanceToFollowingStopM!==null&&m.distanceToFollowingStopM<=1000);
 set('speed',m.speedKmh===null?'—':String(Math.round(m.speedKmh)));
 const d=m.delayMin,observed=m.delayKind==='observed',delay=presentation?.delay;
 set('delay-label',observed?'Zpoždění · odhad':'Zpoždění');set('delay',delay?.label||(observed?(d===0?'Včas':(d>0?'+':'−')+Math.abs(d)+' min'):'Zatím neurčeno'));
 set('delay-note',(delay?.severity==='critical'?'Výrazné zpoždění · ':'')+(delay?.caption||'Čekám na první potvrzený průjezd'));
 el('delay-card').className=observed&&d>20?'critical':observed&&d>0?'late':'';
 set('distance',m.distanceToFollowingStopM===null?'Vzdálenost není dostupná':(m.distanceToFollowingStopM<1000?Math.round(m.distanceToFollowingStopM)+' m':(m.distanceToFollowingStopM/1000).toLocaleString('cs-CZ',{maximumFractionDigits:1,minimumFractionDigits:1})+' km')+' k další zastávce · vzdušně');
 for(const kind of ['arrival','departure']){
  const t=presentation?.times?.[kind],day=t?.dayOffset?(' '+(t.dayOffset>0?'+':'')+t.dayOffset+' den'):'';
  set(kind,(t?.display||'—')+day);set(kind+'-note',!t?.plan?'Údaj chybí':t.estimated?'odhad · plán '+t.plan:'plán');el(kind).parentElement.dataset.estimated=String(!!t?.estimated);
 }
 const identity=latest.app;set('version',identity?'v'+identity.version+(identity.channel==='test'?' · TEST':''):'Starší verze displeje');
 el('version').title=identity?.buildId?'Sestavení '+identity.buildId:'Mobilní rozhraní '+(identity?.mobileRevision||'neurčeno');el('revision-note').hidden=identity?.mobileRevision===MOBILE_REVISION;
 if(tab==='schedule')renderSchedule();if(tab==='map-view')void renderMap();connection();
}
function renderSchedule(){
 const list=el('journey'),visible=latest.model.rows.filter(r=>r.status!=='passed'&&(el('technical').checked||r.passengerStop));const wanted=new Set();
 for(const r of visible){const key=String(r.index);wanted.add(key);let item=rows.get(key);if(!item){item=document.createElement('article');const names=document.createElement('div'),name=document.createElement('strong'),kind=document.createElement('small'),times=document.createElement('div'),plan=document.createElement('strong'),estimate=document.createElement('small');times.className='row-times';estimate.className='row-estimate';names.append(name,kind);times.append(plan,estimate);item.append(names,times);rows.set(key,item);}
 item.className=r.standing||r.status==='target'||(r.passengerStop&&r.name===latest.model.next)?'active':'';
 item.children[0].children[0].textContent=r.name;item.children[0].children[1].textContent=r.passengerStop?'Zastávka pro cestující':r.isStop?'Technický pobyt':r.isStop===false?'Průjezd':'Typ zastavení neznámý';
 item.children[1].children[0].textContent=(r.arrival||'—')+(r.departure&&r.departure!==r.arrival?' / '+r.departure:'');item.children[1].children[1].textContent=r.estimated?'Odhad '+r.estimated:'';
 // Move only when ordering changes; unchanged rows retain their DOM nodes.
 const at=list.children[visible.indexOf(r)];if(at!==item)list.insertBefore(item,at||null);
 }
 for(const [key,item] of rows)if(!wanted.has(key)){item.remove();rows.delete(key);}el('empty-schedule').hidden=visible.length>0;
}
function ensureLeaflet(){
 if(!leafletPromise)leafletPromise=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='/leaflet.css';document.head.append(css);const script=document.createElement('script');script.src='/leaflet.js';script.onload=resolve;script.onerror=()=>{script.remove();css.remove();leafletPromise=null;reject(Error('Mapu nelze načíst.'));};document.head.append(script);});return leafletPromise;
}
async function loadRoute(){
 if(routeBusy||route||routeFailed)return;routeBusy=true;const generation=routeGeneration;
 try{const r=await fetch('/api/route',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error();const value=await r.json();if(generation!==routeGeneration)return;route=value;if(tab==='map-view')drawRoute();}
 catch{if(generation!==routeGeneration)return;routeFailed=true;set('map-status','Traťová data nyní nejsou dostupná. Polohu vlaku lze dál sledovat.');}
 finally{if(generation===routeGeneration)routeBusy=false;}
}
function drawRoute(){
 if(!map||tab!=='map-view'||!route||!latest)return;const idx=latest.train?.timetableIndex,key=(route.runId||route.trainNumber)+':'+(latest.category?.color||'');
 if(routeKey===key&&routeIndex===idx)return;routeKey=key;routeIndex=idx;
 const wanted=new Set();for(const s of route.sections){const id=s.fromIndex+':'+s.toIndex;wanted.add(id);let layer=routeLayers.get(id);const passed=Number.isInteger(idx)&&s.toIndex<idx;
 if(!layer){layer=L.polyline(s.coordinates,{interactive:false,weight:4,opacity:.9}).addTo(map);routeLayers.set(id,layer);}
 layer.setStyle({color:passed?'#78858d':latest.category?.color||'#9ad8ed',opacity:passed?.5:.95});}
 for(const [id,layer] of routeLayers)if(!wanted.has(id)){layer.remove();routeLayers.delete(id);}
 set('map-status',route.sections.length?'Dostupný herní úsek · orientační vedení po kolejích OSM'+(route.missingSections?' · neúplná návaznost':''):'Pro tento vlak chybí propojená traťová data.');
}
async function renderMap(){
 try{await ensureLeaflet();if(tab!=='map-view'||!latest)return;const m=latest.model;if(!map){map=L.map('map',{preferCanvas:true}).setView([m.lat,m.lon],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ODbL',maxZoom:18,className:'dark-tiles',keepBuffer:1,updateWhenIdle:true}).addTo(map);map.on('dragstart',()=>{following=false;el('follow').setAttribute('aria-pressed','false');});}
 map.invalidateSize({animate:false});const wanted=new Set();for(const s of latest.stations){const key=s.name;wanted.add(key);let marker=stations.get(key);if(!marker){marker=L.marker([s.lat,s.lon],{icon:L.divIcon({className:'mobile-station',html:stationSVG,iconSize:[18,18],iconAnchor:[9,9]}),zIndexOffset:0}).bindTooltip(textNode(s.name)).addTo(map);stations.set(key,marker);}else marker.setLatLng([s.lat,s.lon]);}
 for(const [key,marker] of stations)if(!wanted.has(key)){marker.remove();stations.delete(key);}
 const pos=[m.lat,m.lon];if(previousPosition){const dx=(pos[1]-previousPosition[1])*Math.cos(pos[0]*Math.PI/180),dy=pos[0]-previousPosition[0];if(Math.hypot(dx,dy)*111320>=5){heading=Math.atan2(dx,dy)*180/Math.PI;previousPosition=pos;}}else previousPosition=pos;
 if(!trainMarker){trainMarker=L.marker(pos,{icon:L.divIcon({className:'mobile-train',html:trainSVG,iconSize:[34,34],iconAnchor:[17,17]}),zIndexOffset:1000}).addTo(map);}else trainMarker.setLatLng(pos);
 const node=trainMarker.getElement();node.style.setProperty('--train-color',/^#[a-f0-9]{6}$/i.test(latest.category?.color||'')?latest.category.color:'#2265af');
 let arrow=node.querySelector('.direction');if(heading!==null&&m.speedKmh>1){if(!arrow){arrow=document.createElement('span');arrow.className='direction';node.append(arrow);}node.style.setProperty('--heading',heading+'deg');}else arrow?.remove();
 let player=node.querySelector('.mobile-player');if(latest.train?.type==='user'){if(!player){player=document.createElement('span');player.className='mobile-player';node.append(player);}const url=latest.train.avatarUrl;try{const u=new URL(url);if(u.protocol==='https:'&&['avatars.steamstatic.com','avatars.cloudflare.steamstatic.com','avatars.akamai.steamstatic.com','avatars.fastly.steamstatic.com','steamcdn-a.akamaihd.net'].includes(u.hostname)&&!player.querySelector('img')){const img=document.createElement('img');img.src=u.href;img.alt='Hráč';img.style.cssText='width:100%;height:100%;border-radius:50%';player.append(img);}}catch{}}else player?.remove();
 if(following)map.panTo(pos,{animate:false});void loadRoute();drawRoute();
 }catch{set('map-status','Mapu se nepodařilo načíst. Zkuste záložku otevřít znovu.');}
}
function switchTab(which){tab=which;for(const v of document.querySelectorAll('.view'))v.hidden=v.id!==which;for(const b of document.querySelectorAll('nav button'))b.setAttribute('aria-pressed',String(b.dataset.tab===which));render();}
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>switchTab(b.dataset.tab);
el('technical').onchange=()=>{if(latest)renderSchedule();};el('follow').onclick=()=>{following=!following;el('follow').setAttribute('aria-pressed',String(following));if(following&&latest)map?.panTo([latest.model.lat,latest.model.lon]);};el('return').onclick=()=>{if(latest)map?.setView([latest.model.lat,latest.model.lon],13);};el('fit').onclick=()=>{if(route?.sections.length&&map)map.fitBounds(L.latLngBounds(route.sections.flatMap(s=>s.coordinates)),{padding:[25,25],maxZoom:12});else{routeFailed=false;void loadRoute();}};
function cancelRequest(){requestEpoch++;controller?.abort();controller=null;busy=false;el('reconnect').setAttribute('aria-busy','false');}
async function refresh(force=false){
 if(expired||document.hidden||busy&&!force)return;
 if(force)cancelRequest();busy=true;const epoch=++requestEpoch,started=performance.now();controller=new AbortController();const requestController=controller;
 const timeout=setTimeout(()=>requestController.abort(),15000);el('reconnect').setAttribute('aria-busy','true');
 try{
  const res=await fetch('/api/state',{credentials:'same-origin',cache:'no-store',signal:requestController.signal});if(epoch!==requestEpoch)return;
  if(res.status===401){expired=true;set('message','Připojení vypršelo. Načti nový QR kód v launcheru.');return;}if(!res.ok)throw Error();
  const data=await res.json();if(epoch!==requestEpoch)return;
  if(!data.model){networkError=true;set('message','Vlak už není dostupný. Vyber jiný vlak a vytvoř nový QR kód.');return;}
  if(latest?.train?.runId!==data.train?.runId){routeGeneration++;route=null;routeBusy=false;routeFailed=false;routeKey='';routeIndex=null;previousPosition=null;heading=null;for(const layer of routeLayers.values())layer.remove();routeLayers.clear();}
  const serverAge=Number.isFinite(data.dataAgeMs)?data.dataAgeMs:Number.isFinite(data.serverNowMs)&&Number.isFinite(data.fetchedAt)?data.serverNowMs-data.fetchedAt:0;
  ageAtReceipt=Math.max(0,serverAge)+Math.max(0,performance.now()-started);receivedAt=performance.now();latest=data;networkError=false;render();
 }catch{if(epoch!==requestEpoch)return;networkError=true;set('message',latest?'Zobrazuji poslední přijatá data. Spojení se obnovuje…':'Ověř stejnou Wi-Fi, spuštěný launcher a přístup přes firewall.');}
 finally{clearTimeout(timeout);if(epoch===requestEpoch){busy=false;controller=null;el('reconnect').setAttribute('aria-busy','false');connection();}}
}
function resume(){
 if(document.hidden||expired)return;const now=performance.now();if(now-lastResume<300)return;lastResume=now;routeFailed=false;void refresh(true);
}
el('reconnect').onclick=()=>{if(expired){set('message','Otevři v launcheru připojení na mobil a načti nový QR kód.');return;}if(!el('revision-note').hidden){location.reload();return;}routeFailed=false;void refresh(true);};
setInterval(()=>{if(!document.hidden)void refresh();},5000);setInterval(()=>{if(!document.hidden)connection();},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelRequest();else resume();});
window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('pagehide',cancelRequest);void refresh();
