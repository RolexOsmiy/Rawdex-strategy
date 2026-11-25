'use strict';
// Bake the campaign road network: terrain-aware A* legs (roads skirt steep
// hills, mountains, water and partly forests, favouring valleys and passes),
// plus a shared cell registry so overlapping routes merge into one road that
// splits at junctions. Straightening (degree-2 collinear removal) keeps the
// network readable while the renderer rounds the remaining corners.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../dist');

function buildBorderRoads(regions){
 const graph={nodes:new Map(),edges:new Map(),hubKeys:new Map(),regions};
 const byId=new Map(regions.map(region=>[region.id,region]));
 const mainPiece=new Map();
 for(const region of regions){
  const point=region.slots[0],key='h'+region.id;
  graphAddNode(graph,key,point);
  graph.hubKeys.set(region.id,key);
  mainPiece.set(region,region.polys.findIndex((_,i)=>insideRegionPiece(region,i,point.x,point.z)));
 }
 function staysIn(region,from,to){
  const spans=segmentRegionSpans(region,from,to);
  return spans.length===1&&spans[0][0]<=1e-8&&spans[0][1]>=1-1e-8;
 }
 function cleanLeg(region,path){
  const clean=[path[0]];
  for(let from=0;from<path.length-1;){
   let to=path.length-1;
   while(to>from+1&&!staysIn(region,path[from],path[to]))to--;
   clean.push(path[to]);from=to;
  }
  return clean;
 }
 function legalCrossing(a,b,from,to){
  const len=distance(from,to);
  const spans=[...segmentRegionSpans(a,from,to),...segmentRegionSpans(b,from,to)].sort((x,y)=>x[0]-y[0]);
  let covered=0;
  for(const [start,end] of spans){
   // Independently rounded borders can differ by a few hundredths.
   if((start-covered)*len>.13)return false;
   if(start>covered&&isSeaBackground(from.x+(to.x-from.x)*(start+covered)/2,from.z+(to.z-from.z)*(start+covered)/2))return false;
   covered=Math.max(covered,end);
  }
  return covered>=1-1e-7&&![...regionsAlongSegment(regions,from,to)]
   .some(r=>r!==a&&r!==b&&segmentRegionEntry(r,from,to)!=null);
 }
 function borderCandidates(a,b){
  const candidates=[],ai=mainPiece.get(a),bi=mainPiece.get(b);
  if(ai<0||bi<0)return candidates;
  function sample(source,target,part,otherPart,reverse){
   const [x0,z0,x1,z1]=target.bounds[otherPart];
   for(const ring of source.polys[part])for(let i=0;i<ring.length;i++){
    const [x,z]=ring[i],[u,v]=ring[(i+1)%ring.length],dx=u-x,dz=v-z,len=Math.hypot(dx,dz);
    if(len<.005||Math.max(x,u)<x0-2||Math.min(x,u)>x1+2||Math.max(z,v)<z0-2||Math.min(z,v)>z1+2)continue;
    for(const t of [.5,.1,.2,.3,.4,.6,.7,.8,.9]){
     const mx=x+dx*t,mz=z+dz*t;
     for(const offset of [.9,.6,.35,.12,.045,.025,1.8,3.6]){
      const nx=dz/len*offset,nz=-dx/len*offset;
      let p={x:mx+nx,z:mz+nz},q={x:mx-nx,z:mz-nz};
      if(!insideRegionPiece(source,part,p.x,p.z)||!insideRegionPiece(target,otherPart,q.x,q.z))[p,q]=[q,p];
      if(!insideRegionPiece(source,part,p.x,p.z)||!insideRegionPiece(target,otherPart,q.x,q.z))continue;
      const [from,to]=reverse?[q,p]:[p,q];
      if(!legalCrossing(a,b,from,to))continue;
      candidates.push({from,to,cost:distance(a.slots[0],from)+distance(from,to)+distance(to,b.slots[0])});
      break;
     }
    }
   }
  }
  sample(a,b,ai,bi,false);
  sample(b,a,bi,ai,true);
  return candidates.sort((a,b)=>a.cost-b.cost);
 }
 // --- Terrain-driven routing --------------------------------------------
 const cellKey=(i,j)=>i+','+j;
 const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const costCache=new Map(),passGrids=new Map();
 function passGrid(region,piece){
  const cache=passGrids.get(region.id);
  if(cache)return cache;
  const b=region.bounds[piece];
  const x0=Math.floor(b[0])-1,z0=Math.floor(b[1])-1,w=Math.ceil(b[2])-x0+2,h=Math.ceil(b[3])-z0+2;
  const grid=new Uint8Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   if(insideRegionPiece(region,piece,x0+i+.5,z0+j+.5)&&!isSeaBackground(x0+i+.5,z0+j+.5))grid[j*w+i]=1;
  }
  const entry={x0,z0,w,h,grid};
  passGrids.set(region.id,entry);
  return entry;
 }
 function cellPassable(pg,i,j){
  if(i<pg.x0||j<pg.z0||i>=pg.x0+pg.w||j>=pg.z0+pg.h)return false;
  return pg.grid[(j-pg.z0)*pg.w+(i-pg.x0)]===1;
 }
 function cellCost(i,j){
  const k=cellKey(i,j),cached=costCache.get(k);
  if(cached!==undefined)return cached;
  const h=terrainHeight(i+.5,j+.5);
  const rise=Math.max(0,h-3);
  let c=1+rise*rise*.05;
  if(terrainAt(i+.5,j+.5)==='forest')c+=.6;
  costCache.set(k,c);
  return c;
 }
 function jitter(i,j){const v=Math.sin(i*12.9898+j*78.233)*43758.5453;return (v-Math.floor(v))*.12}
 // A* over integer cells inside one region piece; returns a polyline from the
 // exact start to the exact end (border crossing), via cell centers.
 function gridLeg(region,piece,start,end){
  const pg=passGrid(region,piece);
  const si=Math.round(start.x),sj=Math.round(start.z);
  const ei=Math.round(end.x),ej=Math.round(end.z);
  const sKey=cellKey(si,sj);
  const goalSet=new Set();
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
   if(cellPassable(pg,ei+di,ej+dj))goalSet.add(cellKey(ei+di,ej+dj));
  }
  if(!goalSet.size)return null;
  const startCells=[];
  if(cellPassable(pg,si,sj))startCells.push(sKey);
  for(let di=-1;di<=1&&!startCells.length;di++)for(let dj=-1;dj<=1;dj++){
   if(cellPassable(pg,si+di,sj+dj))startCells.push(cellKey(si+di,sj+dj));
  }
  if(!startCells.length)return null;
  const cost=new Map([[sKey,0]]),came=new Map(),closed=new Set();
  const open=[];
  for(const sk of startCells){
   if(sk!==sKey){cost.set(sk,0);came.set(sk,sKey)}
   heapPushRoad(open,{k:sk,f:Math.hypot(ei-+sk.split(',')[0],ej-+sk.split(',')[1])});
  }
  let goal=null;
  for(let iter=0;open.length&&iter<60000;iter++){
   const cur=heapPopRoad(open),ck=cur.k;
   if(closed.has(ck))continue;
   closed.add(ck);
   if(goalSet.has(ck)){goal=ck;break}
   const g=cost.get(ck);
   const [ci,cj]=ck.split(',').map(Number);
   const parent=came.get(ck);
   const dirIn=parent?[ci-+parent.split(',')[0],cj-+parent.split(',')[1]]:null;
   for(const [dx,dz] of DIRS){
    const nx=ci+dx,nz=cj+dz,nk=cellKey(nx,nz);
    if(!cellPassable(pg,nx,nz)||nk===sKey)continue;
    const turn=dirIn&&(dx!==dirIn[0]||dz!==dirIn[1])?.3:0;
    const w=(dx&&dz?1.414:1)*cellCost(nx,nz)+turn+jitter(nx,nz);
    const ng=g+w;
    if(ng>=(cost.get(nk)??Infinity))continue;
    cost.set(nk,ng);came.set(nk,ck);
    heapPushRoad(open,{k:nk,f:ng+Math.hypot(ei-nx,ej-nz)});
   }
  }
  if(!goal)return null;
  const cells=[];
  for(let k=goal;k&&k!==sKey;k=came.get(k)){
   const [i,j]=k.split(',').map(Number);
   cells.push({x:i+.5,z:j+.5});
  }
  cells.reverse();
  return [{x:start.x,z:start.z},...cells,{x:end.x,z:end.z}];
 }
 // --- Shared registration: overlapping cells merge into one road ---------
 const cellNodes=new Map();
 function nodeForCell(i,j){
  const ck=cellKey(i,j);
  let key=cellNodes.get(ck);
  if(!key){key='r'+ck;cellNodes.set(ck,key)}
  if(!graph.nodes.has(key))graphAddNode(graph,key,{x:i+.5,z:j+.5});
  return key;
 }
 function nodeForPoint(p){
  const key='x'+p.x.toFixed(4)+','+p.z.toFixed(4);
  if(!graph.nodes.has(key))graphAddNode(graph,key,{x:p.x,z:p.z});
  return key;
 }
 function addRoad(a,b,left,right){
  let last=graph.hubKeys.get(a.id);
  for(let i=1;i<left.length;i++){
   const p=left[i];
   const key=i===left.length-1?nodeForPoint(p):nodeForCell(Math.round(p.x-.5),Math.round(p.z-.5));
   graphLink(graph,last,key);
   last=key;
  }
  const toKey=nodeForPoint(right[0]);
  graphLink(graph,last,toKey);
  last=toKey;
  for(let i=1;i<right.length;i++){
   const p=right[i];
   const key=i===right.length-1?graph.hubKeys.get(b.id):nodeForCell(Math.round(p.x-.5),Math.round(p.z-.5));
   graphLink(graph,last,key);
   last=key;
  }
 }
 function addRawRoad(a,b,pts){
  let last=graph.hubKeys.get(a.id);
  for(let i=1;i<pts.length;i++){
   const p=pts[i];
   const key=i===pts.length-1?graph.hubKeys.get(b.id):nodeForCell(Math.round(p.x-.5),Math.round(p.z-.5));
   graphLink(graph,last,key);
   last=key;
  }
 }
 function legStaysIn(region,pts){
  for(let i=1;i<pts.length;i++)if(!staysIn(region,pts[i-1],pts[i]))return false;
  return true;
 }
 // --- Straighten: drop degree-2 nodes whose detour is smaller than the road
 // width (cell-grid staircase noise); meaningful bends stay and the renderer
 // rounds them. Junctions (degree 3+) are never touched.
 function unlink(g,k1,k2){
  const e=k1<k2?k1+'|'+k2:k2+'|'+k1;
  g.edges.delete(e);
  g.nodes.get(k1)?.edges.delete(k2);
  g.nodes.get(k2)?.edges.delete(k1);
 }
 function graphSimplify(){
  for(let pass=0;pass<6;pass++){
   let changed=false;
   for(const [key,node] of [...graph.nodes]){
    if(key[0]==='h'||key[0]==='x'||node.edges.size!==2)continue;
    const [ka,kb]=[...node.edges.keys()];
    const a=graph.nodes.get(ka),b=graph.nodes.get(kb);
    if(!a||!b)continue;
    const ax=node.x-a.x,az=node.z-a.z,bx=b.x-node.x,bz=b.z-node.z;
    const seg=Math.hypot(b.x-a.x,b.z-a.z);
    if(seg>0&&Math.abs(ax*bz-az*bx)/seg>1.2)continue;
    unlink(graph,key,ka);unlink(graph,key,kb);graph.nodes.delete(key);
    graphLink(graph,ka,kb);
    changed=true;
   }
   if(!changed)break;
  }
 }
 // --- Build -----------------------------------------------------------------
 const missing=[];
 for(const a of regions)for(const id of a.adj){
  if(id<=a.id)continue;
  const b=byId.get(id);
  let connected=false;
  const ai=mainPiece.get(a),bi=mainPiece.get(b);
  for(const {from,to} of borderCandidates(a,b).slice(0,5)){
   const left=gridLeg(a,ai,a.slots[0],from);
   const right=gridLeg(b,bi,to,b.slots[0]);
   if(!left||!right||!legStaysIn(a,left)||!legStaysIn(b,right))continue;
   addRoad(a,b,left,right);
   connected=true;break;
  }
  if(!connected){
   // Last resort: the old straight legs, still shared where they overlap.
   for(const {from,to} of borderCandidates(a,b)){
    const left=routeWithin(a,a.slots[0],from,staysIn);
    const right=routeWithin(b,to,b.slots[0],staysIn);
    if(!left||!right)continue;
    addRoad(a,b,cleanLeg(a,left),cleanLeg(b,right));
    connected=true;break;
   }
  }
  if(!connected)missing.push([a.id,b.id,a.city,b.city]);
 }
 // A border can touch a detached district while both towns lie elsewhere.
 // Keep ordinary dry-land travel if those towns would otherwise lose access.
 const separated=(a,b)=>!pathsToHub(graph,graph.hubKeys.get(a))?.has(graph.hubKeys.get(b));
 const isolated=missing.filter(([a,b])=>separated(a,b));
 if(isolated.length){
  const ground=makeTransport(regions);
  for(const [a,b] of isolated){
   if(!separated(a,b))continue;
   const path=networkPath(ground,ground.hubKeys.get(a),ground.hubKeys.get(b));
   if(path?.length>1)addRawRoad(byId.get(a),byId.get(b),path);
  }
 }
 graphSimplify();
 return {nodes:[...graph.nodes].map(([key,node])=>[key,node.x,node.z]),hubs:[...graph.hubKeys],
  links:[...graph.edges.keys()].map(key=>key.split('|')),missing};
}
for(const target of process.argv.length>2?[process.argv[2]]:[root,path.join(root,'maps/mediterranean')]){
 const files=[target+'/scenario.js',target+'/map-data.js',target+'/parcel-data.js',root+'/logic.js',root+'/transport.js'].filter(file=>fs.existsSync(file));
 const {missing,...roads}=vm.runInNewContext(files.map(file=>fs.readFileSync(file,'utf8')).join('\n')+
  '\n('+buildBorderRoads.toString()+')(HISTORICAL_REGIONS.map(initRegion));');
 fs.writeFileSync(target+'/road-data.js','const SCENARIO_ROADS='+JSON.stringify(roads)+';\n');
 console.log(target,roads.nodes.length+' road nodes, '+roads.links.length+' segments');
 if(missing.length)console.log('Town pairs without a direct border road:',JSON.stringify(missing));
}
