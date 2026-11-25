export type RailCoord=[number,number];
export interface RailNetwork {version:1;source:{name:string;url:string;license:string;licenseUrl:string;osmTimestamp:string};nodes:RailCoord[];edges:[number,number,RailCoord[]][]}
export interface TrainRoute {
 trainNumber:string;runId:string|null;
 sections:{fromIndex:number;toIndex:number;coordinates:RailCoord[]}[];
 stops:{name:string;index:number;lat:number;lon:number;passengerStop:boolean}[];
 totalPoints:number;matchedPoints:number;missingSections:number;
 sourceDate:string;first:string|null;last:string|null;
}
