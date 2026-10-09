const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (value,currency='USD') => value==null?'Precio a consultar':(currency==='USD'?'USD ':'$ ')+new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(value);
const date = s => s?new Date(s).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'—';
const labels = {qualified:'Cumplen tus requisitos',review:'Datos pendientes de chequeo',rejected:'Fuera de los criterios',all:'Todos los avisos'};
const reviewLabels = {unreviewed:'No revisado',interested:'De interés / Pendiente de contacto',contacted:'Ya contactado / Pendiente de visita',discarded:'Descartado'};
let reviewState=window.deptosStaticApi?'':'unreviewed';
let settings, neighborhoods, status='candidates', page=1, total=0, progress={}, portalProgress={}, activeDetail=null, loadSerial=0;
const filters=['neighborhood','source','property_type','q','min_area','max_price','outdoor','disposition','include_inactive','sort'];
let timer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,6000)}
async function api(path,options={}){if(window.deptosStaticApi)return window.deptosStaticApi(path,options);const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});if(!r.ok){let message;try{const e=await r.json();message=typeof e.detail==='string'?e.detail:JSON.stringify(e.detail)}catch{message=r.statusText}throw new Error(message)}return r.json()}
function params(){const p=new URLSearchParams({status:$('eligibility').value,page,review_state:reviewState});if(reviewState===''||reviewState==='discarded')p.set('include_dismissed','true');for(const key of filters){let el=$(key);let v=el.type==='checkbox'?el.checked:el.value;if(v)p.set(key,String(v))}return p}
function criteria(){ $('criteria').textContent=`3 ambientes · Hasta ${money(settings.max_price)} · Balcón, patio o terraza propios · Antigüedad de ${settings.min_age_years??1} a ${settings.max_age_years??25} años · Sin pozo, construcción ni a estrenar · Frente o contrafrente · Ascensor o planta baja · PB solo en edificios de hasta 2 pisos · Sobre avenidas, solo contrafrente`; }
function reviewOptions(current) {
  return Object.entries(reviewLabels).map(([value,label])=>option(value,current,label)).join('');
}
function card(i) {
  const effective={...i,...(i.overrides||{})};
  const known=[];
  if(effective.property_type)known.push(({departamento:'Departamento',casa:'Casa',ph:'PH'})[effective.property_type]||effective.property_type);
  if(effective.age_years!=null)known.push(effective.age_years===0?'A estrenar':`${effective.age_years} años de antigüedad`);
  if(effective.balcony)known.push('Balcón');
  if(effective.patio)known.push('Patio');
  if(effective.terrace)known.push('Terraza');
  if(effective.disposition)known.push(effective.disposition==='contrafrente'?'Contrafrente':effective.disposition==='frente'?'Frente':effective.disposition);
  if(effective.floor===0)known.push('Planta baja');else if(i.elevator_assumed)known.push('Ascensor (supuesto)');else if(effective.elevator)known.push('Ascensor');
  const pending=i.checks.filter(c=>c.state!=='pass');
  return `<article class="card">
    <button class="card-photo" data-detail="${i.id}" aria-label="Ver ${esc(i.address||i.title)}">${i.photos?.[0]?`<img class="card-image" src="${esc(i.photos[0])}" loading="lazy" referrerpolicy="no-referrer" alt="Departamento en ${esc(i.neighborhood)}">`:'<div class="card-image-placeholder">Fotos en la publicación</div>'}<span class="portal-tag">${i.source==='argenprop'?'ARGENPROP':'ZONAPROP'}</span></button>
    <div class="card-body"><div class="price">${esc(money(i.price,i.currency))}</div><div class="expenses">${i.expenses?`+ ${esc(money(i.expenses,'ARS'))} expensas`:i.partial_price?'Precio parcial: confirmar total':'Expensas sin informar'}</div>
    <h3 class="card-address" title="${esc(i.title)}">${esc(i.address||i.title.slice(0,80)||'Dirección sin informar')}</h3><p class="card-neighborhood">${esc(i.neighborhood||'Barrio sin confirmar')}${!i.active?' · No disponible':''}</p>
    <div class="card-features"><span>${i.rooms||'?'} ambientes</span><span>${i.area_total?`${i.area_total} m² totales`:i.area_covered?`${i.area_covered} m² cubiertos`:'Superficie sin informar'}</span></div>
    <div class="badges">${i.status==='review'?'<span class="badge unknown">Datos pendientes de chequeo</span>':''}${known.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}${pending.slice(0,2).map(c=>`<span class="badge ${c.state==='fail'?'fail':'unknown'}">${esc(c.label)} ${c.state==='fail'?'✕':'?'}</span>`).join('')}</div>
    <label class="review-picker">Estado de seguimiento<select data-review="${i.id}" aria-label="Estado de ${esc(i.address||i.title)}">${reviewOptions(i.review_state)}</select></label>
    <div class="card-bottom"><a class="publication-link" href="${esc(i.url)}" target="_blank" rel="noopener">Publicación ↗</a><button class="view" data-detail="${i.id}">Ver ficha</button></div>
    </div></article>`;
}

