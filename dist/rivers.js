'use strict';

const RIVER_PORT_REACH=16;
const BRIDGE_DEFENSE=.25;
function riverWidth(rank){return rank<=2?2.8:rank<=4?2.35:rank===5?1.85:1.24}

class RiverMap{
 constructor({lines,mouths,sea=[]}){
  this.lines=[];
  this.seas=sea.map(rings=>({rings,
   left:Math.min(...rings[0].map(p=>p[0])),right:Math.max(...rings[0].map(p=>p[0])),
   top:Math.min(...rings[0].map(p=>p[1])),bottom:Math.max(...rings[0].map(p=>p[1]))}));
  this.systems=mouths.map(([x,z])=>({mouth:{x,z},nodes:new Map(),outlet:null,paths:[],grid:new Map()}));
  this.buckets=new Map();
  this.openingBuckets=new Map();
  this.bridgeBuckets=new Map();
  this.bridges=[];
  for(const [name,system,rank,points] of lines){
   const channel=this.systems[system];
   if(!channel||points.length<2)continue;
   const path=points.map(([x,z])=>this.node(channel,x,z));
   channel.paths.push({name,system,rank,path});
   for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    if(a===b)continue;
    this.index(channel.grid,a,b,{a,b,path});
    this.link(a,b);
   }
  }
  for(const channel of this.systems){
   this.stitchJunctions(channel);
   this.traceOutlet(channel);
   for(const {name,system,rank,path} of channel.paths){
    if(Number.isFinite(path[0].toMouth))this.addLine(name,system,rank,path);
   }
  }
 }
 distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
 link(a,b){
  if(a===b)return;
  const length=this.distance(a,b);
  a.links.set(b,length);b.links.set(a,length);
 }
 addLine(name,system,rank,path){
  this.lines.push([name,system,rank,path.map(({x,z})=>[x,z])]);
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];
   if(a!==b)this.index(this.buckets,a,b,{a,b,name,system,width:riverWidth(rank)});
  }
 }
 index(buckets,a,b,item){
  for(let x=Math.floor(Math.min(a.x,b.x)/16);x<=Math.floor(Math.max(a.x,b.x)/16);x++)
   for(let z=Math.floor(Math.min(a.z,b.z)/16);z<=Math.floor(Math.max(a.z,b.z)/16);z++){
    const key=x+':'+z;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(item);
   }
 }
 nearby(buckets,a,b,padding=0){
  const entries=new Set();
  for(let x=Math.floor((Math.min(a.x,b.x)-padding)/16);x<=Math.floor((Math.max(a.x,b.x)+padding)/16);x++)
   for(let z=Math.floor((Math.min(a.z,b.z)-padding)/16);z<=Math.floor((Math.max(a.z,b.z)+padding)/16);z++)
    for(const item of buckets.get(x+':'+z)||[])entries.add(item);
  return entries;
 }
 node(channel,x,z){
  const key=x+':'+z,found=channel.nodes.get(key);
  if(found)return found;
  const node={x,z,links:new Map(),downstream:null,toMouth:Infinity};
  channel.nodes.set(key,node);
  return node;
 }
 stitchJunctions(channel){
  const connectors=[];
  for(const {name,system,rank,path} of channel.paths)for(const end of [path[0],path.at(-1)]){
   if([...end.links].some(([node])=>!path.includes(node)))continue;
   let best=null,gap=2.4;
   for(const segment of this.nearby(channel.grid,end,end,gap)){
    if(segment.path===path||segment.a===end||segment.b===end)continue;
    const hit=this.project(end,segment.a,segment.b),distance=this.distance(end,hit);
    if(distance>=gap)continue;
    best={...hit,segment};gap=distance;
   }
   if(!best)continue;
   const {a,b}=best.segment,node=best.t===0?a:best.t===1?b:this.node(channel,best.x,best.z);
   this.link(node,a);this.link(node,b);
   this.link(end,node);
   if(gap>1e-5)connectors.push({name,system,rank,path:[end,node]});
  }
  channel.paths.push(...connectors);
 }
 traceOutlet(channel){
  let root=null,nearest=Infinity;
  for(const node of channel.nodes.values()){
   const gap=this.distance(node,channel.mouth);
   if(gap<nearest){nearest=gap;root=node}
  }
  if(!root||nearest>39)return;
  channel.outlet=root;
  root.toMouth=nearest;
  const queue=[root],queued=new Set(queue);
  for(let i=0;i<queue.length;i++){
   const node=queue[i];
   queued.delete(node);
   for(const [neighbor,length] of node.links){
    const estimate=node.toMouth+length;
    if(estimate>=neighbor.toMouth)continue;
    neighbor.toMouth=estimate;neighbor.downstream=node;
    if(!queued.has(neighbor)){queue.push(neighbor);queued.add(neighbor)}
   }
  }
 }
 project(point,a,b){
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return {x:a.x+t*dx,z:a.z+t*dz,t};
 }
 nearest(point,reach,predicate=()=>true){
  let best=null,gap=reach;
  for(const segment of this.nearby(this.buckets,point,point,reach)){
   if(!predicate(segment))continue;
   const location=this.project(point,segment.a,segment.b),distance=this.distance(point,location);
   if(distance>=gap)continue;
   gap=distance;best={...location,segment,distance};
  }
  return best;
 }
 channelAt(point,reach=2.4){
  return this.nearest(point,reach,s=>this.systems[s.system].sea!==null);
 }
 offshoreAt({x,z}){
  return this.seas.some(({left,right,top,bottom,rings})=>x>=left&&x<=right&&z>=top&&z<=bottom
   &&inRing(x,z,rings[0])&&!rings.slice(1).some(ring=>inRing(x,z,ring)));
 }
 addOpening(system,path,name,width){
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];
   if(this.distance(a,b)<=.001)continue;
   this.index(this.openingBuckets,a,b,{a,b,system,path,i,name,width});
  }
 }
 openingAt(point){
  let result=null,gap=2.4;
  for(const opening of this.nearby(this.openingBuckets,point,point,gap)){
   const {path,i}=opening,location=this.project(point,path[i-1],path[i]);
   const distance=this.distance(point,location);
   if(distance<gap){gap=distance;result={...opening,location}}
  }
  return result;
 }
 downstream(point,hit){
  if(!hit)return null;
  const {a,b,system}=hit.segment;
  const first=a.toMouth+this.distance(hit,a)<=b.toMouth+this.distance(hit,b)?a:b;
  const path=[point];
  if(this.distance(point,hit)>.001)path.push({x:hit.x,z:hit.z});
  for(let node=first;node;node=node.downstream)if(this.distance(path.at(-1),node)>.001)path.push({x:node.x,z:node.z});
  return {system,path};
 }
 intersection(a,b,c,d){
  const dx=b.x-a.x,dz=b.z-a.z,ex=d.x-c.x,ez=d.z-c.z;
  const determinant=dx*ez-dz*ex;
  if(Math.abs(determinant)<1e-7)return null;
  const x=c.x-a.x,z=c.z-a.z,t=(x*ez-z*ex)/determinant,u=(x*dz-z*dx)/determinant;
  if(t<0||t>1||u<0||u>1)return null;
  const sine=Math.abs(determinant)/(Math.hypot(dx,dz)*Math.hypot(ex,ez));
  if(sine<.24)return null;
  return {x:a.x+t*dx,z:a.z+t*dz,sine};
 }
 updateBridges(graph,isLand){
  if(this.graph===graph&&this.edgeCount===graph?.edges.size)return false;
  this.graph=graph;this.edgeCount=graph?.edges.size;
  this.bridgeBuckets=new Map();this.bridges=[];
  for(const [a,b] of graph?.edges.values()||[]){
   const length=this.distance(a,b);
   if(!length)continue;
   const ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
   for(const segment of [...this.nearby(this.buckets,a,b),...this.nearby(this.openingBuckets,a,b)]){
    if(this.systems[segment.system].sea===null)continue;
    const p=this.intersection(a,b,segment.a,segment.b);
    if(!p||!isLand(p)||this.bridgeAt(p))continue;
    const half=Math.min(7,segment.width/p.sine+1.15);
    const start={x:p.x-ux*half,z:p.z-uz*half},end={x:p.x+ux*half,z:p.z+uz*half};
    const bridge={...p,start,end,river:segment.name,half,ux,uz};
    this.index(this.bridgeBuckets,start,end,bridge);this.bridges.push(bridge);
   }
  }
  return true;
 }
 bridgeAt(point){
  for(const bridge of this.nearby(this.bridgeBuckets,point,point,1.8)){
   const dx=point.x-bridge.x,dz=point.z-bridge.z;
   if(Math.abs(dx*bridge.ux+dz*bridge.uz)<=bridge.half&&Math.abs(dz*bridge.ux-dx*bridge.uz)<=1.35)return bridge;
  }
  return null;
 }
}
