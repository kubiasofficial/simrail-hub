"""Import unmodified screenshots from the user-selected official SimRail wiki."""
import importlib.util,json,re,hashlib,urllib.request,shutil
from urllib.parse import quote,urljoin
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parent.parent
BASE='https://wiki.simrail.eu'
spec=importlib.util.spec_from_file_location('wiki_assets',ROOT/'scripts/wiki-assets.py')
wiki=importlib.util.module_from_spec(spec);spec.loader.exec_module(wiki)
DEST=ROOT/'.wiki-originals';DEST.mkdir(parents=True,exist_ok=True)
records=[];errors=[]

def download(url,relative,page,label):
    url=urljoin(BASE,url)
    dest=DEST/relative;dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():
        request=urllib.request.Request(quote(url,safe=':/%'),headers={'User-Agent':'SimRailHub/0.2.1 (community launcher asset import)'})
        with urllib.request.urlopen(request,timeout=45) as response:
            content=response.read()
            if not response.headers.get('Content-Type','').startswith('image/'): raise ValueError('Not an image: '+url)
        dest.write_bytes(content)
    records.append({'file':'assets/wiki/'+relative,'image':url,'page':page,'label':label,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size})
    return './assets/wiki/'+relative

def normalize(value):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD',value.lower().replace('ł','l')) if not unicodedata.combining(c)).strip()

families=[
 ('eu07','EU07 / EP07','Electric-locomotive/4E','eu07-005.png'),
 ('ep08','EP08','Electric-locomotive/102E','ep08-001.png'),
 ('cd163','ČD 163','Electric-locomotive/71E','163_021-9.png'),
 ('et22','ET22','Electric-locomotive/201E','et22-836.png'),
 ('dragon','ET25 / Dragon 2','Electric-locomotive/E6ACTa','e6acta-016.png'),
 ('traxx','E186 / TRAXX','Electric-locomotive/E186','e186-134.png'),
 ('br285','BR285','Diesel-locomotive/BR285','br285-125.png'),
 ('pendolino','ED250 Pendolino','EMU/Pendolino','ed250-018.png'),
 ('kibel','EN57 / EN71','EMU/Kibel','en57-1000.png'),
 ('elf','EN76 / EN96 ELF','EMU/Elf','en76-006.png'),
 ('impuls','36WEd Impuls 2','EMU/36WEd','36wed-001.png'),
 ('ty2','Ty2','Steam-locomotive/Ty2','ty2-540.png')]

def vehicle(group):
    key,label,path,default=group
    source=wiki.page('/en/Vehicles/Poland/Trains/'+path)
    # Wiki variant galleries use root /vehicle/<vehicle-id>.png. Exclude cabin diagrams.
    images={i['src'] for i in source['images'] if re.fullmatch(r'/vehicle/[^/]+\.(?:png|jpg|webp)',i.get('src',''),re.I)}
    images.add('/vehicle/'+default)
    variants={}
    for image in sorted(images):
        name=Path(image).name
        try:
            local=download(image,'vehicles/'+name,source['page'],label)
            variants[re.sub(r'[^a-z0-9]','',Path(name).stem.lower())]=local
        except Exception as e: errors.append(str(e))
    default_key=re.sub(r'[^a-z0-9]','',Path(default).stem.lower())
    return key,{'label':label,'page':source['page'],'image':variants.get(default_key),'variants':variants}

with ThreadPoolExecutor(max_workers=3) as pool: vehicles=dict(pool.map(vehicle,families))
hero_source=wiki.page('/en/Vehicles/Poland/Trains/Electric-locomotive/4E')
hero=next(i['src'] for i in hero_source['images'] if '20241105175438' in i.get('src',''))
hero=download(hero,'hero.jpg',hero_source['page'],'EU07 – snímek ze hry')

station_list=json.load(urllib.request.urlopen(BASE+'/stations/poland/stations.json'))
def station(station):
    try:
        source=wiki.page(station['url'])
        # Use exterior signalbox/station screenshots, not track plans or UI diagrams.
        candidates=[i['src'] for i in source['images'] if '/stations/poland/' in i.get('src','') and re.search(r'(signalbox|outside|exterior|building|platform|tracks)',i['src'],re.I) and not re.search(r'(layout|speed|radio|signal[s_-]|cctv)',i['src'],re.I)]
        if not candidates:
            candidates=[i['src'] for i in source['images'] if '/stations/poland/' in i.get('src','') and re.search(r'(signalbox|outside|exterior|building)',i['src'],re.I)]
        if not candidates:return None
        image=candidates[0]
        slug=re.sub(r'[^a-z0-9]+','-',normalize(station['name'])).strip('-')
        local=download(image,'stations/'+slug+Path(image).suffix,source['page'],station['name'])
        return normalize(station['name']),{'name':station['name'],'image':local,'page':source['page']}
    except Exception as e: errors.append(station['name']+': '+str(e));return None

with ThreadPoolExecutor(max_workers=3) as pool: stations=dict(x for x in pool.map(station,station_list) if x)
# Keep one original per family and the hero bundled. Variant/station images are served
# directly by the wiki, avoiding hundreds of MB of duplicated online station media.
bundled={v['image'] for v in vehicles.values()}|{hero}
by_file={r['file']:r for r in records}
for local in bundled:
    relative=local.removeprefix('./assets/wiki/')
    target=ROOT/'public/assets/wiki'/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(DEST/relative,target)
for family in vehicles.values():
    family['variants']={key:(local if local in bundled else by_file[local.removeprefix('./')]['image']) for key,local in family['variants'].items()}
for station in stations.values():
    station['image']=by_file[station['image'].removeprefix('./')]['image']
for record in records:
    record['bundled']='./'+record['file'] in bundled
catalog={'vehicles':vehicles,'stations':stations,'hero':{'image':hero,'page':hero_source['page']}}
(ROOT/'src/data').mkdir(exist_ok=True)
(ROOT/'src/data/wiki-media.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'docs/wiki-media-sources.json').write_text(json.dumps({'retrieved':'2026-11-24','source':BASE,'rights':'Wiki siteConfig declares contentLicense=alr (all rights reserved). Images remain property of their respective authors and SimRail; no open licence is claimed.','images':sorted(records,key=lambda r:r['file']),'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'vehicleTypes':len(vehicles),'vehicleImages':sum(len(v['variants']) for v in vehicles.values()),'stations':len(stations),'totalBytes':sum(r['bytes'] for r in records),'errors':errors},ensure_ascii=True,indent=2))
