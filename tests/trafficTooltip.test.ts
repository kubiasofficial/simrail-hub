import {it,expect} from 'vitest';
import {trafficTooltip} from '../src/services/trafficTooltip';
import type {TrafficAlert} from '../src/services/dispatcher';
const alert:TrafficAlert={key:'slow:2',kind:'slow',text:'Stojící vlak.',lat:50,lon:19,distanceM:2400,count:1,severity:1,trainIds:['2'],sectionFrom:'Kozłów',sectionTo:'Miechów',observedAt:100000,state:'active'};
it('shows the current complication, actual count, section, distance basis and age',()=>{expect(trafficTooltip(alert,105000)).toContain('Kozłów → Miechów');expect(trafficTooltip(alert,105000)).toContain('2.4 km');expect(trafficTooltip({...alert,count:3,distanceM:1500},105000)).toContain('Počet vlaků: 3');expect(trafficTooltip({...alert,distanceBasis:'air'},105000)).toContain('vzdušnou čarou');});
it('labels stale or interrupted observations as unverified, never as cleared',()=>{expect(trafficTooltip(alert,120000)).toContain('Čekáme na aktuální údaje');expect(trafficTooltip({...alert,state:'unverified'},101000)).toContain('Uvolnění provozu zatím není potvrzené');expect(trafficTooltip({...alert,state:'checking'},105000)).toContain('Ověřuji uklidnění situace');});
