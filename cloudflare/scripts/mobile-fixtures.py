"""Deterministic rendering fixtures. Never imported by the deployed app."""
from datetime import datetime,timezone
from types import SimpleNamespace
from searx.results import ResultContainer,UnresponsiveEngine
from searx.result_types import MainResult,Image,Video,Code,Paper,File,KeyValue,LegacyResult,Answer,Translations,WeatherAnswer

IMAGE='/static/themes/simple/img/searxng.png'
def fixture_results(kind):
 common={'engine':'google','url':'https://example.org/research/mobile-layout','title':'Cape Town — a result layout fixture','content':'A public reference with a useful description, source provenance, and enough detail to judge reading comfort on a phone.','category':'general'}
 if kind=='alignment':
  return [MainResult(**{**common,'engine':'mastodon users','url':'https://example.org/ap/users/116280044923065558','title':'A researcher with a long profile name (1165 followers)','content':'<p>Healthcare data scientist.<br>Grain farmer using regenerative practices.</p><p>Canadian living in <a href="https://example.org/tags/Alberta" class="mention hashtag">#<span>Alberta</span></a>.</p><img src="/must-not-load" onerror="window.__snippetExecuted=true"><script>window.__snippetExecuted=true</script>','category':'social media'},thumbnail=IMAGE,publishedDate=datetime(2026,3,23,tzinfo=timezone.utc)),MainResult(**{**common,'url':'https://example.org/artists/trevor-hall','title':'Short title','content':''},thumbnail=IMAGE),MainResult(**{**common,'url':'https://example.org/'+('a-long-path-segment/'*12),'title':'A long URL without a thumbnail'})]
 if kind=='images':
  return [Image(**{**common,'url':f'https://example.org/image/{i}','title':f'Image layout fixture {i+1}','category':'images'},img_src=IMAGE,thumbnail_src=IMAGE,resolution='1200 × 800',img_format='PNG',source='Example image source',filesize='240 KB') for i in range(8)]
 if kind=='videos':return [Video(**{**common,'category':'videos'},iframe_src='https://example.org/embed/demo',thumbnail=IMAGE,author='Example publisher',length=120,views='1,234')]
 if kind=='code':return [Code(**common,repository='https://example.org/source',filename='research/search.py',code_language='python',codelines=[(1,'def investigate(signal):'),(2,'    return '+repr('a long line for horizontal scrolling / '*12))])]
 if kind=='paper':return [Paper(**{**common,'category':'science'},authors=['A. Researcher','B. Analyst'],journal='Example Research Review',doi='10.0000/layout-fixture',pdf_url='https://example.org/paper.pdf',tags=['open research','mobile'])]
 if kind=='file':return [File(**{**common,'category':'files'},filename='public-evidence-dataset-with-a-long-name.csv',size='2.4 MB',mimetype='text/csv',author='Example publisher',embedded='https://example.org/dataset.csv')]
 if kind=='keyvalue':return [KeyValue(**common,caption='Layout fixture data',key_title='Field',value_title='Value',kvmap={'Coordinates':'33.9249° S, 18.4241° E','Reference URL':'https://example.org/'+('long-reference/'*10)})]
 if kind=='map':return [LegacyResult(**{**common,'template':'map.html','category':'map','latitude':-33.9249,'longitude':18.4241,'address':{'road':'Hawthorn Avenue','locality':'Mpofana Local Municipality','country':'South Africa'},'data':[{'label':'Opening hours','value':'Mon–Fri, 09:00–17:00'}],'links':[{'label':'Website','url':'https://example.org/','url_label':'Visit website'}]})]
 if kind=='products':return [LegacyResult(**{**common,'template':'products.html','price':'R 299.00','shipping':'Free delivery','source_country':'ZA'})]
 if kind=='packages':return [LegacyResult(**{**common,'template':'packages.html','package_name':'mobile-layout-fixture','version':'2.4.1','maintainer':'Example maintainer','tags':['python','research'],'license_name':'MIT','homepage':'https://example.org/project','source_code_url':'https://example.org/source'})]
 if kind=='torrent':return [LegacyResult(**{**common,'template':'torrent.html','category':'files','magnetlink':'magnet:?xt=urn:btih:'+('0'*40),'torrentfile':'https://example.org/open-data.torrent','seed':15,'leech':2,'filesize':'24 MB','files':3})]
 return [MainResult(**{**common,'url':f'https://example.org/research/{i}','title':f'{common["title"]} {i+1}'},publishedDate=datetime(2026,10,1,tzinfo=timezone.utc),thumbnail=IMAGE if i==0 else '') for i in range(6)]

