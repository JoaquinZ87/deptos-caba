/* Adaptador de consulta para la exportación de GitHub Pages. No hace escrituras. */
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
    if(options.method&&options.method!=='GET')throw Error('Este catálogo es de consulta. Los cambios se guardan en la web local.');
    const url=new URL(path,'https://catalog.invalid'),catalog=await data();
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
    document.getElementById('scan-state').textContent='Catálogo de consulta';
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
