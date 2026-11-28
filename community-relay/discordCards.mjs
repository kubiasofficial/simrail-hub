// Presentation only. Legacy client payloads are validated by worker.mjs before reaching this formatter.
export const DISCORD_PRESENTATION='compact-cards-2026-11-28';
const ICON='https://raw.githubusercontent.com/kubiasofficial/simrail-hub/main/build/icon.png';
const LABELS={
 'drive-start':['🚆 Převzetí vlaku',0x54bd88],
 'drive-end':['🏁 Ukončení jízdy',0x61a5e8],
 'shift-start':['🗓️ Zahájení směny',0xa48add],
 'shift-break':['☕ Přestávka ve směně',0xe6b65e],
 'shift-arrival':['🏁 Poslední jízda směny',0x54bd88],
 'shift-ready':['▶️ Přestávka skončila',0x54bd88],
 'shift-end':['🗓️ Ukončení směny',0xa48add]
};
const ENDINGS={
 'drive-start':/^(.*) právě převzal vlak (\d+)$/u,
 'drive-end':/^(.*) ukončil řízení vlaku (\d+)$/u,
 'shift-start':/^(.*) zahájil směnu$/u,
 'shift-break':/^(.*) zahájil přestávku ve směně$/u,
 'shift-arrival':/^(.*) dorazil do cíle poslední plánované jízdy$/u,
 'shift-ready':/^(.*) má konec přestávky$/u,
 'shift-end':/^(.*) (?:dokončil|ukončil) směnu$/u
};
// Decode only the exact escapes made by released clients, then escape all Discord markdown ourselves.
const plain=value=>String(value??'').replace(/\\([\\`*_~|<>])/g,'$1').replace(/\u200b/g,'');
const escape=value=>plain(value).replace(/([\\`*_~|<>\[\]()#])/g,'\\$1').replace(/@/g,'@\u200b');
function limit(value,max){if(value.length<=max)return value;return value.slice(0,max-1).replace(/[\uD800-\uDBFF]$/,'').replace(/\\$/,'')+'…';}
function duration(value){
 const match=/^(\d+) min(.*)$/u.exec(plain(value));if(!match)return escape(value);
 const total=Number(match[1]),hours=Math.floor(total/60),minutes=total%60;
 return (hours?hours+' h'+(minutes?' '+minutes+' min':''):minutes+' min')+(match[2].includes('přerušení')?'\nVčetně přerušení':'');
}
function serverLabel(value){const code=plain(value).toUpperCase(),country=code.slice(0,2);const flags={CZ:'🇨🇿',PL:'🇵🇱',DE:'🇩🇪',FR:'🇫🇷',EN:'🇬🇧',SK:'🇸🇰',HU:'🇭🇺',ES:'🇪🇸',IT:'🇮🇹',NL:'🇳🇱',PT:'🇵🇹'};return (flags[country]??'🌐')+' '+code;}
export function formatDiscordCard(kind,title,sourceFields,now){
 const match=ENDINGS[kind]?.exec(title),[label,color]=LABELS[kind];
 const nickname=escape(match?.[1]??''),train=match?.[2]??null;
 const data=new Map(sourceFields.map(f=>[f.name,f.value])),fields=[];
 const add=(name,key,inline=true,transform=escape)=>{const value=data.get(key);if(value)fields.push({name,value:limit(transform(value),1024),inline});};
 const addServer=()=>add('Server','Server',true,serverLabel);
 let footer='SimRail Hub · Komunitní evidence';
 if(kind==='drive-start'||kind==='drive-end'){
  add('Trasa vlaku','Trasa',false);
  const manuallyEntered=/ručně/i.test(plain(data.get('Místo')));
  if(kind==='drive-start'){
   add(manuallyEntered?'Převzetí · zadáno ručně':'Převzetí','Začátek řízení');addServer();add('Směna','Součást směny');
  }else{
   add('Převzetí','Začátek řízení');add(manuallyEntered?'Ukončení · zadáno ručně':'Ukončení','Konec řízení');add('Čas evidence','Doba evidence',true,duration);
   addServer();add('Zpoždění · odhad','Zpoždění – odhad z launcheru');add('Poznámka','Poznámka',false);
  }
 }else if(kind==='shift-start'){
  add('Doprava','Doprava');addServer();add('Plánovaný konec','Plánovaný konec');
  add('Plán jízd','Plánované jízdy',false,value=>plain(value).split(' | ').map((line,i)=>(i+1)+'. '+escape(line)).join('\n'));
  add('Přestávka','Přestávka',true,duration);
 }else if(kind==='shift-break'||kind==='shift-arrival'){
  add('Stanice','Místo pozorovaného příjezdu');add('Vlak','Vlak');addServer();
  if(kind==='shift-break')add('Přestávka','Stav',false,value=>duration(plain(value).replace(/^Plánovaná přestávka /,'')));
  else fields.push({name:'Další krok',value:'Ukončení směny potvrď v launcheru.',inline:false});
  footer='SimRail Hub · Pozorovaný příjezd';
 }else if(kind==='shift-ready'){
  add('Stanice','Místo');addServer();add('Další jízda','Další krok',false);
 }else if(kind==='shift-end'){
  add('Doprava','Doprava');addServer();add('Dokončené jízdy','Pozorované dokončené jízdy');
  add('Čas evidence','Doba evidence',true,duration);add('Vlaky','Vlaky',false);
 }
 // Bound transformed text as well as input: escaping hostile markdown can expand values.
 let budget=5000;for(let i=0;i<fields.length;i++){const max=Math.min(1024,budget-(fields.length-i-1)*128);fields[i].value=limit(fields[i].value,max);budget-=fields[i].value.length;}
 return {username:'SimRail Hub',avatar_url:ICON,allowed_mentions:{parse:[]},embeds:[{
  title:label+(train?' · '+train:''),description:(kind.startsWith('drive')?'Strojvůdce ':'')+'**'+nickname+'**',color,fields,
  timestamp:new Date(now).toISOString(),footer:{text:footer}
 }]};
}
