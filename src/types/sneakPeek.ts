import type {RailCoord} from './route';
export interface SneakPeekRoute {
 id:string;name:string;corridor:string;steamAppId:number;officialUrl:string;image:string;releaseMonth:string;officialCheckedAt:string;
 geometrySource:{name:string;url:string;license:string;licenseUrl:string;retrievedAt:string;simplificationMeters:number};
 apiEvidence:{checkedAt:string;server:string;stationNames:string[];coordinateStationCount:number};
 lengthKm:number;geometry:RailCoord[];stations:{id:string;name:string;lat:number;lon:number;apiNamePresent:boolean}[];
}
export interface SneakPeekCatalog {version:1;routes:SneakPeekRoute[]}
