'use strict';
// Bake one road over each shared land border. Build the two inland legs
// separately so curves and narrow duchies cannot send the road abroad.
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
 function addRoad(a,b,path){
  let last=graph.hubKeys.get(a.id);
  for(let i=1;i<path.length;i++){
   const point=path[i],key=i===path.length-1?graph.hubKeys.get(b.id):
    'r'+nodeKey(point.x.toFixed(5),point.z.toFixed(5));
   graphAddNode(graph,key,point);
   graphLink(graph,last,key);
   last=key;
  }
 }
 const missing=[];
 for(const a of regions)for(const id of a.adj){
  if(id<=a.id)continue;
  const b=byId.get(id);
  let connected=false;
  for(const {from,to} of borderCandidates(a,b)){
   const left=routeWithin(a,a.slots[0],from,staysIn);
   if(!left)continue;
   const right=routeWithin(b,to,b.slots[0],staysIn);
   if(!right)continue;
   addRoad(a,b,[...cleanLeg(a,left),...cleanLeg(b,right)]);
   connected=true;break;
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
   if(path?.length>1)addRoad(byId.get(a),byId.get(b),path);
  }
 }
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
