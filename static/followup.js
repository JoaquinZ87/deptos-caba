/* Editor de seguimiento con borradores y control de cambios entre dispositivos. */
let followupItem=null,followupDraftKey='',followupVersion='',followupBusy=false;
const followupBooleans=[['balcony','Balcón propio'],['patio','Patio propio'],['terrace','Terraza propia'],['elevator','Ascensor'],['stairs','Acceso por escalera'],['ready','Terminado y disponible']];
const followupNumbers=[['rooms','Ambientes',1,30,1],['area_total','Superficie total (m²)',.01,10000,'any'],['area_covered','Superficie cubierta (m²)',.01,10000,'any'],['expenses','Expensas ($)',0,100000000,'any'],['age_years','Antigüedad (años)',0,300,'any'],['floor','Piso (0 = planta baja)',0,100,1],['building_floors','Pisos del edificio',0,100,1]];
function followupValues(){return Object.fromEntries(new FormData($('followup-form')))}
function keepFollowupDraft(){
  if(!followupItem||followupBusy)return;
  try{localStorage.setItem(followupDraftKey,JSON.stringify({values:followupValues(),version:followupVersion,overrides:followupItem.overrides||{},baseline:followupItem.followupBaseline}));$('followup-status').textContent='Borrador guardado en este dispositivo. Pulsá Guardar para sincronizar.'}
  catch{$('followup-status').textContent='No se pudo conservar el borrador en este navegador. Guardá antes de cerrar.'}
}
function fillFollowup(item,restore=true){
  followupItem=item;followupVersion=item.workflow_version||'';
  followupDraftKey=`deptos-followup:${item.source}:${item.remote_id}`;
  const e=item.effective||item;
  $('followup-title').textContent=item.address||item.title||'Seguimiento';
  $('followup-state').innerHTML=reviewOptions(item.review_state||'unreviewed');
  $('followup-notes').value=item.notes||'';
  $('followup-fields').innerHTML=followupBooleans.map(([key,label])=>confirmation(key,label,key==='elevator'&&item.elevator_assumed?null:e[key])).join('')+
    followupNumbers.map(([key,label,min,max,step])=>`<label>${label}${e[key]==null?' <span class="missing-field">Falta el dato</span>':''}<input name="${key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${e[key]??''}" placeholder="Sin confirmar"></label>`).join('')+
    `<label>Disposición<select name="disposition">${option('',e.disposition??'','Sin confirmar')}${['frente','contrafrente','lateral','interno'].map(v=>option(v,e.disposition,v)).join('')}</select></label>`;
  item.followupBaseline=followupValues();
  $('followup-status').textContent='Los cambios se guardan para todos tus dispositivos.';
  $('followup-reload').hidden=true;
  if(restore){
    try{
      const draft=JSON.parse(localStorage.getItem(followupDraftKey)||'null');
      if(draft){
        for(const [key,value] of Object.entries(draft.values||{})){const field=$('followup-form').elements.namedItem(key);if(field)field.value=value}
        followupVersion=draft.version;item.overrides=draft.overrides;item.followupBaseline=draft.baseline;
        $('followup-status').textContent='Recuperamos tu borrador. Todavía no está sincronizado.';
        $('followup-reload').hidden=false;
      }
    }catch{}
  }
}
async function openFollowup(id){
  if(followupBusy)return;
  try{
    const item=await api('/api/listings/'+id);
    fillFollowup(item);
    $('followup-dialog').showModal();
  }catch(error){toast(error.message)}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-followup]');
  if(button)openFollowup(Number(button.dataset.followup));
});
$('followup-form').addEventListener('input',keepFollowupDraft);
$('followup-form').addEventListener('change',keepFollowupDraft);
$('followup-close').onclick=()=>$('followup-dialog').close();
$('followup-dialog').addEventListener('cancel',event=>{if(followupBusy)event.preventDefault()});
$('followup-reload').onclick=async()=>{
  try{const latest=await api('/api/listings/'+followupItem.id);localStorage.removeItem(followupDraftKey);fillFollowup(latest,false)}catch(error){$('followup-status').textContent=error.message}
};
$('followup-form').onsubmit=async event=>{
  event.preventDefault();if(followupBusy||!followupItem)return;
  keepFollowupDraft();
  const values=followupValues(),overrides={...(followupItem.overrides||{})};
  let changed=false;
  for(const key of [...followupBooleans.map(f=>f[0]),...followupNumbers.map(f=>f[0]),'disposition']){
    if(values[key]===(followupItem.followupBaseline||{})[key])continue;
    changed=true;
    if(values[key]==='')delete overrides[key];
    else if(followupBooleans.some(f=>f[0]===key))overrides[key]=values[key]==='true';
    else overrides[key]=key==='disposition'?values[key]:Number(values[key]);
  }
  const changes={review_state:values.review_state,notes:values.notes};
  if(followupVersion)changes.expected_workflow_version=followupVersion;
  if(changed)changes.overrides=overrides;
  followupBusy=true;$('followup-save').disabled=true;$('followup-close').disabled=true;
  $('followup-status').textContent='Guardando…';
  try{
    const saved=await api('/api/listings/'+followupItem.id,{method:'PATCH',body:JSON.stringify(changes)});
    localStorage.removeItem(followupDraftKey);fillFollowup(saved,false);
    $('followup-status').textContent='Guardado y sincronizado.';load();
  }catch(error){
    $('followup-status').textContent=error.message+' El borrador sigue en este dispositivo.';
    $('followup-reload').hidden=error.status!==409;
  }finally{followupBusy=false;$('followup-save').disabled=false;$('followup-close').disabled=false}
};
