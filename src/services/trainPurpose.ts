import type {Train} from '../types/trains';

const FREIGHT_WAGONS=new Set(['230-01','406ra','408s','412w','424z','434z','441v','629z']);
/** Use the consist, with the API's freight/service category as a fallback for light engines. */
export function isFreightTrain(train:Pick<Train,'vehicles'|'name'>|null|undefined):boolean {
  if(!train)return false;
  if(train.vehicles?.some(v=>FREIGHT_WAGONS.has(v.split('/')[0].toLowerCase())))return true;
  return /^(?:T[A-Z]{2}|Z[A-Z]{2}|L[A-Z]{2})(?:\s|[-–]|$)/i.test(train.name??'');
}
