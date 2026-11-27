import type {TimetablePoint} from '../types/trains';
import {isPassengerStop} from './passengerStops';
const pragueDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',month:'2-digit',day:'2-digit'});
export function isChristmasEve(now:number):boolean {
 const parts=pragueDate.formatToParts(new Date(now));
 return parts.find(p=>p.type==='month')?.value==='12'&&parts.find(p=>p.type==='day')?.value==='24';
}
/** Same conservative criterion as recording preparation: PH, real line, non-placeholder point. */
export function playablePassengerStops(points:TimetablePoint[]):TimetablePoint[]{
 return points.filter(p=>isPassengerStop(p)&&Number(p.line)>0&&!!p.pointId&&!p.pointId.startsWith('999'));
}