async function load(){const serial=++loadSerial;try{const r=await api('/api/listings?'+params());if(serial!==loadSerial)return;total=r.total;for(const [state,count] of Object.entries(r.review_counts))$('count-'+state).textContent=count;$('result-count').textContent=`${total} ${total===1?'aviso':'avisos'}`+($('eligibility').value==='candidates'&&r.eligibility_counts?` · ${r.eligibility_counts.qualified} cumplen · ${r.eligibility_counts.review} con datos pendientes`:'');$('results-title').textContent=window.deptosStaticApi?'Propiedades disponibles':reviewLabels[reviewState]||'Todos los estados';$('cards').innerHTML=r.items.length?r.items.map(card).join(''):`<div class="empty"><div class="empty-icon">⌂</div><h3>No hay avisos en este estado</h3><p>Probá con otros filtros o elegí Todos los estados para ver tu seguimiento completo.</p><button class="subtle" id="show-all-states">Ver todos los estados →</button></div>`;$('page-label').textContent=`${page} / ${Math.max(1,Math.ceil(total/24))}`;$('prev').disabled=page<=1;$('next').disabled=page*24>=total;document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(Number(b.dataset.detail)));document.querySelectorAll('[data-review]').forEach(el=>el.onchange=()=>saveReview(Number(el.dataset.review),el.value,el));if($('show-all-states'))$('show-all-states').onclick=()=>setReviewState('')}catch(e){toast(e.message)}}
function setReviewState(state) {
  reviewState=state;page=1;
  document.querySelectorAll('[data-review-state]').forEach(b=>b.classList.toggle('active',b.dataset.reviewState===state));
  load();
}
async function saveReview(id,state,select) {
  if(select)select.disabled=true;
  try {
    await api('/api/listings/'+id,{method:'PATCH',body:JSON.stringify({review_state:state})});
    toast(reviewLabels[state]);await load();
  } catch(e) {toast(e.message);await load();}
}

