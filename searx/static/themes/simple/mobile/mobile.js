// SPDX-License-Identifier: AGPL-3.0-or-later
// Progressive mobile UI around the existing SearXNG forms and result models.
const configElement=document.getElementById('sx-mobile-config');
if(configElement){
 const cfg=JSON.parse(configElement.dataset.config),L=cfg.labels,compact=matchMedia('(max-width:900px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const body=document.body,query=document.getElementById('q'),search=document.getElementById('search'),preferences=document.getElementById('search_form');
 const endpoint=document.querySelector('meta[name=endpoint]')?.content||'';
 const icons={search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',filters:'M4 6h16M7 12h10M10 18h4',info:'M12 8v.1M12 11v6M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',menu:'M4 6h16M4 12h16M4 18h16',sections:'M7 5h14M7 12h14M7 19h14M2 5h1M2 12h1M2 19h1',save:'m5 12 4 4L20 5',sort:'M4 5h16M4 12h11M4 19h6',more:'M12 5v.1M12 12v.1M12 19v.1'};
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',icons[name]||icons.info);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);return svg;};
 function button(text,cls,fn){const b=node('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
 function dockButton(text,name,fn){const b=button('','',fn);b.append(icon(name),node('span','',text));return b;}
 function dockLink(text,name,url){const a=node('a');a.href=url;a.append(icon(name),node('span','',text));return a;}
 function choice(text,fn){return button(text,'sx-sheet-choice',fn);}
 function safeLink(raw){try{const u=new URL(raw,location.href);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}

 const sheet=node('dialog','sx-sheet'),sheetHead=node('div','sx-sheet-head'),sheetTitle=node('h2','sx-sheet-title'),sheetBody=node('div','sx-sheet-body');
 sheetTitle.id='sx-sheet-title';sheet.setAttribute('aria-labelledby',sheetTitle.id);
 const close=button('×','sx-sheet-close',()=>closeSheet());close.setAttribute('aria-label',L.close);close.autofocus=true;
 sheetHead.append(sheetTitle,close);sheet.append(sheetHead,sheetBody);body.append(sheet);
 let returnFocus=null,moved=[],historyToken=null,tokenCounter=0,pendingAction=null;
 function restoreMoved(){for(const [el,marker] of moved){if(marker.isConnected){marker.after(el);marker.remove();}}moved=[];}
 function finishAction(){const fn=pendingAction;pendingAction=null;fn?.();}
 function openSheet(title,trigger,fill){
  if(!sheet.open){returnFocus=trigger||document.activeElement;historyToken='sx-mobile-'+(++tokenCounter);history.pushState({...history.state,sxMobileSheet:historyToken},'',location.href);}
  restoreMoved();sheetTitle.textContent=title;sheetBody.replaceChildren();fill(sheetBody);if(!sheet.open)sheet.showModal();
 }
 function moveToSheet(el){const marker=document.createComment('mobile sheet position');el.before(marker);moved.push([el,marker]);sheetBody.append(el);}
 function closeSheet(after){
  if(typeof after==='function')pendingAction=after;
  if(sheet.open)sheet.close();
  if(historyToken&&history.state?.sxMobileSheet===historyToken){history.back();}else{historyToken=null;finishAction();}
 }
 sheet.addEventListener('close',()=>{if(sheet.open)return;restoreMoved();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
 sheet.addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
 sheet.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSheet();}});
 sheet.addEventListener('click',e=>{if(e.target!==sheet)return;const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet();});
 window.addEventListener('popstate',()=>{if(historyToken&&history.state?.sxMobileSheet!==historyToken){historyToken=null;if(sheet.open)sheet.close();finishAction();}});

 const header=node('header','sx-header sx-mobile-only'),brand=node('a','sx-brand'),menu=button('','sx-menu',()=>openMenu(menu));
 for(const link of document.querySelectorAll('.page_with_header>a'))if(link.querySelector('img.logo'))link.classList.add('sx-original-logo');
 brand.href=cfg.home;brand.append(icon('search'),node('span','',cfg.name));menu.append(icon('menu'));menu.setAttribute('aria-label',L.menu);header.append(brand,menu);body.prepend(header);
 const dock=node('nav','sx-dock sx-mobile-only');dock.setAttribute('aria-label',L.search+' / '+L.preferences);body.append(dock);
 function openMenu(trigger){openSheet(L.menu,trigger,container=>{
  const seen=new Set();for(const original of document.querySelectorAll('#links_on_top a,body>footer a')){
   const href=original.getAttribute('href');if(!href||seen.has(href))continue;seen.add(href);
   const a=original.cloneNode(true);a.className='sx-sheet-choice';container.append(a);
  }
  container.append(node('p','sx-sheet-status',document.querySelector('meta[name=generator]')?.content||cfg.name));
 });}
 const done=button(L.done,'sx-keyboard-done',()=>document.activeElement?.blur());header.append(done);
 const searchControl=query?dockButton(L.search,'search',()=>{if(sheet.open)closeSheet();query.scrollIntoView({block:'center',behavior:'instant'});query.focus({preventScroll:true});}):dockLink(L.search,'search',cfg.home);
 dock.append(searchControl);

 function categoryLabel(code){const original=document.querySelector(`#categories button[name="category_${CSS.escape(code)}"] .category_name`);return original?.textContent.trim()||code.replace(/\b\w/g,c=>c.toUpperCase());}
 function setHomeCategory(code){
  for(const hidden of search.querySelectorAll('input[type=hidden][name^="category_"]'))hidden.remove();
  const value=node('input');value.type='hidden';value.name='category_'+code;value.value='1';search.append(value);
  for(const el of document.querySelectorAll('.sx-home-categories button'))el.setAttribute('aria-pressed',String(el.dataset.category===code));
 }
 function openCategories(trigger){openSheet(L.categories,trigger,container=>{
  for(const category of cfg.categories){
   const native=[...document.querySelectorAll('#categories button.category')].find(b=>b.name==='category_'+category);
   const b=choice(categoryLabel(category),()=>closeSheet(()=>{if(native)native.click();else{setHomeCategory(category);query?.focus({preventScroll:true});}}));
   const selected=native?native.classList.contains('selected'):Boolean(search?.querySelector('input[name="category_'+CSS.escape(category)+'"]'));
   b.setAttribute('aria-pressed',String(selected));container.append(b);
  }
 });}
 if(endpoint==='index'&&query&&search){
  const title=document.querySelector('.index .title');
  title?.prepend(node('span','sx-home-kicker sx-mobile-only',L.search+' / '+L.categories));
  title?.append(node('p','sx-home-intro sx-mobile-only',document.querySelector('meta[name=description]')?.content.replace(/^SearXNG\s*[—-]\s*/,'')||''));
  const categories=node('div','sx-home-categories sx-mobile-only');categories.setAttribute('aria-label',L.categories);
  for(const category of cfg.categories.slice(0,6)){
   const b=button(categoryLabel(category),'',()=>setHomeCategory(category));b.dataset.category=category;b.setAttribute('aria-pressed',String(Boolean(search.querySelector('input[name="category_'+CSS.escape(category)+'"]'))));categories.append(b);
  }search.after(categories);
  const cats=dockButton(L.categories,'sections',()=>openCategories(cats));dock.append(cats,dockLink(L.about,'info',cfg.about));
 }

 const filters=document.querySelector('#search .search_filters');
 function openFilters(trigger){openSheet(L.filters,trigger,container=>{
  const selected=[];
  for(const original of filters.querySelectorAll('select')){
   const label=node('label','sx-field-label',original.getAttribute('aria-label')||original.name);const clone=original.cloneNode(true);clone.id='sx-filter-'+original.id;clone.removeAttribute('name');clone.value=original.value;label.htmlFor=clone.id;container.append(label,clone);selected.push([original,clone]);
  }
  const apply=button(L.apply,'sx-sheet-apply',()=>closeSheet(()=>{for(const [original,clone] of selected)original.value=clone.value;search.requestSubmit();}));container.append(apply);
 });}
 if(endpoint==='results'){
  if(filters){
   const summary=node('div','sx-refine-summary sx-mobile-only');summary.append(node('span','',[...filters.querySelectorAll('select')].map(s=>s.selectedOptions[0]?.textContent.trim()).filter(Boolean).join(' · ')));
   const refine=button(L.filters,'',()=>openFilters(refine));summary.append(refine);search.append(summary);
   const filterDock=dockButton(L.filters,'filters',()=>openFilters(filterDock));dock.append(filterDock);
  }
  const context=document.querySelector('#sidebar');
  const insights=dockButton(L.info,'info',()=>openSheet(L.info,insights,()=>moveToSheet(context)));insights.disabled=!context;dock.append(insights);
 }

 function tabControl(tabs){
  const radios=[...tabs.children].filter(n=>n.matches('input[type=radio]'));
  if(!radios.length)return null;
  const entries=radios.map(r=>({radio:r,label:tabs.querySelector(`:scope>label[for="${CSS.escape(r.id)}"]`),panel:tabs.querySelector('#'+CSS.escape('tab-content-'+r.id.replace(/^tab-/,'')))})).filter(e=>e.label&&e.panel);
  if(!entries.length)return null;
  const picker=button('','sx-tab-picker sx-mobile-only',()=>openSheet(L.sections,picker,container=>{
   for(const entry of entries){const b=choice(entry.label.textContent.trim(),()=>closeSheet(()=>select(entry)));b.setAttribute('aria-pressed',String(entry.radio.checked));container.append(b);}
  }));tabs.before(picker);tabs.classList.add('sx-controlled-tabs');
  function syncSemantics(){tabs.setAttribute('role',compact.matches?'group':'tablist');for(const item of entries){item.panel.setAttribute('role',compact.matches?'region':'tabpanel');item.panel.setAttribute('aria-labelledby',item.label.id);item.panel.setAttribute('aria-hidden',String(!item.radio.checked));}}
  compact.addEventListener('change',syncSemantics);
  function select(entry){
   entry.radio.checked=true;
   for(const item of entries){item.panel.classList.toggle('sx-pref-active',item===entry);item.label.setAttribute('aria-selected',String(item===entry));}
   picker.replaceChildren(node('span','',entry.label.textContent.trim()),node('small','',entries.length+' '+L.sections.toLowerCase()));syncSemantics();
  }
  for(const entry of entries){
   const heading=node('h2','sx-panel-heading sx-mobile-only',entry.label.textContent.trim());entry.panel.prepend(heading);
   entry.radio.addEventListener('change',()=>{if(entry.radio.checked)select(entry);});
  }select(entries.find(e=>e.radio.checked)||entries[0]);
  return {picker,entries,select,open:()=>picker.click()};
 }
 let prefTabs=null,dirty=false;
 if(preferences){
  prefTabs=tabControl(preferences.querySelector(':scope>.tabs'));
  const engineTabs=preferences.querySelector('#tab-content-engines>.tabs');if(engineTabs)tabControl(engineTabs);
  for(const input of preferences.querySelectorAll('input[type=password]')){
   const legend=input.closest('fieldset')?.querySelector('legend');if(legend){legend.id||='sx-pref-'+input.name;input.setAttribute('aria-labelledby',legend.id);}
  }
  const sections=dockButton(L.sections,'sections',()=>prefTabs?.open());dock.append(sections);
  const save=dockButton(L.save,'save',()=>preferences.requestSubmit());save.classList.add('sx-primary');dock.append(save);
  const changed=node('p','sx-setting-status sx-mobile-only');preferences.before(changed);
  preferences.addEventListener('input',e=>{if(!e.target.name||['maintab','enginetab'].includes(e.target.name))return;dirty=true;changed.textContent=L.save+' · '+L.preferences;save.setAttribute('aria-label',L.save+' '+L.preferences);});
  preferences.addEventListener('change',e=>{if(!e.target.name||['maintab','enginetab'].includes(e.target.name))return;dirty=true;changed.textContent=L.save+' · '+L.preferences;});
  preferences.addEventListener('submit',()=>{dirty=false;});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 }

 function addTableCards(table,{engines=false,titleIndex=0,toggle=false}={}){
  table.classList.add('sx-card-table');const headerRow=table.querySelector(':scope>tbody>tr,:scope>tr');if(!headerRow)return;
  headerRow.classList.add('sx-table-head');const labels=[...headerRow.children].map(cell=>cell.textContent.trim());
  for(const row of table.querySelectorAll(':scope>tbody>tr')){
   if(row===headerRow||row.classList.contains('pref-group'))continue;
   const cells=[...row.children];cells.forEach((cell,i)=>{if(cell.tagName==='TD')cell.dataset.label=labels[i]||'';});
   const named=row.querySelector('[data-engine-name]')||row.querySelector('.engine-name')||cells[titleIndex];named?.classList.add('sx-cell-title');
   if(engines||toggle){if(cells[0]?.querySelector('input'))cells[0].classList.add('sx-cell-toggle');else cells[0]?.classList.add('sx-empty-cell');}
   if(engines){
    const details=button(L.details,'sx-engine-details',()=>engineDetails(named,details)),cell=node('td','sx-engine-detail-cell sx-mobile-only');cell.colSpan=labels.length;cell.append(details);row.append(cell);
   }
  }
 }
 let descriptions=null;
 async function engineDetails(named,trigger){
  const name=named.dataset.engineName||named.textContent.trim(),original=named.querySelector('.engine-tooltip');
  openSheet(name,trigger,container=>{
   if(original){const copy=original.cloneNode(true);copy.removeAttribute('id');container.append(copy);}
   else container.append(node('p','sx-sheet-status',name));
  });
  const description=sheetBody.querySelector('.engine-description');if(!description||description.textContent.trim())return;
  try{
   descriptions||=fetch(cfg.descriptions,{credentials:'same-origin'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
   const records=await descriptions;if(!description.isConnected)return;const record=records[name];if(record)description.textContent=String(record[0]||record).replace(/<[^>]*>/g,'');
  }catch{}
 }
 for(const table of document.querySelectorAll('#main_preferences table.table_engines')){
  addTableCards(table,{engines:true});
  const input=node('input','sx-engine-search sx-mobile-only');input.type='search';input.placeholder=L.find_engine;input.setAttribute('aria-label',L.find_engine);table.parentElement.before(input);
  input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();for(const row of table.querySelectorAll('tr')){if(row.querySelector('[data-engine-name]'))row.hidden=!row.querySelector('[data-engine-name]').dataset.engineName.toLowerCase().includes(q);}});
 }
 for(const table of document.querySelectorAll('#main_stats>table.engine-stats,#tab-content-cookies>table.cookies'))addTableCards(table);
 for(const table of document.querySelectorAll('#tab-content-query table'))addTableCards(table,{titleIndex:2,toggle:true});
 const statsTable=document.querySelector('#main_stats>table.engine-stats');
 if(endpoint==='stats'){
  const sorter=dockButton(L.sort,'sort',()=>openSheet(L.sort,sorter,container=>{
   for(const link of statsTable?.querySelectorAll('tr:first-child th a')||[]){const a=link.cloneNode(true);a.className='sx-sheet-choice';container.append(a);}
  }));sorter.disabled=!statsTable?.querySelector('tr:first-child th a');dock.append(sorter,dockLink(L.about,'info',cfg.about));
 }
 if(endpoint==='info'){
  const contents=dockButton(L.contents,'sections',()=>openSheet(L.contents,contents,container=>{
   document.querySelectorAll('.info-page h1,.info-page h2,.info-page h3').forEach((h,i)=>{h.id||='sx-section-'+i;container.append(choice(h.textContent.trim(),()=>closeSheet(()=>{h.tabIndex=-1;h.focus({preventScroll:true});h.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});})));});
  }));dock.append(contents,dockLink(L.stats,'sort',cfg.stats));
 }
 if(!['index','results','preferences','info','stats'].includes(endpoint)){dock.append(dockLink(L.about,'info',cfg.about),dockLink(L.stats,'sort',cfg.stats));}
 if(!preferences)dock.append(dockLink(L.preferences,'settings',cfg.preferences));

 async function copyValue(text,status){try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);status.textContent=L.copied;}catch{status.textContent=L.select;const field=node('textarea');field.readOnly=true;field.value=text;field.setAttribute('aria-label',L.copy);sheetBody.append(field);field.focus();field.select();}}
 function resultActions(article,trigger){
  const link=article.querySelector('h3 a[href]'),url=safeLink(link?.href);if(!url)return;
  openSheet(link.textContent.trim(),trigger,container=>{
   const feedback=node('p','sx-sheet-status');feedback.setAttribute('role','status');
   const copy=choice(L.copy,()=>copyValue(url,feedback));
   const share=choice(L.share,async()=>{try{if(!navigator.share)throw Error();await navigator.share({title:link.textContent.trim(),url});}catch(e){if(e.name!=='AbortError')await copyValue(url,feedback);}});
   container.append(copy,share,feedback);
  });
 }
 function plainSocialSnippet(article){
  const engines=[...article.querySelectorAll('.engines span')].map(el=>el.textContent).join(' ');
  const content=article.querySelector('p.content');
  if(!/mastodon/i.test(engines)||!content||!/<(?:p|br|a|span)\b/i.test(content.textContent))return;
  // Template contents are inert. Only extracted text is inserted into the live page.
  const template=document.createElement('template');template.innerHTML=content.textContent;
  template.content.querySelectorAll('script,style,iframe,object,embed').forEach(el=>el.remove());
  template.content.querySelectorAll('br').forEach(el=>el.replaceWith(document.createTextNode(' ')));
  template.content.querySelectorAll('p,div,li').forEach(el=>el.append(document.createTextNode(' ')));
  content.textContent=template.content.textContent.replace(/\s+/g,' ').trim();
 }
 function enhanceResults(){
  for(const article of document.querySelectorAll('#urls article.result:not(.result-images)')){
   if(article.querySelector('.sx-result-more')||!article.querySelector('h3 a[href]'))continue;
   plainSocialSnippet(article);
   article.classList.toggle('sx-has-thumbnail',Boolean(article.querySelector('.thumbnail_link')));
   const more=button('⋯','sx-result-more sx-mobile-only',()=>resultActions(article,more));more.setAttribute('aria-label',L.details+': '+article.querySelector('h3').textContent.trim());article.append(more);
  }
 }
 enhanceResults();const urls=document.querySelector('#urls');if(urls)new MutationObserver(enhanceResults).observe(urls,{childList:true});
 const pagination=document.querySelector('#pagination'),pages=pagination?.querySelector('.numbered_pagination');
 if(pages){const current=pages.querySelector('.page_number_current')?.value||new URL(location.href).searchParams.get('pageno')||'1';
  const choose=button(L.page+' '+current,'sx-page-chooser sx-mobile-only',()=>openSheet(L.page,choose,container=>{const list=node('div','sx-pagination-list');for(const form of pages.querySelectorAll('form'))list.append(form.cloneNode(true));container.append(list);}));
  const next=pagination.querySelector('.next_page');if(next)next.before(choose);else pagination.append(choose);
 }
 // Keep all wide evidence usable without widening the page.
 for(const el of document.querySelectorAll('.info-page pre,.result .codelines,.selectable_url')){el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label',L.details);}
 let viewportBaseline=0,keyboardSeen=false;
 function viewport(){
  const vv=window.visualViewport,zoom=(vv?.scale||1)>1.05,height=zoom?innerHeight:(vv?.height||innerHeight),top=zoom?0:(vv?.offsetTop||0);
  const focused=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea');
  if(!keyboardSeen&&!focused)viewportBaseline=height;if(!viewportBaseline)viewportBaseline=innerHeight;
  if(focused&&!zoom&&viewportBaseline-height>140)keyboardSeen=true;
  if(keyboardSeen&&height>=viewportBaseline-80)keyboardSeen=false;
  body.classList.toggle('sx-keyboard',compact.matches&&keyboardSeen);
  document.documentElement.style.setProperty('--sx-vh',Math.round(height)+'px');document.documentElement.style.setProperty('--sx-vtop',Math.round(top)+'px');
  document.documentElement.style.setProperty('--sx-keyboard-inset',(zoom?0:Math.max(0,Math.round(innerHeight-height-top)))+'px');
 }
 window.visualViewport?.addEventListener('resize',viewport,{passive:true});window.visualViewport?.addEventListener('scroll',viewport,{passive:true});window.addEventListener('resize',viewport,{passive:true});document.addEventListener('focusin',viewport);document.addEventListener('focusout',()=>queueMicrotask(viewport));viewport();
 compact.addEventListener('change',()=>{if(!compact.matches&&sheet.open)closeSheet();if(!compact.matches)for(const row of document.querySelectorAll('.table_engines tr[hidden]'))row.hidden=false;});
 // Preserve SearXNG's image loading, horizontal swipes and browser-Back model.
 let activeImage=null,imageTrigger=null,inerted=[];
 function imageState(){
  const detail=compact.matches&&document.querySelector('#results.image-detail-open article.result-images[data-vim-selected] .detail');
  if(detail===activeImage)return;
  if(activeImage){activeImage.removeAttribute('role');activeImage.removeAttribute('aria-modal');for(const el of inerted)el.inert=false;inerted=[];}
  if(!detail){activeImage=null;const card=imageTrigger?.closest('article.result-images');if(card){card.tabIndex=-1;card.focus({preventScroll:true});}return;}
  if(!activeImage)imageTrigger=document.activeElement;
  activeImage=detail;detail.setAttribute('role','dialog');detail.setAttribute('aria-modal','true');detail.setAttribute('aria-label',detail.querySelector('h4')?.textContent.trim()||L.info);
  for(const el of document.querySelectorAll('#search,.sx-header,.sx-dock,body>footer,#urls article.result')){if(el.contains(detail)||el.inert)continue;el.inert=true;inerted.push(el);}
  detail.querySelector('.result-detail-close')?.focus({preventScroll:true});
 }
 const results=document.getElementById('results');if(results)new MutationObserver(()=>requestAnimationFrame(imageState)).observe(results,{attributes:true,subtree:true,attributeFilter:['class','data-vim-selected']});
 window.addEventListener('hashchange',()=>requestAnimationFrame(imageState));compact.addEventListener('change',imageState);
 document.addEventListener('keydown',e=>{
  if(!activeImage)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();activeImage.querySelector('.result-detail-close')?.click();}
  if(e.key==='Tab'){
   const nodes=[...activeImage.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length),first=nodes[0],last=nodes.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 },true);
 body.classList.add('sx-enhanced');
}
