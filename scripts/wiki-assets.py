"""Inspect official wiki content and preserve image provenance."""
import json, urllib.request, re, sys
from urllib.parse import quote
from pathlib import Path
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor

BASE='https://wiki.simrail.eu'
ROOT=Path(__file__).resolve().parent.parent

class Content(HTMLParser):
    def __init__(self):
        super().__init__(); self.images=[]; self.links=[]; self.text=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='img': self.images.append(a)
        if tag=='a' and a.get('href'): self.links.append(a['href'])
    def handle_data(self,data):
        if data.strip(): self.text.append(data.strip())

def page(path):
    url=BASE+path
    html=urllib.request.urlopen(quote(url,safe=':/%'),timeout=30).read().decode('utf8')
    content=html.split('<template slot="contents">',1)[-1].split('<template slot="comments">',1)[0]
    parsed=Content();parsed.feed(content)
    return {'page':url,'images':parsed.images,'links':parsed.links,'text':' '.join(parsed.text)}

if __name__=='__main__':
    paths=sys.argv[1:] or ['/en/Vehicles/Poland/Trains/Electric-locomotive/4E','/en/Vehicles/Poland/Trains/EMU/Kibel','/en/Stations/Poland/Overview']
    results=list(ThreadPoolExecutor(max_workers=3).map(page,paths))
    (ROOT/'docs/wiki-inspection.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
    for result in results:
        print(result['page']); print(json.dumps(result['images'],ensure_ascii=True)); print(json.dumps(result['links'],ensure_ascii=True));print(result['text'][:1000].encode('ascii','backslashreplace').decode())
