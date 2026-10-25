"""Read-only inventory of the live browser surface; raw HTML stays in output/."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode
import json,time

root=Path(__file__).resolve().parents[2];out=root/'output/mobile-audit';out.mkdir(parents=True,exist_ok=True)
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=set();self.forms=[];self.fields=[];self.title='';self.in_title=False;self.results=0;self.tabs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='title':self.in_title=True
  if tag=='a' and a.get('href','').startswith('/'):self.links.add(a['href'])
  if tag=='form':self.forms.append({k:a.get(k) for k in ['id','method','action']})
  if tag in ['input','select','textarea'] and a.get('name'):self.fields.append({'tag':tag,'name':a['name'],'type':a.get('type','')})
  if tag=='article' and 'result' in a.get('class','').split():self.results+=1
  if tag=='label' and a.get('role')=='tab':self.tabs.append(a.get('for'))
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
 def handle_data(self,text):
  if self.in_title:self.title+=text
paths=['/','/preferences','/info/en/about','/info/en/search-syntax','/about','/stats','/stats?sort=score','/stats?sort=result_count','/stats?sort=time','/stats?sort=reliability','/stats?engine=google','/stats/errors','/mobile-audit-missing-page','/manifest.json','/opensearch.xml','/config','/robots.txt','/healthz']
paths += [f'/info/{locale}/{name}' for locale in ['de','it','id','fa-IR','fr'] for name in ['about','search-syntax']]
paths += ['/rss.xsl','/engine_descriptions.json','/autocompleter?q=searxng','/image_proxy','/metrics','/clear_cookies','/favicon.ico','/static/themes/simple/img/192.png','/search?q=searxng&format=json']
paths += ['/search?'+urlencode({'q':'Cape Town','categories':category}) for category in ['general','images','videos','news','map','music','it','science','files','social media']]
report=[]
for index,path in enumerate(paths):
 start=time.monotonic();request=Request('https://searx.syncpundit.io'+path,headers={'User-Agent':'Mozilla/5.0 Chrome/154.0.0.0 Safari/537.36'})
 try:response=urlopen(request,timeout=35)
 except HTTPError as error:response=error
 except Exception as error:
  row={'path':path,'error':type(error).__name__};report.append(row);print(json.dumps(row),flush=True);continue
 with response:
  data=response.read();content=response.headers.get('Content-Type','');row={'path':path,'status':response.status,'content_type':content,'seconds':round(time.monotonic()-start,2)}
  if 'html'in content:
   p=Page();p.feed(data.decode());row.update({'title':p.title,'forms':p.forms,'fields':p.fields,'tabs':p.tabs,'results':p.results,'internal_links':sorted(p.links)})
   (out/f'{index:02d}.html').write_bytes(data)
  report.append(row);print(json.dumps({k:row[k] for k in ['path','status','results','seconds'] if k in row}),flush=True)
(out/'live-audit.json').write_text(json.dumps(report,indent=2)+'\n')