async function updateStatus(){if(window.deptosStaticStatus){await window.deptosStaticStatus();return}try{const r=await api('/api/status');progress=r.progress;portalProgress=r.portals||{};$('scan-state').textContent=Object.keys(portalProgress).length?Object.entries(portalProgress).map(([source,p])=>`${source}: ${p.message}`).join(' · '):progress.message;$('next-run').textContent=settings?.automatic?`Próxima actualización: ${date(r.next_run)}`:'Actualización automática pausada';$('progress-bar').style.width=progress.pages_target?Math.round(100*progress.pages_done/progress.pages_target)+'%':'0%';$('scan').disabled=Boolean(portalProgress[$('source').value||settings?.sources[0]]?.running??progress.running);$('stop').hidden=!progress.running;$('stop').textContent=r.manual?'Guardar y cerrar navegador':'Detener';const latest={};for(const run of r.runs)if(!latest[run.source])latest[run.source]=run;const bad=Object.values(latest).filter(r=>['blocked','error','partial','interrupted'].includes(r.status));const held=Object.entries(r.held||{}).filter(([s,v])=>v).map(([s])=>s);$('portal-alert').hidden=!bad.length&&!held.length;$('portal-alert').textContent=held.length?held.map(source=>r.hold_reason?.[source]==='login'?`${source}: iniciá sesión desde Abrir sesión. La cuenta y las cookies se guardan automáticamente.`:`${source}: verificación pendiente en Chromium. Zonaprop conserva la misma ventana al continuar.`).join(' · '):bad.map(r=>`${r.source}: la última corrida quedó incompleta. Consultá el registro.`).join(' · ');$('runs-content').innerHTML=r.runs.length?r.runs.map(r=>`<div class="run-row"><strong>${r.source==='argenprop'?'Argenprop':'Zonaprop'}</strong><span class="run-status ${esc(r.status)}">${esc({running:'En curso',success:'Completado',blocked:'Verificación pendiente',error:'Error',partial:'Parcial',cancelled:'Detenido',interrupted:'Interrumpido'}[r.status]||r.status)}</span><small>${date(r.started_at)} · ${r.discovered} tarjetas leídas · ${r.processed} fichas · ${r.errors} errores</small>${r.message?`<small>${esc(r.message)}</small>`:''}</div>`).join(''):'<p class="muted">Todavía no hubo corridas.</p>';if(progress.running)load()}catch(e){$('scan-state').textContent='No se pudo conectar con la aplicación'}}
function option(value,current,label){return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`}
function confirmation(key,label,current){return `<label>${label}<select name="${key}">${option('',current??'','Sin confirmar')}${option('true',current,'Sí')}${option('false',current,'No')}</select></label>`}
let galleryPhotos=[],galleryIndex=0,galleryTitle='',photoZoomed=false;
function galleryMarkup(photos){
  if(!photos.length)return '<div class="gallery-empty">Este aviso no tiene fotos disponibles. Podés consultar la publicación original.</div>';
  return `<section class="detail-gallery" aria-label="Galería de fotos del departamento">
    <div class="gallery-stage">
      <button id="gallery-open" class="gallery-open" aria-label="Ampliar foto"><img id="gallery-main" referrerpolicy="no-referrer" alt="" draggable="false"><span id="gallery-error" class="gallery-error" hidden>No se pudo cargar esta foto. Probá con otra.</span><span class="gallery-expand">⤢ Ampliar foto</span></button>
      <button id="gallery-prev" class="gallery-arrow gallery-prev" aria-label="Foto anterior" ${photos.length===1?'disabled':''}>‹</button>
      <button id="gallery-next" class="gallery-arrow gallery-next" aria-label="Foto siguiente" ${photos.length===1?'disabled':''}>›</button>
    </div>
    <div class="gallery-caption"><span id="gallery-count" role="status"></span><span>Elegí una miniatura o usá las flechas</span></div>
    <div class="gallery-thumbnails" aria-label="Elegir foto">${photos.map((url,n)=>`<button type="button" data-photo="${n}" aria-label="Ver foto ${n+1}" aria-pressed="false"><img src="${esc(url)}" loading="lazy" referrerpolicy="no-referrer" alt="" draggable="false"><span>${n+1}</span></button>`).join('')}</div>
  </section>`;
}
function setGalleryImage(image,error,url,alt){
  image.hidden=false;error.hidden=true;
  image.onload=()=>{image.hidden=false;error.hidden=true};
  image.onerror=()=>{image.hidden=true;error.hidden=false};
  image.alt=alt;image.src=url;
}
function selectGalleryPhoto(index){
  if(!galleryPhotos.length)return;
  galleryIndex=(index+galleryPhotos.length)%galleryPhotos.length;
  const alt=`Foto ${galleryIndex+1} de ${galleryPhotos.length} · ${galleryTitle}`;
  setGalleryImage($('gallery-main'),$('gallery-error'),galleryPhotos[galleryIndex],alt);
  $('gallery-open').setAttribute('aria-label',`Ampliar foto ${galleryIndex+1}`);
  $('gallery-count').textContent=`${galleryIndex+1} / ${galleryPhotos.length} fotos`;
  const strip=document.querySelector('.gallery-thumbnails');
  strip.querySelectorAll('button').forEach((button,n)=>button.setAttribute('aria-pressed',String(n===galleryIndex)));
  const thumb=strip.children[galleryIndex];
  const left=thumb.getBoundingClientRect().left-strip.getBoundingClientRect().left;
  if(left<0||left+thumb.offsetWidth>strip.clientWidth)strip.scrollLeft+=left-(strip.clientWidth-thumb.offsetWidth)/2;
  if($('photo-dialog').open)renderPhotoViewer();
}
function photoSwipe(element,enabled=()=>true){
  let start=null,suppressClick=false;
  element.addEventListener('touchstart',event=>{start=event.touches.length===1&&enabled()?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null},{passive:true});
  element.addEventListener('touchend',event=>{
    if(!start||!event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;
    start=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){
      suppressClick=true;selectGalleryPhoto(galleryIndex+(dx<0?1:-1));
      setTimeout(()=>suppressClick=false,400);
    }
  },{passive:true});
  element.addEventListener('touchcancel',()=>start=null,{passive:true});
  element.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false}},true);
}
function mountGallery(item){
  galleryPhotos=item.photos||[];galleryIndex=0;galleryTitle=item.address||item.title||'Fotos del departamento';
  if(!galleryPhotos.length)return;
  selectGalleryPhoto(0);
  $('gallery-prev').onclick=()=>selectGalleryPhoto(galleryIndex-1);
  $('gallery-next').onclick=()=>selectGalleryPhoto(galleryIndex+1);
  $('gallery-open').onclick=()=>{$('photo-title').textContent=galleryTitle;$('photo-dialog').showModal();renderPhotoViewer()};
  document.querySelector('.gallery-thumbnails').onclick=event=>{const button=event.target.closest('[data-photo]');if(button)selectGalleryPhoto(Number(button.dataset.photo))};
  document.querySelector('.detail-gallery').onkeydown=event=>{
    if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();selectGalleryPhoto(galleryIndex+(event.key==='ArrowRight'?1:-1))}
  };
  photoSwipe($('gallery-open'));
}
function setPhotoZoom(zoom){
  photoZoomed=zoom;
  $('photo-viewport').classList.toggle('is-zoomed',zoom);
  $('photo-zoom').textContent=zoom?'− Ajustar':'＋ Zoom';
  $('photo-zoom').setAttribute('aria-pressed',String(zoom));
  $('photo-canvas').setAttribute('aria-label',zoom?'Reducir imagen':'Ampliar imagen al doble');
  requestAnimationFrame(()=>{const viewport=$('photo-viewport');viewport.scrollTo(zoom?(viewport.scrollWidth-viewport.clientWidth)/2:0,zoom?(viewport.scrollHeight-viewport.clientHeight)/2:0)});
}
function renderPhotoViewer(){
  setPhotoZoom(false);
  setGalleryImage($('photo-image'),$('photo-error'),galleryPhotos[galleryIndex],`Foto ${galleryIndex+1} · ${galleryTitle}`);
  $('photo-position').textContent=`${galleryIndex+1} / ${galleryPhotos.length}`;
  $('photo-original').href=galleryPhotos[galleryIndex];
  $('photo-previous').disabled=$('photo-next').disabled=galleryPhotos.length<2;
}
$('photo-close').onclick=()=>$('photo-dialog').close();
$('photo-previous').onclick=()=>selectGalleryPhoto(galleryIndex-1);
$('photo-next').onclick=()=>selectGalleryPhoto(galleryIndex+1);
$('photo-zoom').onclick=$('photo-canvas').onclick=()=>setPhotoZoom(!photoZoomed);
$('photo-dialog').addEventListener('keydown',event=>{
  if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();selectGalleryPhoto(galleryIndex+(event.key==='ArrowRight'?1:-1))}
});
$('photo-dialog').addEventListener('close',()=>setPhotoZoom(false));
photoSwipe($('photo-viewport'),()=>!photoZoomed);

async function detail(id){try{const i=await api('/api/listings/'+id);activeDetail=id;const e=i.effective;const contacts=[];contacts.push(`<a href="${esc(i.url)}" target="_blank" rel="noopener">Abrir aviso original ↗</a>`);if(i.contact.phone)contacts.push(`<a href="tel:${esc(i.contact.phone)}">${esc(i.contact.phone)}</a>`);if(i.contact.email)contacts.push(`<a href="mailto:${esc(i.contact.email)}">${esc(i.contact.email)}</a>`);if(i.contact.whatsapp)contacts.push(`<a href="${esc(i.contact.whatsapp)}" target="_blank" rel="noopener">WhatsApp ↗</a>`);$('detail-content').innerHTML=`<p class="eyebrow">${esc(i.source)} · ${esc(reviewLabels[i.review_state])}</p><div class="detail-heading"><div><h2>${esc(i.address||i.title.slice(0,120))}</h2><p class="muted">${esc(i.neighborhood||'Barrio sin confirmar')} · ${i.rooms||'?'} ambientes · ${i.area_total||i.area_covered||'?'} m² ${!i.area_total&&i.area_covered?'cubiertos':''}</p></div><div class="price">${esc(money(i.price,i.currency))}</div></div>${galleryMarkup(i.photos||[])}<div class="detail-layout"><div><h3>Descripción del aviso</h3><div class="detail-description">${esc(i.description||'Descripción pendiente de extracción.')}</div><div class="detail-section"><h3>Contacto</h3><p class="muted">${esc(i.contact.agency||'Inmobiliaria sin informar')}</p><div class="detail-links">${contacts.join('')}</div>${!i.contact.phone&&!i.contact.whatsapp?'<p class="muted">El teléfono no está publicado en los datos obtenidos. Podés consultarlo desde el aviso original.</p>':''}</div><div class="detail-section"><h3>Historial de precios</h3>${i.price_history.map(h=>`<div class="history-row"><span>${date(h.recorded_at)}</span><strong>${esc(money(h.price,h.currency))}</strong></div>`).join('')}<p class="muted">Visto por primera vez: ${date(i.first_seen)}<br>Última aparición: ${date(i.last_seen)}<br>Ficha completa: ${date(i.detail_at)}</p></div></div><div><h3>Tus requisitos</h3>${i.checks.map(c=>`<div class="check ${c.state}"><span class="check-icon">${c.state==='pass'?'✓':c.state==='fail'?'✕':'?'}</span><div><strong>${esc(c.label)}</strong><small>${esc(c.reason)}${c.manual?' · Confirmado manualmente':''}</small>${c.evidence?`<small>«${esc(c.evidence)}»</small>`:''}</div></div>`).join('')}<div class="detail-section"><h3>Seguimiento</h3><label>Estado de seguimiento<select id="detail-review">${reviewOptions(i.review_state)}</select></label><label>Mis notas<textarea id="detail-notes" rows="4" maxlength="10000" placeholder="Consulta, visita, dudas…">${esc(i.notes)}</textarea></label><button id="save-workflow" class="primary full">Guardar seguimiento</button></div><details class="detail-section"><summary>Confirmar datos manualmente</summary><p class="muted">Usá esta opción después de verificar el dato con quien publica. Se conserva el dato original del portal.</p><form id="confirm-form">${confirmation('balcony','Balcón propio',e.balcony)}${confirmation('patio','Patio propio',e.patio)}${confirmation('terrace','Terraza propia',e.terrace)}${confirmation('ready','Terminado, sin pozo ni construcción',e.ready)}${confirmation('elevator','Ascensor',i.elevator_assumed?null:e.elevator)}${confirmation('stairs','Acceso por escalera',e.stairs)}<label>Antigüedad confirmada (años)<input name="age_years" type="number" min="0" max="300" step="any" placeholder="Sin confirmar" value="${e.age_years??''}"></label><label>Piso de la unidad (0 = planta baja)<input name="floor" type="number" min="0" max="100" value="${e.floor??''}"></label><label>Pisos del edificio (sin contar PB)<input name="building_floors" type="number" min="0" max="100" step="1" placeholder="Sin confirmar" value="${e.building_floors??''}"></label><label>Disposición<select name="disposition">${option('',e.disposition??'','Sin confirmar')}${['frente','contrafrente','lateral','interno'].map(v=>option(v,e.disposition,v)).join('')}</select></label><button class="primary full">Guardar verificación</button><button type="button" id="clear-overrides" class="subtle full">Volver a los datos del portal</button></form></details></div></div>`;$('detail-dialog').showModal();mountGallery(i);$('save-workflow').onclick=async()=>{try{await api('/api/listings/'+id,{method:'PATCH',body:JSON.stringify({review_state:$('detail-review').value,notes:$('detail-notes').value})});toast('Seguimiento guardado');load();updateStatus()}catch(err){toast(err.message)}};$('confirm-form').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),overrides={};for(const k of ['balcony','patio','terrace','ready','elevator','stairs'])if(f.get(k)!=='')overrides[k]=f.get(k)==='true';if(f.get('floor')!=='')overrides.floor=Number(f.get('floor'));if(f.get('age_years')!=='')overrides.age_years=Number(f.get('age_years'));if(f.get('building_floors')!=='')overrides.building_floors=Number(f.get('building_floors'));if(f.get('disposition'))overrides.disposition=f.get('disposition');try{await api('/api/listings/'+id,{method:'PATCH',body:JSON.stringify({overrides})});toast('Verificación guardada');detail(id);load();updateStatus()}catch(err){toast(err.message)}};$('clear-overrides').onclick=async()=>{try{await api('/api/listings/'+id,{method:'PATCH',body:'{"overrides":{}}'});detail(id);load();updateStatus()}catch(err){toast(err.message)}}}catch(err){toast(err.message)}}
function showSettings(){const form=$('settings-form');form.elements.daily_time.value=settings.daily_time||'08:00';for(const k of ['min_age_years','max_age_years','max_price','pages_per_neighborhood','max_details_per_source','delay_seconds','delay_max_seconds','refresh_hours'])form.elements[k].value=settings[k];for(const k of ['headless','automatic'])form.elements[k].checked=settings[k];$('settings-neighborhoods').innerHTML=neighborhoods.map(n=>`<label class="checkbox"><input name="neighborhoods" type="checkbox" value="${esc(n)}" ${settings.neighborhoods.includes(n)?'checked':''}>${esc(n)}</label>`).join('');form.querySelectorAll('[name="sources"]').forEach(el=>el.checked=settings.sources.includes(el.value));$('settings-dialog').showModal()}
$('settings-form').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),next={...settings,neighborhoods:f.getAll('neighborhoods'),sources:f.getAll('sources')};for(const k of ['min_age_years','max_age_years','max_price','pages_per_neighborhood','max_details_per_source','delay_seconds','delay_max_seconds','refresh_hours'])next[k]=Number(f.get(k));next.daily_time=f.get('daily_time');next.schedule_mode='daily';for(const k of ['headless','automatic'])next[k]=f.has(k);try{settings=await api('/api/settings',{method:'PUT',body:JSON.stringify(next)});criteria();$('settings-dialog').close();toast('Preferencias guardadas');load();updateStatus()}catch(e){toast(e.message)}};
document.querySelectorAll('[data-browser]').forEach(b=>b.onclick=async()=>{try{const r=await api('/api/browser/'+b.dataset.browser,{method:'POST',body:'{}'});toast(r.message);$('settings-dialog').close();updateStatus()}catch(e){toast(e.message)}});
document.querySelectorAll('.dialog-close').forEach(b=>b.onclick=()=>{b.closest('dialog').close();activeDetail=null});document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
document.querySelectorAll('[data-review-state]').forEach(b=>b.onclick=()=>setReviewState(b.dataset.reviewState));$('all-states').onclick=()=>setReviewState('');$('eligibility').onchange=()=>{status=$('eligibility').value;page=1;load()};
for(const key of filters)$(key).addEventListener(key==='q'?'input':'change',()=>{page=1;if(key==='q'){clearTimeout(window.searchDebounce);window.searchDebounce=setTimeout(load,250)}else load();if(key==='source')updateStatus()});
$('reset').onclick=()=>{for(const key of filters){const el=$(key);if(el.type==='checkbox')el.checked=false;else el.value=key==='sort'?'newest':''}$('eligibility').value='candidates';status='candidates';setReviewState('unreviewed')};
$('prev').onclick=()=>{page--;load()};$('next').onclick=()=>{page++;load()};$('export').onclick=()=>window.deptosStaticExport?window.deptosStaticExport(params()):location.href='/api/export.csv?'+params();
$('settings-open').onclick=showSettings;$('runs-open').onclick=()=>{$('runs-dialog').showModal();updateStatus()};
$('scan').onclick=async()=>{try{const r=await api('/api/scan',{method:'POST',body:JSON.stringify({source:$('source').value||settings.sources[0]})});toast(r.message);updateStatus()}catch(e){toast(e.message)}};
$('stop').onclick=async()=>{try{const r=await api('/api/stop',{method:'POST',body:'{}'});toast(r.message)}catch(e){toast(e.message)}};
async function init(){try{const r=await api('/api/settings');settings=r.settings;neighborhoods=r.available_neighborhoods;$('neighborhood').innerHTML+='<option disabled>─────────</option>'+neighborhoods.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');criteria();await updateStatus();await load();if(!window.deptosStaticApi)setInterval(updateStatus,10000)}catch(e){toast(e.message)}}init();

document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=async()=>{try{const r=await api('/api/resume/'+b.dataset.resume,{method:'POST',body:'{}'});toast(r.message);updateStatus()}catch(e){toast(e.message)}});

let tinderItem=null, tinderBusy=false, tinderUndo=null, tinderPhoto=0, tinderSerial=0;
function tinderButtons() {
  for(const id of ['tinder-no','tinder-yes'])$(id).disabled=tinderBusy||!tinderItem;
  $('tinder-undo').disabled=tinderBusy||!tinderUndo;
}
function renderTinder() {
  const i=tinderItem;
  if(!i) {
    $('tinder-card').innerHTML='<div class="empty"><div class="empty-icon">✓</div><h3>No quedan avisos por revisar</h3><p>No quedan propiedades no revisadas con los filtros actuales. Tus decisiones están guardadas.</p></div>';
    tinderButtons();return;
  }
  const checks=i.checks.filter(c=>c.state!=='pass');
  $('tinder-card').innerHTML=`<article class="tinder-property">
    <div class="tinder-photo">${i.photos.length?`<img src="${esc(i.photos[tinderPhoto])}" referrerpolicy="no-referrer" alt="Foto ${tinderPhoto+1} del departamento">`:'<div class="card-image-placeholder">Fotos en la publicación</div>'}<span class="portal-tag">${esc(i.source)}</span></div>
    ${i.photos.length>1?`<div class="tinder-photo-nav"><button id="photo-prev" class="subtle" aria-label="Foto anterior">‹</button><span>${tinderPhoto+1} / ${i.photos.length} fotos</span><button id="photo-next" class="subtle" aria-label="Foto siguiente">›</button></div>`:''}
    <div class="tinder-summary"><div class="price">${esc(money(i.price,i.currency))}</div><h3>${esc(i.address||i.title.slice(0,140))}</h3><p>${esc(i.neighborhood||'Barrio sin confirmar')} · ${i.rooms||'?'} ambientes · ${i.area_total?`${i.area_total} m² totales`:i.area_covered?`${i.area_covered} m² cubiertos`:'Superficie sin informar'}</p>
    <div class="badges">${i.status==='review'?'<span class="badge unknown">Datos pendientes de chequeo</span>':''}${checks.map(c=>`<span class="badge ${c.state==='fail'?'fail':'unknown'}">${esc(c.label)} ${c.state==='fail'?'✕':'?'}</span>`).join('')}${!checks.length?'<span class="badge">Cumple los requisitos</span>':''}</div>
    <div class="tinder-links"><a class="publication-link" href="${esc(i.url)}" target="_blank" rel="noopener">Abrir publicación ↗</a><button id="tinder-detail" class="view">Ver ficha completa</button></div></div>
  </article>`;
  if($('photo-prev'))$('photo-prev').onclick=()=>{tinderPhoto=(tinderPhoto+i.photos.length-1)%i.photos.length;renderTinder()};
  if($('photo-next'))$('photo-next').onclick=()=>{tinderPhoto=(tinderPhoto+1)%i.photos.length;renderTinder()};
  $('tinder-detail').onclick=()=>detail(i.id);
  tinderButtons();
}
async function loadTinder() {
  const serial=++tinderSerial;
  tinderBusy=true;tinderItem=null;tinderButtons();
  $('tinder-card').innerHTML='<p class="muted">Cargando próximo departamento…</p>';
  const p=params();if(!['qualified','review','candidates'].includes(p.get('status')))p.set('status','candidates');p.set('review_state','unreviewed');p.set('page','1');p.set('page_size','1');p.delete('include_dismissed');
  try {
    const r=await api('/api/listings?'+p);
    if(serial!==tinderSerial)return;
    tinderItem=r.items[0]||null;tinderPhoto=0;
    $('tinder-remaining').textContent=`${r.total} ${r.total===1?'aviso por revisar':'avisos por revisar'}`;
    renderTinder();
  } catch(e) {
    if(serial!==tinderSerial)return;
    $('tinder-card').innerHTML='<p class="muted">No se pudo cargar el próximo aviso. Cerrá y volvé a abrir el modo Tinder para reintentar.</p>';
    toast(e.message);
  } finally {
    if(serial===tinderSerial){tinderBusy=false;tinderButtons();}
  }
}
async function decideTinder(state) {
  if(tinderBusy||!tinderItem)return;
  const item=tinderItem;
  tinderBusy=true;tinderButtons();
  try {
    await api('/api/listings/'+item.id,{method:'PATCH',body:JSON.stringify({review_state:state})});
    tinderUndo={id:item.id,state:item.review_state};
    toast(state==='interested'?'Guardado: de interés / pendiente de contacto':'Guardado: descartado');
    await loadTinder();await load();
  } catch(e) {toast(e.message);}
  finally {tinderBusy=false;tinderButtons();}
}
$('tinder-open').onclick=()=>{$('tinder-dialog').showModal();loadTinder()};
$('tinder-no').onclick=()=>decideTinder('discarded');
$('tinder-yes').onclick=()=>decideTinder('interested');
$('tinder-undo').onclick=async()=>{
  if(tinderBusy||!tinderUndo)return;
  tinderBusy=true;tinderButtons();
  try {
    await api('/api/listings/'+tinderUndo.id,{method:'PATCH',body:JSON.stringify({review_state:tinderUndo.state})});
    tinderUndo=null;toast('Última decisión deshecha');await loadTinder();await load();
  } catch(e){toast(e.message);}
  finally{tinderBusy=false;tinderButtons();}
};
$('tinder-dialog').addEventListener('close',()=>{tinderSerial++;tinderItem=null;tinderBusy=false;load()});
$('detail-dialog').addEventListener('close',()=>{if($('tinder-dialog').open)loadTinder()});
document.addEventListener('keydown',ev=>{
  if(!$('tinder-dialog').open||$('detail-dialog').open||$('photo-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName))return;
  if(ev.key==='ArrowRight'){ev.preventDefault();decideTinder('interested');}
  if(ev.key==='ArrowLeft'){ev.preventDefault();decideTinder('discarded');}
});
