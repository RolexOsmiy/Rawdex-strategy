'use strict';
// Road graph joins settlement centers on a shared land grid; connectors attach buildings to it.
const ROAD_STEP=typeof GAME_MAP!=='undefined'&&GAME_MAP?3.5:7;
function nodeKey(x,z){return x+','+z}
function graphAddNode(g,key,p){if(!g.nodes.has(key))g.nodes.set(key,{x:p.x,z:p.z,edges:new Map()})}
function graphLink(g,ka,kb){if(ka===kb)return;let a=g.nodes.get(ka),b=g.nodes.get(kb),length=distance(a,b);if(!Number.isFinite(length)||length===0)return;a.edges.set(kb,length);b.edges.set(ka,length);let k=ka<kb?ka+'|'+kb:kb+'|'+ka;g.edges.set(k,[{x:a.x,z:a.z},{x:b.x,z:b.z}])}
function heapPushRoad(a,v){a.push(v);let i=a.length-1;while(i){let p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p}a[i]=v}
function heapPopRoad(a){let root=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let n=i*2+1;if(n+1<a.length&&a[n+1].f<a[n].f)n++;if(a[n].f>=last.f)break;a[i]=a[n];i=n}a[i]=last}return root}
function makeTransport(regions){
 if(typeof SCENARIO_ROADS!=='undefined'){
  const graph={nodes:new Map(),edges:new Map(),hubKeys:new Map(SCENARIO_ROADS.hubs),regions};
  for(const [key,x,z] of SCENARIO_ROADS.nodes) graphAddNode(graph,key,{x,z});
  for(const [a,b] of SCENARIO_ROADS.links) graphLink(graph,a,b);
  return graph;
 }
 const mapBounds=typeof GAME_MAP!=='undefined'&&GAME_MAP?.bounds;
 const landCache=new Map(),edgeCache=new Map(),g={nodes:new Map(),edges:new Map(),hubKeys:new Map(),regions};
 function allowed(x,z){let key=nodeKey(x,z);if(landCache.has(key))return landCache.get(key);let px=x*ROAD_STEP,pz=z*ROAD_STEP,yes=mapBounds?px>=mapBounds[0]&&px<=mapBounds[2]&&pz>=mapBounds[1]&&pz<=mapBounds[3]&&!isSeaBackground(px,pz):px>=0&&px<=1100&&pz>=0&&pz<=710&&(!!regionAt(regions,px,pz)||!isSeaBackground(px,pz));landCache.set(key,yes);return yes}
 function safeEdge(ax,az,bx,bz){let a=nodeKey(ax,az),b=nodeKey(bx,bz),key=a<b?a+'|'+b:b+'|'+a;if(edgeCache.has(key))return edgeCache.get(key);let safe=true,checks=mapBounds?20:4;for(let i=1;i<checks;i++){let t=i/checks,x=(ax+(bx-ax)*t)*ROAD_STEP,z=(az+(bz-az)*t)*ROAD_STEP;if(isSeaBackground(x,z)&&(mapBounds||!regionAt(regions,x,z))){safe=false;break}}edgeCache.set(key,safe);return safe}
 function nearest(p){let x=Math.round(p.x/ROAD_STEP),z=Math.round(p.z/ROAD_STEP),found=null,best=Infinity;for(let ring=0;ring<=4&&!found;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){if(Math.max(Math.abs(dx),Math.abs(dz))!==ring||!allowed(x+dx,z+dz))continue;let px=(x+dx)*ROAD_STEP,pz=(z+dz)*ROAD_STEP,dist=Math.hypot(p.x-px,p.z-pz);let water=false;for(let i=0;i<=8;i++){let t=i/8,sx=p.x+(px-p.x)*t,sz=p.z+(pz-p.z)*t;if(!regionAt(regions,sx,sz)&&isSeaBackground(sx,sz)){water=true;break}}if(!water&&dist<best){best=dist;found={x:x+dx,z:z+dz}}}return found}
 function astar(start,end){let ak=nodeKey(start.x,start.z),goal=nodeKey(end.x,end.z),open=[],cost=new Map([[ak,0]]),came=new Map(),closed=new Set();heapPushRoad(open,{...start,f:0});for(let count=0;open.length&&count<14000;count++){let cur=heapPopRoad(open),k=nodeKey(cur.x,cur.z);if(closed.has(k))continue;if(k===goal){let out=[];while(k){let [x,z]=k.split(',').map(Number);out.push({x,z});k=came.get(k)}return out.reverse()}closed.add(k);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let x=cur.x+dx,z=cur.z+dz,n=nodeKey(x,z);if(!allowed(x,z)||closed.has(n)||(dx&&dz&&(!allowed(cur.x+dx,cur.z)||!allowed(cur.x,cur.z+dz)))||!safeEdge(cur.x,cur.z,x,z))continue;let ka=nodeKey(cur.x,cur.z),existing=g.nodes.get('g'+ka)?.edges.has('g'+n),weight=(dx&&dz?1.414:1)*(existing ? .75 : 1),next=cost.get(ka)+weight;if(next>=(cost.get(n)??Infinity))continue;cost.set(n,next);came.set(n,ka);heapPushRoad(open,{x,z,f:next+Math.hypot(end.x-x,end.z-z)*.75})}}return null}
 const anchors=new Map();for(const r of regions){const p=r.slots[0],hub='h'+r.id;graphAddNode(g,hub,p);g.hubKeys.set(r.id,hub);let cell=nearest(p);if(cell){let ck='g'+nodeKey(cell.x,cell.z);graphAddNode(g,ck,{x:cell.x*ROAD_STEP,z:cell.z*ROAD_STEP});graphLink(g,hub,ck);anchors.set(r.id,cell)}}
 for(const r of regions)for(const id of r.adj){if(id<=r.id)continue;let a=anchors.get(r.id),b=anchors.get(id);if(!a||!b)continue;let path=astar(a,b);if(!path)continue;for(let i=0;i<path.length;i++){let k='g'+nodeKey(path[i].x,path[i].z);graphAddNode(g,k,{x:path[i].x*ROAD_STEP,z:path[i].z*ROAD_STEP});if(i)graphLink(g,'g'+nodeKey(path[i-1].x,path[i-1].z),k)}}
 return g;
}
function networkPath(g,from,to,canTraverse=null){
 if(!g.nodes.has(from)||!g.nodes.has(to))return null;
 // Мемоизация: боты и караваны спрашивают одни и те же маршруты десятки раз,
 // а Дейкстра по всей дорожной сети — миллисекунды на запрос. Ключ включает
 // сам фильтр (замыкание), поэтому при войне/мире маршруты честно считаются
 // заново. Кэш ограничен и сбрасывается при изменении графа (attachCity).
 const cache=g._pathCache??(g._pathCache=new Map());
 const key=(canTraverse??'open')+':'+from+':'+to;
 if(cache.has(key))return cache.get(key);
 let open=[],cost=new Map([[from,0]]),came=new Map(),closed=new Set(),result=null;
 heapPushRoad(open,{id:from,f:0});
 while(open.length){let cur=heapPopRoad(open),id=cur.id;if(closed.has(id))continue;if(id===to){let out=[];for(let k=id;k;k=came.get(k)){let n=g.nodes.get(k);out.push({x:n.x,z:n.z})}result=out.reverse();break}closed.add(id);for(let [next,w] of g.nodes.get(id).edges){if(canTraverse&&!canTraverse(g.nodes.get(id),g.nodes.get(next)))continue;let d=cost.get(id)+w;if(d>=(cost.get(next)??Infinity))continue;cost.set(next,d);came.set(next,id);heapPushRoad(open,{id:next,f:d})}}
 cache.set(key,result);
 if(cache.size>8000)cache.clear();
 return result;
}
function localRoadNodes(g,region){
 const cache=g.localRoadNodes??=new Map();
 let data=cache.get(region);
 if(!data||data.size!==g.nodes.size){
  const entries=[];
  for(const entry of g.nodes)if(insideRegion(region,entry[1].x,entry[1].z))entries.push(entry);
  data={size:g.nodes.size,entries};
  cache.set(region,data);
 }
 return data.entries;
}

