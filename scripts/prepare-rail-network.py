
import json, math, sys, collections, pathlib
source=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2])
osm=json.loads(source.read_text(encoding='utf-8'))
nodes={e['id']:(e['lat'],e['lon']) for e in osm['elements'] if e['type']=='node'}
adj=collections.defaultdict(set)
for way in osm['elements']:
 if way['type']!='way':continue
 if way.get('tags',{}).get('railway')!='rail':continue
 for a,b in zip(way['nodes'],way['nodes'][1:]):
  if a in nodes and b in nodes and a!=b:adj[a].add(b);adj[b].add(a)
unseen=set(adj); largest=set()
while unseen:
 start=unseen.pop(); component={start}; todo=[start]
 while todo:
  node=todo.pop()
  for other in adj[node]:
   if other in unseen:unseen.remove(other);component.add(other);todo.append(other)
 if len(component)>len(largest):largest=component
junctions=sorted(n for n in largest if len(adj[n])!=2)
if not junctions:raise RuntimeError('No routing junctions')
ids={n:i for i,n in enumerate(junctions)}
def simplify(points,tol=7):
 # RDP metres in local equirectangular projection.
 if len(points)<=2:return points
 result={0,len(points)-1}; todo=[(0,len(points)-1)]
 while todo:
  lo,hi=todo.pop();a,b=points[lo],points[hi]; c=math.cos(math.radians((a[0]+b[0])/2));bx=(b[1]-a[1])*c*111320;by=(b[0]-a[0])*111320;den=bx*bx+by*by
  maximum=tol*tol;best=None
  for k in range(lo+1,hi):
   p=points[k];x=(p[1]-a[1])*c*111320;y=(p[0]-a[0])*111320
   t=max(0,min(1,(x*bx+y*by)/den)) if den else 0
   d=(x-t*bx)**2+(y-t*by)**2
   if d>maximum:maximum=d;best=k
  if best is not None:result.add(best);todo.extend([(lo,best),(best,hi)])
 return [points[k] for k in sorted(result)]
seen=set();edges=[]
for start in junctions:
 for nxt in sorted(adj[start]):
  if (start,nxt) in seen:continue
  path=[start];prev=start;current=nxt
  while True:
   seen.add((prev,current));seen.add((current,prev));path.append(current)
   if current in ids:break
   candidates=adj[current]-{prev}
   if not candidates:break
   prev,current=current,next(iter(candidates))
  if current in ids and current!=start:
   geometry=simplify([nodes[n] for n in path])
   edges.append([ids[start],ids[current],[[round(x,6),round(y,6)] for x,y in geometry]])
out={'version':1,'source':{'name':'OpenStreetMap contributors','url':'https://www.openstreetmap.org/copyright','license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','osmTimestamp':osm.get('osm3s',{}).get('timestamp_osm_base'),'bbox':[49.965,18.822,52.347,21.037],'query':'way[railway=rail](49.965,18.822,52.347,21.037);out body;>;out skel qt;','simplificationMeters':7},'nodes':[[round(nodes[n][0],6),round(nodes[n][1],6)] for n in junctions],'edges':edges}
dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
print(json.dumps({'rawNodes':len(nodes),'connectedNodes':len(largest),'junctions':len(junctions),'edges':len(edges),'geometryPoints':sum(len(e[2]) for e in edges),'bytes':dest.stat().st_size}))

