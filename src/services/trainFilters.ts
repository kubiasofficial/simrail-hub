import type {Train} from '../types/trains';
import {trainCategory} from './trainCategory';
export interface TrainFilter {category:string;driver:string;origin:string;destination:string;favoritesOnly:boolean}
export const EMPTY_FILTER:TrainFilter={category:'all',driver:'all',origin:'',destination:'',favoritesOnly:false};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().trim();
export function filterTrains(trains:Train[],filter:TrainFilter,server:string|null,favorites:string[]):Train[]{
 return trains.filter(t=>(filter.category==='all'||trainCategory(t).key===filter.category)&&(filter.driver==='all'||t.type===filter.driver)&&(!filter.origin||norm(t.startStation??'').includes(norm(filter.origin)))&&(!filter.destination||norm(t.endStation??'').includes(norm(filter.destination)))&&(!filter.favoritesOnly||favorites.includes(server+':'+t.number)));
}
