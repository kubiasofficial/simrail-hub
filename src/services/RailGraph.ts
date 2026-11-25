import {haversineM} from './geo';
import type {RailCoord,RailNetwork} from '../types/route';
interface Edge {a:number;b:number;points:RailCoord[];length:number;distance:number[];box:number[]}
interface Snap {edge:number;segment:number;point:RailCoord;along:number}
class Heap {
 private values:{node:number;cost:number;priority:number}[]=[];
 push(item:{node:number;cost:number;priority:number}){const a=this.values;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p].priority<=item.priority)break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.values,first=a[0],last=a.pop();if(a.length&&last){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].priority<a[c].priority)c++;if(a[c].priority>=last.priority)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
 get size(){return this.values.length;}
}
const metres=(a:RailCoord,b:RailCoord)=>haversineM(a[0],a[1],b[0],b[1]);
export class RailGraph {
 private edges:Edge[];private adjacent:{edge:number;other:number}[][];
 private snaps=new Map<string,Snap|null>();
 constructor(private network:RailNetwork){
  if(network.version!==1||!network.nodes.length)throw Error('Traťová data nejsou platná.');
  this.adjacent=network.nodes.map(()=>[]);
  this.edges=network.edges.map(([a,b,points],id)=>{
   if(!this.adjacent[a]||!this.adjacent[b]||points.length<2)throw Error('Neplatné propojení kolejí.');
   const distance=[0];for(let i=1;i<points.length;i++)distance.push(distance[i-1]+metres(points[i-1],points[i]));
   const box=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){box[0]=Math.min(box[0],p[0]);box[1]=Math.min(box[1],p[1]);box[2]=Math.max(box[2],p[0]);box[3]=Math.max(box[3],p[1]);}
   this.adjacent[a].push({edge:id,other:b});this.adjacent[b].push({edge:id,other:a});
   return {a,b,points,length:distance.at(-1)!,distance,box};
  });
 }
 private snap(at:RailCoord):Snap|null{
  const key=at.join(',');if(this.snaps.has(key))return this.snaps.get(key)!;
  const scale=Math.cos(at[0]*Math.PI/180);let best:Snap|null=null,limit=1500**2;
  this.edges.forEach((e,edge)=>{
   if(at[0]<e.box[0]-.014||at[0]>e.box[2]+.014||at[1]<e.box[1]-.023||at[1]>e.box[3]+.023)return;
   for(let segment=0;segment<e.points.length-1;segment++){
    const a=e.points[segment],b=e.points[segment+1],x=(b[1]-a[1])*scale*111320,y=(b[0]-a[0])*111320,px=(at[1]-a[1])*scale*111320,py=(at[0]-a[0])*111320;
    const t=x*x+y*y?Math.max(0,Math.min(1,(x*px+y*py)/(x*x+y*y))):0;
    const d=(px-t*x)**2+(py-t*y)**2;
    if(d<limit){limit=d;best={edge,segment,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],along:e.distance[segment]+t*(e.distance[segment+1]-e.distance[segment])};}
   }
  });
  if(this.snaps.size>=512)this.snaps.delete(this.snaps.keys().next().value!);
  this.snaps.set(key,best);return best;
 }
 path(from:RailCoord,to:RailCoord):RailCoord[]|null{
  const a=this.snap(from),b=this.snap(to);if(!a||!b)return null;
  const start=this.edges[a.edge],end=this.edges[b.edge];
  if(a.edge===b.edge){
   if(a.along<=b.along)return [a.point,...start.points.slice(a.segment+1,b.segment+1),b.point];
   return [b.point,...start.points.slice(b.segment+1,a.segment+1),a.point].reverse();
  }
  const dist=new Float64Array(this.network.nodes.length).fill(Infinity),parent=new Int32Array(dist.length).fill(-1),parentEdge=new Int32Array(dist.length).fill(-1);
  const queue=new Heap(),goalCosts=new Map([[end.a,b.along],[end.b,end.length-b.along]]);
  for(const [node,cost] of [[start.a,a.along],[start.b,start.length-a.along]]){dist[node]=cost;queue.push({node,cost,priority:cost+metres(this.network.nodes[node],b.point)});}
  let best=Infinity,finish=-1;
  const maxLength=Math.max(5000,metres(a.point,b.point)*1.9+3000);
  while(queue.size){
   const item=queue.pop();if(item.cost!==dist[item.node])continue;
   if(item.priority>=best||item.priority>maxLength)break;
   const tail=goalCosts.get(item.node);if(tail!==undefined&&item.cost+tail<best){best=item.cost+tail;finish=item.node;}
   for(const link of this.adjacent[item.node]){
    const cost=item.cost+this.edges[link.edge].length;if(cost>=dist[link.other]||cost>maxLength)continue;
    dist[link.other]=cost;parent[link.other]=item.node;parentEdge[link.other]=link.edge;
    queue.push({node:link.other,cost,priority:cost+metres(this.network.nodes[link.other],b.point)});
   }
  }
  if(finish<0||best>maxLength)return null;
  const middle:{node:number;edge:number}[]=[];let node=finish;
  while(parent[node]>=0){middle.push({node:parent[node],edge:parentEdge[node]});node=parent[node];}
  const result:RailCoord[]=node===start.a?[a.point,...start.points.slice(0,a.segment+1).reverse()]:[a.point,...start.points.slice(a.segment+1)];
  for(const part of middle.reverse()){const edge=this.edges[part.edge];result.push(...(edge.a===part.node?edge.points:[...edge.points].reverse()).slice(1));}
  const suffix=finish===end.a?[...end.points.slice(0,b.segment+1),b.point]:[...end.points.slice(b.segment+1).reverse(),b.point];
  result.push(...suffix.slice(1));return result;
 }
}
