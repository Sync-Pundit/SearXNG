// SPDX-License-Identifier: AGPL-3.0-or-later
// Real Flask templates, deterministic provider data. Run against mobile-serve.py.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// PLAYWRIGHT_MODULE and CHROMIUM_PATH can point at a normal local installation.
let playwright;try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{playwright=require('/opt/codex/cua_node/lib/node_modules/playwright');}
const {chromium}=playwright;
const base=process.env.BASE_URL||'http://127.0.0.1:8795';
const report={engine:'Chromium',groups:[],limitations:['Real Flask rendering with deterministic result/provider fixtures.','Gecko/WebKit and physical touch, keyboard, native sharing and screen readers remain device checks.']};
async function run(name,fn){if(process.env.MOBILE_TEST_FILTER&&!name.toLowerCase().includes(process.env.MOBILE_TEST_FILTER.toLowerCase()))return;await fn();report.groups.push({name,status:'passed'});console.log('PASS '+name);}
async function context(browser,options={}){
 const c=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,...options});
 await c.addInitScript(()=>{
  window.__mobile={copies:[],shares:[]};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>__mobile.copies.push(value)}});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>__mobile.shares.push(data)});
  let override=null;const vv=visualViewport;
  for(const key of ['height','offsetTop','scale']){const read=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv),key).get.bind(vv);Object.defineProperty(vv,key,{get:()=>override?.[key]??read()});}
  window.__viewport=value=>{override=value;vv.dispatchEvent(new Event('resize'));vv.dispatchEvent(new Event('scroll'));};
 });return c;
}
async function open(c,url='/'){
 const p=await c.newPage();p.setDefaultTimeout(12000);p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(base+url,{waitUntil:'domcontentloaded'});await p.locator('body.sx-enhanced').waitFor();return p;
}
async function go(p,url){const response=await p.goto(base+url,{waitUntil:'domcontentloaded'});assert.equal(response.status(),url==='/missing-mobile-page'?404:200,url);await p.locator('body.sx-enhanced').waitFor();}
async function closeSheet(p){await p.locator('.sx-sheet-close').click();await p.waitForFunction(()=>!document.querySelector('.sx-sheet').open&&!history.state?.sxMobileSheet);}
async function preferenceSection(p,id){
 const text=await p.locator(`label[for="tab-${id}"]`).textContent();await p.locator('#search_form>.sx-tab-picker').click();await p.locator('.sx-sheet-choice').filter({hasText:new RegExp('^'+text.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();await p.locator('#tab-content-'+id).waitFor({state:'visible'});
}
const templates=['default','images','videos','map','code','paper','file','keyvalue','products','packages','torrent'];
const pages=['/','/preferences','/info/en/about','/info/en/search-syntax','/stats','/stats?engine=google','/stats?empty=1','/missing-mobile-page',...['de','it','id','fa-IR','fr'].flatMap(locale=>['about','search-syntax'].map(name=>'/info/'+locale+'/'+name)),...templates.map(t=>'/search?q=fixture:'+t),...['all','answers','color','translations','weather','empty','partial','alignment'].map(t=>'/search?q=fixture:'+t)];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});report.browser_version=browser.version();
 try{
 await run('Every HTML page family, result template and answer state fits phone, tablet and landscape',async()=>{
  let combinations=0;
  for(const [width,height] of [[320,640],[393,851],[430,932],[768,1024],[851,393]]){
   const c=await context(browser,{viewport:{width,height}}),p=await open(c);
   for(const route of pages){
    await go(p,route);
    const metrics=await p.evaluate(()=>({width:document.documentElement.scrollWidth,dock:document.querySelector('.sx-dock').getBoundingClientRect().toJSON()}));
    assert(metrics.width<=width+1,`${route} at ${width}: ${metrics.width}`);assert(metrics.dock.bottom<=height+1,route);
    assert.deepEqual(p.errors,[],route);combinations++;
   }await c.close();
  }report.route_viewport_combinations=combinations;report.templates=templates;
 });
 await run('Reported alignment: map values, result thumbnails, footers, switches and focused search controls',async()=>{
  let checks=0;
  for(const width of [320,393,430,851]){
   const c=await context(browser,{viewport:{width,height:851}}),p=await open(c,'/search?q=fixture:map');
   const values=await p.locator('.result-map td').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
   assert(values.length>=3);assert(values.every(w=>w>width*.5),'Map values must have reading width, not a narrow sliver');
   await go(p,'/search?q=fixture:alignment');assert.equal(await p.evaluate(()=>Boolean(window.__snippetExecuted)),false);
   const bio=await p.locator('p.content').first().textContent();assert(!bio.includes('<p>'));assert(bio.includes('Canadian living in #Alberta.'));assert(!bio.includes('window.__snippetExecuted'));assert.equal(await p.locator('p.content img,p.content script').count(),0);
   for(const article of await p.locator('.sx-has-thumbnail').all()){
    const image=await article.locator('.thumbnail_link').boundingBox(),heading=await article.locator('h3').boundingBox(),url=await article.locator('.url_header').boundingBox(),content=await article.locator('p.content').boundingBox();
    assert(Math.abs(image.y-heading.y)<2,'Thumbnail follows title row');assert(image.y>=url.y+url.height);assert(content.y>=Math.max(image.y+image.height,heading.y+heading.height),'Description clears title and thumbnail');
   }
   for(const article of await p.locator('#urls article.result').all()){
    const source=await article.locator('.engines span').first().boundingBox(),cached=await article.locator('.cache_link').boundingBox();
    assert(Math.abs(source.y+source.height/2-cached.y-cached.height/2)<2,'Footer source/cache share a baseline');
    const host=await article.locator('.url_o1').boundingBox(),path=await article.locator('.url_o2').boundingBox();if(path)assert(Math.abs(host.x-path.x)<1,'URL path starts under hostname');
   }
   for(const route of ['/','/search?q=fixture:default']){
    await go(p,route);const field=p.locator('#q'),before=await field.boundingBox();await field.focus();const after=await field.boundingBox();assert(Math.abs(before.y-after.y)<1);assert(Math.abs(before.x-after.x)<1);
    const box=await p.locator('.search_box').boundingBox(),clear=await p.locator('#clear_search').boundingBox(),send=await p.locator('#send_search').boundingBox();
    assert(box.height<70);assert(clear.x>=box.x&&clear.x+clear.width<=send.x+1);assert(send.x+send.width<=width);assert(after.x+after.width<=clear.x+1);
    await p.evaluate(()=>__viewport({height:320,offsetTop:0,scale:1}));assert((await p.locator('#send_search').boundingBox()).x+send.width<=width);await field.blur();await p.evaluate(()=>__viewport(null));
   }
   for(const locale of ['en','ar']){
    await go(p,'/preferences?locale='+locale);
    const toggles=p.locator('#tab-content-general input.checkbox-onoff:visible');assert(await toggles.count()>0);
    for(const toggle of await toggles.all()){
     const rect=await toggle.boundingBox();assert(rect.height>=44);
     const thumb=await toggle.evaluate(n=>{const s=getComputedStyle(n,'::before');return{x:parseFloat(s.left),y:parseFloat(s.top),width:parseFloat(s.width),height:parseFloat(s.height)}});
     assert(thumb.x>=0&&thumb.x+thumb.width<=rect.width);assert(thumb.y>=0&&thumb.y+thumb.height<=rect.height);
    }
    for(const button of await p.locator('.preferences_back').all())assert.equal(await button.evaluate(n=>getComputedStyle(n).padding),'0px');
   }
   assert.deepEqual(p.errors,[]);checks++;await c.close();
  }report.alignment_viewports=checks;
 });
 await run('Category swipes navigate native forms without hijacking scrolling, viewers or browser edges',async()=>{
  const c=await context(browser),p=await open(c,'/search?q=swipe+test&categories=general&language=en&time_range=week&safesearch=2&pageno=3');
  const cdp=await c.newCDPSession(p);
  async function drag(selector,dx,dy=0,startX){
   const target=p.locator(selector).first();await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
   const x=startX??Math.max(50,Math.min(330,box.x+box.width/2)),y=Math.max(270,Math.min(700,box.y+box.height/2));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y:y+dy*i/10}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function change(category,dx){
   await Promise.all([p.waitForURL(u=>u.searchParams.get('categories')===category&&!u.hash),drag('#urls article.result',dx)]);await p.locator('body.sx-enhanced').waitFor();
   const u=new URL(p.url());assert.equal(u.searchParams.get('q'),'swipe test');assert.equal(u.searchParams.get('language'),'en');assert.equal(u.searchParams.get('time_range'),'week');assert.equal(u.searchParams.get('safesearch'),'2');assert(!u.searchParams.has('pageno'),'New category starts at page one');
   assert.equal(await p.locator('#categories button.selected').textContent().then(s=>s.trim().toLowerCase()),category);
  }
  await change('images',-120);await change('videos',-120);await change('images',120);
  await p.goBack();await p.locator('body.sx-enhanced').waitFor();assert.equal(new URL(p.url()).searchParams.get('categories'),'videos');assert.equal((await p.locator('#categories button.selected').textContent()).trim().toLowerCase(),'videos');await change('images',120);
  // Repeated native swipes on the closed image grid must switch categories, not open a picture.
  await change('general',120);
  let requests=0;p.on('request',r=>{if(new URL(r.url()).pathname==='/search')requests++;});
  for(const [dx,dy,startX] of [[120,0],[40,0],[-30,-140],[-120,0,5]]){await drag('#urls article.result',dx,dy,startX);assert.equal(new URL(p.url()).searchParams.get('categories'),'general');}
  assert.equal(requests,0,'Boundary, short, vertical and edge gestures do not search');
  await go(p,'/search?q=swipe+test&categories=social+media');await drag('#urls article.result',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'social media','Last category does not wrap');
  await go(p,'/search?q=fixture:code&categories=it');await drag('.codelines',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'it');
  await go(p,'/search?q=fixture:map&categories=map');await p.locator('.btn-collapse').click();await drag('.osm-map-box',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'map');
  await go(p,'/search?q=fixture:images&categories=images');await p.locator('.result-images>a').first().click();await p.locator('.detail[role=dialog]').waitFor();await drag('.detail .result-images-source',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'images');assert.equal(new URL(p.url()).hash,'#image-viewer');assert(await p.locator('.detail[role=dialog]').isVisible());await p.goBack();
  await c.addCookies([{name:'search_on_category_select',value:'0',url:base}]);await go(p,'/search?q=swipe+test&categories=general');assert(await p.locator('#categories input[type=checkbox]').count()>0);await Promise.all([p.waitForURL(u=>u.searchParams.get('category_images')==='on'||u.searchParams.get('categories')==='images'),drag('#urls article.result',-120)]);await p.locator('body.sx-enhanced').waitFor();assert.equal(await p.locator('#categories input[name=category_images]').isChecked(),true);await c.clearCookies();
  await c.addCookies([{name:'locale',value:'ar',url:base}]);await go(p,'/search?q=swipe+test&categories=general&locale=ar');await Promise.all([p.waitForURL(u=>u.searchParams.get('categories')==='images'),drag('#urls article.result',120)]);await p.locator('body.sx-enhanced').waitFor();assert.equal(await p.locator('html').getAttribute('dir'),'rtl');await c.clearCookies();
  await go(p,'/search?q=swipe+test&categories=general');await p.evaluate(()=>{const box=document.createElement('div');box.id='swipe-nested-scroll';box.style.cssText='overflow-x:auto;height:80px;width:100%';const inner=document.createElement('div');inner.style.cssText='width:1500px;height:80px';inner.textContent='Horizontally scrollable evidence';box.append(inner);document.querySelector('#urls article').prepend(box);});await drag('#swipe-nested-scroll',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'general');assert((await p.locator('#swipe-nested-scroll').evaluate(n=>n.scrollLeft))>0);
  await go(p,'/search?q=swipe+test&categories=general');await p.evaluate(()=>__viewport({height:851,offsetTop:0,scale:2}));await drag('#urls article.result',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'general');await p.evaluate(()=>__viewport(null));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:480},{x:250,y:480}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(new URL(p.url()).searchParams.get('categories'),'general');
  await p.setViewportSize({width:1440,height:1000});await drag('#urls article.result',-120);assert.equal(new URL(p.url()).searchParams.get('categories'),'general');
  assert.deepEqual(p.errors,[]);report.category_swipes='Native button and checkbox forms, query/filters, Back, RTL, bounds and gesture exclusions passed';await c.close();
 });
 await run('All preference sections and engine categories remain available with mobile-sized controls',async()=>{
  const c=await context(browser),p=await open(c,'/preferences');let sections=0,categories=0;
  for(const id of ['general','ui','privacy','engines','query','cookies']){
   await preferenceSection(p,id);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=393));
   const panel=p.locator('#tab-content-'+id);assert(await panel.isVisible());sections++;
   for(const select of await panel.locator('select:visible').all())assert((await select.boundingBox()).height>=44);
  }
  await preferenceSection(p,'engines');
  const labels=await p.locator('#tab-content-engines>.tabs>label').allTextContents();
  for(const label of labels){
   await p.locator('#tab-content-engines>.sx-tab-picker').click();await p.locator('.sx-sheet-choice').filter({hasText:new RegExp('^'+label.trim()+'$','i')}).click();
   await p.waitForFunction(()=>!history.state?.sxMobileSheet);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=393));categories++;
  }
  report.preference_sections=sections;report.engine_categories=categories;assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Mobile filter apply preserves query, categories, language, SafeSearch and page navigation',async()=>{
  const c=await context(browser),p=await open(c,'/search?q=fixture:default&categories=general&pageno=2');
  await p.locator('.sx-refine-summary button').click();await p.locator('#sx-filter-time_range').selectOption('week');await p.locator('#sx-filter-safesearch').selectOption('2');await p.locator('#sx-filter-language').selectOption('en');
  await p.locator('.sx-sheet-apply').click();await p.waitForURL(/time_range=week/);await p.locator('body.sx-enhanced').waitFor();
  const u=new URL(p.url());assert.equal(u.searchParams.get('q'),'fixture:default');assert.equal(u.searchParams.get('safesearch'),'2');assert.equal(u.searchParams.get('language'),'en');assert.equal(u.searchParams.get('categories'),'general');
  await p.locator('.sx-page-chooser').click();await p.locator('.sx-pagination-list input[type="submit"][value="3"]').click();await p.waitForURL(/pageno=3/);
  const next=new URL(p.url());assert.equal(next.searchParams.get('q'),'fixture:default');assert.equal(next.searchParams.get('time_range'),'week');assert.equal(next.searchParams.get('safesearch'),'2');
  assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Context and action sheets preserve native forms, browser Back, focus and sharing',async()=>{
  const c=await context(browser),p=await open(c,'/search?q=fixture:default');
  await p.locator('.sx-dock button').filter({hasText:'Info'}).click();assert(await p.locator('.sx-sheet #sidebar').isVisible());assert(await p.locator('.sx-sheet #apis input[type=submit]').count());
  await p.goBack();await p.waitForFunction(()=>!document.querySelector('.sx-sheet').open);assert.equal(await p.locator('#results>#sidebar').count(),1);
  await p.locator('.sx-result-more').first().click();await p.locator('.sx-sheet-choice').filter({hasText:'Copy link'}).click();assert.equal((await p.evaluate(()=>__mobile.copies)).length,1);
  await p.locator('.sx-sheet-choice').filter({hasText:/^Share$/}).click();assert.equal((await p.evaluate(()=>__mobile.shares)).length,1);await closeSheet(p);
  assert(await p.locator('.sx-result-more').first().evaluate(n=>document.activeElement===n));
  await p.locator('.sx-menu').click();assert((await p.locator('.sx-sheet a[href]').count())>=6);await p.keyboard.press('Escape');await p.waitForFunction(()=>!history.state?.sxMobileSheet);
  assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Engine search, details, bulk actions and preference saving keep the original form contract',async()=>{
  const c=await context(browser),p=await open(c,'/preferences');await preferenceSection(p,'engines');
  const panel=p.locator('#tab-content-category_general');await panel.locator('.sx-engine-search').fill('wikipedia');
  assert.equal(await panel.locator('tr:visible [data-engine-name]').count(),1);const toggle=panel.locator('tr:visible input.checkbox-onoff');
  await panel.locator('.disable-all-engines').click();assert.equal(await toggle.isChecked(),true);await panel.locator('.enable-all-engines').click();assert.equal(await toggle.isChecked(),false);
  await panel.locator('.sx-engine-details:visible').click();assert(await p.locator('.sx-sheet .engine-tooltip').isVisible());assert((await p.locator('.sx-sheet a[href]').count())>0);await closeSheet(p);
  await preferenceSection(p,'general');await p.locator('select[name=language]').selectOption('en');
  await p.locator('.sx-dock .sx-primary').click();await p.waitForURL(u=>!u.pathname.includes('/preferences'));await go(p,'/preferences');assert.equal(await p.locator('select[name=language]').inputValue(),'en');
  assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Image preview keeps native swipe/Back behavior, visible exits and keyboard focus',async()=>{
  const c=await context(browser),p=await open(c,'/search?q=fixture:images');await p.locator('.result-images>a').first().click();await p.waitForURL(/#image-viewer$/);
  const dialog=p.locator('.detail[role=dialog]');await dialog.waitFor();const rect=await dialog.boundingBox();assert(rect.x>=-1&&rect.width<=394&&rect.y>=-1&&rect.height<=852);
  assert.equal(await dialog.getAttribute('aria-modal'),'true');assert((await dialog.locator('.result-detail-close').boundingBox()).height>=44);
  await dialog.locator('.result-detail-next').click();assert.equal(await p.locator('.detail[role=dialog]').count(),1);
  await p.goBack();await p.waitForFunction(()=>!document.querySelector('#results').classList.contains('image-detail-open'));assert.equal(await p.locator('.sx-dock').evaluate(n=>n.inert),false);
  assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('All palettes and RTL layouts retain page width and readable native forms',async()=>{
  const c=await context(browser),p=await open(c,'/preferences');await preferenceSection(p,'ui');const styles=await p.locator('select[name=simple_style] option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
  for(const style of styles){await go(p,'/search?q=fixture:all&simple_style='+encodeURIComponent(style));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=393),style);}
  for(const locale of ['ar','fa-IR']){
   await go(p,'/search?q=fixture:all&locale='+locale);assert.equal(await p.locator('html').getAttribute('dir'),'rtl');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=393),locale);
   await go(p,'/preferences?locale='+locale);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=393),locale+' preferences');
  }
  report.palettes=styles;report.rtl_locales=['ar','fa-IR'];assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Keyboard focus is stable before real occlusion and short viewports retain sheet controls',async()=>{
  const c=await context(browser),p=await open(c);const input=p.locator('#q'),before=await input.boundingBox(),cdp=await c.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:before.x+30,y:before.y+20}]});const after=await input.boundingBox();assert(Math.abs(after.y-before.y)<1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await p.locator('body').evaluate(n=>n.classList.contains('sx-keyboard')),false);
  await input.fill('An unsubmitted query');await p.evaluate(()=>__viewport({height:320,offsetTop:20,scale:1}));await p.waitForFunction(()=>document.body.classList.contains('sx-keyboard'));assert.equal(await p.locator('.sx-dock').isVisible(),false);
  await input.blur();await p.evaluate(()=>__viewport(null));await p.waitForFunction(()=>!document.body.classList.contains('sx-keyboard'));assert.equal(await input.inputValue(),'An unsubmitted query');
  await p.locator('.sx-menu').click();await p.evaluate(()=>__viewport({height:300,offsetTop:20,scale:1}));const close=await p.locator('.sx-sheet-close').boundingBox();assert(close.y>=20-1&&close.y+close.height<=320+1);await closeSheet(p);
  assert.deepEqual(p.errors,[]);await c.close();
 });
 await run('Desktop resize restores native controls and no-JavaScript pages stay navigable',async()=>{
  const c=await context(browser),p=await open(c,'/preferences');await preferenceSection(p,'engines');await p.setViewportSize({width:1440,height:1000});assert.equal(await p.locator('.sx-dock').isVisible(),false);assert(await p.locator('label[for=tab-engines]').isVisible());assert.equal(await p.locator('.sx-tab-picker').first().isVisible(),false);
  await go(p,'/search?q=fixture:default');assert(await p.locator('.search_filters select').first().isVisible());assert(await p.locator('#sidebar').isVisible());assert.deepEqual(p.errors,[]);await c.close();
  const no=await browser.newContext({viewport:{width:393,height:851},javaScriptEnabled:false}),q=await no.newPage();await q.goto(base+'/search?q=fixture:default');assert(await q.locator('.search_filters select').first().isVisible());assert((await q.locator('#urls article.result').count())>0);await no.close();
 });
 }finally{await browser.close();}
 const output=path.resolve(__dirname,'../../output',process.env.MOBILE_TEST_FILTER?'searxng-focused.json':'searxng-mobile-results.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
