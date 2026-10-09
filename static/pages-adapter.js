/* Catálogo y seguimiento sincronizado; admite acceso directo o privado. */
(() => {
  const catalogURL=new URL('../catalog.json',document.currentScript.src);
  let snapshot;
  async function data(){
    if(!snapshot)snapshot=fetch(catalogURL,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw Error('No se pudo cargar el catálogo publicado.');
      return response.json();
    }).catch(error=>{snapshot=null;throw error});
    return snapshot;
  }
  const accessKey='deptos-pages-access-v1';
  let access='',publicEdit=false,syncState='readonly';
  const syncEnabled=()=>publicEdit||Boolean(access);
  const privateCache=new Map();
  try{access=localStorage.getItem(accessKey)||''}catch{}
  const hash=new URLSearchParams(location.hash.slice(1)),activation=hash.get('access');
  if(activation){access=activation;hash.delete('access');history.replaceState(null,'',location.pathname+location.search+(hash.size?'#'+hash.toString():''))}
  document.querySelector('.header-actions').insertAdjacentHTML('beforeend','<button id="pages-connect" class="subtle" hidden>Activar seguimiento</button>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="pages-access-dialog" aria-labelledby="pages-access-title"><h2 id="pages-access-title">Tu seguimiento privado</h2><p>Activá este dispositivo con tu enlace privado. Tus notas se sincronizan con los demás dispositivos y no se publican en GitHub.</p><form id="pages-access-form"><label>Enlace privado o código de acceso<input id="pages-access-code" type="password" autocomplete="off" required></label><p id="pages-access-message" role="status"></p><button class="primary full" type="submit">Activar en este dispositivo</button></form><button id="pages-disconnect" class="subtle full" type="button">Desactivar en este dispositivo</button><button id="pages-access-close" class="text-button" type="button">Cerrar</button></dialog>`);
  function showState(state){
    syncState=state;document.body.dataset.sync=syncEnabled()?'connected':'readonly';
    document.getElementById('pages-connect').hidden=publicEdit;
    document.getElementById('pages-connect').textContent=access?'Mi seguimiento':'Activar seguimiento';
    const label={readonly:'Catálogo de consulta',online:'Seguimiento sincronizado',offline:'Sin conexión para sincronizar. Podés conservar borradores.'}[state];
    document.getElementById('scan-state').textContent=label;
  }
  async function remote(path,options={}){
    const catalog=await data();
    if(!catalog.sync_url)throw Error('El seguimiento todavía no está configurado.');
    let response;
    try{response=await fetch(new URL(path,catalog.sync_url),{...options,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000),headers:{...(!publicEdit&&access?{Authorization:'Bearer '+access}:{}),'Content-Type':'application/json','ngrok-skip-browser-warning':'1'}})}
    catch{showState('offline');throw Error('No se pudo conectar para guardar o consultar el seguimiento. Comprobá que la PC esté encendida y conectada.')}
    let result;try{result=await response.json()}catch{showState('offline');throw Error('La conexión de seguimiento no está disponible en este momento.')}
    if(!response.ok){
      if(response.status===401){access='';privateCache.clear();try{localStorage.removeItem(accessKey)}catch{}showState(publicEdit?'offline':'readonly')}
      const error=new Error(typeof result.detail==='string'?result.detail:'No se pudo guardar. Revisá los datos ingresados.');error.status=response.status;throw error;
    }
    showState('online');
    if(!options.method||options.method==='GET')privateCache.set(path,result);
    else privateCache.set(path,result);
    return result;
  }
  const ready=(async()=>{
    const catalog=await data();
    publicEdit=catalog.public_edit===true;
    if(publicEdit){access='';try{localStorage.removeItem(accessKey)}catch{}}
    if(!syncEnabled()){showState('readonly');return}
    showState('offline');
    try{
      await remote('/api/listings?status=candidates&page_size=1');
      if(access){try{localStorage.setItem(accessKey,access)}catch{}}
    }catch(error){document.getElementById('pages-access-message').textContent=error.message;if(access){try{localStorage.setItem(accessKey,access)}catch{}}}
  })();
  window.deptosSyncEnabled=syncEnabled;
  document.getElementById('pages-connect').onclick=()=>document.getElementById('pages-access-dialog').showModal();
  document.getElementById('pages-access-close').onclick=()=>document.getElementById('pages-access-dialog').close();
  document.getElementById('pages-disconnect').onclick=()=>{access='';privateCache.clear();try{localStorage.removeItem(accessKey)}catch{}showState('readonly');document.getElementById('pages-access-dialog').close();if(typeof load==='function')load()};
  document.getElementById('pages-access-form').onsubmit=async event=>{
    event.preventDefault();let value=document.getElementById('pages-access-code').value.trim();
    try{if(value.includes('://'))value=new URLSearchParams(new URL(value).hash.slice(1)).get('access')||''}catch{value=''}
    if(!/^[A-Za-z0-9_-]{32,128}$/.test(value)){document.getElementById('pages-access-message').textContent='Pegá el enlace privado completo o el código de acceso.';return}
    access=value;
    try{await remote('/api/listings?status=candidates&page_size=1');localStorage.setItem(accessKey,access);document.getElementById('pages-access-code').value='';document.getElementById('pages-access-dialog').close();load()}
    catch(error){document.getElementById('pages-access-message').textContent=error.message}
  };
  setInterval(()=>{if(syncEnabled()&&!document.hidden&&!document.querySelector('dialog[open]')&&typeof load==='function')load()},30000);
  const normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function selected(catalog,p){
    const eligibility=p.get('status')||'candidates',q=normal(p.get('q'));
    const result=catalog.items.filter(item=>{
      const e=item.effective;
      if(!['all','candidates'].includes(eligibility)&&item.status!==eligibility)return false;
      for(const key of ['neighborhood','property_type','disposition'])if(p.get(key)&&e[key]!==p.get(key))return false;
      if(p.get('source')&&item.source!==p.get('source'))return false;
      if(q&&!normal([item.title,item.description,item.address].join(' ')).includes(q))return false;
      if(Number(p.get('min_area'))>0&&(e.area_total==null||e.area_total<Number(p.get('min_area'))))return false;
      if(Number(p.get('max_price'))>0&&(e.currency!=='USD'||e.price==null||e.price>Number(p.get('max_price'))))return false;
      if(p.get('outdoor')&&e[p.get('outdoor')]!==true)return false;
      return true;
    });
    const sort=p.get('sort');
    if(sort==='price_asc')result.sort((a,b)=>(a.currency!=='USD')-(b.currency!=='USD')||(a.price==null)-(b.price==null)||(a.price||0)-(b.price||0));
    if(sort==='price_desc')result.sort((a,b)=>(a.currency!=='USD')-(b.currency!=='USD')||(b.price||0)-(a.price||0));
    if(sort==='area_desc')result.sort((a,b)=>(b.area_total||0)-(a.area_total||0));
    return result;
  }
  // Valores vacíos para los controles privados ocultos; nunca se exportan notas ni seguimiento.
  function view(item){return {...item,active:true,notes:'',review_state:'unreviewed',overrides:{},dismissed:false,favorite:false}}
  window.deptosStaticApi=async(path,options={})=>{
    await ready;
    const url=new URL(path,'https://catalog.invalid'),catalog=await data();
    if(syncEnabled()&&url.pathname.startsWith('/api/listings')){
      try{return await remote(path,options)}catch(error){
        if(!options.method||options.method==='GET'){
          if(syncState==='offline'&&privateCache.has(path))return privateCache.get(path);
          if(url.pathname==='/api/listings'&&syncState==='offline'){}else throw error;
        }else throw error;
      }
    }
    if(options.method&&options.method!=='GET')throw Error('Activá tu seguimiento privado para guardar cambios.');
    if(url.pathname==='/api/settings')return {settings:{...catalog.settings,automatic:false},available_neighborhoods:catalog.available_neighborhoods};
    if(url.pathname==='/api/listings'){
      const items=selected(catalog,url.searchParams),page=Math.max(1,Number(url.searchParams.get('page'))||1),size=24;
      return {items:items.slice((page-1)*size,page*size).map(view),total:items.length,page,page_size:size,
        review_counts:{unreviewed:items.length,interested:0,contacted:0,discarded:0},
        eligibility_counts:{qualified:items.filter(i=>i.status==='qualified').length,review:items.filter(i=>i.status==='review').length,rejected:0}};
    }
    const match=url.pathname.match(/^\/api\/listings\/(\d+)$/);
    if(match){const item=catalog.items.find(i=>i.id===Number(match[1]));if(item)return view(item);throw Error('Aviso no encontrado en el catálogo publicado.')}
    throw Error('Esta acción está disponible en la web local.');
  };
  window.deptosStaticStatus=async()=>{
    const catalog=await data();
    await ready;showState(syncState);
    document.getElementById('next-run').textContent='Actualizado: '+new Date(catalog.generated_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
  };
  window.deptosStaticExport=async params=>{
    try{
      const items=selected(await data(),params);
      const columns=['address','neighborhood','property_type','price','currency','area_total','status','url'];
      const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
      const csv=[columns,...items.map(i=>columns.map(k=>i[k]))].map(row=>row.map(cell).join(',')).join('\r\n');
      const blob=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=blob;link.download='propiedades.csv';link.click();
      setTimeout(()=>URL.revokeObjectURL(blob),1000);
    }catch(error){document.getElementById('toast').textContent=error.message;document.getElementById('toast').hidden=false}
  };
})();
