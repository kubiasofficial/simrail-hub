"""Import the approved 2026-11-28 voice batch. Never deletes or renames originals."""
from pathlib import Path
import array,hashlib,json,math,re,shutil,subprocess,sys,unicodedata,wave
ROOT=Path(__file__).resolve().parent.parent
PRIVATE=ROOT.parent/'hlaseni'
AUDIT=ROOT/'docs/verification/station-recordings-import.json'
FUTURE={'deblin':'Dęblin','golab':'Gołąb','klementowice':'Klementowice','sadurki':'Sadurki','lublin_glowny':'Lublin Główny','minkowice':'Minkowice','jaszczow':'Jaszczów','rejowiec':'Rejowiec','chelm':'Chełm'}
# Confirmed by the owner on 2026-11-28; source names are kept unchanged.
ALIASES={'klematowice':'klementowice','rejowice':'rejowiec','warszawa_srodmiesci':'warszawa_srodmiescie'}
def normal(s):return re.sub('[^a-z0-9]+','_',''.join(c for c in unicodedata.normalize('NFD',s.lower().replace('ł','l')) if not unicodedata.combining(c))).strip('_')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
coverage=json.loads((ROOT/'docs/verification/recording-coverage.json').read_text('utf-8'))
known={r['file'][:-4]:r['station'] for group in ['covered','missing'] for r in coverage[group]};known.update(FUTURE)
manifestPath=ROOT/'assets/recordings/manifest.json';manifest=json.loads(manifestPath.read_text('utf-8'))
original={(r['file']):r for r in manifest['files']};imported=[]
staging=ROOT/'.deployment/station-recordings-conversion';staging.mkdir(parents=True,exist_ok=True)
ffmpeg=shutil.which('ffmpeg')
if not ffmpeg:raise RuntimeError('ffmpeg is required')
for source in sorted(PRIVATE.glob('*.m4a')):
 stem=ALIASES.get(normal(source.stem),normal(source.stem))
 if stem not in known:raise RuntimeError('Unknown station recording: '+source.name)
 filename=stem+'.wav';future=stem in FUTURE
 destination=ROOT/('assets/upcoming-recordings/lublin-region' if future else 'assets/recordings')/filename
 converted=staging/(stem+'-'+sha(source.read_bytes())[:12]+'.wav')
 if not converted.exists():subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-n','-i',str(source),'-af','highpass=f=65,loudnorm=I=-20:TP=-2:LRA=7','-ar','48000','-ac','1','-c:a','pcm_s16le',str(converted)],check=True)
 with wave.open(str(converted),'rb') as audio:
  if (audio.getframerate(),audio.getnchannels(),audio.getsampwidth())!=(48000,1,2):raise RuntimeError('Invalid PCM: '+filename)
  samples=array.array('h',audio.readframes(audio.getnframes()))
  duration=len(samples)/48000
 if not .2<duration<30:raise RuntimeError('Unexpected station duration: '+filename)
 peak=max(abs(x) for x in samples)/32768;rms=math.sqrt(sum((x/32768)**2 for x in samples)/len(samples))
 if peak<.02 or rms<.003:raise RuntimeError('Recording is silent: '+filename)
 if peak>.999:raise RuntimeError('Recording clips: '+filename)
 data=converted.read_bytes();destination.parent.mkdir(parents=True,exist_ok=True)
 for output in [destination,PRIVATE/filename]:
  if output.exists() and output.read_bytes()!=data:raise RuntimeError('Would overwrite different WAV: '+str(output))
  if not output.exists():shutil.copy2(converted,output)
 row={'station':known[stem],'file':filename,'source':source.name,'sourceSha256':sha(source.read_bytes()),'bytes':len(data),'sha256':sha(data),'seconds':duration,'peak':round(peak,5),'rms':round(rms,5),'status':'upcoming' if future else 'active'}
 imported.append(row)
 if not future:original[filename]={k:row[k] for k in ['file','bytes','sha256','seconds']}
 if len(imported)%20==0:print('Converted',len(imported),'station recordings',flush=True)
manifest['files']=sorted(original.values(),key=lambda r:r['file']);save(manifestPath,manifest)
active=[r for r in imported if r['status']=='active'];future=[r for r in imported if r['status']=='upcoming']
save(ROOT/'assets/upcoming-recordings/lublin-region/manifest.json',{'dlcId':5548340,'status':'confirmed-upcoming','automaticPlayback':False,'officialSource':'https://store.steampowered.com/app/5548340/','files':future})
save(AUDIT,{'date':'2026-11-28','originalsRetained':True,'activeAdded':len(active),'upcomingPrepared':len(future),'files':imported})
# Preserve the original eight core station entries and their required-file semantics.
s=(ROOT/'src/services/localAudio.ts').read_text('utf-8');match=re.search(r"const STATIONS:Record<string,string>=(\{.*?\});",s)
if match:
 old=dict(re.findall(r"'([^']+)':'([^']+)'",match.group(1)))
 pretty={known.get(file,next((r['station'] for r in coverage['covered'] if normal(r['station']).replace('_',' ')==key),key)):file for key,file in old.items()}
 s=s[:match.start()]+"const STATIONS:Record<string,string>=Object.fromEntries(Object.entries(STATION_RECORDINGS).map(([name,file])=>[norm(name),file]));"+s[match.end():]
 s="import {STATION_RECORDINGS} from './stationRecordings';\n"+s
 actual=next(line for line in s.splitlines() if line.startswith('const norm='))
 s=s.replace(actual+'\n','');s=s.replace('const STATIONS:',actual+'\nconst STATIONS:')
 (ROOT/'src/services/localAudio.ts').write_text(s,encoding='utf-8',newline='\n')
else:
 registry=(ROOT/'src/services/stationRecordings.ts').read_text('utf-8')
 pretty=json.loads(registry[registry.index('{'):registry.rindex('}')+1])
for row in active:pretty[row['station']]=row['file'][:-4]
(ROOT/'src/services/stationRecordings.ts').write_text('// Shared across all passenger services; confirmed upcoming DLC is stored separately.\nexport const STATION_RECORDINGS:Readonly<Record<string,string>> = '+json.dumps(pretty,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
print(json.dumps({'activeAdded':len(active),'upcomingPrepared':len(future),'bundledAudio':len(manifest['files']),'originalsRetained':True}),flush=True)
