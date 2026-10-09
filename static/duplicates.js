const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const labels={description:'Descripción',photos:'Foto coincidente',name:'Nombre',address:'Dirección'};
let report,filtered=[],page=0,saving=false;const size=20;
function unitEvidence(d){const u=d.unit_details;if(!u)return '';const parts=[u.floor!=null?'Piso '+u.floor:null,u.unit?'Unidad '+u.unit:null,u.disposition,u.kitchen_layout==='separate'?'Cocina separada':u.kitchen_layout==='integrated'?'Cocina integrada':null,u.bathrooms!=null?u.bathrooms+' baño(s)':null,u.area_total?'Total '+u.area_total+' m²':null,u.area_covered?'Cubiertos '+u.area_covered+' m²':null].filter(Boolean);return `<div class="unit-evidence"><strong>Datos de la unidad</strong><p>${esc(parts.join(' · ')||'Piso y unidad sin precisar')}</p>${u.description_evidence?.length?`<details><summary>Ver evidencia en la descripción</summary>${u.description_evidence.map(t=>`<blockquote>${esc(t)}</blockquote>`).join('')}</details>`:''}</div>`}
function addressEvidence(pair,index){
  const e=pair.address_relation?.description_addresses?.[index===0?'left':'right'];
  if(!e)return '';
  return `<div class="unit-evidence"><strong>Altura indicada en la descripción</strong><p>${esc(e.address)}</p><details><summary>Ver ubicación citada</summary><blockquote>${esc(e.evidence)}</blockquote></details></div>`;
}
function listing(id,pair,index){const d=report.listings[id];const photo=pair.photo_example?.[index]||d.photos?.[0];return `<div class="listing">${photo?`<img src="${esc(photo)}" loading="lazy" referrerpolicy="no-referrer" alt="Foto del aviso ${id}"><p class="photo-label">${pair.photo_example?'Foto que motivó la sospecha':'Portada del aviso'}</p>`:''}<p class="muted">${esc(d.source)} · Aviso ${id}${pair.first_id===id?' · <span class="first">Primera publicación registrada</span>':''}</p><h2>${esc(d.address||'Dirección sin informar')}</h2><p>${esc(d.title)}</p>${addressEvidence(pair,index)}${unitEvidence(d)}<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Abrir publicación original ↗</a><details><summary>Comparar descripción</summary><div class="description">${esc(d.description||'Sin descripción')}</div></details></div>`}
function photoEvidence(p){
  const e=p.photo_evidence;if(!e?.matches?.length)return '';
  return `<section class="photo-evidence"><strong>${e.matched_photos} foto(s) distinta(s) coincidente(s)</strong><p>Cubren ${Math.round(e.coverage[0]*100)}% y ${Math.round(e.coverage[1]*100)}% de las galerías publicadas (${e.gallery_sizes.join(' / ')} fotos distintas). Esto no confirma por sí solo que sea la misma unidad.</p><details><summary>Comparar fotos coincidentes</summary>${e.matches.map(m=>`<div class="photo-match"><p>${m.method==='same_url'?'Mismo archivo publicado':`${m.method==='translated_dhash'?'Encuadre desplazado':m.method==='crop_dhash'?'Recorte coincidente':m.method==='stable_dhash'?'Contornos estables':'Similitud del hash'}: ${Math.round(m.similarity*100)}% · ${m.different_bits} de ${m.compared_bits||512} bits diferentes`}</p><div class="comparison">${m.urls.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" loading="lazy" referrerpolicy="no-referrer" alt="Foto coincidente del aviso ${p.ids[i]}"></a>`).join('')}</div></div>`).join('')}</details></section>`;
}
function coverage(){
  const candidates=$('scope').value==='candidates';
  const c=candidates?report.candidate_coverage:report.coverage;
  const signals=Object.entries(c.by_signal).map(([k,v])=>`${labels[k]}: ${v.toLocaleString('es-AR')} pares`).join(' · ');
  $('coverage').textContent=`Revisión del ${new Date(report.generated_at).toLocaleString('es-AR')} sobre ${c.listings.toLocaleString('es-AR')} ${candidates?'candidatos':'avisos'}. ${signals}. ${c.review_pairs??c.pairs} pares pendientes; ${c.reviewed_distinct_pairs||0} pares revisados como inmuebles distintos; las demás señales siguen disponibles en el filtro. Se compararon todas las URL de fotos y el contenido visual de ${c.visual_hashes.toLocaleString('es-AR')} de ${c.photo_urls.toLocaleString('es-AR')} imágenes mediante hash perceptual de 512 bits (similitud mínima 92%, con control de color). ${c.unavailable_photos||0} imágenes ya no disponibles en el portal.${c.pending_photos?` ${c.pending_photos} imágenes pendientes de procesar.`:''} Pozo, a estrenar y en construcción quedan excluidos por título. Las sospechas se actualizan automáticamente con cada carga del scraper.`;
}
function actions(p){
  if(report.can_review===false)return '';
  const rejected=p.review_decision?.decision==='distinct';
  return `<section class="pair-actions" aria-label="Decidir sobre el par ${p.ids.join(' / ')}"><p>Al fusionar se conserva el aviso <strong>${p.first_id}</strong>, la primera publicación. Se reúnen fotos, notas e historial de precios.</p><label>Motivo (opcional)<input data-reason="${p.ids.join(':')}" maxlength="2000" placeholder="Ej. Misma unidad y mismas fotos"></label><div><button class="merge" data-action="merge" data-pair="${p.ids.join(':')}">Confirmar fusión</button><button data-action="distinct" data-pair="${p.ids.join(':')}" ${rejected?'disabled':''}>${rejected?'Fusión rechazada':'Rechazar fusión'}</button></div></section>`;
}
function render(){const slice=filtered.slice(page*size,(page+1)*size);$('pairs').innerHTML=slice.length?slice.map(p=>`<article class="pair"><div class="pair-head"><strong>Par ${p.ids.join(' / ')}</strong>${p.assessment==='distinct_units'?'<strong class="badge">Datos que indican unidades distintas</strong>':''}${Object.entries(p.signals).map(([key,value])=>`<span class="badge">${labels[key]} ${Math.round(value*100)}%</span>`).join('')}</div>${['spelling','block_number','intersection','nearby_number','street_only'].includes(p.address_relation?.kind)?`<p class="address-note">${esc(p.address_relation.label)}</p>`:''}${p.conflicts.length?`<div class="conflicts">Datos a contrastar: ${p.conflicts.map(esc).join(' · ')}. Puede tratarse de unidades distintas.</div>`:''}${p.in_review_queue===false?`<p class="address-note">${esc(p.review_reason)}</p>`:''}${photoEvidence(p)}<div class="comparison">${p.ids.map((id,index)=>listing(id,p,index)).join('')}</div>${actions(p)}</article>`).join(''):'<div class="empty">No hay pares con estos filtros.</div>';$('count').textContent=`${filtered.length.toLocaleString('es-AR')} pares sospechosos · ${new Set(filtered.flatMap(p=>p.ids)).size.toLocaleString('es-AR')} avisos involucrados. Un aviso puede aparecer en varios pares.`;$('page').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/size))}`;$('prev').disabled=page===0;$('next').disabled=(page+1)*size>=filtered.length;}
function filter(){const signal=$('signal').value,evidence=$('evidence').value,q=normalize($('search').value);filtered=report.pairs.filter(p=>(evidence!=='rejected'||p.review_decision?.decision==='distinct')&&(evidence!=='review'||p.in_review_queue!==false)&&($('scope').value!=='candidates'||p.ids.every(id=>report.listings[id].candidate))&&(evidence!=='gallery'||p.photo_evidence?.matched_photos>=2)&&(!signal||signal in p.signals)&&(!q||p.ids.some(id=>normalize(report.listings[id].address+' '+report.listings[id].title).includes(q)))&&(evidence!=='units'||p.assessment==='distinct_units')&&(evidence!=='strong'||'description' in p.signals||'photos' in p.signals)&&(evidence!=='multiple'||Object.keys(p.signals).length>=2)&&(evidence!=='weak'||!('description' in p.signals)&&!('photos' in p.signals))&&(evidence!=='conflict'||p.conflicts.length));page=0;coverage();render();}
for(const id of ['signal','evidence','scope'])$(id).onchange=()=>report&&filter();$('search').oninput=()=>report&&filter();$('prev').onclick=()=>{page--;render();window.scrollTo(0,0)};$('next').onclick=()=>{page++;render();window.scrollTo(0,0)};
async function reload(){
  const response=await fetch(window.DEPTOS_DUPLICATES_URL||'/api/duplicate-suspects',{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo actualizar la lista de duplicados.');
  report=await response.json();filter();
}
$('pairs').addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');
  if(!button||saving)return;
  const pair=report.pairs.find(p=>p.ids.join(':')===button.dataset.pair);
  if(!pair)return;
  const reason=button.closest('.pair-actions').querySelector('input').value;
  saving=true;
  $('pairs').querySelectorAll('button[data-action]').forEach(b=>b.disabled=true);
  $('decision-status').textContent='Guardando decisión…';
  let saved=false;
  try{
    const response=await fetch('/api/duplicate-decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:pair.ids,action:button.dataset.action,review_token:pair.review_token,reason})});
    const result=await response.json();
    if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'No se pudo guardar la decisión.');
    saved=true;
    $('decision-status').textContent=result.decision==='merge'?`Fusión guardada. Se conservó el aviso ${result.kept_id}.`:'Fusión rechazada. Los dos avisos se conservan y el scraper respetará esta decisión.';
    await reload();
  }catch(error){
    $('decision-status').textContent=(saved?'La decisión quedó guardada, pero no se pudo refrescar la lista. ':'')+error.message;
    if(!saved){try{await reload()}catch{}}
  }finally{saving=false;render()}
});
$('refresh').onclick=()=>{if(!saving)reload().catch(e=>{$('decision-status').textContent=e.message})};
reload().catch(e=>{$('coverage').textContent=e.message});
