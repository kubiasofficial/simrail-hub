"""Build an offline, explicitly approximate OSM preview; never feed it to live routing."""
import json,math,heapq,sys,datetime
from pathlib import Path
raw=Path(sys.argv[1]);evidence=Path(sys.argv[2]);target=Path(sys.argv[3])
osm=json.loads(raw.read_text(encoding='utf-8'));api=json.loads(evidence.read_text(encoding='utf-8'))
nodes={e['id']:e for e in osm['elements'] if e['type']=='node'};adj={}
def metres(a,b):
 x=(a[1]-b[1])*math.cos(math.radians((a[0]+b[0])/2))*111320;y=(a[0]-b[0])*111320
 return math.hypot(x,y)
def coord(n):return [nodes[n]['lat'],nodes[n]['lon']]
for w in osm['elements']:
 if w['type']!='way' or w.get('tags',{}).get('railway')!='rail':continue
 for a,b in zip(w['nodes'],w['nodes'][1:]):
  if a not in nodes or b not in nodes:continue
  d=metres(coord(a),coord(b));adj.setdefault(a,[]).append((b,d));adj.setdefault(b,[]).append((a,d))
def named(name):return [n for n,v in nodes.items() if v.get('tags',{}).get('name')==name and n in adj]
def shortest(starts,ends):
 costs={n:0 for n in starts};parent={};queue=[(0,n) for n in starts];heapq.heapify(queue);end=None
 while queue:
  cost,n=heapq.heappop(queue)
  if cost!=costs[n]:continue
  if n in ends:end=n;break
  for other,d in adj.get(n,[]):
   nc=cost+d
   if nc<costs.get(other,float('inf')):costs[other]=nc;parent[other]=n;heapq.heappush(queue,(nc,other))
 if end is None:raise RuntimeError('OSM route has a gap; do not invent a connector')
 path=[end]
 while path[-1] in parent:path.append(parent[path[-1]])
 return list(reversed(path)),costs[end]
path,length=shortest(named('Dęblin'),set(named('Chełm')))
if not any(nodes[n].get('tags',{}).get('name')=='Lublin Główny' for n in path):raise RuntimeError('Route bypasses Lublin Główny')
# Iterative RDP; geometry always remains on the mapped railway, within a 7 m simplification tolerance.
points=[coord(n) for n in path];keep={0,len(points)-1};todo=[(0,len(points)-1)]
while todo:
 lo,hi=todo.pop();a,b=points[lo],points[hi];scale=math.cos(math.radians((a[0]+b[0])/2));bx=(b[1]-a[1])*scale*111320;by=(b[0]-a[0])*111320;den=bx*bx+by*by;best=None;maximum=49
 for k in range(lo+1,hi):
  p=points[k];x=(p[1]-a[1])*scale*111320;y=(p[0]-a[0])*111320;t=max(0,min(1,(x*bx+y*by)/den)) if den else 0;d=(x-t*bx)**2+(y-t*by)**2
  if d>maximum:maximum=d;best=k
 if best is not None:keep.add(best);todo.extend([(lo,best),(best,hi)])
geometry=[[round(v,6) for v in points[i]] for i in sorted(keep)]
names=['Dęblin','Gołąb','Klementowice','Nałęczów','Sadurki','Lublin Zachodni','Lublin Główny','Świdnik Miasto','Minkowice','Jaszczów','Rejowiec','Chełm']
stations=[]
for name in names:
 choices=named(name);onpath=[n for n in choices if n in set(path)]
 if not onpath:raise RuntimeError('Station is not on mapped route: '+name)
 n=onpath[0];stations.append({'id':'osm-'+str(n),'name':name,'lat':nodes[n]['lat'],'lon':nodes[n]['lon'],'apiNamePresent':name in api['timetableNames']})
checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
route={'id':'lublin-region','name':'Lublin Region','corridor':'Dęblin → Lublin → Chełm','steamAppId':5548340,'officialUrl':'https://store.steampowered.com/app/5548340/SimRail_The_Railway_Simulator_Lublin_Region/','image':'./assets/dlc/5548340.jpg','releaseMonth':'2026-12','officialCheckedAt':checked,'geometrySource':{'name':'OpenStreetMap contributors','url':'https://www.openstreetmap.org/relation/318953','license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','retrievedAt':checked,'simplificationMeters':7},'apiEvidence':{'checkedAt':api['checkedAt'],'server':api['server'],'stationNames':[s['name'] for s in stations if s['apiNamePresent']],'coordinateStationCount':len(api['coordinateStations'])},'lengthKm':round(length/1000,1),'geometry':geometry,'stations':stations}
target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps({'version':1,'routes':[route]},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'points':len(geometry),'stations':len(stations),'lengthKm':route['lengthKm'],'apiNames':route['apiEvidence']['stationNames'],'bytes':target.stat().st_size},ensure_ascii=False))
