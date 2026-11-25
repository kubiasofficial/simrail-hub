import {it,expect,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {RailGraph} from '../src/services/RailGraph';
import {TrainRouteService} from '../src/services/TrainRouteService';
import {trainCategory} from '../src/services/trainCategory';
import type {RailNetwork,RailCoord} from '../src/types/route';
import {tmp} from './helpers';
const nodes:RailCoord[]=[[50,19],[50,19.02],[50.02,19.02],[50.02,19],[51,20],[51,20.01]];
const data:RailNetwork={version:1,source:{name:'test',url:'',license:'ODbL-1.0',licenseUrl:'',osmTimestamp:'2026-11-25'},nodes,
 edges:[[0,1,[nodes[0],[50,19.01],nodes[1]]],[1,2,[nodes[1],[50.01,19.02],nodes[2]]],[0,3,[nodes[0],nodes[3]]],[3,2,[nodes[3],nodes[2]]],[4,5,[nodes[4],nodes[5]]]]};
it('follows connected rail geometry instead of drawing a diagonal between stations',()=>{
 const graph=new RailGraph(data),path=graph.path([50,19.005],[50.015,19.02])!;
 expect(path).toContainEqual(nodes[1]);expect(path.length).toBeGreaterThan(2);
 expect(path[0][1]).toBeCloseTo(19.005);expect(path.at(-1)![0]).toBeCloseTo(50.015);
 expect(path.every(p=>Math.abs(p[0]-50)<1e-7||Math.abs(p[1]-19.02)<1e-7)).toBe(true);
});
it('supports reversed travel on a single rail edge and does not connect missing tracks',()=>{
 const graph=new RailGraph(data),path=graph.path([50,19.018],[50,19.002])!;
 expect(path[0][1]).toBeCloseTo(19.018);expect(path.at(-1)![1]).toBeCloseTo(19.002);
 expect(graph.path([50,19],[51,20])).toBeNull();
 expect(graph.path([53,25],[50,19])).toBeNull();
});
it('uses explicit categories, including compound API names, without guessing from train number or locomotive',()=>{
 const cases=[['EIJ - EIP','EIP'],['ECE - EC','EC'],['EIC Wawel','EIC'],['MPE - IC','IC'],['MPE - TLK','TLK'],['MOJ - R','R'],['IR Małopolska','R'],['ROJ - Ł','R'],['MOE','R'],['ECJ','EC'],['EIE','EIC'],['MPE','unknown'],['Cargo','freight'],['ExpressCar','unknown'],['','unknown']];
 for(const [name,key] of cases)expect(trainCategory({name,vehicles:['ED250/ED250-001']}).key).toBe(key);
 expect(trainCategory({name:null,vehicles:['412W/coal']}).key).toBe('freight');
});
it('retains missing itinerary points as coverage gaps and deduplicates requests',async()=>{
 const folder=await tmp(),file=join(folder,'rail.json');await writeFile(file,JSON.stringify(data));
 const point=(name:string,index:number)=>({name,index,arrival:'12:00:00',departure:'12:00:00',stopType:'CommercialStop',isStop:true});
 const tracking={getDetail:vi.fn(async()=>({ok:true,data:{train:{number:'123',runId:'run'},timetable:{points:[point('A',0),point('Unknown',1),point('B',2)]},stations:[{name:'A',lat:50,lon:19.005},{name:'B',lat:50.015,lon:19.02}],notes:[]}}))};
 const routes=new TrainRouteService(tracking as never,file),[a,b]=await Promise.all([routes.get('cz1','123'),routes.get('cz1','123')]);
 expect(tracking.getDetail).toHaveBeenCalledTimes(1);expect(a).toBe(b);expect(a.totalPoints).toBe(3);expect(a.matchedPoints).toBe(2);
 expect(a.sections[0]).toMatchObject({fromIndex:0,toIndex:2});expect(a.sections[0].coordinates.length).toBeGreaterThan(2);
});
it('bundled OSM network connects an actual available Katowice–Sosnowiec section',async()=>{
 const network=JSON.parse(await readFile(resolve('public/data/rail-network.json'),'utf8')) as RailNetwork;
 expect(network.source.license).toBe('ODbL-1.0');expect(network.source.osmTimestamp).toBeTruthy();
 const graph=new RailGraph(network),path=graph.path([50.2569,19.0192],[50.279,19.123]);
 expect(path?.length).toBeGreaterThan(10);
});
