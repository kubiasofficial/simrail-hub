import {it,expect} from 'vitest';
import {isChristmasEve,playablePassengerStops} from '../src/services/seasonalAnnouncements';
import {parseTimetables} from '../src/adapters/trainsApi';
it('uses real Czech calendar date including Prague midnight, independent of server clock',()=>{
 for(const date of ['2026-12-23T22:59:59Z','2026-12-24T23:00:00Z','2026-06-24T10:00:00Z'])expect(isChristmasEve(Date.parse(date))).toBe(false);
 for(const date of ['2026-12-23T23:00:00Z','2026-12-24T22:59:59Z'])expect(isChristmasEve(Date.parse(date))).toBe(true);
});
it('retains real railway line metadata and excludes non-PH, zero line and synthetic points',()=>{
 const points=parseTimetables([{trainNoLocal:'23901',timetable:[
  {nameForPerson:'Outside',line:0,pointId:'99901',stopType:'CommercialStop'},
  {nameForPerson:'First',line:8,pointId:'100',stopType:'CommercialStop'},
  {nameForPerson:'Technical',line:8,pointId:'101',stopType:'NoncommercialStop'},
  {nameForPerson:'Last',line:8,pointId:'102',stopType:'PH'},
  {nameForPerson:'Unknown',pointId:'103',stopType:'CommercialStop'}
 ]}])[0].points;
 expect(playablePassengerStops(points).map(p=>p.name)).toEqual(['First','Last']);expect(points[1].line).toBe(8);
});
