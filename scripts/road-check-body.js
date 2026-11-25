'use strict';
// Runs inside the sandbox bundle; exercises the chain walker, smoothing and
// ribbon widths of the road renderer against the real transport graph. Every
// edge must be covered exactly once.
globalThis.__roadCheck=(mapId)=>{
 const L=globalThis.__logicExports,T=globalThis.__transportExports;
 const regions=HISTORICAL_REGIONS.map(L.initRegion);
 const graph=T.makeTransport(regions);

 const hashString=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};
 const smoothOpenChain=(points,passes=2)=>{
  let p=points;
  if(p.length<3)return p;
  for(let it=0;it<passes;it++){
   const out=[p[0]];
   for(let i=0;i<p.length-1;i++){
    const a=p[i],b=p[i+1];
    out.push({x:a.x*.75+b.x*.25,z:a.z*.75+b.z*.25});
    out.push({x:a.x*.25+b.x*.75,z:a.z*.25+b.z*.75});
   }
   out.push(p[p.length-1]);
   p=out;
  }
  return p;
 };
 const degree2=new Set();
 for(const [key,node] of graph.nodes)if(node.edges.size===2)degree2.add(key);
 const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
 const usedEdges=new Set(),ribbons=[];
 const walk=(startKey,firstKey)=>{
  const keys=[startKey];
  let prev=startKey,cur=firstKey;
  while(cur!=null&&degree2.has(cur)&&!keys.includes(cur)){
   keys.push(cur);
   const node=graph.nodes.get(cur);
   let next=null;
   for(const nk of node.edges.keys())if(nk!==prev){next=nk;break}
   prev=cur;cur=next;
  }
  if(cur!=null&&!keys.includes(cur))keys.push(cur);
  return keys;
 };
 const emitRuns=keys=>{
  let run=null;
  const flush=()=>{if(run&&run.length>=2)ribbons.push(run);run=null};
  for(let i=1;i<keys.length;i++){
   const k=pairKey(keys[i-1],keys[i]);
   if(!usedEdges.has(k)){
    usedEdges.add(k);
    if(!run)run=[keys[i-1]];
    run.push(keys[i]);
   }else flush();
  }
  flush();
 };
 for(const [key,node] of graph.nodes)for(const nk of node.edges.keys()){
  if(usedEdges.has(pairKey(key,nk)))continue;
  emitRuns(walk(key,nk));
 }
 const missing=[];
 for(const [id] of graph.edges)if(!usedEdges.has(id))missing.push(id);

 let verts=0,minW=Infinity,maxW=-Infinity;
 for(const chain of ribbons){
  const pts=chain.map(k=>{const n=graph.nodes.get(k);return {x:n.x,z:n.z}});
  const smooth=smoothOpenChain(pts,2);
  const sig=chain[0]+'|'+chain[chain.length-1];
  const base=.55+hashString('w'+sig)*.23,phase=hashString('p'+sig)*6.283;
  const cum=[0];
  for(let i=1;i<smooth.length;i++)cum.push(cum[i-1]+Math.hypot(smooth[i].x-smooth[i-1].x,smooth[i].z-smooth[i-1].z));
  for(let i=1;i<smooth.length;i++){
   const a=smooth[i-1],b=smooth[i];
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
   if(!len)continue;
   const nx=-dz/len,nz=dx/len;
   for(const t of [cum[i-1],cum[i]]){
    const w=base*(1+.07*Math.sin(t*.55+phase));
    if(!Number.isFinite(w)){console.error('NaN width');return}
    minW=Math.min(minW,w);maxW=Math.max(maxW,w);
   }
   for(const [sx,sz] of [[a.x+nx,a.z+nz],[a.x-nx,a.z-nz],[b.x+nx,b.z+nz],[b.x-nx,b.z-nz]]){
    if(!Number.isFinite(sx)||!Number.isFinite(sz)){console.error('NaN corner');return}
   }
   verts+=6;
  }
 }
 console.log(mapId+': узлов '+graph.nodes.size+', рёбер '+graph.edges.size+', лент '+ribbons.length+', непокрытых рёбер '+(missing.length?missing.slice(0,5).join(', ')+'…':'0'));
 console.log('ширина дорог: '+minW.toFixed(2)+'–'+maxW.toFixed(2)+' мировых ед., вершин в лентах '+verts);
 const demo=smoothOpenChain([{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:20,z:10}],1);
 console.log('сглаживание угла 90°: '+demo.map(p=>p.x.toFixed(1)+','+p.z.toFixed(1)).join(' → '));
};