// Every workshop sending to the same capital uses the same shortest-path tree.
function pathsToHub(g,hub,canTraverse){
 if(!g.nodes.has(hub))return null;
 if(g.hubPathRevision!==g.edges.size){
  g.hubPathRevision=g.edges.size;
  g.hubPaths=new Map();
  g.filteredHubPaths=new WeakMap();
 }
 let cache=g.hubPaths;
 if(canTraverse){
  if(!g.filteredHubPaths.has(canTraverse))g.filteredHubPaths.set(canTraverse,new Map());
  cache=g.filteredHubPaths.get(canTraverse);
 }
 if(cache.has(hub))return cache.get(hub);
 const nextHop=new Map([[hub,null]]),cost=new Map([[hub,0]]),queue=[];
 heapPushRoad(queue,{id:hub,f:0});
 while(queue.length){
  const {id,f}=heapPopRoad(queue);
  if(f!==cost.get(id))continue;
  const node=g.nodes.get(id);
  for(const [next,weight] of node.edges){
   const total=f+weight;
   if(total>=(cost.get(next)??Infinity)||canTraverse&&!canTraverse(g.nodes.get(next),node))continue;
   cost.set(next,total);
   nextHop.set(next,id);
   heapPushRoad(queue,{id:next,f:total});
  }
 }
 nextHop.distances=cost;
 cache.set(hub,nextHop);
 return nextHop;
}
function routeToHub(g,from,hub,canTraverse=null){
 const tree=pathsToHub(g,hub,canTraverse);
 if(!tree?.has(from))return null;
 const path=[];
 for(let key=from;key;key=tree.get(key)){
  const {x,z}=g.nodes.get(key);
  path.push({x,z});
 }
 return path;
}
function buildingRoadJunctions(g,region,building){
 const cache=g._edgeScan??=new Map();
 const key=region.id+':'+building.x+':'+building.z;
 if(cache.has(key))return cache.get(key);
 const hits=[];
 for(const [edge,[a,b]] of g.edges){
  const dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
  if(length2<1e-8||!region.bounds.some(([minX,minZ,maxX,maxZ])=>
   Math.max(a.x,b.x)>=minX&&Math.min(a.x,b.x)<=maxX&&Math.max(a.z,b.z)>=minZ&&Math.min(a.z,b.z)<=maxZ))continue;
  const projected=Math.max(0,Math.min(1,((building.x-a.x)*dx+(building.z-a.z)*dz)/length2));
  const at=t=>({x:a.x+dx*t,z:a.z+dz*t});
  const projection=at(projected);
  const points=insideRegion(region,projection.x,projection.z)?[projection]:
   segmentRegionSpans(region,a,b).map(([lo,hi])=>at(Math.max(lo+1e-7,Math.min(hi-1e-7,projected))));
  const keys=edge.split('|');
  for(const point of points)hits.push({point,keys,gap:distance(building,point)});
 }
 hits.sort((a,b)=>a.gap-b.gap);
 cache.set(key,hits);
 return hits;
}
function roadJunctionExit(g,tree,point,keys,canTraverse){
 let endpoint=null,remaining=Infinity;
 for(const key of keys){
  const node=g.nodes.get(key),other=keys[0]===key?keys[1]:keys[0];
  if(!tree.has(key))continue;
  const distanceToNode=distance(point,node);
  if(distanceToNode>1e-7&&canTraverse&&!canTraverse(point,node))continue;
  if(distanceToNode>1e-7&&tree.get(key)===other&&distance(point,g.nodes.get(other))>1e-7)continue;
  const length=distanceToNode+tree.distances.get(key);
  if(length<remaining){endpoint=key;remaining=length}
 }
 return endpoint===null?null:{endpoint,remaining};
}
function branchRoadContact(from,to,a,b){
 const dx=to.x-from.x,dz=to.z-from.z,ex=b.x-a.x,ez=b.z-a.z;
 const x=a.x-from.x,z=a.z-from.z,det=dx*ez-dz*ex;
 if(Math.abs(det)>1e-9){
  const t=(x*ez-z*ex)/det,u=(x*dz-z*dx)/det;
  return t>=0&&t<=1&&u>=0&&u<=1?t:null;
 }
 if(Math.abs(x*dz-z*dx)>1e-7)return null;
 const length2=dx*dx+dz*dz;
 if(length2<1e-9)return null;
 const t0=(x*dx+z*dz)/length2,t1=t0+(ex*dx+ez*dz)/length2;
 const t=Math.max(0,Math.min(t0,t1));
 return t<=1&&Math.max(t0,t1)>=0?t:null;
}
function firstBranchRoad(g,branch,junctions,tree,canTraverse){
 for(let i=1;i<branch.length;i++){
  const from=branch[i-1],to=branch[i];
  let closest=null;
  for(const {keys} of junctions){
   const [a,b]=keys.map(key=>g.nodes.get(key));
   const t=branchRoadContact(from,to,a,b);
   if(t===null||closest&&t>=closest.t)continue;
   const point={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};
   const exit=roadJunctionExit(g,tree,point,keys,canTraverse);
   if(exit)closest={...exit,point,t};
  }
  if(closest){
   const prefix=branch.slice(0,i);
   if(closest.t>1e-7)prefix.push(closest.point);
   return {...closest,branch:prefix};
  }
 }
 return null;
}
function attachBuilding(g,region,building,capitalId,canTraverse=null){
 const hub=g.hubKeys.get(capitalId),tree=pathsToHub(g,hub,canTraverse);
 if(!tree)return null;
 const origin={x:building.x,z:building.z};
 const allows=branch=>!canTraverse||branch.every((point,i)=>!i||canTraverse(branch[i-1],point));
 const junctions=buildingRoadJunctions(g,region,building);
 let best=null;
 for(const hit of junctions){
  if(best&&hit.gap>best.branchLength+1e-7)break;
  const {point,keys,gap}=hit;
  let exit=roadJunctionExit(g,tree,point,keys,canTraverse);
  if(!exit)continue;
  const direct=segmentWithin(region,origin,point);
  let branch;
  if(direct)branch=gap<1e-7?[origin]:[origin,point];
  else{
   if(!Object.hasOwn(hit,'detour'))hit.detour=routeWithin(region,origin,point);
   if(!hit.detour)continue;
   const first=firstBranchRoad(g,hit.detour,junctions,tree,canTraverse);
   if(first){exit=first;branch=first.branch}else branch=hit.detour;
  }
  if(!allows(branch))continue;
  const branchLength=routeLength(branch),{endpoint,remaining}=exit;
  if(!best||branchLength<best.branchLength-1e-7||Math.abs(branchLength-best.branchLength)<=1e-7&&remaining<best.remaining)
   best={endpoint,branch,branchLength,remaining};
 }
 if(!best){
  if(region.id!==capitalId)return null;
  const hubPoint=g.nodes.get(hub),destination={x:hubPoint.x,z:hubPoint.z};
  const branch=segmentWithin(region,origin,destination)?[origin,destination]:routeWithin(region,origin,destination);
  if(!branch||!allows(branch))return null;
  best=firstBranchRoad(g,branch,junctions,tree,canTraverse)||{endpoint:hub,branch};
 }
 const contact=firstBranchRoad(g,best.branch,junctions,tree,canTraverse);
 if(contact&&routeLength(contact.branch)<routeLength(best.branch)-1e-7)best=contact;
 const {branch,endpoint}=best,path=branch.slice();
 for(let key=endpoint;key;key=tree.get(key)){
  const {x,z}=g.nodes.get(key),point={x,z};
  if(distance(path.at(-1),point)>1e-7)path.push(point);
 }
 if(path.length===1)path.push({...path[0]});
 path.branchLength=branch.length;
 return path;
}
function attachCity(g,region,city){
 // Граф изменится — сбрасываем кэши маршрутов (tree/edgeScan/pathCache),
 // hubPaths инвалидируется сам по hubPathRevision = edges.size.
 g._edgeScan?.clear();g._pathCache?.clear();
 const options=localRoadNodes(g,region).map(([key,p])=>({key,p,d:distance(p,city)})).sort((a,b)=>a.d-b.d);
 for(const opt of options){
  const path=routeWithin(region,city,opt.p);
  if(!path)continue;
  let last=opt.key;
  for(let i=path.length-2;i>=0;i--){
   const p=path[i],k='c'+region.id+':'+city.slotId+':'+i;
   graphAddNode(g,k,p);
   graphLink(g,k,last);
   last=k;
  }
  return true;
 }
 return false;
}
// Locations may lie in the middle of a road edge, not just at towns.
function roadNodeLocation(g,key){let p=g.nodes.get(key);return p?{point:{x:p.x,z:p.z},links:[key]}:null}
function nearestRoadLocation(g,x,z){let best=null,d2=Infinity;for(const [id,edge] of g.edges){let [a,b]=edge,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),point={x:a.x+dx*t,z:a.z+dz*t},d=(point.x-x)**2+(point.z-z)**2;if(d<d2){d2=d;best={point,links:id.split('|'),edge:id}}}return best?{...best,distance:Math.sqrt(d2)}:null}
function roadRouteBetween(g,from,to,canTraverse=null){if(!from||!to)return null;let best=null,bestLength=Infinity;function offer(path){let clean=[];for(const p of path)if(!clean.length||distance(clean[clean.length-1],p)>.00001)clean.push({x:p.x,z:p.z});if(clean.length<2)return;let len=0;for(let i=1;i<clean.length;i++)len+=distance(clean[i-1],clean[i]);if(len<bestLength){bestLength=len;best=clean}}if(from.edge&&from.edge===to.edge&&(!canTraverse||canTraverse(from.point,to.point)))offer([from.point,to.point]);for(const a of from.links||[])for(const b of to.links||[]){let an=g.nodes.get(a),bn=g.nodes.get(b);if(!an||!bn||(canTraverse&&(!canTraverse(from.point,an)||!canTraverse(bn,to.point))))continue;let trunk=networkPath(g,a,b,canTraverse);if(trunk)offer([from.point,...trunk,to.point])}return best}
// Find the first legal exit in order of real road distance from a position on an edge.
function nearestRoadExit(g,from,isOutside,canTraverse){
 if(!from)return null;
 const queue=[],cost=new Map(),previous=new Map();
 for(const id of from.links){
  const point=g.nodes.get(id);
  if(!point||!canTraverse(from.point,point))continue;
  const gap=distance(from.point,point);
  cost.set(id,gap);previous.set(id,null);heapPushRoad(queue,{id,f:gap});
 }
 while(queue.length){
  const {id,f}=heapPopRoad(queue);
  if(f!==cost.get(id))continue;
  const node=g.nodes.get(id);
  if(isOutside(node)){
   const path=[];
   for(let key=id;key;key=previous.get(key)){
    const {x,z}=g.nodes.get(key);
    path.push({x,z});
   }
   path.reverse();
   if(distance(from.point,path[0])>.00001)path.unshift(from.point);
   return {path,destination:roadNodeLocation(g,id)};
  }
  for(const [next,len] of node.edges){
   const target=g.nodes.get(next),travel=f+len;
   if(travel>=(cost.get(next)??Infinity)||!canTraverse(node,target))continue;
   cost.set(next,travel);previous.set(next,id);heapPushRoad(queue,{id:next,f:travel});
  }
 }
 return null;
}
if(typeof module!=='undefined')module.exports={ROAD_STEP,makeTransport,networkPath,attachBuilding,attachCity,roadNodeLocation,nearestRoadLocation,roadRouteBetween};