def install():
 import searx.search,searx.webapp
 from searx.extended_types import sxng_request
 original_stats=searx.webapp.get_engines_stats
 original_reliability=searx.webapp.get_reliabilities
 original_proxify=searx.webapp.image_proxify
 searx.webapp.image_proxify=lambda url:IMAGE if url==IMAGE else original_proxify(url)
 kinds=['default','images','videos','map','code','paper','file','keyvalue','products','packages','torrent']
 def search(search_self):
  q=search_self.search_query.query
  kind=q.removeprefix('fixture:').split()[0] if q.startswith('fixture:') else {'it':'code','science':'paper','files':'file','music':'default'}.get(search_self.search_query.categories[0],search_self.search_query.categories[0])
  container=ResultContainer();results=[]
  if kind=='all':
   for name in kinds:results.extend(fixture_results(name))
  elif kind not in ['empty','answers','color','translations','weather','partial']:results=fixture_results(kind)
  elif kind=='partial':results=fixture_results('default')
  container.extend('google',results)
  container.paging=True
  if kind in ['all','answers','partial']:
   container.answers.add(Answer(answer='42 · a deterministic answer fixture',url='https://example.org/answer'))
  if kind=='color':container.answers.add(Answer(answer='#3675e8',template='answer/color.html'))
  if kind=='translations':container.answers.add(Translations(translations=[Translations.Item(text='Hello',examples=['A greeting'],definitions=['A word used when meeting someone'],synonyms=['Hi'])],url='https://example.org/dictionary'))
  if kind=='weather':
   class Measure:
    def __init__(self,value):self.value=value
    def l10n(self,*args,**kwargs):return self.value
   current=SimpleNamespace(summary='Cape Town · weather layout fixture',url=None,location='Cape Town',temperature=Measure('22 °C'),feels_like=Measure('21 °C'),wind_from=Measure('SW'),wind_speed=Measure('12 km/h'),pressure=Measure('1015 hPa'),humidity=Measure('68%'),datetime=Measure('Tomorrow'))
   container.answers.add(WeatherAnswer(current=current,forecasts=[current],service='Weather layout fixture'))
  if kind in ['all','default','partial']:
   container.suggestions.add('Cape Town research');container.corrections.add('Cape Town')
   container.infoboxes.append({'infobox':'Cape Town','id':'fixture-info','content':'A coastal city in South Africa. This is an interface fixture.','urls':[{'url':'https://example.org/cape-town','title':'Read more'}],'attributes':[{'label':'Country','value':'South Africa'}]})
  if kind in ['partial','empty']:
   container.unresponsive_engines.add(UnresponsiveEngine(engine='brave',error_type='timeout',suspended=False))
  container.close()
  return container
 searx.search.SearchWithPlugins.search=search
 def stats(engines):
  if sxng_request.args.get('empty')=='1':return original_stats(engines)
  names=['google','wikipedia','brave','duckduckgo','yahoo']
  rows=[{'name':name,'score':12-i,'score_per_result':2.4-i*.2,'result_count':50-i*5,'total':.4+i*.2,'http':.3+i*.15,'processing':.1+i*.05,'total_p80':1.1,'http_p80':.9,'processing_p80':.2,'total_p95':1.7,'http_p95':1.4,'processing_p95':.3} for i,name in enumerate(names) if name in engines]
  return {'time':rows,'max_result_count':50,'max_time':2}
 searx.webapp.get_engines_stats=stats
 def reliability(engines):
  values=original_reliability(engines)
  for name in values:values[name]={'reliability':96,'errors':[]}
  if 'google'in values:
   values['google']['errors']=[dict(secondary=False,exception_classname='ReadTimeout',log_message=None,log_parameters=('layout-fixture',),filename='searx/engines/example.py',line_no=42,function='response',code='response.raise_for_status()',percentage=4)]
  return values
 searx.webapp.get_reliabilities=reliability
 return kinds
