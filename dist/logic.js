'use strict';
const TYPES={city:{name:'Город',icon:'♜',cost:100},grain:{name:'Ферма',icon:'♧',cost:60,unit:'зерна'},wood:{name:'Лесопилка',icon:'♣',cost:60,unit:'древесины'},iron:{name:'Рудник',icon:'◆',cost:60,unit:'железа'},cloth:{name:'Ткацкая',icon:'▦',cost:60,unit:'тканей'},port:{name:'Порт',icon:'⚓',cost:90}};
const GAME_MAP=typeof MAP_SCENARIO==='undefined'?null:MAP_SCENARIO;
const [WORLD_WIDTH,WORLD_HEIGHT]=GAME_MAP?.world||[1100,710];
const LAND_BAND_HEIGHT=8;
function indexLandRing(ring){
 const bands=new Map();
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if(a[1]===b[1])continue;
  const first=Math.floor(Math.min(a[1],b[1])/LAND_BAND_HEIGHT);
  const last=Math.floor(Math.max(a[1],b[1])/LAND_BAND_HEIGHT);
  for(let band=first;band<=last;band++){
   if(!bands.has(band))bands.set(band,[]);
   bands.get(band).push([a,b]);
  }
 }
 return bands;
}
function inLandRing(x,z,edges){
 let hit=false;
 for(const [a,b] of edges||[]){
  if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
 }
 return hit;
}
const MAP_LAND=typeof SCENARIO_LAND==='undefined'?null:SCENARIO_LAND.map(poly=>{
 const outer=poly[0];
 return {rings:poly.map(indexLandRing),minX:Math.min(...outer.map(p=>p[0])),maxX:Math.max(...outer.map(p=>p[0])),
  minZ:Math.min(...outer.map(p=>p[1])),maxZ:Math.max(...outer.map(p=>p[1]))};
});
const LAND_NAMES={field:'Равнина',forest:'Лес',mountain:'Горы'};
function terrainFeatures(x,z){const forest=Math.sin(x*.009+Math.sin(z*.012)*1.6)+Math.cos(z*.014-x*.008)+.35*Math.sin(x*.027+z*.023),belt=GAME_MAP?GAME_MAP.ridges.reduce((height,[rx,rz,radius,peak])=>Math.max(height,peak/75*Math.exp(-((x-rx)**2+(z-rz)**2)/radius**2)),0):Math.exp(-Math.pow((z-590)/105,2)),ridge=.5+.5*Math.cos(x*.022+Math.sin(z*.012)*1.1),peaks=Math.pow(Math.max(0,Math.cos(x*.04+z*.018)*Math.cos(z*.029-x*.008)),2),hills=(Math.sin(x*.014+z*.006)+Math.cos(z*.019-x*.004)+2)/4;return {forest,belt,ridge,peaks,hills}}
function terrainHeight(x,z){const f=terrainFeatures(x,z);return 3+f.hills*8+f.belt*(14+f.ridge*34+f.peaks*33)}
function terrainAt(x,z){const f=terrainFeatures(x,z);if(f.belt*(7+f.ridge*14+f.peaks*16)>13)return 'mountain';return f.forest<-.35?'forest':'field'}
function productivity(type,terrain){const m={grain:{field:1.1,forest:.7,mountain:.5},wood:{field:.8,forest:1.3,mountain:.7},iron:{field:.8,forest:.9,mountain:1.4},cloth:{field:1,forest:1,mountain:.9}};return m[type]?{multiplier:m[type][terrain],rate:Math.round(10*m[type][terrain])}:null}
function inRing(x,z,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
// The basemap distinguishes the Baltic from unplayable neighboring land.
const BALTIC=[[0,0],[800,0],[800,50],[640,50],[620,45],[595,50],[565,50],[535,55],[510,55],[490,55],[485,115],[478,155],[460,165],[430,168],[400,170],[375,165],[355,160],[345,190],[340,225],[330,255],[305,280],[265,290],[230,290],[190,290],[150,285],[120,265],[0,265]];
function isSeaBackground(x,z){
 if(!GAME_MAP) return inRing(x,z,BALTIC);
 const [x0,z0,x1,z1]=GAME_MAP.bounds;
 if(x<x0||x>x1||z<z0||z>z1) return false;
 const band=Math.floor(z/LAND_BAND_HEIGHT);
 return !MAP_LAND.some(({rings,minX,maxX,minZ,maxZ})=>x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&
  inLandRing(x,z,rings[0].get(band))&&!rings.slice(1).some(hole=>inLandRing(x,z,hole.get(band))));
}
function triangulatePolygon(points){
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 let area=0;for(let i=0;i<points.length;i++){let a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1]}
 const sign=area>=0?1:-1,ids=points.map((_,i)=>i),triangles=[];
 for(let guard=0;ids.length>3&&guard<points.length*points.length;guard++){
  let removed=false;for(let j=0;j<ids.length;j++){let ai=ids[(j+ids.length-1)%ids.length],bi=ids[j],ci=ids[(j+1)%ids.length],a=points[ai],b=points[bi],c=points[ci];if(cross(a,b,c)*sign<=1e-8)continue;
   let contains=ids.some(k=>{if(k===ai||k===bi||k===ci)return false;let p=points[k];return cross(a,b,p)*sign>=-1e-8&&cross(b,c,p)*sign>=-1e-8&&cross(c,a,p)*sign>=-1e-8});if(contains)continue;
   triangles.push([a,b,c]);ids.splice(j,1);removed=true;break;
  }if(!removed)break;
 }
 if(ids.length===3)triangles.push(ids.map(i=>points[i]));
 if(triangles.length!==points.length-2)throw new Error('Не удалось построить береговую линию');return triangles;
}
function initRegion(r){const out={...r,owner:'neutral',buildings:[],bounds:r.polys.map(poly=>{let p=poly[0];return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]})};let data=typeof PARCEL_DATA!=='undefined'?PARCEL_DATA[r.id]:null;out.slots=data?data.slots.map(s=>({...s})):generateSlots(out);return out}
function insideRegionPiece(r,index,x,z){
 const bounds=r.bounds[index],piece=r.polys[index];
 return x>=bounds[0]&&z>=bounds[1]&&x<=bounds[2]&&z<=bounds[3]&&inRing(x,z,piece[0])&&
  !piece.slice(1).some(hole=>inRing(x,z,hole));
}
function insideRegion(r,x,z){return r.polys.some((_,index)=>insideRegionPiece(r,index,x,z))}
const regionGrids=new WeakMap(),REGION_GRID_STEP=64;
function regionGrid(regions){
 let grid=regionGrids.get(regions);
 if(!grid){
  grid=new Map();
  for(const region of regions){
   const cells=new Set();
   for(const [x0,z0,x1,z1] of region.bounds){
    for(let gz=Math.floor(z0/REGION_GRID_STEP);gz<=Math.floor(z1/REGION_GRID_STEP);gz++)
     for(let gx=Math.floor(x0/REGION_GRID_STEP);gx<=Math.floor(x1/REGION_GRID_STEP);gx++)cells.add(gx+','+gz);
   }
   for(const key of cells){
    if(!grid.has(key))grid.set(key,[]);
    grid.get(key).push(region);
   }
  }
  regionGrids.set(regions,grid);
 }
 return grid;
}
function regionAt(regions,x,z){
 if(!GAME_MAP)return regions.find(r=>insideRegion(r,x,z))||null;
 const key=Math.floor(x/REGION_GRID_STEP)+','+Math.floor(z/REGION_GRID_STEP);
 return regionGrid(regions).get(key)?.find(r=>insideRegion(r,x,z))||null;
}
function regionsAlongSegment(regions,a,b){
 const grid=regionGrid(regions),found=new Set();
 for(let z=Math.floor(Math.min(a.z,b.z)/REGION_GRID_STEP);z<=Math.floor(Math.max(a.z,b.z)/REGION_GRID_STEP);z++)
  for(let x=Math.floor(Math.min(a.x,b.x)/REGION_GRID_STEP);x<=Math.floor(Math.max(a.x,b.x)/REGION_GRID_STEP);x++)
   for(const region of grid.get(x+','+z)||[])found.add(region);
 return found;
}
function ringArea(ring){let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=a[0]*b[1]-b[0]*a[1]}return Math.abs(sum/2)}
function boundaryDistance(poly,x,z){let best=Infinity;for(const ring of poly)for(let i=0,j=ring.length-1;i<ring.length;j=i++){let a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den)):0;best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return best}
function slotCapacity(r){let area=r.polys.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((n,h)=>n+ringArea(h),0),0);return Math.max(3,Math.min(18,Math.round(3+2*Math.sqrt(Math.max(0,area)/1000))))}
function generateSlots(r){
 // Keep sites on the largest landmass and respect an inset adapted to narrow provinces.
 let k=0;for(let i=1;i<r.polys.length;i++)if(ringArea(r.polys[i][0])>ringArea(r.polys[k][0]))k=i;
 const poly=r.polys[k],b=r.bounds[k],candidates=[];
 for(let i=0;i<36;i++)for(let j=0;j<36;j++){let x=b[0]+(i+.5)*(b[2]-b[0])/36,z=b[1]+(j+.5)*(b[3]-b[1])/36;if(inRing(x,z,poly[0])&&!poly.slice(1).some(h=>inRing(x,z,h))&&insideRegion(r,x,z))candidates.push({x,z,clearance:boundaryDistance(poly,x,z)})}
 if(!candidates.length)return [{id:0,x:r.x,z:r.y,terrain:terrainAt(r.x,r.y)}];
 let maxClearance=Math.max(...candidates.map(p=>p.clearance)),pool=candidates.filter(p=>p.clearance>=maxClearance*.38),slots=[];
 if(GAME_MAP){
  const desired={x:r.x,z:r.y};
  if(insideRegion(r,desired.x,desired.z)&&boundaryDistance(poly,desired.x,desired.z)>.65)
   slots.push({id:0,...desired,terrain:terrainAt(desired.x,desired.z),clearance:boundaryDistance(poly,desired.x,desired.z)});
  else{
   const safe=candidates.filter(p=>p.clearance>=Math.min(1.3,maxClearance*.8));
   safe.sort((a,b)=>distance(a,desired)-distance(b,desired));
   const p=safe[0];
   if(p) slots.push({id:0,...p,terrain:terrainAt(p.x,p.z)});
  }
 }
 while(slots.length<slotCapacity(r)&&pool.length){let best=0,score=-1;for(let i=0;i<pool.length;i++){let p=pool[i],d=slots.length?Math.min(...slots.map(s=>Math.hypot(s.x-p.x,s.z-p.z))):maxClearance,weight=.4+.6*p.clearance/maxClearance,value=d*weight;if(value>score){score=value;best=i}}let p=pool.splice(best,1)[0];slots.push({id:slots.length,x:p.x,z:p.z,terrain:terrainAt(p.x,p.z),clearance:p.clearance})}
 for(const slot of slots){let spacing=Math.min(...slots.filter(other=>other!==slot).map(other=>Math.hypot(slot.x-other.x,slot.z-other.z)));slot.scale=.34*Math.min(1,slot.clearance/3.4,spacing/6.5)}
 return slots;
}
// A conservative local radius remains useful for marker and building scale.
function slotRadius(region,slot){let clearance=Number.isFinite(slot.clearance)?slot.clearance:Math.max(0,...(region.polys||[]).filter(p=>inRing(slot.x,slot.z,p[0])).map(p=>boundaryDistance(p,slot.x,slot.z)));let spacing=Math.min(...region.slots.filter(s=>s!==slot).map(s=>Math.hypot(s.x-slot.x,s.z-slot.z)));return Math.max(0,Math.min(11,clearance*.82,Number.isFinite(spacing)?spacing*.43:11))}
function slotAt(region,x,z){if(!region||!insideRegion(region,x,z)||!region.slots.length)return null;let best=null,d=Infinity;for(const slot of region.slots){let q=(slot.x-x)**2+(slot.z-z)**2;if(q<d){best=slot;d=q}}return best}

function costShortfalls(gold,stocks,goldCost,resources={}){
 const labels={grain:'зерна',wood:'древесины',iron:'железа',cloth:'ткани',equipment:'комплектов'};
 const missing=[];
 if(gold+1e-8<goldCost)missing.push(Math.ceil(goldCost-gold-1e-8)+' зл.');
 for(const [good,amount] of Object.entries(resources)){
  const gap=amount-(stocks?.[good]||0);
  if(gap>1e-8)missing.push(Math.ceil(gap-1e-8)+' '+labels[good]);
 }
 return missing;
}

const VASSAL_BUILD_REASON='Владением распоряжается феодал. Вы можете передать ему золото.';
function canDevelopLand(state,region,vassalId=null){
 return (vassalFor(state,region)?.id??null)===vassalId;
}
function developmentPrice(state,base,owner='you',vassal=null){
 const lands=vassal?vassal.lands.length:state.regions.filter(r=>r.owner===owner).length;
 const extra=Math.max(0,lands-1);
 return Math.ceil(base*(1+.065*extra+.012*extra*extra/(1+extra/16)));
}
function landDevelopmentPrice(state,base,region){
 return developmentPrice(state,base,region.owner,vassalFor(state,region));
}
function buildingSiteCheck(state,type,x,z,projectId=null,owner='you',vassalId=null){
 const definition=TYPES[type];
 if(!definition)return {ok:false,reason:'Неизвестная постройка'};
 if(!state.started)return {ok:false,reason:'Сначала выберите столицу'};
 if(state.defeated)return {ok:false,reason:'Вы потеряли все земли'};
 const r=regionAt(state.regions,x,z);
 if(r?.owner!==owner)return {ok:false,reason:'Выберите свою территорию'};
 if(!canDevelopLand(state,r,vassalId))return {ok:false,reason:VASSAL_BUILD_REASON,r};
 if(r.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством',r};
 const slot=r.slots.find(s=>Math.hypot(s.x-x,s.z-z)<.02);
 if(!slot)return {ok:false,reason:'Выберите отмеченное графство',r};
 if(r.buildings.some(b=>b.slotId===slot.id))return {ok:false,reason:'Графство уже застроено',r,slot};
 if(r.buildings.length>=r.slots.length)return {ok:false,reason:'Все графства застроены',r,slot};
 const plans=getRealmCouncil(state,owner)?.projects||[];
 if(plans.some(p=>p.id!==projectId&&p.regionId===r.id&&p.slotId===slot.id))return {ok:false,reason:'Графство зарезервировано Советом',r,slot};
 if(type==='port'){
  if(state.portSite?!state.portSite(r,slot):!r.coast)
   return {ok:false,reason:'Нужен участок у моря или судоходной реки',r,slot};
  if(r.buildings.some(b=>b.type==='port')||plans.some(p=>p.id!==projectId&&p.regionId===r.id&&p.type==='port'))
   return {ok:false,reason:'В герцогстве уже есть порт или план его стройки',r,slot};
 }
 return {ok:true,r,slot,terrain:slot.terrain,product:productivity(type,slot.terrain),cost:landDevelopmentPrice(state,definition.cost,r)};
}
function buildCheck(state,type,x,z,owner='you'){
 const check=buildingSiteCheck(state,type,x,z,null,owner);
 if(check.ok&&factionLedger(state,owner)?.gold<check.cost)return {...check,ok:false,reason:'Не хватает '+costShortfalls(factionLedger(state,owner).gold,null,check.cost).join(' · ')};
 return check;
}

function build(state,type,x,z,project=null,owner='you'){
 const listed=project&&getRealmCouncil(state,owner)?.projects.includes(project);
 const check=buildingSiteCheck(state,type,x,z,project?.id,owner,listed?project.vassalId??null:null);
 if(!check.ok)return check;
 const ledger=factionLedger(state,owner);
 const funded=project&&getRealmCouncil(state,owner)?.projects.includes(project)&&project.finishAt!=null&&project.finishAt<=state.economy.seconds&&
  project.regionId===check.r.id&&project.slotId===check.slot.id&&project.type===type;
 if(!funded){
  if(project||ledger.gold<check.cost)return {ok:false,reason:'Недостаточно золота',r:check.r,slot:check.slot};
  ledger.gold-=check.cost;
 }else check.cost=project.cost;
 const b={type,x:check.slot.x,z:check.slot.z,slotId:check.slot.id,scale:check.slot.scale,level:1,terrain:check.terrain,product:check.product,population:type==='city'?0:undefined,produced:0,dispatchClock:0};check.r.buildings.push(b);if((b.product||b.type==='port')&&state.economy){let cap=state.regions.find(r=>r.id===realmCapitalId(state,owner)),city=cap?.buildings.find(x=>x.capital);b.route=state.attachRoute?state.attachRoute(check.r,b):(cap===check.r&&city?routeWithin(check.r,b,city):null)}return {...check,building:b}}
function demolishBuilding(state,region,building,owner='you'){
 const index=region?.buildings.indexOf(building)??-1;
 if(!state.started||region?.owner!==owner||index<0)return {ok:false,reason:'Можно сносить свои постройки'};
 if(!canDevelopLand(state,region))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(building===duchySeat(region)||building.capital)return {ok:false,reason:'Главный город герцогства нельзя снести'};
 region.buildings.splice(index,1);
 if(building.type==='city'){
  region.displacedResidents=(region.displacedResidents||0)+(building.population||0);
  for(const city of region.buildings){
   if(city.type!=='city')continue;
   const free=Math.max(0,cityHousing(city)-(city.population||0));
   const moving=Math.min(free,region.displacedResidents);
   if(moving){city.population=(city.population||0)+moving;region.displacedResidents-=moving;}
  }
 }
 if(building.type==='port'){
  for(const ship of state.warships||[])if(ship.owner===region.owner&&ship.homeId===region.id)ship.homeId=null;
 }
 return {ok:true,building,region};
}
const MAX_BUILDING_LEVEL=3;
const CITY_HOUSING=[1800,3000,4500];
function cityHousing(b){return b?.type==='city'?(b.housingClosed?100:CITY_HOUSING[Math.min(CITY_HOUSING.length-1,Math.max(0,(b.level||1)-1))]):0}
const BASE_JOBS={city:60,grain:60,wood:70,iron:90,cloth:55,armory:100};
const WORKING_SHARE=.6, LOCAL_GRAIN_SHARE=.3;
const STORE_COST={gold:120,wood:24},STORE_MAX_LEVEL=3,STORE_SHARE=.15,SUPPLY_PRIORITY_SHARE=.15;
function storeBonus(region){return (region.store?.level||0)*STORE_SHARE+(region.supplyPriority?SUPPLY_PRIORITY_SHARE:0)}
function localGrainShare(region){return duchySeat(region)?.capital?1:region.vassalId!=null?VASSAL_SHARE:Math.min(.75,LOCAL_GRAIN_SHARE+storeBonus(region));}
function buildingJobs(building){
 return Math.round((BASE_JOBS[building.type]||0)*(1+.5*((building.level||1)-1)));
}
function regionalPopulation(region){
 return (region?.buildings||[]).reduce((sum,b)=>sum+(b.type==='city'?(b.population||0):0),0);
}
function workforceReport(region,buildings=region.buildings){
 const population=regionalPopulation(region),available=Math.floor(population*WORKING_SHARE);
 if(region.awaitingAdministration)
  return {available,capacity:0,employed:0,free:available,outsideWorkforce:Math.floor(population)-available,byBuilding:new Map()};
 const jobs=buildings.filter(b=>b.product).map(b=>({building:b,type:b.type,capacity:buildingJobs(b),workers:0}));
 if(region.armory?.ready&&region.armory.policy!=='paused')
  jobs.push({building:region.armory,type:'armory',capacity:BASE_JOBS.armory,workers:0});
 // Towns employ service workers: a city alone keeps a small settlement growing.
 for(const b of buildings)if(b.type==='city')jobs.push({building:b,type:'city',capacity:buildingJobs(b),workers:0});
 const capacity=jobs.reduce((sum,job)=>sum+job.capacity,0),efficiency=economicEfficiency(region);
 let left=available,food=population*GRAIN_PER_RESIDENT;
 // Feed the population first. Share any remaining workers across open jobs.
 const localShare=localGrainShare(region);
 const farms=jobs.filter(({building})=>building.type==='grain').sort((a,b)=>
  b.building.product.rate/b.capacity-a.building.product.rate/a.capacity);
 for(const job of farms){
  const rate=job.building.product.rate*localShare*efficiency/job.capacity;
  job.workers=Math.min(left,job.capacity,Math.ceil(Math.max(0,food)/rate));
  left-=job.workers;
  food-=job.workers*rate;
 }
 const openSlots=capacity-(available-left),shared=Math.min(left,openSlots);
 let assigned=0;
 for(const job of jobs){
  const exact=openSlots?shared*(job.capacity-job.workers)/openSlots:0,whole=Math.floor(exact);
  job.workers+=whole;
  job.remainder=exact-whole;
  assigned+=whole;
 }
 for(const job of jobs.slice().sort((a,b)=>b.remainder-a.remainder).slice(0,shared-assigned))job.workers++;
 const byBuilding=new Map(jobs.map(job=>{
  job.rate=(job.building.product?.rate||0)*efficiency*job.workers/job.capacity;
  return [job.building,job];
 }));
 const employed=available-left+shared;
 return {available,capacity,employed,free:available-employed,outsideWorkforce:Math.floor(population)-available,byBuilding};
}
function productionRate(region,building,workforce=workforceReport(region)){
 return workforce.byBuilding.get(building)?.rate||0;
}

function housingTotal(state){return state.regions.filter(r=>r.owner==='you').reduce((n,r)=>n+r.buildings.reduce((v,b)=>v+cityHousing(b),0),0)}
function upgradeCheck(state,r,b,purse=state,owner='you'){
 const ledger=factionLedger(state,owner,purse);
 if(!state.started||!ledger||r?.owner!==owner||!r.buildings.includes(b))return {ok:false,reason:'Улучшать можно свои постройки'};
 if(!canDevelopLand(state,r,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(r.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 const level=b.level||1;
 if(b.type==='city'&&(b.housingClosed||b.damaged))return {ok:false,reason:'Сначала восстановите захваченный город'};
 if(level>=MAX_BUILDING_LEVEL)return {ok:false,reason:'Достигнут максимальный уровень'};
 if(b.type!=='city'&&!b.product)return {ok:false,reason:'Улучшение этой постройки пока недоступно'};
 const cost=landDevelopmentPrice(state,b.type==='city'?(level===1?120:200):(level===1?80:130),r);
 const base=b.product?(b.baseRate??productivity(b.type,b.terrain).rate):null;
 const details=b.type==='city'?{nextHousing:CITY_HOUSING[level],nextJobs:buildingJobs({type:'city',level:level+1})}:{base,nextRate:Math.round(base*(1+.5*level))};
 if(ledger.gold<cost)return {ok:false,cost,...details,reason:'Не хватает '+costShortfalls(ledger.gold,null,cost).join(' · ')};
 return {ok:true,cost,...details,level};
}
function upgradeBuilding(state,r,b,purse=state,owner='you'){let check=upgradeCheck(state,r,b,purse,owner);if(!check.ok)return check;factionLedger(state,owner,purse).gold-=check.cost;b.level=check.level+1;if(b.product){b.baseRate=check.base;b.product={...b.product,rate:check.nextRate}}return {...check,building:b}}

const COUNCIL_BUILD_SECONDS={city:32,port:40,grain:18,wood:22,iron:26,cloth:22};
const COUNCIL_QUEUE_LIMIT=24;

function councilRegion(state,id,owner='you'){
 return state.regions.find(r=>r.id===id&&r.owner===owner);
}
function councilSpendable(state){return Math.max(0,state.gold-(state.council?.reserve||0))}
function councilSite(state,region,type,owner='you',vassalId=null){
 if(!region||!Object.hasOwn(COUNCIL_BUILD_SECONDS,type))return {ok:false,reason:'Выберите постройку и герцогство'};
 let best=null,reason='В герцогстве нет свободных графств';
 for(const slot of region.slots){
  if(region.buildings.some(b=>b.slotId===slot.id))continue;
  if(type==='port'&&state.councilPortSite&&!state.councilPortSite(slot)){
   reason='Для порта нужно свободное графство с выходом к воде';continue;
  }
  const check=buildingSiteCheck(state,type,slot.x,slot.z,null,owner,vassalId);
  if(!check.ok){reason=check.reason;continue}
  if(!best||(check.product?.rate||0)>(best.product?.rate||0))best=check;
 }
 return best||{ok:false,reason};
}
function queueCouncilProject(state,region,type,delegated=false,slot=null,owner='you',vassalId=null){
 const council=getRealmCouncil(state,owner);
 if(!council||council.projects.length>=COUNCIL_QUEUE_LIMIT)return {ok:false,reason:'Очередь строительства заполнена'};
 const check=slot?buildingSiteCheck(state,type,slot.x,slot.z,null,owner,vassalId):councilSite(state,region,type,owner,vassalId);
 if(!check.ok)return check;
 const project={id:++council.nextProject,type,regionId:region.id,slotId:check.slot.id,cost:check.cost,delegated,finishAt:null};
 if(vassalId!=null)project.vassalId=vassalId;
 council.projects.push(project);
 return {ok:true,project};
}
function editCouncilProject(state,id,prioritize){
 const queue=state.council?.projects;
 const index=queue?.findIndex(project=>project.id===id)??-1;
 if(index<0||queue[index].finishAt!=null)return false;
 const [project]=queue.splice(index,1);
 if(prioritize){
  const next=queue.findIndex(p=>!p.monthly&&p.finishAt==null);
  queue.splice(next<0?queue.length:next,0,project);
 }
 return true;
}
function councilConstruction(state,owner='you'){
 const council=getRealmCouncil(state,owner),queue=council.projects,now=state.economy.seconds;
 if(!queue.length)return;
 for(const project of queue.slice()){
  const region=councilRegion(state,project.regionId,owner);
  if(region&&(project.finishAt==null||now<project.finishAt))continue;
  const slot=region?.slots.find(site=>site.id===project.slotId);
  const result=slot&&build(state,project.type,slot.x,slot.z,project,owner);
  queue.splice(queue.indexOf(project),1);
  if(owner==='you'&&!project.vassalId)recordCouncilResult(state,project.regionId,result?.ok?'build:'+project.type:'construction-lost',
   result?.ok?COUNCIL_BUILT_LABELS[project.type]:'Строительство прервано');
  state.onCouncilProject?.(result?.ok?'finished':'lost',project,region,result);
 }
 if(owner!=='you'||council.paused)return;
 const manual=queue.filter(p=>!p.monthly);
 if(manual.some(p=>p.finishAt!=null))return;
 while(manual.length){
  const project=manual.shift(),region=councilRegion(state,project.regionId,owner);
  const slot=region?.slots.find(site=>site.id===project.slotId);
  const quote=slot&&buildingSiteCheck(state,project.type,slot.x,slot.z,project.id);
  if(!quote?.ok){
   queue.splice(queue.indexOf(project),1);
   recordCouncilResult(state,project.regionId,'construction-lost','Строительство прервано');
   state.onCouncilProject?.('lost',project,region);
   continue;
  }
  project.cost=quote.cost;
  if(councilSpendable(state)<project.cost)return;
  const steward=council.stewards.get(project.regionId);
  if(project.delegated&&(steward?.policy!=='develop'||steward.budget<project.cost)){
   queue.splice(queue.indexOf(project),1);continue;
  }
  state.gold-=project.cost;
  if(project.delegated)steward.budget-=project.cost;
  project.finishAt=now+COUNCIL_BUILD_SECONDS[project.type];
  return;
 }
}

function setCouncilSteward(state,region,policy,budget){
 if(!state.council||region?.owner!=='you'||!['manual','restore','develop'].includes(policy)||!Number.isSafeInteger(budget)||budget<0)return false;
 if(!canDevelopLand(state,region))return false;
 const {stewards,projects}=state.council;
 const kept=projects.filter(p=>p.regionId!==region.id||!p.delegated||p.finishAt!=null);
 state.council.projects=kept;
 if(policy==='manual')stewards.delete(region.id);
 else stewards.set(region.id,{policy,budget,status:''});
 state.council.nextStewardTick=0;
 return true;
}
function councilAdministration(state){
 const council=state.council,now=state.economy.seconds;
 if(!council.stewards.size||now<(council.nextStewardTick||0))return;
 council.nextStewardTick=now+8;
 const home=councilRegion(state,state.capitalId);
 const shipments=state.economy.shipments;
 let dispatched=0;
 const priorities=[...council.stewards].map(([id,rule])=>({id,rule,region:councilRegion(state,id)}));
 priorities.sort((a,b)=>Number(b.rule.policy==='restore')-Number(a.rule.policy==='restore')||
  (a.region?.control??100)-(b.region?.control??100));
 for(const {id,rule,region} of priorities){
  if(!region){council.stewards.delete(id);continue}
  if(rule.policy==='restore'){
   if(councilSpendable(state)<RELIEF_GOLD){rule.status='Казна защищена резервом';continue}
   const result=councilReliefDelivery(state,region,home,shipments,{gold:rule.budget},dispatched<2);
   rule.status=result.status;
   if(result.ok){rule.budget-=RELIEF_GOLD;state.gold-=RELIEF_GOLD;if(result.dispatched)dispatched++}
   continue;
  }
  if(council.projects.some(p=>p.regionId===id&&p.delegated)){rule.status='Проект в общей очереди';continue}
  const info=regionEconomy(state,region),harvest=info.production.grain;
  const need=granaryFor(state,id)?.need??info.grainNeed;
  const type=harvest+1<need?'grain':info.population>info.housing*.86?'city':null;
  if(!type){rule.status='Зерна и жилья хватает';continue}
  const cost=landDevelopmentPrice(state,TYPES[type].cost,region);
  if(rule.budget<cost){rule.status='Нужен остаток бюджета '+cost+' зл.';continue}
  const result=queueCouncilProject(state,region,type,true);
  rule.status=result.ok?'Проект в общей очереди':result.reason;
 }
}
function councilReliefDelivery(state,region,home,shipments,purse,mayDispatch=true){
 const owner=region?.owner,ledger=factionLedger(state,owner,purse);
 if(!ledger)return {status:'Герцогство недоступно'};
 const inFlight=shipments.filter(s=>s.kind==='granary'&&s.owner===owner&&s.grainPurpose==='relief');
 const pending=inFlight.find(s=>s.grainDestination===region.id);
 if(pending)return {status:pending.supplyBlocked?'Пункт доставки недоступен':pending.routeRisk?'Помощь в пути · риск перехвата':'Помощь в пути'};
 if((region.councilReliefUntil||0)>state.economy.seconds)return {status:'Идёт восстановление'};
 if(ledger.gold<RELIEF_GOLD)return {status:'Нужно '+RELIEF_GOLD+' зл. на помощь'};
 if(!region.occupation&&!moodReport(state,region).food&&(region.control??100)>=76&&moodReport(state,region).value>=0)return {status:'Восстановление пока не требуется'};
 if(!home)return {status:'Нужна столица державы'};
 if(region!==home&&(!mayDispatch||inFlight.length>=8))return {status:'Ожидает свободного обоза помощи'};
 const food=granaryFor(state,home?.id),keep=region.occupation?0:food?.need?Math.ceil(food.need):0;
 if(ledger.stocks.grain<keep+RELIEF_GRAIN)return {status:'Ожидает свободного зерна'};
 const path=home&&region!==home?state.grainRoute?.(home,region):null;
 if(region!==home&&!path)return {status:'Путь снабжения перекрыт'};
 const result=sendRelief(state,region,owner,!!path,purse);
 if(!result.ok)return {status:result.reason};
 if(!path){activateCouncilRelief(state,region);return {ok:true,status:'Зерно выдано жителям'}}
 shipments.push({kind:'granary',owner,originRegion:home.id,grainDestination:region.id,grainPurpose:'relief',
  good:'grain',amount:RELIEF_GRAIN,cargo:{grain:RELIEF_GRAIN},path,mode:path.seaSupply?'sea':'land',seaSupply:path.seaSupply,
  seaStart:path.seaStart,seaEnd:path.seaEnd,elapsed:0,duration:journeyDuration(path)});
 return {ok:true,status:'Помощь в пути',dispatched:true};
}
function activateCouncilRelief(state,region){
 region.reliefUntil=region.councilReliefUntil=state.economy.seconds+RELIEF_DURATION;
 if(region.owner!=='you')return;
 const rule=state.council?.stewards.get(region.id);
 if(rule)rule.status='Идёт восстановление';
 recordCouncilResult(state,region.id,'relief','Помощь жителям доставлена');
 state.onCouncilRelief?.(region);
}
function stepCouncil(state){
 if(!state.council)return;
 councilAdministration(state);
 councilConstruction(state);
}

const EMBASSY_TRUST=30;
const COUNCIL_DIRECTIONS={
 chancellor:{name:'Канцлер',field:'Дипломатия',foreign:true,tasks:{
  relations:{label:'Улучшить отношения',icon:'parley',ongoing:true,free:true,description:'Повышает доверие выбранной державы на 12 каждые 10 игровых дней.'},
  embassy:{label:'Создать посольство',icon:'scroll',free:true,description:'Через 30 дней откроет посольство и добавит 30 доверия. В каждой державе может быть одно посольство.'}}},
 marshal:{name:'Маршал',field:'Военное дело',tasks:{
  stabilize:{label:'Укрепить порядок',icon:'shield',ongoing:true,free:true,description:'Восстанавливает контроль и довольство, снижает волнения и поддерживает войска в герцогстве.'},
  recruit:{label:'Набирать солдат',icon:'swords',description:'Покупает железо и ткани на мировом рынке из бюджета поручения. Затем набирает местных жителей.'},
  supply:{label:'Снабжать войска',icon:'cart',description:'Ускоряет набор и даёт наибольшую скидку на содержание местных войск.'}}},
 steward:{name:'Управляющий',field:'Управление',tasks:{
  build:{label:'Строить здания',icon:'hammer',description:'Строит и улучшает здания в герцогстве. Учитывает жильё, рабочих и окупаемость.'},
  tax:{label:'Повысить доход',icon:'coins',ongoing:true,free:true,description:'Сразу повышает местные налоги на 25% на всё время назначения.'}}},
 spymaster:{name:'Тайный советник',field:'Интриги',foreign:true,tasks:{
  unrest:{label:'Сеять недовольство',icon:'flame',description:'Снижает довольство и подогревает волнения в чужом герцогстве.'},
  disrupt:{label:'Подорвать управление',icon:'eye',description:'Сильнее снижает контроль чужой державы над выбранным городом.'}}}
};
function councilTargetAllowed(state,direction,region,action,owner='you'){
 const role=COUNCIL_DIRECTIONS[direction];
 if(!role||!duchySeat(region))return false;
 if(!role.foreign)return region.owner===owner&&canDevelopLand(state,region);
 if(region.owner===owner||!campaignNationAlive(state,region.owner))return false;
 if(direction!=='chancellor')return true;
 if(!state.campaign||isAtWar(state,owner,region.owner)||action==='embassy'&&campaignEmbassy(state,region.owner,owner))return false;
 if(state.regions.some(r=>r.owner===region.owner&&adjacentToFaction(state,r,owner)))return true;
 const road=owner==='you'?state.factions?.[region.owner]?.path:state.councilDiplomacyRoute?.(owner,region.owner);
 return !!(road?.length>1&&routeLength(road)<=tradeRange(state,owner));
}
function councilTaskRegion(state,task){
 const region=state.regions.find(r=>r.id===task.regionId),owner=task.realm||'you';
 if(region?.owner!==task.owner||!duchySeat(region))return null;
 if(!COUNCIL_DIRECTIONS[task.direction].foreign&&!canDevelopLand(state,region))return null;
 if(task.start==null)return councilTargetAllowed(state,task.direction,region,task.action,owner)?region:null;
 if(COUNCIL_DIRECTIONS[task.direction].foreign&&!campaignNationAlive(state,region.owner))return null;
 return task.direction==='chancellor'&&isAtWar(state,owner,region.owner)?null:region;
}
function startCouncilTask(state,direction,region,rate,action,owner='you'){
 const council=getRealmCouncil(state,owner),role=COUNCIL_DIRECTIONS[direction];
 if(!role||!council)return {ok:false,reason:'Совет недоступен'};
 action??=Object.keys(role.tasks)[0];
 if(!Object.hasOwn(role.tasks,action))return {ok:false,reason:'Выберите поручение советника'};
 const option=role.tasks[action],active=council.monthly[direction];
 const queue=council.taskQueues[direction]||[];
 if(action==='embassy'&&(campaignEmbassy(state,region?.owner,owner)||
  [active,...queue].some(task=>task?.action==='embassy'&&task.owner===region?.owner)))
  return {ok:false,reason:'В этой державе посольство уже открыто или запланировано'};
 if(!councilTargetAllowed(state,direction,region,action,owner))
  return {ok:false,reason:role.foreign?'Выберите доступное иностранное герцогство':'Выберите своё герцогство'};
 if(!option.free&&(!Number.isSafeInteger(rate)||rate<1))return {ok:false,reason:'Укажите бюджет в целых золотых'};
 if(action==='recruit'){
  const minimum=marshalMarketPrice(MARSHAL_RECRUIT_STEP).total;
  if(rate<minimum)return {ok:false,reason:'Для первого отряда нужно ещё '+(minimum-rate)+' зл.'};
 }
 if(!option.free){
  const limit=councilBudgetLimit(state,direction,owner);
  if(rate>limit)return {ok:false,reason:'Свободный регулярный доход для поручения · '+limit+' зл./мин'};
 }
 council.taskQueues[direction]=queue;
 const task={id:council.nextTask=(council.nextTask||0)+1,direction,regionId:region.id,owner:region.owner,realm:owner,rate:option.free?0:rate,action};
 if(active&&Number.isFinite(active.end)){
  queue.push(task);
  return {ok:true,task,queued:true};
 }
 if(active)finishCouncilTask(state,active,'reassigned');
 queue.unshift(task);
 activateNextCouncilTask(state,direction,state.economy.seconds,owner);
 return {ok:true,task,queued:false};
}
function activateNextCouncilTask(state,direction,start,owner='you'){
 const council=getRealmCouncil(state,owner),queue=council.taskQueues[direction];
 while(queue?.length){
  const task=queue.shift(),region=councilTaskRegion(state,task);
  if(!region){
   if(owner==='you')recordCouncilResult(state,task.regionId,'task-skipped:'+direction,'Поручение пропущено · герцогство недоступно');
   continue;
  }
  const option=COUNCIL_DIRECTIONS[direction].tasks[task.action];
  const freeStatus={tax:'Местные налоги +25%',stabilize:'Восстанавливает контроль и довольство',
   relations:'Доверие '+campaignRelation(state,region.owner,owner).trust+' / 100',embassy:'Готовится открытие посольства'};
  Object.assign(task,{start,end:option.ongoing?Infinity:councilMonthEnd(start),gold:0,funded:0,actions:0,lastAction:'',
   status:option.free?freeStatus[task.action]:'Ожидает первых поступлений',
   nextCheck:option.ongoing?start+COUNCIL_DUTY_INTERVAL:start});
  if(option.ongoing)task.supportUntil=Infinity;
  council.monthly[direction]=task;
  return;
 }
}
function editCouncilTaskQueue(state,direction,id,offset){
 const queue=state.council?.taskQueues[direction];
 const index=queue?.findIndex(task=>task.id===id)??-1;
 if(index<0)return false;
 if(!offset){queue.splice(index,1);return true}
 const target=index+offset;
 if(target<0||target>=queue.length)return false;
 const now=state.economy.seconds,before=scheduledCouncilPeak(state,'you',null,now);
 [queue[index],queue[target]]=[queue[target],queue[index]];
 const {taxes,upkeep,reparations}=realmTreasuryReport(state);
 const ceiling=Math.max(before,taxes-upkeep-reparations.outgoing);
 if(scheduledCouncilPeak(state,'you',null,now)>ceiling+1e-8){
  [queue[index],queue[target]]=[queue[target],queue[index]];
  return false;
 }
 return true;
}
function councilMonthEnd(start){return start+30*SECONDS_PER_GAME_DAY;}
function councilTaskLimit(task,at=task.end){
 return task.rate?task.rate*Math.max(0,Math.min(task.end,at)-task.start)/60:0;
}
function finishCouncilTask(state,task,reason){
 const owner=task.realm||'you',{monthly,previousMonthly}=getRealmCouncil(state,owner);
 const region=state.regions.find(r=>r.id===task.regionId);
 const receipt={regionId:task.regionId,city:region?.city,reason,rate:task.rate,action:task.action,
  spent:Math.max(0,task.funded-task.gold),returned:task.gold,actions:task.actions,lastAction:task.lastAction,status:task.status};
 delete monthly[task.direction];
 previousMonthly[task.direction]=receipt;
 factionLedger(state,owner).gold+=task.gold;
 if(owner!=='you')return;
 if(reason==='lost')recordCouncilResult(state,task.regionId,'lost','Поручение закрыто после потери герцогства');
 if(reason==='finished'){
  const direction=COUNCIL_DIRECTIONS[task.direction].name;
  if(!task.actions)recordCouncilResult(state,task.regionId,'task:'+task.direction,direction+' · '+task.status);
  if(task.gold>0)recordCouncilResult(state,task.regionId,'refund:'+task.direction,direction+' · возвращено '+Number(task.gold.toFixed(2))+' зл.');
 }
}
function cancelCouncilTask(state,direction,owner='you'){
 const task=getRealmCouncil(state,owner)?.monthly[direction];
 if(!task)return false;
 finishCouncilTask(state,task,'cancelled');
 activateNextCouncilTask(state,direction,state.economy.seconds,owner);
 return true;
}

function councilTaskUpgrade(state,region,building,purse=null){
 const {cost}=upgradeCheck(state,region,building,purse,region.owner);
 return {kind:'upgrade',building,cost,label:'Улучшение · '+TYPES[building.type].name};
}
function advisorIsWorking(state,direction,region){
 const task=region&&getRealmCouncil(state,region.owner)?.monthly[direction];
 return !!task&&task.regionId===region.id&&task.supportUntil>state.economy.seconds&&task.end>state.economy.seconds?task:null;
}
function councilTaskPlan(state,direction,region,action){
 if(!duchySeat(region))return {status:'Нужен главный город'};
 const task=getRealmCouncil(state,region.owner)?.monthly[direction];
 if(direction==='spymaster')return action==='disrupt'?{kind:'intrigue',cost:20,label:'Подрыв управления',control:15,mood:8,unrest:0}:
  {kind:'intrigue',cost:15,label:'Поддержка недовольных',control:7,mood:14,unrest:12};
 if(direction==='marshal'){
  if(task?.supportUntil>state.economy.seconds)return {status:'Войска получают поддержку'};
  return {kind:'militarySupport',cost:8,label:'Снабжение войск'};
 }
 return {status:'Ожидает строительства'};
}
function councilProductionPath(state,region,site,type,local=false){
 if(state.attachRoute){
  const path=state.attachRoute(region,{...site,type,product:productivity(type,site.terrain)});
  return path||(local?routeWithin(region,site,duchySeat(region)):null);
 }
 const capital=councilRegion(state,realmCapitalId(state,region.owner),region.owner);
 const town=type==='grain'&&state.economy.granaries?region:capital;
 if(town===region)return routeWithin(region,site,duchySeat(region));
 return town&&state.grainRoute?.(region,town);
}
function councilWorkforceGain(region,workforce,candidate,previous,foodPriority=false){
 const planned=workforceReport(region,region.buildings.filter(b=>b!==previous).concat(candidate));
 const newRate=productionRate(region,candidate,planned),oldRate=productionRate(region,previous,workforce);
 let displaced=0;
 for(const job of workforce.byBuilding.values()){
  if(job.building===previous||foodPriority&&job.building.type!=='grain')continue;
  displaced+=job.rate-productionRate(region,job.building,planned);
 }
 return newRate-oldRate-displaced;
}
function councilEconomyPlan(state,region,budget,{income=0,seconds=0,maximum=budget,purse=null}={}){
 const owner=region.owner,capitalId=realmCapitalId(state,owner),council=getRealmCouncil(state,owner);
 const ceiling=Math.min(maximum,budget+income*seconds/60),minimum=landDevelopmentPrice(state,TYPES.grain.cost,region);
 const constructionRoom=COUNCIL_QUEUE_LIMIT-council.projects.length;
 if(ceiling+1e-8<minimum)return {plans:[],status:'По прогнозу средств на вложение пока не хватает'};
 const stocks=factionLedger(state,owner,purse).stocks,national={grain:0,wood:0,iron:0,cloth:0},outputByHub=new Map();
 const local=regionEconomy(state,region);
 if(!region.occupation&&local.housing>0&&local.population>local.housing*.86&&
    !council.projects.some(project=>project.regionId===region.id&&project.type==='city')){
  const site=constructionRoom>0?councilSite(state,region,'city',owner,purse?.vassalId):null;
  const housing=site?.ok?[{kind:'building',type:'city',slot:site.slot,cost:site.cost,label:TYPES.city.name}]:[];
  for(const building of region.buildings){
   if(building.type==='city'&&upgradeCheck(state,region,building,{gold:ceiling+1e-8,vassalId:purse?.vassalId},owner).ok)
    housing.push(councilTaskUpgrade(state,region,building,purse));
  }
  const choice=housing.filter(plan=>plan.cost<=ceiling+1e-8).sort((a,b)=>a.cost-b.cost)[0];
  if(choice){
   const wait=choice.cost<=budget+1e-8?0:(choice.cost-budget)*60/income;
   return wait?{plans:[],target:choice,wait}:{plans:[choice],target:null,wait:0};
  }
 }
 const localWorkforce=workforceReport(region);
 const outlook=state.councilMarketOutlook?.(region,false,!!purse?.vassalId)||new Map();
 function reserveProduction(type,rate,marketId){
  const hub=marketId??capitalId,output=outputByHub.get(hub)||{};
  output[type]=(output[type]||0)+rate;
  outputByHub.set(hub,output);national[type]+=rate;
 }
 for(const land of state.regions){
  if(land.owner!==owner||purse?.vassalId&&land.vassalId!==purse.vassalId)continue;
  const workforce=land===region?localWorkforce:workforceReport(land);
  for(const building of land.buildings){
   if(building.product&&building.route?.length)
    reserveProduction(building.type,productionRate(land,building,workforce),building.route.marketId);
  }
 }
 for(const project of council.projects){
  if(project.finishAt==null||!GOODS.includes(project.type)||purse?.vassalId&&project.vassalId!==purse.vassalId)continue;
  const land=councilRegion(state,project.regionId,owner),slot=land?.slots.find(s=>s.id===project.slotId);
  if(!slot)continue;
  const projected={type:project.type,product:productivity(project.type,slot.terrain)};
  const rate=productionRate(land,projected,workforceReport(land,[...land.buildings,projected]));
  reserveProduction(project.type,rate,project.marketId);
  if(land===region)local.production[project.type]+=rate;
 }
 const targets={wood:32,iron:24,cloth:18};
 const internal={
  grain:(granaryFor(state,region.id)?.need??local.grainNeed)*1.15/localGrainShare(region),
  ...Object.fromEntries(MARKET_GOODS.map(g=>[g,Math.max(0,(targets[g]-(stocks[g]||0))/2)]))
 };
 const options=[];
 if(constructionRoom>0)for(const slot of region.slots){
  if(!buildingSiteCheck(state,'grain',slot.x,slot.z,null,owner,purse?.vassalId).ok)continue;
  const goodsRoute=councilProductionPath(state,region,slot,'wood',!!purse?.vassalId);
  for(const type of GOODS){
   const path=type==='grain'?councilProductionPath(state,region,slot,type,!!purse?.vassalId):goodsRoute;
   if(!path?.length)continue;
   const candidate={type,product:productivity(type,slot.terrain)};
   const rate=councilWorkforceGain(region,localWorkforce,candidate);
   if(rate>0)options.push({kind:'building',type,slot,path,cost:landDevelopmentPrice(state,TYPES[type].cost,region),label:TYPES[type].name,rate,workers:buildingJobs(candidate)});
  }
 }
 for(const building of region.buildings){
  if(!building.product||!building.route?.length||!GOODS.includes(building.type))continue;
  const check=upgradeCheck(state,region,building,{gold:ceiling+1e-8,vassalId:purse?.vassalId},owner);
  if(!check.ok)continue;
  const candidate={...building,level:check.level+1,product:{rate:check.nextRate}};
  const rate=councilWorkforceGain(region,localWorkforce,candidate,building);
  if(rate>0)options.push({...councilTaskUpgrade(state,region,building,purse),type:building.type,path:building.route,
   rate,workers:buildingJobs(candidate)-buildingJobs(building)});
 }
 // Compare infrastructure against productive work, using spare goods and proven routes.
 const policies=purse?.vassalId?{grainPolicy:'trade'}:owner==='you'?state.economy:state.factions[owner];
 const surplus=Object.fromEntries(GOODS.map(g=>[
  g,(g==='grain'?policies.grainPolicy!=='trade':policies.exportPolicy?.[g]==='hold')?0:
   Math.max(0,(g==='grain'?national[g]-local.grainNeed:national[g]-internal[g])+((stocks[g]||0)-(TRADE_RESERVE[g]||0))/4)
 ]));
 const evaluateHub=book=>GOODS.reduce((n,g)=>n+Math.min(surplus[g],book?.[g]?.units||0)*(book?.[g]?.price||0),0);
 if(constructionRoom>0&&ceiling+1e-8>=landDevelopmentPrice(state,TYPES.port.cost,region)){
  const berth=councilSite(state,region,'port',owner,purse?.vassalId);
  if(berth.ok&&Object.values(surplus).some(n=>n>=8)){
   const harbor=state.councilPortOutlook?.(region,berth.slot,!!purse?.vassalId);
   if(harbor){
    const present=evaluateHub(outlook.get(capitalId)),potential=evaluateHub(harbor);
    const benefit=.50*Math.max(0,potential-present)+.13*potential;
    if(benefit>0)options.push({kind:'building',type:'port',slot:berth.slot,cost:berth.cost,label:TYPES.port.name,benefit});
   }
  }
 }
 if(marketCheck(state,region,{gold:ceiling+1e-8,stocks,vassalId:purse?.vassalId},owner).ok&&MARKET_GOODS.some(g=>local.production[g]>=8)){
  const market=state.councilMarketOutlook?.(region,true,!!purse?.vassalId)?.get(region.id);
  const localValue=MARKET_GOODS.reduce((n,g)=>n+Math.min(local.production[g],market?.[g]?.units||0)*(market?.[g]?.price||0),0);
  const present=evaluateHub(outlook.get(capitalId));
  if(localValue>0)options.push({kind:'market',cost:landDevelopmentPrice(state,MARKET_COST.gold,region),label:'Торговый центр',benefit:localValue*(present>0?.24:.64)});
 }
 // Compare doing one job now, saving for a larger one, and the best compatible follow-up.
 const horizon=seconds+180;
 const waitFor=cost=>cost<=budget+1e-8?0:income>0?(cost-budget)*60/income:Infinity;
 function value(option,wait,first=null){
  const {type,path,rate,cost,benefit}=option;
  let gain=benefit||0;
  if(rate>0){
   const isGrain=type==='grain',added=first?.type===type?(first.rate||0):0;
   const inRegion=local.production[type]+added;
   const domestic=Math.min(rate,Math.max(0,internal[type]-(isGrain?inRegion:national[type]+added)));
   const hub=path.marketId??capitalId,book=outlook.get(hub)?.[type];
   const atCapital=hub===capitalId,storage=atCapital?stocks:tradeCenter(state,hub,owner)?.market.stocks;
   const excess=Math.max(0,(storage?.[type]||0)-(TRADE_RESERVE[type]||0));
   const firstAtHub=first?.path&&(first.path.marketId??capitalId)===hub?added:0;
   const alreadySupplied=Math.max(0,(outputByHub.get(hub)?.[type]||0)+firstAtHub-(atCapital?internal[type]:0));
   const exportable=Math.max(0,Math.min(rate-domestic,(book?.units||0)-alreadySupplied-excess/5));
   const travel=1/(1+journeyDuration(path)/90);
   gain=(domestic*(isGrain?9:TRADE_PRICE[type])+exportable*(book?.price||0))*travel/(1+inRegion/42);
  }else if(first&&!first.rate)gain*=.45;
  const work=option.kind==='building'?COUNCIL_BUILD_SECONDS[type]:option.kind==='market'?MARKET_BUILD_SECONDS:0;
  return gain*Math.max(0,horizon-wait-work)/60-cost;
 }
 const eligible=options.filter(option=>option.cost<=ceiling+1e-8);
 const ranked=eligible.map(option=>({option,wait:waitFor(option.cost)}))
  .map(entry=>({...entry,profit:value(entry.option,entry.wait)}))
  .filter(entry=>entry.profit>0).sort((a,b)=>b.profit-a.profit);
 let best=null;
 for(const first of ranked.slice(0,16)){
  let follow=null,followValue=0,wait=0;
  for(const second of eligible){
   if(first.option===second||first.option.slot&&first.option.slot===second.slot)continue;
   if(first.option.slot&&second.slot&&constructionRoom<2)continue;
   if(first.option.workers&&second.workers&&first.option.workers+second.workers>localWorkforce.available-localWorkforce.capacity)continue;
   const cost=first.option.cost+second.cost;
   if(cost>ceiling+1e-8)continue;
   const delay=waitFor(cost),gain=value(second,delay,first.option);
   if(gain>followValue){follow=second;followValue=gain;wait=delay}
  }
  const projected=first.profit+followValue;
  if(!best||projected>best.projected+1e-8)
   best={first,follow,followWait:wait,projected};
 }
 if(!best)return {plans:[],status:'Подходящих вложений при текущем спросе и путях нет'};
 const plans=[];
 if(best.first.wait>1e-8)return {plans,target:best.first.option,wait:best.first.wait};
 plans.push(best.first.option);
 if(best.follow&&!best.followWait)plans.push(best.follow);
 const target=best.followWait>0?best.follow:null;
 return {plans,target,wait:best.followWait};
}

function executeCouncilTask(state,task,region,finalCheck=false){
 task.nextCheck=state.economy.seconds+SECONDS_PER_GAME_DAY;
 task.targetCost=null;
 const owner=task.realm||'you',projects=getRealmCouncil(state,owner).projects;
 if(task.direction==='marshal'&&task.action==='recruit'){executeMarshalRecruiting(state,task,region,owner,finalCheck);return}
 if(task.direction==='steward'&&task.action==='build'){
  const {plans,target,wait,status}=councilEconomyPlan(state,region,task.gold,councilInvestmentForecast(state,task));
  for(const plan of plans)if(!performCouncilAction(state,task,region,plan))return;
  const running=projects.filter(p=>p.monthly===task.id);
  if(target){
   task.targetCost=target.cost;
   task.status='Копит на следующий проект · '+target.label+' · '+target.cost+' зл. · примерно '+Math.max(1,Math.ceil(wait/SECONDS_PER_GAME_DAY))+' дн.';
  }else if(running.length)task.status='В работе · '+running.map(p=>TYPES[p.type].name.toLowerCase()).join(', ');
  else if(!plans.length)task.status=status;
  return;
 }
 const plan=councilTaskPlan(state,task.direction,region,task.action);
 if(!plan.kind){task.status=plan.status;return;}
 if(task.gold+1e-8<plan.cost){task.targetCost=plan.cost;task.status=plan.label+' · не хватает '+Math.ceil(plan.cost-task.gold)+' зл.';return}
 performCouncilAction(state,task,region,plan);
}
function executeMarshalRecruiting(state,task,region,owner,finalCheck){
 const minimum=marshalMarketPrice(MARSHAL_RECRUIT_STEP).total;
 while(true){
  const site=recruitSiteCheck(state,region,owner,MARSHAL_RECRUIT_STEP);
  if(!site.ok){task.status=site.reason;return}
  const remaining=finalCheck?task.gold:task.gold+Math.max(0,councilTaskLimit(task)-task.funded);
  const troops=marshalAffordableTroops(remaining,site.residents);
  if(!troops){task.status='На минимальный набор нужно '+minimum+' зл. · не хватает '+Math.ceil(Math.max(0,minimum-task.gold))+' зл.';return}
  const quote=marshalMarketPrice(troops);
  if(task.gold+1e-8<quote.total){
   task.targetCost=quote.total;
   task.status='Копит на набор '+troops+' солдат · не хватает '+Math.ceil(quote.total-task.gold)+' зл.';
   return;
  }
  const {ok,order,reason}=recruitGarrison(state,region,owner,task,{troops,market:true});
  if(!ok){task.status=reason;return}
  if(task.gold<0&&task.gold>-1e-8)task.gold=0;
  order.councilTask=task.id;
  task.supportUntil=task.end;
  task.actions++;
  task.recruited=(task.recruited||0)+order.troops;
  task.lastAction='Начат набор '+task.recruited+' солдат · последний отряд '+order.troops;
  task.status='Куплено '+quote.iron+' железа и '+quote.cloth+' тканей за '+quote.materials+' зл.';
  if(task.gold+1e-8<minimum)return;
 }
}
function performCouncilAction(state,task,region,plan){
 if(task.gold<plan.cost)task.gold=plan.cost; // Allow fractional accumulation at the exact price.
 const owner=task.realm||'you';
 let result;
 switch(plan.kind){
  case 'militarySupport':
   task.gold-=plan.cost;task.supportUntil=task.end;
   task.nextCheck=state.economy.seconds+COUNCIL_DUTY_INTERVAL;result={ok:true};break;
  case 'intrigue':
   task.gold-=plan.cost;
   region.control=Math.max(0,(region.control??100)-plan.control);
   region.sabotageControl=Math.min(25,Math.max(region.sabotageControl||0,plan.control)*1.35);
   region.sabotageUntil=state.economy.seconds+20*SECONDS_PER_GAME_DAY;
   region.mood=Math.max(-100,(region.mood??20)-plan.mood);
   if(plan.unrest&&(region.unrest||0)<95)region.unrest=Math.min(95,(region.unrest||0)+plan.unrest);
   task.nextCheck=state.economy.seconds+10*SECONDS_PER_GAME_DAY;result={ok:true};break;
  case 'market':result=commissionMarket(state,region,task,owner);break;
  case 'upgrade':result=upgradeBuilding(state,region,plan.building,task,owner);break;
  case 'building':
   result=queueCouncilProject(state,region,plan.type,false,plan.slot,owner,task.vassalId);
   if(result.ok){
    task.gold-=result.project.cost;
    result.project.monthly=task.id;
    result.project.marketId=plan.path?.marketId;
    result.project.finishAt=state.economy.seconds+COUNCIL_BUILD_SECONDS[plan.type];
   }
   break;
 }
 if(!result?.ok){task.status=result?.reason||result?.status||'Ожидает выполнения';return false}
 task.actions++;
 task.lastAction=plan.label;
 task.status=result.status||plan.label;
 if(plan.kind==='upgrade'){
  if(owner==='you'&&!task.vassalId)recordCouncilResult(state,region.id,'upgrade:'+plan.building.type,'Улучшение · '+TYPES[plan.building.type].name+' (ур. '+plan.building.level+')');
  state.onCouncilUpgrade?.(plan.building,owner);
 }
 return true;
}

function addDiplomaticTrust(state,other,amount,owner='you'){
 const relation=campaignRelation(state,other,owner),trust=Math.min(100,relation.trust+amount);
 state.campaign.relations.set(warKey(owner,other),{...relation,trust});
 return trust;
}
function advanceCouncilDuty(state,task,region,now){
 if(task.action==='tax'||now<task.nextCheck)return;
 const checks=1+Math.floor((now-task.nextCheck)/COUNCIL_DUTY_INTERVAL);
 task.nextCheck+=checks*COUNCIL_DUTY_INTERVAL;
 const boost=12*checks;
 if(task.action==='relations'){
  task.status='Доверие '+addDiplomaticTrust(state,region.owner,boost,task.realm)+' / 100';
 }else if(task.action==='stabilize'){
  region.control=Math.min(100,(region.control??100)+boost);
  region.mood=Math.min(100,(region.mood??20)+boost);
  region.unrest=Math.max(0,(region.unrest||0)-boost);
 }
}
function openCouncilEmbassy(state,task,region){
 if(!region)return;
 const owner=task.realm||'you';
 (state.campaign.embassies??=new Map()).set(owner+'>'+region.owner,region.id);
 const trust=addDiplomaticTrust(state,region.owner,EMBASSY_TRUST,owner);
 task.actions++;
 task.status='Доверие '+trust+' / 100';
 if(owner!=='you')return;
 recordCouncilResult(state,region.id,'embassy','Посольство открыто · доверие '+trust+' / 100');
 pushNotification(state,{kind:'diplomacy',title:'Посольство открыто',body:region.city+' · доверие '+trust+' / 100',regionId:region.id});
}
function creditCouncilIncome(state,at,maximum=Infinity,owner='you'){
 const tasks=Object.values(getRealmCouncil(state,owner)?.monthly||{}).filter(task=>task.rate>0);
 const accrued=tasks.map(task=>Math.max(0,councilTaskLimit(task,at)-task.funded));
 const total=accrued.reduce((sum,amount)=>sum+amount,0);
 if(!total||maximum<=0)return 0;
 const ledger=factionLedger(state,owner),paid=Math.min(total,maximum,Math.max(0,ledger.gold)),share=paid/total;
 for(const [index,task] of tasks.entries()){
  const amount=accrued[index]*share;
  task.funded+=amount;task.gold+=amount;
 }
 ledger.gold=Math.max(0,ledger.gold-paid);
 return paid;
}
function stepCouncilTasks(state,dt=0,owner='you'){
 const council=getRealmCouncil(state,owner),payroll={due:0,unpaid:0};
 if(!council)return payroll;
 const now=state.economy.seconds;
 for(const task of Object.values(council.monthly)){
  if(councilTaskRegion(state,task))continue;
  finishCouncilTask(state,task,'lost');
  activateNextCouncilTask(state,task.direction,now,owner);
 }
 let cursor=now-dt;
 while(Object.keys(council.monthly).length){
  const tasks=Object.values(council.monthly);
  const at=Math.min(now,Math.max(cursor,Math.min(...tasks.map(task=>task.end))));
  const due=tasks.reduce((sum,task)=>sum+councilTaskLimit(task,at)-councilTaskLimit(task,cursor),0);
  const paid=creditCouncilIncome(state,at,Infinity,owner);
  payroll.due+=due;payroll.unpaid+=Math.max(0,due-paid);
  for(const task of tasks){
   if(task.end>at)continue;
   if(task.action==='embassy')openCouncilEmbassy(state,task,councilTaskRegion(state,task));
   else if(task.gold>0&&(task.action==='recruit'||task.end===now&&(now>=task.nextCheck||task.targetCost&&task.gold+1e-8>=task.targetCost)))
    executeCouncilTask(state,task,councilTaskRegion(state,task),true);
   finishCouncilTask(state,task,'finished');
   activateNextCouncilTask(state,task.direction,task.end,owner);
  }
  if(at>=now)break;
  cursor=at;
 }
 for(const task of Object.values(council.monthly)){
  if(task.end===Infinity)advanceCouncilDuty(state,task,councilTaskRegion(state,task),now);
  else if((now>=task.nextCheck&&task.gold>0)||(task.targetCost&&task.gold+1e-8>=task.targetCost))
   executeCouncilTask(state,task,councilTaskRegion(state,task));
 }
 return payroll;
}
function councilInvestmentForecast(state,task){
 const now=state.economy.seconds,seconds=Math.max(0,task.end-now);
 const owner=task.realm||'you';
 const peers=Object.values(getRealmCouncil(state,owner).monthly).filter(other=>other.direction!==task.direction&&other.end>now);
 const sales=state.campaign?.trades?.get(owner)||[];
 const recentSales=sales.filter(sale=>sale.time>now-90).reduce((sum,sale)=>sum+sale.value,0);
 const {taxes,upkeep,reparations}=realmTreasuryReport(state,owner);
 const net=taxes-upkeep-reparations.outgoing+recentSales*60/90;
 const total=peers.reduce((sum,other)=>sum+other.rate,task.rate);
 const income=task.rate*Math.min(1,Math.max(0,net+factionLedger(state,owner).gold*60/Math.max(1,seconds))/total);
 const maximum=task.gold+Math.max(0,councilTaskLimit(task)-task.funded);
 return {seconds,income,maximum};
}

const COUNCIL_BUILT_LABELS={city:'Построен город',port:'Открыт порт',grain:'Построена ферма',wood:'Открыта лесопилка',iron:'Открыт рудник',cloth:'Открыта ткацкая'};
const COUNCIL_REPORT_MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
function recordCouncilResult(state,regionId,kind,label,amount=1){
 if(!state.council)return;
 const date=gameDate(state.economy.seconds),key=date.year*12+date.month;
 const months=state.council.reportMonths??=new Map();
 if(!months.has(key))months.set(key,new Map());
 const bucket=months.get(key),entryKey=regionId+':'+kind;
 const previous=bucket.get(entryKey);
 bucket.set(entryKey,{regionId,kind,label,amount:(previous?.amount||0)+amount});
}
function flushCouncilReports(state){
 const months=state.council?.reportMonths;
 if(!months?.size)return;
 const date=gameDate(state.economy.seconds),current=date.year*12+date.month;
 for(const [month,bucket] of months){
  if(month>=current)continue;
  months.delete(month);
  const entries=[...bucket.values()].map(({regionId,kind,label,amount})=>({
   regionId,city:state.regions.find(r=>r.id===regionId)?.city,
   text:kind==='recruits'?'Набрано '+amount+' солдат':label+(amount>1?' ×'+amount:'')
  }));
  const year=Math.floor(month/12),index=month%12;
  const title=globalThis.gameI18n?.month(year,index)??(COUNCIL_REPORT_MONTHS[index]+' '+year+' г.');
  const body=entries.slice(0,2).map(entry=>entry.city+' · '+entry.text).join(' • ')+
   (entries.length>2?' · ещё '+(entries.length-2):'');
  pushNotification(state,{kind:'council',title:'Отчёт Совета · '+title,body,regionId:entries[0].regionId,report:{title,entries}});
 }
}
// A bounded, game-local history of important events; never auto-deletes unread first.
function pushNotification(state,event){state.notifications??=[];let note={id:state.nextNotificationId=(state.nextNotificationId||0)+1,kind:event.kind||'info',title:event.title||'',body:event.body||'',regionId:event.regionId??null,point:event.point?{x:event.point.x,z:event.point.z}:null,time:state.economy?.seconds||0,read:false};if(event.report)note.report=event.report;state.notifications.unshift(note);if(state.notifications.length>80){let index=state.notifications.findLastIndex(n=>n.read);state.notifications.splice(index<0?state.notifications.length-1:index,1)}state.onNotification?.(note);return note}
function markNotification(state,id){let note=(state.notifications||[]).find(n=>n.id===id);if(note)note.read=true;return !!note}
// Single-player prototype economy. Goods are paid into capital only on arrival.
const GOODS=['grain','wood','iron','cloth'], MIN_TRADE_CARGO=10, DISPATCH_SECONDS=8, TRADE_RESERVE={grain:18,wood:8,iron:6,cloth:6}, TRADE_PRICE={grain:3,wood:6,iron:7,cloth:6};
const SECONDS_PER_GAME_DAY=2, GAME_EPOCH=Date.UTC(1619,0,1), DAY_MS=86400000;
const COUNCIL_DUTY_INTERVAL=10*SECONDS_PER_GAME_DAY;
function gameDate(seconds){let days=Math.floor(Math.max(0,seconds||0)/SECONDS_PER_GAME_DAY),date=new Date(GAME_EPOCH+days*DAY_MS);return {day:date.getUTCDate(),month:date.getUTCMonth(),year:date.getUTCFullYear()}}
// Campaign progress uses delivered cargo, current ownership and active treaties.
const CAMPAIGN_PATHS = ['trade','military','diplomacy'];
const CAMPAIGN_TRADE_WINDOW=240, CAMPAIGN_MARKET_WINDOW=90;
const CAMPAIGN_MONTH=30*SECONDS_PER_GAME_DAY, ECONOMIC_SHARE=.51;
const EMBARGO_DURATION=60, EMBARGO_COOLDOWN=300;
const ENVOY_COST=35, ENVOY_DELAY=45, ALLIANCE_TRUST=60, HARBOR_CHARTER_COST=60;

function initializeCampaign(state,map){
 const founders=Object.entries(state.factions).filter(([,faction])=>!faction.isRebel&&!faction.defeated);
 const rivals=founders.length;
 // Snapshot the original seats once. Transfers only change the active capital.
 const startingCapitals=new Map([[state.capitalId,'you'],...founders.map(([owner,faction])=>[faction.regionId,owner])]
  .filter(([id])=>id!=null));
 const mediterranean=map==='mediterranean';
 const partners=Math.min(3,rivals),marketScale=.22+.26*partners;
 const baseIncome=mediterranean?270:220;
 state.campaign={
  rules:{partners,baseIncome,
   turnover:Math.round((mediterranean?3900:3000)*marketScale),repeatSales:2,
   stability:72,
   allies:rivals>=3?2:1,tradeHold:180,tradeGrace:30,diplomaticHold:195,allianceAge:60,diplomaticCapitalLevel:2,minTime:180},
  startingCapitals,
  trades:new Map(), turnover:new Map(), relations:new Map(), embassies:new Map(), pacts:new Map(),
  holds:new Map(), progress:new Map(), monthlyIncome:new Map(), embargoes:new Map(), counterEmbargoes:new Map(),
  pressure:null, result:null, exploring:false, charter:null
 };
 updateCampaign(state,0);
}
const CAMPAIGN_RECAP_SECONDS=25;
function initializeCampaignRecap(state,setup){
 const owners=new Map(state.regions.map(region=>[region.id,region.owner]));
 const city=state.regions.find(region=>region.id===setup.capitalId);
 state.campaign.recap={setup,owners,latestOwners:new Map(owners),changes:[],deliveries:[],
  first:{kind:'start',time:0,regionId:city.id,title:'Заложена столица',detail:city.city},
  moments:new Map(),everHadPort:state.regions.some(r=>r.owner==='you'&&r.buildings.some(b=>b.type==='port'))};
}
function recordRecapMoment(state,kind,details){
 const recap=state.campaign?.recap;
 if(!recap||recap.outcome)return;
 const previous=recap.moments.get(kind);
 if(previous&&(details.size==null?previous.weight>=details.weight:previous.size>=details.size))return;
 recap.moments.set(kind,{kind,time:state.economy.seconds,...details});
}
function recordRecapTerritory(state,region,previous){
 const recap=state.campaign?.recap;
 if(!recap||recap.outcome||recap.latestOwners.get(region.id)===region.owner)return;
 recap.latestOwners.set(region.id,region.owner);
 recap.changes.push({time:state.economy.seconds,regionId:region.id,owner:region.owner});
 const port=region.buildings.some(b=>b.type==='port');
 if(region.owner==='you'){
  if(previous==='neutral')recordRecapMoment(state,'expansion',{regionId:region.id,title:'Герцогство присоединилось',detail:region.city,weight:56});
  if(port)recordRecapPort(state,region);
 }else if(previous==='you'){
  recordRecapMoment(state,'loss',{regionId:region.id,title:port?'Потерян порт':'Потеряно герцогство',detail:region.city,weight:port?86:68});
 }
}
function recordRecapPort(state,region){
 const recap=state.campaign?.recap;
 if(!recap||recap.outcome||recap.everHadPort)return;
 recap.everHadPort=true;
 recordRecapMoment(state,'port',{regionId:region.id,title:'Выход к морю',detail:region.city,weight:72});
}
function recordRecapDelivery(state,ship){
 const recap=state.campaign?.recap;
 if(!recap||recap.outcome||ship.path?.length<2||!(ship.value>0))return;
 const destination=ship.destinationRegionId??ship.destinationPortRegionId??realmCapitalId(state,ship.buyer);
 const origin=ship.marketId??ship.departureRegionId??ship.departureCapitalId??state.capitalId,value=ship.realmRevenue??ship.value;
 const region=state.regions.find(r=>r.id===destination),mode=ship.mode==='sea'?'sea':'land';
 const key=[mode,origin,ship.portKey,destination].join(':');
 const paths=[...(ship.recapTraveled||[]),ship.path];
 const time=state.economy.seconds;
 recap.deliveries.push({key,time,value,mode,paths});
 const detail=(region?.city?region.city+' · ':'')+Math.round(value)+' зл.';
 recordRecapMoment(state,mode==='sea'?'sea-trade':'first-trade',{regionId:destination,
  title:mode==='sea'?'Первый морской рейс':'Первая торговая поставка',detail,weight:mode==='sea'?82:47});
 recordRecapMoment(state,'large-trade',{regionId:destination,title:'Крупнейшая поставка',detail,
  weight:50+Math.min(15,value/30),size:value});
}
function finishCampaignRecap(state,result,title){
 const recap=state.campaign?.recap;
 if(!recap||recap.outcome)return recap;
 for(const region of state.regions)recordRecapTerritory(state,region,recap.latestOwners.get(region.id));
 const ranked=[...recap.moments.values()].sort((a,b)=>b.weight-a.weight);
 const last=ranked.find(moment=>moment.time===result.time);
 const end={kind:'end',time:result.time,regionId:result.regionId??last?.regionId??state.capitalId,
  point:last?.point,title,detail:last?.detail||''};
 const candidates=ranked.filter(m=>m.time>0&&m.time<end.time);
 const moments=[];
 const gap=Math.max(1,Math.min(22,end.time*.07));
 for(const moment of candidates){
  if(moments.length>=3)break;
  if(moments.some(selected=>Math.abs(selected.time-moment.time)<gap))continue;
  moments.push(moment);
 }
 recap.highlights=[recap.first,...moments.sort((a,b)=>a.time-b.time),end];
 recap.outcome={...result,title};
 return recap;
}
function campaignRecapFrame(recap,time){
 const owners=new Map(recap.owners),recent=new Map();
 const glowWindow=Math.max(.5,(recap.outcome?.time||0)*.75/CAMPAIGN_RECAP_SECONDS);
 for(const change of recap.changes){
  if(change.time>time)break;
  owners.set(change.regionId,change.owner);
  const glow=1-(time-change.time)/glowWindow;
  if(glow>0)recent.set(change.regionId,glow);
 }
 const routes=new Map();
 let revenue=0;
 for(const sale of recap.deliveries){
  if(sale.time>time)break;
  revenue+=sale.value;
  if(time-sale.time>CAMPAIGN_TRADE_WINDOW)continue;
  const previous=routes.get(sale.key);
  routes.set(sale.key,{...sale,value:sale.value+(previous?.value||0)});
 }
 const busy=[...routes.values()].sort((a,b)=>b.value-a.value).slice(0,5);
 return {owners,recent,routes:busy,revenue,lands:[...owners.values()].filter(owner=>owner==='you').length};
}
function campaignNationAlive(state,owner){
 return owner==='you'?state.started&&!state.defeated:tradePartnerAlive(state,owner);
}
function recordCampaignIncome(state,owner,amount){
 const campaign=state.campaign,income=campaign?.monthlyIncome;
 if(!income||campaign.result||!Number.isFinite(amount)||amount===0)return;
 const time=state.economy.seconds;
 const entries=income.get(owner)||[];
 if(entries.at(-1)?.time===time)entries.at(-1).amount+=amount;
 else entries.push({time,amount});
 income.set(owner,entries);
}
function campaignMonthlyIncome(state,owner){
 const entries=state.campaign.monthlyIncome.get(owner);
 if(!entries)return 0;
 const cutoff=state.economy.seconds-CAMPAIGN_MONTH;
 const first=entries.findIndex(entry=>entry.time>cutoff);
 if(first<0){entries.length=0;return 0;}
 if(first>0)entries.splice(0,first);
 return entries.reduce((total,entry)=>total+entry.amount,0);
}
function recordCampaignTrade(state,seller,buyer,value){
 const c=state.campaign;
 if(!c||seller===buyer||!(value>0))return;
 const now=state.economy.seconds;
 const sales=c.trades.get(seller)||[];
 sales.push({buyer,time:now,value});
 c.trades.set(seller,sales);
 const turnover=c.turnover??=new Map();
 turnover.set(seller,(turnover.get(seller)||0)+value);
 recordCampaignIncome(state,seller,value);
 const pair=warKey(seller,buyer),relation=c.relations.get(pair)||{trust:0,next:0};
 relation.trust=Math.min(100,relation.trust+12);
 c.relations.set(pair,relation);
}
function marketCompetition(state,buyer,seller){
 // Lock the negotiated price at dispatch. Existing deliveries and other sellers
 // in transit compete for a finite share of the next contract.
 const c=state.campaign;
 if(!c?.counterMarkets?.has(buyer))return 1;
 const now=state.economy.seconds;
 let rivals=0;
 for(const [owner,sales] of c.trades){
  if(owner!==seller&&sales.some(s=>s.buyer===buyer&&now-s.time<=CAMPAIGN_MARKET_WINDOW))rivals++;
 }
 return Math.max(.70,1-.10*rivals);
}
function campaignRelation(state,other,owner='you'){
 return state.campaign?.relations.get(warKey(owner,other))||{trust:0,next:0};
}
function campaignEmbassy(state,other,owner='you'){
 const regionId=state.campaign?.embassies?.get(owner+'>'+other);
 return regionId==null?null:state.regions.find(region=>region.id===regionId&&region.owner===other)||null;
}
function campaignFrontiers(state){
 const byId=new Map(state.regions.map(region=>[region.id,region]));
 const living=new Set(state.started&&!state.defeated?['you']:[]);
 for(const [owner,faction] of Object.entries(state.factions||{})){
  const seat=byId.get(faction.regionId);
  if(!faction.defeated&&!faction.isRebel&&seat?.owner===owner&&seat.buildings?.some(building=>building.type==='city'))living.add(owner);
 }
 const neighbors=new Map([...living].map(owner=>[owner,new Set()]));
 for(const region of state.regions){
  if(!living.has(region.owner))continue;
  for(const id of region.adj||[]){
   const other=byId.get(id)?.owner;
   if(other===region.owner||!living.has(other))continue;
   neighbors.get(region.owner).add(other);
   neighbors.get(other).add(region.owner);
  }
 }
 return neighbors;
}
function regionalPactHasFrontier(frontiers,a,b,against){
 return a!==against&&b!==against&&!!frontiers.get(a)?.has(b)&&frontiers.get(a).has(against)&&!!frontiers.get(b)?.has(against);
}
function campaignAllies(state,owner){
 return [...(state.campaign?.pacts.values()||[])]
  .filter(p=>(p.a===owner||p.b===owner)&&!isAtWar(state,p.a,p.b))
  .map(p=>p.a===owner?p.b:p.a)
  .filter(partner=>campaignNationAlive(state,partner));
}
function campaignPortCharter(state,owner='you'){
 const charter=owner==='you'?state.campaign?.charter:state.factions?.[owner]?.charter;
 if(!charter||!campaignAllies(state,owner).includes(charter.owner))return null;
 const region=state.regions.find(r=>r.id===charter.regionId&&r.owner===charter.owner);
 const port=region?.buildings.find(b=>b.type==='port'&&b.slotId===charter.slotId);
 return port?{...charter,region,port}:null;
}
function envoyCheck(state,other){
 const c=state.campaign,relation=campaignRelation(state,other);
 if(!c||!campaignNationAlive(state,other)||other==='you'||isAtWar(state,'you',other))return {ok:false,reason:'Посланник недоступен'};
 if(campaignAllies(state,'you').includes(other))return {ok:false,reason:'Союз уже заключён'};
 if(relation.trust>=ALLIANCE_TRUST)return {ok:false,reason:'Поддержки хватает для союза'};
 const waiting=Math.ceil(relation.next-state.economy.seconds);
 if(waiting>0)return {ok:false,reason:'Следующий посланник через '+waiting+' сек.'};
 if(state.gold<ENVOY_COST)return {ok:false,reason:'Нужно '+ENVOY_COST+' золота'};
 return {ok:true};
}
function sendCampaignEnvoy(state,other){
 const check=envoyCheck(state,other);
 if(!check.ok)return check;
 const pair=warKey('you',other),relation=campaignRelation(state,other);
 state.gold-=ENVOY_COST;
 state.campaign.relations.set(pair,{trust:Math.min(100,relation.trust+30),next:state.economy.seconds+ENVOY_DELAY});
 return {ok:true};
}
function campaignAllianceCheck(state,a,b,coalitionAgainst=null,frontiers=campaignFrontiers(state)){
 const c=state.campaign;
 if(!c||a===b||!campaignNationAlive(state,a)||!campaignNationAlive(state,b)||isAtWar(state,a,b))
  return {ok:false,reason:'Союз недоступен'};
 if(c.pacts.has(warKey(a,b)))return {ok:false,reason:'Союз уже заключён'};
 if(!frontiers.get(a)?.has(b))return {ok:false,reason:'Для союза нужна общая граница'};
 const enemies=owner=>Object.keys(state.wars||{}).filter(key=>key.split('|').includes(owner)).map(key=>key.split('|').find(id=>id!==owner));
 if(enemies(a).some(e=>campaignAllies(state,b).includes(e))||enemies(b).some(e=>campaignAllies(state,a).includes(e)))
  return {ok:false,reason:'У державы есть союз с вашим противником'};
 if(coalitionAgainst){
  if(!regionalPactHasFrontier(frontiers,a,b,coalitionAgainst)||campaignAllies(state,a).includes(coalitionAgainst)||campaignAllies(state,b).includes(coalitionAgainst))
   return {ok:false,reason:'Нужен общий соперник на границе'};
  if([...c.pacts.values()].some(p=>p.against&&[p.a,p.b].some(owner=>owner===a||owner===b)))
   return {ok:false,reason:'Держава уже участвует в региональном союзе'};
  return {ok:true};
 }
 if(a!=='you'&&b!=='you')return {ok:false,reason:'Нужен общий соперник на границе'};
 if(campaignRelation(state,b,a).trust<ALLIANCE_TRUST)return {ok:false,reason:'Нужно '+ALLIANCE_TRUST+' доверия'};
 const partner=a==='you'?b:a;
 if(a==='you'||b==='you'){
  const blocks=[...c.pacts.values()].some(p=>p.against==='you'&&(p.a===partner||p.b===partner));
  if(blocks)return {ok:false,reason:'Держава входит в оборонительный союз против вас'};
 }
 return {ok:true};
}
function formCampaignAlliance(state,a,b,against=null){
 const check=campaignAllianceCheck(state,a,b,against);
 if(!check.ok)return check;
 state.campaign.pacts.set(warKey(a,b),{a,b,against,since:state.economy.seconds});
 state.onCampaignPact?.(a,b,against);
 return {ok:true};
}
function campaignEmbargoStatus(state,a,b){
 const order=state.campaign?.embargoes?.get(warKey(a,b)),now=state.economy?.seconds||0;
 return {by:order?.by,remaining:Math.max(0,(order?.until??0)-now),cooldown:Math.max(0,(order?.reopens??0)-now)};
}
function campaignTradeEmbargo(state,a,b){
 return (state.campaign?.embargoes?.get(warKey(a,b))?.until??0)>(state.economy?.seconds||0);
}
function setCampaignEmbargo(state,owner,target){
 const campaign=state.campaign,now=state.economy?.seconds||0;
 if(!campaign||owner===target||!campaignNationAlive(state,owner)||!campaignNationAlive(state,target)||isAtWar(state,owner,target))return null;
 const key=warKey(owner,target),status=campaignEmbargoStatus(state,owner,target);
 if(status.remaining&&status.by===owner){campaign.embargoes.get(key).until=now;return {active:false};}
 if(status.cooldown)return null;
 campaign.embargoes.set(key,{by:owner,until:now+EMBARGO_DURATION,reopens:now+EMBARGO_COOLDOWN});
 return {active:true};
}
function breakCampaignAlliance(state,other){
 const c=state.campaign,key=warKey('you',other);
 if(!c?.pacts.delete(key))return false;
 c.relations.set(key,{trust:0,next:state.economy.seconds});
 updateCampaign(state,0);
 return true;
}
function militaryCampaignTarget(state,region){
 return !!state.campaign?.startingCapitals?.has(region.id);
}
function updateCampaign(state,dt,captureId=null){
 const c=state.campaign;
 if(!c||c.result)return;
 const now=state.economy.seconds,rules=c.rules,guards=defendingTroopsByRegion(state);
 const regionByOwner=new Map(),capitalsByOwner=new Map();
 for(const region of state.regions){
  if(region.owner==='neutral')continue;
  if(!regionByOwner.has(region.owner))regionByOwner.set(region.owner,[]);
  regionByOwner.get(region.owner).push(region);
  if(c.startingCapitals.has(region.id)){
   if(!capitalsByOwner.has(region.owner))capitalsByOwner.set(region.owner,[]);
   capitalsByOwner.get(region.owner).push(region);
  }
 }
 const owners=[...(state.defeated?[]:['you']),...Object.entries(state.factions).filter(([id,f])=>!f.defeated&&!f.isRebel&&
  regionByOwner.get(id)?.some(r=>r.id===f.regionId&&r.buildings.some(b=>b.type==='city'))).map(([id])=>id)];
 const nationSet=new Set(owners);
 const financials=new Map(owners.map(owner=>[owner,{
  gold:Math.max(0,factionLedger(state,owner)?.gold||0),monthlyIncome:campaignMonthlyIncome(state,owner)
 }]));
 const totalGold=[...financials.values()].reduce((sum,account)=>sum+account.gold,0);
 const totalIncome=[...financials.values()].reduce((sum,account)=>sum+Math.max(0,account.monthlyIncome),0);
 const alliesByOwner=new Map(owners.map(id=>[id,[]]));
 const frontiers=c.pacts.size?campaignFrontiers(state):null;
 for(const [key,pact] of c.pacts){
  if(!nationSet.has(pact.a)||!nationSet.has(pact.b)||isAtWar(state,pact.a,pact.b)||
   pact.against&&!regionalPactHasFrontier(frontiers,pact.a,pact.b,pact.against)){c.pacts.delete(key);continue}
  const matureAt=(pact.since??-Infinity)+rules.allianceAge;
  alliesByOwner.get(pact.a).push({owner:pact.b,matureAt});
  alliesByOwner.get(pact.b).push({owner:pact.a,matureAt});
 }
 const cap=(n,max)=>max>0?Math.min(1,n/max):0;
 const requiredCapitals=c.startingCapitals.size;
 const requiredAllies=Math.min(rules.allies,owners.length-1);
 let leader=null,pressure=null,winner=null;
 const pathLeaders={},threats={},previousProgress=c.progress;
 c.progress=new Map();
 for(const owner of owners){
  const lands=regionByOwner.get(owner)||[],held=capitalsByOwner.get(owner)||[];
  const holdsOwn=held.some(region=>c.startingCapitals.get(region.id)===owner);
  const sales=(c.trades.get(owner)||[]).filter(s=>now-s.time<CAMPAIGN_TRADE_WINDOW);
  if(c.trades.has(owner))c.trades.set(owner,sales);
  const activeSales=sales.filter(s=>nationSet.has(s.buyer)&&!isAtWar(state,owner,s.buyer)&&!campaignTradeEmbargo(state,owner,s.buyer));
  const counts=new Map();
  for(const sale of activeSales)counts.set(sale.buyer,(counts.get(sale.buyer)||0)+1);
  const buyers=[...counts.keys()],repeatBuyers=buyers.filter(id=>counts.get(id)>=rules.repeatSales);
  const income=activeSales.reduce((sum,s)=>sum+s.value,0)*60/CAMPAIGN_TRADE_WINDOW;
  const turnover=c.turnover?.get(owner)||0;
  const activeAlliances=alliesByOwner.get(owner);
  const allies=activeAlliances.filter(pact=>pact.matureAt<=now).map(pact=>pact.owner);
  const capitalId=owner==='you'?state.capitalId:state.factions[owner].regionId;
  const home=lands.find(r=>r.id===capitalId);
  const homeLevel=home?.buildings.find(b=>b.type==='city'&&b.capital)?.level||1;
  const besieged=!!home&&state.sieges?.has(home.id)&&state.sieges.get(home.id).status!=='abandoned';
  const stability=home?duchyStability(home,guards.get(home.id)):0;
  const peaceful=!!home&&!besieged&&stability>=rules.stability;
  const requiredPartners=Math.min(rules.partners,owners.length-1);
  const requiredIncome=Math.round(rules.baseIncome*(.22+.26*rules.partners));
  const {gold,monthlyIncome}=financials.get(owner);
  const rivalGold=totalGold-gold,rivalIncome=totalIncome-Math.max(0,monthlyIncome);
  const requiredGold=Math.max(1,Math.ceil(rivalGold*ECONOMIC_SHARE-1e-8));
  const requiredMonthlyIncome=Math.max(1,Math.ceil(rivalIncome*ECONOMIC_SHARE-1e-8));
  const eligibleTrade=requiredPartners>0&&repeatBuyers.length>=requiredPartners&&income>=requiredIncome&&turnover>=rules.turnover&&
   gold+1e-8>=requiredGold&&monthlyIncome+1e-8>=requiredMonthlyIncome;
  const eligibleDiplomacy=requiredAllies>0&&allies.length>=requiredAllies&&peaceful&&homeLevel>=rules.diplomaticCapitalLevel;
  const heldFor=c.holds.get(owner)||{trade:0,diplomacy:0,tradeInterrupted:0};
  if(eligibleTrade){
   heldFor.trade=Math.min(rules.tradeHold,heldFor.trade+dt);
   heldFor.tradeInterrupted=0;
  }else if(heldFor.trade>0){
   heldFor.tradeInterrupted=(heldFor.tradeInterrupted||0)+dt;
   if(heldFor.tradeInterrupted>=rules.tradeGrace){heldFor.trade=0;heldFor.tradeInterrupted=0}
  }
  heldFor.diplomacy=eligibleDiplomacy?Math.min(rules.diplomaticHold,heldFor.diplomacy+dt):0;
  c.holds.set(owner,heldFor);
  const paths={
   trade:{buyers,repeatBuyers,income,turnover,requiredPartners,requiredIncome,gold,monthlyIncome,rivalGold,rivalIncome,requiredGold,requiredMonthlyIncome,
    margin:Math.min(gold/requiredGold,monthlyIncome/requiredMonthlyIncome),held:heldFor.trade,ready:eligibleTrade&&heldFor.trade>=rules.tradeHold,
    eligible:eligibleTrade,remaining:Math.max(0,rules.tradeHold-heldFor.trade,rules.minTime-now),
    blockedFor:eligibleTrade||!heldFor.trade?0:Math.max(0,rules.tradeGrace-(heldFor.tradeInterrupted||0)),
    score:.14*cap(repeatBuyers.length,requiredPartners)+.14*cap(income,requiredIncome)+.14*cap(turnover,rules.turnover)+
     .22*cap(gold,requiredGold)+.20*cap(Math.max(0,monthlyIncome),requiredMonthlyIncome)+.16*cap(heldFor.trade,rules.tradeHold)},
   military:{held,holdsOwn,requiredCapitals,ready:requiredCapitals>1&&held.length===requiredCapitals,
    score:requiredCapitals>1?cap(held.length,requiredCapitals):0},
   diplomacy:{allies,activeAlliances,requiredAllies,peaceful,stability,besieged,homeLevel,held:heldFor.diplomacy,ready:heldFor.diplomacy>=rules.diplomaticHold,
    eligible:eligibleDiplomacy,remaining:Math.max(0,rules.diplomaticHold-heldFor.diplomacy,rules.minTime-now),
    score:.70*cap(allies.length,requiredAllies)+.06*Number(peaceful)+.09*Number(homeLevel>=rules.diplomaticCapitalLevel)+.15*cap(heldFor.diplomacy,rules.diplomaticHold)}
  };
  c.progress.set(owner,paths);
  for(const path of CAMPAIGN_PATHS){
   const entry={owner,path,score:paths[path].score};
   if(!leader||entry.score>leader.score)leader=entry;
   const pathLeader=pathLeaders[path];
   if(!pathLeader||entry.score>pathLeader.score)pathLeaders[path]={score:entry.score,owners:[owner]};
   else if(entry.score===pathLeader.score)pathLeader.owners.push(owner);
   const danger=path==='military'&&held.length<=Number(holdsOwn)?0:entry.score;
   if(path!=='diplomacy'&&danger>=.57&&(!pressure||danger>pressure.score))pressure={owner,path,score:danger};
   if(owner!=='you'&&path!=='military'&&(paths[path].eligible||paths[path].blockedFor>0)){
    const candidate={owner,path,remaining:paths[path].remaining,blockedFor:paths[path].blockedFor||0};
    const current=threats[path];
    if(!current||Number(!!candidate.blockedFor)<Number(!!current.blockedFor)||!!candidate.blockedFor===!!current.blockedFor&&candidate.remaining<current.remaining)threats[path]=candidate;
    if(paths[path].eligible&&!previousProgress.get(owner)?.[path]?.eligible&&!previousProgress.get(owner)?.[path]?.blockedFor)state.onCampaignCountdown?.(candidate);
   }
   if(paths[path].ready){
    if(path==='military')winner={...entry,regionId:captureId};
    else if(!state.defeated&&now>=rules.minTime&&(!winner||path==='trade'&&winner.path==='trade'&&
     paths.trade.margin>c.progress.get(winner.owner).trade.margin))winner=entry;
   }
  }
 }
 c.leader=leader;
 c.pathLeaders=pathLeaders;
 c.threats=threats;
 c.pressure=pressure;
 if(winner){
  c.result={...winner,time:now};
  state.onCampaignEnd?.(c.result);
 }
}

function initializeEconomy(state,region){state.domainPriority=[];state.domainWarning=0;state.council=createRealmCouncil(region.id);state.vassals=new Map();state.vassalFeuds=new Map();state.nextVassalId=0;state.capitalId=region.id;state.realmRank='duchy';state.garrisons={};state.recruitments=[];state.nextRecruitmentId=0;state.armyMoves=[];state.fieldArmies=[];state.warships=[];state.wars={};state.warRecords={};state.peaceTreaties={};state.transit={};state.battlePairs=[];state.sieges=new Map();state.notifications=[];state.nextNotificationId=0;state.defeated=false;state.economy={stocks:{grain:24,wood:10,iron:8,cloth:8,equipment:0},industryReserve:0,equipmentReserve:0,shipments:[],seconds:0,tradeClock:0,tradeEarned:0,tradeSpent:0,tradeStats:{land:{count:0,revenue:0},sea:{count:0,revenue:0},ports:{}},regionDeliveries:{},exportPolicy:{wood:'trade',iron:'trade',cloth:'trade'},events:[],grainFlow:[],roadTraffic:new Map(),grainPolicy:'growth',growthRate:.012,actualGrowthRate:.012};region.control=100;region.mood=20;let capital=region.buildings.find(b=>b.capital);if(capital)capital.population=1000}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function segmentWithin(r,a,b){let d=distance(a,b),steps=Math.max(1,Math.ceil(d/1.2));for(let i=0;i<=steps;i++){let t=i/steps;if(!insideRegion(r,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true}
function routeWithin(r,from,to,allowsSegment=segmentWithin){
 const piece=r.polys.findIndex((_,index)=>insideRegionPiece(r,index,from.x,from.z)&&insideRegionPiece(r,index,to.x,to.z));
 if(piece<0)return null;
 if(allowsSegment(r,from,to))return [{x:from.x,z:from.z},{x:to.x,z:to.z}];
 const bounds=r.bounds[piece];
 function search(divisions){let step=Math.max(.12,Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])/divisions),w=Math.ceil((bounds[2]-bounds[0])/step)+1,h=Math.ceil((bounds[3]-bounds[1])/step)+1;
  let cells=[];for(let j=0;j<h;j++)for(let i=0;i<w;i++){let p={x:bounds[0]+i*step,z:bounds[1]+j*step,i,j};if(insideRegion(r,p.x,p.z))cells.push(p)}
  let find=p=>cells.slice().sort((a,b)=>distance(a,p)-distance(b,p)).find(q=>allowsSegment(r,p,q));let start=find(from),end=find(to);if(!start||!end)return null;
  let byKey=new Map(cells.map(p=>[p.i+','+p.j,p])),key=p=>p.i+','+p.j,queue=[start],prev=new Map([[key(start),null]]);for(let head=0;head<queue.length;head++){let at=queue[head];if(key(at)===key(end))break;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let n=byKey.get((at.i+dx)+','+(at.j+dz));if(!n||prev.has(key(n))||!allowsSegment(r,at,n))continue;prev.set(key(n),at);queue.push(n)}}
  if(!prev.has(key(end)))return null;let path=[];for(let p=end;p;p=prev.get(key(p)))path.push({x:p.x,z:p.z});path.reverse();path.unshift({x:from.x,z:from.z});path.push({x:to.x,z:to.z});return path;
 }
 for(const resolution of [44,88,132]){let path=search(resolution);if(path)return path}return null;
}
// Routes are replaced when orders change. Cache their cumulative distances for moving units.
const routeDistances=new WeakMap();
function routeMetrics(path){
 const cached=routeDistances.get(path);
 if(cached&&cached.length===path.length&&cached.first===path[0]&&cached.last===path.at(-1)) return cached;
 const distances=[0];
 for(let i=1;i<path.length;i++) distances.push(distances[i-1]+distance(path[i-1],path[i]));
 const metrics={distances,total:distances.at(-1),length:path.length,first:path[0],last:path.at(-1)};
 routeDistances.set(path,metrics);
 return metrics;
}
function routeLength(path){return routeMetrics(path).total}
const CART_SPEED=12,SHIP_SPEED=24;
function markSeaLeg(path,start,end){
 if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)Object.assign(path,{seaStart:start,seaEnd:end});
 return path;
}
function travelTimeAtDistance(path,along){
 const sea=path.seaStart==null?0:Math.max(0,Math.min(along,path.seaEnd)-path.seaStart);
 return (along-sea)/CART_SPEED+sea/SHIP_SPEED;
}
function journeyDuration(path){return Math.max(.001/CART_SPEED,travelTimeAtDistance(path,routeLength(path)))}
function routeDistanceAt(path,t){
 const total=routeLength(path),fraction=Math.max(0,Math.min(1,t));
 if(path.seaStart==null)return fraction*total;
 const elapsed=journeyDuration(path)*fraction,embark=path.seaStart/CART_SPEED;
 const landfall=travelTimeAtDistance(path,path.seaEnd);
 if(elapsed<=embark)return elapsed*CART_SPEED;
 if(elapsed<=landfall)return path.seaStart+(elapsed-embark)*SHIP_SPEED;
 return Math.min(total,path.seaEnd+(elapsed-landfall)*CART_SPEED);
}
function routeFractionAt(path,along){
 return Math.max(0,Math.min(1,travelTimeAtDistance(path,along)/journeyDuration(path)));
}
function pointOnRoute(path,t){return pointAtRouteDistance(path,routeDistanceAt(path,t))}
function retraceRoute(ship,elapsed=ship.elapsed){
 const {path,duration}=ship,along=routeDistanceAt(path,elapsed/duration);
 const point=pointAtRouteDistance(path,along);
 const next=routeMetrics(path).distances.findIndex(distance=>distance>=along);
 const back=[point,...path.slice(0,next).reverse()];
 if(back.length===1)back.push(point);
 if(path.seaStart!=null&&along>path.seaStart)
  markSeaLeg(back,Math.max(0,along-path.seaEnd),along-path.seaStart);
 return back;
}
function pointAtRouteDistance(path,target){
 if(path.length<2)return path[0];
 const {distances}=routeMetrics(path);
 let low=1,high=path.length-1;
 while(low<high){
  const middle=(low+high)>>1;
  if(distances[middle]<target) low=middle+1;
  else high=middle;
 }
 const a=path[low-1],b=path[low],length=distances[low]-distances[low-1];
 const ratio=length?(target-distances[low-1])/length:0;
 return {x:a.x+(b.x-a.x)*ratio,z:a.z+(b.z-a.z)*ratio};
}
// Trading reach uses the historical scale for existing trade routes.
function tradeRange(state,owner='you'){let owned=state.regions.filter(r=>r.owner===owner),pop=0,production=0;for(const r of owned){const workforce=workforceReport(r);pop+=regionalPopulation(r);for(const b of r.buildings)if(b.product&&b.route?.length)production+=productionRate(r,b,workforce)}const strength=owned.length*100+pop*.1+production*3+armyTroops(state,owner)*.5+Math.max(0,Math.min(1000,factionLedger(state,owner)?.gold||0))*.04;return Math.min(1300,Math.floor(420+strength*.4))}
function tradePremium(path){return 1+Math.min(.5,routeLength(path)/1600)}
function tradePartnerAlive(state,id){let f=state.factions?.[id];return !!f&&!f.defeated&&!f.isRebel&&state.regions.some(r=>r.id===f.regionId&&r.owner===id&&r.buildings?.some(b=>b.type==='city'))}
function exportDestinationOpen(state,ship){
 if(!campaignNationAlive(state,ship.buyer)||isAtWar(state,shipmentOwner(ship),ship.buyer)||campaignTradeEmbargo(state,shipmentOwner(ship),ship.buyer))return false;
 if(ship.mode!=='sea'){
  return ship.destinationRegionId==null||state.regions.some(r=>r.id===ship.destinationRegionId&&r.owner===ship.buyer&&
   r.buildings.some(b=>b.type==='city'));
 }
 if(ship.destinationPortRegionId==null)return true;
 return state.regions.some(r=>r.id===ship.destinationPortRegionId&&r.owner===ship.buyer&&
  r.buildings.some(b=>b.type==='port'&&b.slotId===ship.destinationPortSlotId));
}
function ensureExportDestination(state,ship){
 if(exportDestinationOpen(state,ship))return true;
 return ship.mode!=='sea'&&campaignNationAlive(state,ship.buyer)&&!isAtWar(state,shipmentOwner(ship),ship.buyer)&&
  !campaignTradeEmbargo(state,shipmentOwner(ship),ship.buyer)&&
  !!state.retargetLandExport?.(ship);
}
function returnTradeShipment(state,ship){
 const owner=shipmentOwner(ship),path=retraceRoute(ship);
 if(!ship.marketTrade&&state.factions?.[ship.buyer])state.factions[ship.buyer].gold+=ship.value||0;
 Object.assign(ship,{kind:'returnTrade',owner,mode:path.seaStart!=null?'sea':'land',
  seaStart:path.seaStart,seaEnd:path.seaEnd,returnCapitalId:merchantHomeId(state,ship),
  value:0,path,elapsed:0,duration:journeyDuration(path),buyer:null,supplyBlocked:false});
 state.planMerchantReturn?.(ship);
 if(owner==='you')state.onTradeReturned?.(ship);
 return ship;
}
function shipmentOwner(ship){
 if(ship.kind==='import'&&!ship.fleetClass)return ship.owner||ship.seller||'you';
 return ship.owner||'you';
}
function routeHeading(path,t){let a=pointOnRoute(path,Math.max(0,t-.004)),b=pointOnRoute(path,Math.min(1,t+.004));return Math.atan2(b.z-a.z,b.x-a.x)}
// A region keeps its own control. Distance is counted through owned neighboring lands.
// Ranks change administrative capacity, never the legality of expansion.
const REALM_REFERENCE_SIZE=44;
const REALM_RANKS=[
 {id:'duchy',name:'Герцогство',capacity:3},
 {id:'kingdom',name:'Королевство',capacity:8,capitalLevel:2,cost:350},
 {id:'empire',name:'Империя',capacity:16,capitalLevel:3,cost:800}
];
function realmMapScale(state){
 return Math.sqrt(Math.max(1,state.regions.length)/REALM_REFERENCE_SIZE);
}
const realmRankCatalogs=new Map();
function realmRanks(state){
 const total=state.regions.length;
 if(!realmRankCatalogs.has(total)){
  const scale=realmMapScale(state);
  const capacities=REALM_RANKS.map(rank=>Math.max(1,Math.min(total,Math.round(rank.capacity*scale))));
  realmRankCatalogs.set(total,REALM_RANKS.map((rank,i)=>({...rank,capacity:capacities[i],requiredLands:capacities[i-1]})));
 }
 return realmRankCatalogs.get(total);
}
function realmRank(state,owner='you'){
 const id=owner==='you'?state.realmRank:state.factions?.[owner]?.realmRank,ranks=realmRanks(state);
 return ranks.find(r=>r.id===id)||ranks[0];
}
function realmPromotionCheck(state,owner='you'){
 const ranks=realmRanks(state),id=owner==='you'?state.realmRank:state.factions?.[owner]?.realmRank;
 const index=Math.max(0,ranks.findIndex(rank=>rank.id===id)),current=ranks[index],next=ranks[index+1];
 if(!state.started||!state.economy||(owner==='you'&&state.defeated)||(owner!=='you'&&(!state.factions?.[owner]||state.factions[owner].defeated||state.factions[owner].isRebel)))return {ok:false,current,next,reason:'Держава недоступна'};
 if(!next)return {ok:false,current,next:null,reason:'Высший ранг достигнут'};
 let lands=state.regions.filter(r=>r.owner===owner).length,capitalId=owner==='you'?state.capitalId:state.factions[owner].regionId,capital=state.regions.find(r=>r.id===capitalId&&r.owner===owner),city=capital?.buildings?.find(b=>b.type==='city'&&b.capital),level=city?.level||1,ledger=factionLedger(state,owner),missing=[];
 if(!city)missing.push('нужна столица');if(lands<next.requiredLands)missing.push('земли '+lands+'/'+next.requiredLands);if(city&&level<next.capitalLevel)missing.push('столица '+level+'/'+next.capitalLevel+' ур.');if(!ledger||ledger.gold<next.cost)missing.push('золото '+Math.floor(ledger?.gold||0)+'/'+next.cost);return {ok:missing.length===0,current,next,lands,capital,city,level,missing,reason:missing.join(' · ')};
}
function promoteRealm(state,owner='you'){let check=realmPromotionCheck(state,owner);if(!check.ok)return check;let ledger=factionLedger(state,owner);ledger.gold-=check.next.cost;if(owner==='you'){state.realmRank=check.next.id;pushNotification(state,{kind:'economy',title:'Новый ранг державы',body:check.next.name+' · размер домена '+check.next.capacity+'.',regionId:state.capitalId})}else state.factions[owner].realmRank=check.next.id;stepControl(state,0);state.onRealmPromoted?.({owner,rank:check.next});return {...check,ok:true}}
const CONTROL_TIME=180;
function controlEfficiency(region){let value=Number.isFinite(region?.control)?region.control:100;return .6+.4*Math.max(0,Math.min(100,value))/100}
function realmAdministration(state,owner){
 const lands=state.regions.filter(r=>r.owner===owner),capital=owner==='you'?state.capitalId:state.factions?.[owner]?.regionId;
 const neighbors=new Map(lands.map(r=>[r.id,[]]));
 for(const r of lands)for(const id of r.adj||[]){
  if(!neighbors.has(id))continue;
  neighbors.get(r.id).push(id);
  neighbors.get(id).push(r.id);
 }
 const distances=new Map(),queue=[];
 if(neighbors.has(capital)){distances.set(capital,0);queue.push(capital)}
 for(let i=0;i<queue.length;i++){
  const id=queue[i],distance=distances.get(id)+1;
  for(const neighbor of neighbors.get(id)){
   if(distances.has(neighbor))continue;
   distances.set(neighbor,distance);
   queue.push(neighbor);
  }
 }
 // Sea connectivity: a coastal duchy with a port ties every other coastal
 // duchy of the realm to the capital, counting a sea leg as two hops.
 const sea=new Set();
 const hubs=lands.filter(r=>r.coast&&r.buildings?.some(b=>b.type==='port')&&distances.has(r.id));
 if(hubs.length)for(const r of lands){
  if(!r.coast||distances.has(r.id))continue;
  let best=Infinity;
  for(const hub of hubs)best=Math.min(best,distances.get(hub.id)+2);
  if(Number.isFinite(best)){distances.set(r.id,best);sea.add(r.id)}
 }
 const capacity=realmRank(state,owner).capacity;
 const priorities=owner==='you'?state.domainPriority||[]:[];
 const directLands=lands.filter(r=>!r.awaitingAdministration&&!vassalFor(state,r));
 const direct=directLands.length,excess=Math.max(0,direct-capacity),overload=excess/capacity;
 const yieldFactor=Math.max(.2,1/(1+1.25*overload));
 const excessLands=new Map();
 if(excess){
  const priority=id=>id===capital?priorities.length+1:priorities.indexOf(id)+1;
  directLands.sort((a,b)=>priority(b.id)-priority(a.id)||
   (distances.get(a.id)??Infinity)-(distances.get(b.id)??Infinity)||a.id-b.id);
  directLands.slice(capacity).forEach((region,index)=>excessLands.set(region.id,Math.min(88,Math.round(24+38*overload+3*index))));
 }
 return {capital,distances,capacity,direct,excess,overload,yieldFactor,excessLands,sea};
}
function toggleDomainPriority(state,region){
 const capacity=realmRank(state).capacity;
 if(capacity<=1||!region||region.owner!=='you'||region.awaitingAdministration||region.id===state.capitalId||vassalFor(state,region))return;
 const current=(state.domainPriority||[]).filter(id=>state.regions.some(r=>r.id===id&&r.owner==='you'&&r.id!==state.capitalId&&!vassalFor(state,r)));
 state.domainPriority=current.includes(region.id)?current.filter(id=>id!==region.id):
  [...current,region.id].slice(1-capacity);
 stepControl(state,0);
}
function controlReport(state,region,administration){
 if(!region||!region.owner||region.owner==='neutral')return null;
 const admin=administration||realmAdministration(state,region.owner);
 const {capital,distances,capacity,excessLands,yieldFactor}=admin;
 const dist=distances.get(region.id),isCapital=region.id===capital,buildings=region.buildings||[];
 const vassal=vassalFor(state,region),bySea=admin.sea.has(region.id);
 const houseCapacity=vassal&&vassalTierInfo(vassal).capacity;
 const houseExcess=vassal?Math.max(0,vassal.lands.length-houseCapacity):0;
 const position=vassal?.lands.filter(id=>id!==vassal.seatId).indexOf(region.id)??-1;
 const burden=vassal?(position>=houseCapacity-1?Math.min(80,28+houseExcess*10):0):excessLands.get(region.id)||0;
 const infra=Math.min(12,buildings.filter(b=>b.product&&b.route?.length).length*2+
  buildings.filter(b=>b.type==='city').reduce((n,b)=>n+Math.max(0,(b.level||1)-1)*3,0));
 const g=state.garrisons?.[region.id],soldiers=g?.owner===region.owner&&!g.inBattle?g.troops||0:0;
 const garrison=Math.min(8,soldiers*.04);
 const distancePenalty=vassal?(vassal.seatId===region.id?0:4):dist==null?30:Math.min(24,dist*4);
 const relief=(region.councilReliefUntil||0)> (state.economy?.seconds||0)?6:0;
 const sabotage=(region.sabotageUntil||0)>(state.economy?.seconds||0)?region.sabotageControl:0;
 const target=(isCapital?100:Math.max(burden?5:35,Math.min(100,88-distancePenalty-burden+infra+garrison+relief)))-sabotage;
 const value=Number.isFinite(region.control)?region.control:100;
 return {value,target,dist,infra,garrison,burden,capacity:houseCapacity||capacity,distancePenalty,isCapital,sabotage,sea:bySea,
  yieldFactor:vassal?1/(1+.32*houseExcess):yieldFactor,efficiency:controlEfficiency(region)};
}
function stepControl(state,dt){
 const byOwner=new Map(),recovery=1-Math.exp(-dt/CONTROL_TIME);
 for(const r of state.regions){
  if(r.owner!=='you'&&!state.factions?.[r.owner])continue;
  if(!byOwner.has(r.owner))byOwner.set(r.owner,realmAdministration(state,r.owner));
  const admin=byOwner.get(r.owner),q=controlReport(state,r,admin);
  r.domainYield=q.yieldFactor;
  r.domainBurden=q.burden;
  const now=state.economy?.seconds||0,calming=pacifying(r,now);
  const aided=((r.councilReliefUntil||0)>now||advisorIsWorking(state,'marshal',r)||calming)&&q.target>q.value;
  const target=calming?Math.min(100,q.target+12):q.target;
  const decline=q.burden&&target<q.value?1-Math.exp(-dt*(1+Math.min(1.25,admin.overload*.6))/CONTROL_TIME):recovery;
  r.control=q.isCapital&&!q.sabotage?100:Math.max(0,Math.min(100,q.value+(target-q.value)*(aided?1-Math.exp(-dt/(CONTROL_TIME*.62)):decline)));
 }
 const player=byOwner.get('you');
 if(player){
  const lost=Math.round((1-player.yieldFactor)*100),stage=lost>=70?3:lost>=50?2:lost>0?1:0;
  if(stage>(state.domainWarning||0))pushNotification(state,{kind:'danger',title:'Домен перегружен',
   body:player.direct+' из '+player.capacity+' земель · выпуск и налоги −'+lost+'%. Передайте земли вассалам или повысьте ранг державы.',
   regionId:player.excessLands.keys().next().value??state.capitalId});
  state.domainWarning=stage;
 }
}
const GRAIN_PER_RESIDENT=.006;
const CITY_SELF_FEED_LIMIT=200;
function cityExternalGrainNeed(region){
 return (region?.buildings||[]).reduce((need,city)=>need+
  (city.type==='city'?Math.max(0,(city.population||0)-CITY_SELF_FEED_LIMIT)*GRAIN_PER_RESIDENT:0),0);
}
const SEAT_REPAIR_GOLD=35,SEAT_REPAIR_SECONDS=32,SETTLEMENT_FOOD_SECONDS=18;
const OCCUPATION_UNREST_SECONDS=110;
function beginOccupation(state,region){
 const now=state.economy.seconds,seat=duchySeat(region);
 if(!seat)return;
 seat.damaged=true;
 delete seat.housingClosed;
 region.occupation={fedFor:0,repairAt:null};
 Object.assign(region,{control:40,mood:-40,conquestUntil:now+180,reliefUntil:0,
  reliefCooldownUntil:0,moodAlerted:false,unrest:0,unrestAlertStage:0,revoltCooldownUntil:now+20});
}
function repairSeat(state,region,owner='you',purse=state){
 const check=seatRepairCheck(state,region,owner,purse);
 if(!check.ok)return check;
 check.ledger.gold-=check.cost;
 region.occupation.repairAt=state.economy.seconds+SEAT_REPAIR_SECONDS;
 return {ok:true,status:'Столица восстанавливается'};
}
function seatRepairCheck(state,region,owner='you',purse=state){
 if(region?.owner!==owner||!region.occupation||!duchySeat(region)?.damaged)return {ok:false,reason:'Ремонт не требуется'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(region.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 if(region.occupation.repairAt!=null)return {ok:false,reason:'Ремонт уже идёт'};
 if(state.sieges?.has(region.id))return {ok:false,reason:'Город в осаде'};
 const ledger=factionLedger(state,owner,purse);
 if(!ledger)return {ok:false,reason:'Казна недоступна'};
 const cost=landDevelopmentPrice(state,SEAT_REPAIR_GOLD,region);
 const missing=costShortfalls(ledger.gold,null,cost);
 return missing.length?{ok:false,cost,reason:'Не хватает '+missing.join(' · ')}:{ok:true,cost,ledger};
}
function settlementReport(state,region){
 const q=region?.occupation;
 if(!q||state.factions?.[region.owner]?.isRebel)return null;
 const stock=granaryStock(state,region.id),need=regionGrainNeed(state,region);
 return {damaged:!!duchySeat(region)?.damaged,repairing:q.repairAt!=null,
  repairSeconds:Math.max(0,(q.repairAt||0)-state.economy.seconds),fed:q.fedFor>=SETTLEMENT_FOOD_SECONDS,
  fedFor:q.fedFor,foodDays:need>0?Math.floor(stock*60/(need*SECONDS_PER_GAME_DAY)):0,
  reliefPending:state.economy.shipments.some(s=>s.grainPurpose==='relief'&&s.grainDestination===region.id)};
}
function stepSettlement(state,region,dt){
 const q=region.occupation;
 if(q&&!state.factions?.[region.owner]?.isRebel){
  const seat=duchySeat(region),g=granaryFor(state,region.id);
  if(q.repairAt!=null&&q.repairAt<=state.economy.seconds&&!state.sieges?.has(region.id)){
   seat.damaged=false;q.repairAt=null;
   if(region.owner==='you')pushNotification(state,{kind:'economy',title:'Столица восстановлена',body:region.city,regionId:region.id});
  }
  q.fedFor=Math.max(0,Math.min(SETTLEMENT_FOOD_SECONDS,q.fedFor+(g?.fed>=.999?dt:-2*dt)));
  if(!seat.damaged&&q.fedFor>=SETTLEMENT_FOOD_SECONDS){
   delete region.occupation;
   delete seat.housingClosed;
   region.conquestUntil=0;
   region.mood=Math.max(-12,region.mood||0);
   if(region.owner==='you')pushNotification(state,{kind:'economy',title:'Герцогство обустроено',body:region.name,regionId:region.id});
  }
 }
}
function relocateResidents(region,dt,fed,externalFood=true){
 if(!fed&&externalFood)return;
 const cities=region.buildings.filter(b=>b.type==='city'),seat=duchySeat(region);
 if(!cities.length)return;
 let displaced=region.displacedResidents||0,returnCapacity=dt*2;
 for(const city of cities){
  const ceiling=externalFood?cityHousing(city):Math.min(cityHousing(city),CITY_SELF_FEED_LIMIT);
  const room=Math.max(0,ceiling-(city.population||0));
  const returning=Math.min(displaced,room,returnCapacity);
  if(!returning)continue;
  city.population=(city.population||0)+returning;
  displaced-=returning;returnCapacity-=returning;
 }
 region.displacedResidents=displaced;
 // Newly built houses are filled by people already living in this duchy.
 if(!seat||seat.damaged||cities.length<2)return;
 for(const city of cities){
  if(city===seat)continue;
  const residents=city.population||0;
  const gap=((seat.population||0)/cityHousing(seat)-residents/cityHousing(city))*cityHousing(city);
  const foodRoom=externalFood?Infinity:Math.max(0,CITY_SELF_FEED_LIMIT-residents);
  const moving=Math.min(foodRoom,Math.max(0,gap/2),Math.max(0,(seat.population||0)-100),dt*.9/(cities.length-1));
  if(moving<=0)continue;
  seat.population-=moving;
  city.population=residents+moving;
 }
}
// Public mood reacts to actual food, housing, local control and sieges.
const RELIEF_GOLD=20,RELIEF_GRAIN=6,RELIEF_DURATION=120,RELIEF_COOLDOWN=150;
const PACIFY_GOLD=80,PACIFY_GRAIN=12,PACIFY_SECONDS=120,PACIFY_COOLDOWN=150;
function moodReport(state,region){
 if(!region||region.owner==='neutral')return null;let owner=region.owner,now=state.economy?.seconds||0,control=Number.isFinite(region.control)?region.control:100,buildings=region.buildings||[],population=buildings.filter(b=>b.type==='city').reduce((n,b)=>n+(b.population||0),0),housing=buildings.reduce((n,b)=>n+cityHousing(b),0),food=state.economy?.granaries?(granaryFor(state,region.id)?.fed??1)<.999:owner==='you'?!!state.economy?.hungry:(state.factions?.[owner]?.stocks?.grain??0)<1,siege=state.sieges?.get(region.id),besieged=!!siege&&siege.defender===owner&&siege.status!=='abandoned',crowded=population>0&&housing>0&&population>=housing*.98,recent=(region.conquestUntil||0)>now,relief=(region.reliefUntil||0)>now,development=Math.min(12,buildings.filter(b=>b.product&&b.route?.length).length*2+buildings.filter(b=>b.type==='city').reduce((n,b)=>n+1+Math.max(0,(b.level||1)-1)*2,0)),controlPenalty=Math.max(0,60-control)*.5,domainPenalty=Math.min(32,Math.round((region.domainBurden||0)*.36)),target=Math.max(-100,Math.min(100,20-controlPenalty-domainPenalty-(food?45:0)-(besieged?35:0)-(crowded?12:0)-(recent?30:0)+(relief?30:0)+development)),value=Number.isFinite(region.mood)?region.mood:20;
 return {value,target,food,besieged,crowded,recent,relief,development,controlPenalty,domainPenalty,reliefRemaining:Math.max(0,(region.reliefUntil||0)-now),cooldown:Math.max(0,(region.reliefCooldownUntil||0)-now)};
}
function duchyStability(region,troops=0){
 const control=Number.isFinite(region?.control)?region.control:100;
 const mood=Number.isFinite(region?.mood)?region.mood:20;
 const seatLevel=duchySeat(region)?.level||1;
 const support=Math.min(20,Math.ceil(Math.max(0,troops)/20)+(seatLevel-1)*3);
 const normal=Math.min(100,.7*control+.3*(100+Math.min(0,Math.max(-100,mood)))+support);
 return Math.round(Math.max(0,normal-(region?.treasuryPenalty||0)));
}
function moodEfficiency(r){let mood=Number.isFinite(r?.mood)?r.mood:20;return 1+Math.min(0,Math.max(-100,mood))*.0015}
function economicEfficiency(r){return controlEfficiency(r)*moodEfficiency(r)*(r.domainYield??1)}
function reliefCheck(state,region,owner='you',purse=null){
 if(!state.started||!region||region.owner!==owner||!state.economy)return {ok:false,reason:'Земля недоступна'};let ledger=factionLedger(state,owner,purse),report=moodReport(state,region);
 if(!ledger)return {ok:false,reason:'Держава недоступна'};if(report.cooldown>0)return {ok:false,reason:'Повторная помощь через '+Math.ceil(report.cooldown)+' сек.'};const missing=costShortfalls(ledger.gold,ledger.stocks,RELIEF_GOLD,{grain:RELIEF_GRAIN});
 return missing.length?{ok:false,reason:'Не хватает · '+missing.join(' · ')}:{ok:true};
}
function sendRelief(state,region,owner='you',deferred=false,purse=null){
 let check=reliefCheck(state,region,owner,purse);if(!check.ok)return check;let ledger=factionLedger(state,owner,purse),now=state.economy.seconds||0;ledger.gold-=RELIEF_GOLD;ledger.stocks.grain-=RELIEF_GRAIN;if(owner==='you')recordGrainFlow(state,-RELIEF_GRAIN);if(!deferred){region.reliefUntil=now+RELIEF_DURATION;if(state.economy.granaries)changeGranaryStock(state,region.id,RELIEF_GRAIN);}region.reliefCooldownUntil=now+RELIEF_COOLDOWN;return {ok:true};
}
function pacifying(region,now){return (region.pacifyUntil||0)>now}
function pacifyCheck(state,region,owner='you'){
 const now=state.economy?.seconds||0;
 if(!state.started||!state.economy)return {ok:false,reason:'Сначала выберите столицу'};
 if(!region||region.owner!==owner)return {ok:false,reason:'Умиротворить можно только свою землю'};
 if(region.id===realmCapitalId(state,owner))return {ok:false,reason:'Столица не нуждается в умиротворении'};
 if(pacifying(region,now))return {ok:false,reason:'Умиротворение уже идёт'};
 if((region.pacifyCooldownUntil||0)>now)return {ok:false,reason:'Земля недавно умиротворялась'};
 if(state.sieges?.has(region.id))return {ok:false,reason:'Город в осаде'};
 const ledger=factionLedger(state,owner);
 if(!ledger)return {ok:false,reason:'Казна недоступна'};
 const need=region.control<70||region.mood<10||(region.unrest||0)>=15||!!region.occupation;
 if(!need)return {ok:false,reason:'Земля спокойна и не нуждается в умиротворении'};
 const missing=costShortfalls(ledger.gold,ledger.stocks,PACIFY_GOLD,{grain:PACIFY_GRAIN});
 return missing.length?{ok:false,reason:'Не хватает · '+missing.join(' · '),missing}:{ok:true,ledger};
}
function pacify(state,region,owner='you'){
 const check=pacifyCheck(state,region,owner);
 if(!check.ok)return check;
 const now=state.economy.seconds;
 check.ledger.gold-=PACIFY_GOLD;
 check.ledger.stocks.grain-=PACIFY_GRAIN;
 if(owner==='you')recordGrainFlow(state,-PACIFY_GRAIN);
 region.pacifyUntil=now+PACIFY_SECONDS;
 region.pacifyCooldownUntil=region.pacifyUntil+PACIFY_COOLDOWN;
 if(owner==='you')pushNotification(state,{kind:'economy',title:'Умиротворение началось',body:region.name+' · контроль восстанавливается быстрее, волнения затухают.',regionId:region.id});
 state.onRealmPacified?.({region});
 return {ok:true,until:region.pacifyUntil};
}
function stepMood(state,dt){
 for(const region of state.regions){if(region.owner!=='you'&&!state.factions?.[region.owner]||state.factions?.[region.owner]?.isRebel)continue;let q=moodReport(state,region),now=state.economy?.seconds||0,target=pacifying(region,now)?q.target+15:q.target;region.mood=Math.max(-100,Math.min(100,q.value+(target-q.value)*(1-Math.exp(-dt/120))));
  if(region.owner==='you'){if(region.mood<=-20&&!region.moodAlerted){region.moodAlerted=true;pushNotification(state,{kind:'danger',title:'Недовольство жителей',body:region.name+': настроение '+Math.round(region.mood)+'. Проверьте зерно, жильё и контроль.',regionId:region.id})}else if(region.mood>=-10)region.moodAlerted=false;
   if(region.supplyPriority&&granaryFor(state,region.id)?.fed<.7&&state.economy.stocks.grain>=RELIEF_GRAIN+24){
    const home=councilRegion(state,state.capitalId,'you');
    councilReliefDelivery(state,region,home,state.economy.shipments,state);
   }
  }
  else if(region.owner!=='you'&&!vassalFor(state,region)){
   const faction=state.factions[region.owner];
   if(region.mood<=-20&&faction?.gold>=RELIEF_GOLD+60){
    const home=councilRegion(state,realmCapitalId(state,region.owner),region.owner);
    councilReliefDelivery(state,region,home,state.economy.shipments,state);
   }
   if((region.unrest||0)>=25&&faction?.gold>=PACIFY_GOLD+70&&pacifyCheck(state,region,region.owner).ok)pacify(state,region,region.owner);
  }
 }
}
const UNREST_SECONDS=240,UNREST_RECOVERY_SECONDS=90,REVOLT_COOLDOWN=300;
const UNREST_RECOVERY_STABILITY=75;
function defendingTroopsByRegion(state){
 const guards=new Map();
 function add(region,unit){
  if(region?.owner===unit.owner&&unit.troops>0)guards.set(region.id,(guards.get(region.id)||0)+unit.troops);
 }
 for(const region of state.regions){const g=state.garrisons?.[region.id];if(g)add(region,g);}
 function at(point){return point&&(state.armyTerritoryAt?.(point)||(!state.armyTerritoryAt&&state.regions.find(r=>r.slots?.[0]&&distance(point,r.slots[0])<=SIEGE_RADIUS)));}
 for(const unit of state.fieldArmies||[])if(unit.troops>0)add(at(unit.location?.point),unit);
 for(const unit of state.armyMoves||[]){
  if(!unit.path?.length||unit.troops<=0)continue;
  const ratio=Math.min(1,unit.elapsed/unit.duration),along=routeDistanceAt(unit.path,ratio);
  if(unit.path.landingId!=null&&along>=unit.path.seaStart&&along<=unit.path.seaEnd)continue;
  add(at(pointOnRoute(unit.path,ratio)),unit);
 }
 return guards;
}
function unrestReport(state,r,guards=defendingTroopsByRegion(state)){
 if(!r||r.owner==='neutral'||state.factions?.[r.owner]?.isRebel)return null;
 const troops=guards.get(r.id)||0,baseStability=duchyStability(r);
 const stability=troops>0?duchyStability(r,troops):baseStability;
 const now=state.economy?.seconds||0,cooldown=Math.max(0,(r.revoltCooldownUntil||0)-now);
 const population=regionalPopulation(r)+(r.displacedResidents||0);
 const occupation=settlementReport(state,r),neglected=!!occupation&&(occupation.damaged||!occupation.fed);
 const progress=Math.max(0,Math.min(100,r.unrest||0)),chance=(100-stability)/100;
 const tension=population>=1&&baseStability<UNREST_RECOVERY_STABILITY&&(baseStability<=55||((r.domainBurden||0)>0&&baseStability<70)||neglected||progress>=35);
 const requiredTroops=r.domainBurden?Math.min(120,Math.max(30,Math.ceil(population*.05))):1;
 const protectedByArmy=tension&&troops>=requiredTroops;
 const atRisk=tension&&!protectedByArmy;
 const risk=atRisk&&!cooldown;
 const base=neglected?OCCUPATION_UNREST_SECONDS*(occupation.repairing||!occupation.damaged||occupation.fed?1.65:1):UNREST_SECONDS;
 const dailyRate=100/(pacifying(r,now)?base*2.4:base)*(.5+chance),speed=risk?dailyRate:0;
 return {progress,risk,chance,troops,requiredTroops,protectedByArmy,cooldown,population,speed,
  days:atRisk?Math.max(1,Math.ceil((cooldown+(100-progress)/dailyRate)/SECONDS_PER_GAME_DAY)):null};
}
function startRebellion(state,region){
 const check=unrestReport(state,region);
 if(!check||check.troops>=check.requiredTroops||check.population<1||!duchySeat(region))return {ok:false};
 const owner=region.owner;
 (state.factions??={});(state.wars??={});
 const id='rebels-'+(state.nextRebellionId=(state.nextRebellionId||0)+1);
 const faction={isRebel:true,rebelAgainst:owner,regionId:region.id,gold:0,stocks:{grain:0,wood:0,iron:0,cloth:0},defeated:false,path:null};
 state.factions[id]=faction;
 state.wars[warKey(id,owner)]=true;
 const result=captureDuchy(state,region,id,{rebellion:true});
 if(!result.ok){delete state.factions[id];delete state.wars[warKey(id,owner)];return result;}
 let remaining=Math.min(300,Math.max(1,Math.floor(check.population*.25)));
 const muster=remaining;
 const displaced=Math.min(remaining,Math.floor(region.displacedResidents||0));
 region.displacedResidents=(region.displacedResidents||0)-displaced;
 remaining-=displaced;
 for(const city of region.buildings){
  if(city.type!=='city'||!remaining)continue;
  const taken=Math.min(remaining,Math.floor(city.population||0));
  city.population-=taken;remaining-=taken;
 }
 const army={owner:id,troops:muster-remaining,rebellion:true};
 if(army.troops>0)state.garrisons[region.id]=army;
 if(owner==='you')pushNotification(state,{kind:'danger',title:'Крестьянское восстание',body:region.name+' отделилось. Ополчение: '+army.troops+'. Верните город осадой.',regionId:region.id});
 return {ok:true,army,rebel:id};
}
function stepUnrest(state,dt){
 const guards=defendingTroopsByRegion(state);
 for(const r of state.regions){
  const q=unrestReport(state,r,guards);
  if(!q)continue;
  const calm=pacifying(r,state.economy?.seconds||0);
  r.unrest=q.protectedByArmy?q.progress:q.risk?Math.min(100,q.progress+dt*q.speed):Math.max(0,q.progress-dt*100/(calm?UNREST_RECOVERY_SECONDS*.55:UNREST_RECOVERY_SECONDS));
  if(r.owner==='you'){
   const stage=r.unrest>=75?2:r.unrest>=35?1:0;
   if(q.risk&&stage>(r.unrestAlertStage||0)){
    r.unrestAlertStage=stage;
    pushNotification(state,{kind:'danger',title:stage===2?'Восстание близко':'Волнения в герцогстве',
     body:r.name+' · '+Math.floor(r.unrest)+'%. '+(r.domainBurden?'Земля сверх лимита домена. Рассмотрите передачу вассалу.':'Проверьте продовольствие и состояние столицы.'),regionId:r.id});
   }else if(r.unrest<15)r.unrestAlertStage=0;
  }
  if(r.unrest>=100&&q.risk){
   if((state.revoltRandom||Math.random)()<q.chance)startRebellion(state,r);
   else{r.unrest=35;r.unrestAlertStage=1;}
  }
 }
}
function resolveRebellions(state){
 for(const [id,f] of Object.entries(state.factions||{})){
  if(!f.isRebel||f.rebellionEnded||state.regions.some(r=>r.owner===id))continue;
  f.defeated=true;f.rebellionEnded=true;
  for(const key of Object.keys(state.wars||{}))if(key.split('|').includes(id))delete state.wars[key];
  const region=state.regions.find(r=>r.id===f.regionId);
  state.onRebellion?.({kind:'end',region,owner:f.rebelAgainst,rebel:id});
 }
}
const TAX_PER_1000=40;
function duchyTax(state,region){
 if(region.awaitingAdministration)return 0;
 const support=advisorIsWorking(state,'steward',region);
 return regionalPopulation(region)*economicEfficiency(region)*TAX_PER_1000/1000*(support?.action==='tax'?1.25:1);
}
function taxIncome(state,owner='you'){
 return state.regions.reduce((sum,region)=>sum+(region.owner===owner?duchyTax(state,region)*(vassalFor(state,region)?1-VASSAL_SHARE:1):0),0);
}
function administrationUpkeep(landCount){
 const extra=Math.max(0,landCount-1);
 return extra*Math.min(29,7+1.2*extra);
}
function realmTreasuryReport(state,owner='you'){
 const taxes=taxIncome(state,owner),reparations=reparationRates(state,owner);
 let upkeep=garrisonUpkeep(state,owner);
 for(const vassal of state.vassals?.values()||[]){
  if(vassal.owner!==owner)continue;
  const income=vassal.lands.reduce((total,id)=>{
   const region=councilRegion(state,id,owner);
   return total+(vassalFor(state,region)===vassal?duchyTax(state,region)*VASSAL_SHARE:0);
  },0);
  upkeep=Math.max(0,upkeep-Math.min(vassal.gold+income,vassalArmyUpkeep(state,vassal)));
 }
 const administration=administrationUpkeep(state.regions.filter(r=>r.owner===owner).length);
 const net=taxes-upkeep-administration+reparations.incoming-reparations.outgoing;
 const now=state.economy?.seconds||0;
 let committed=0;
 for(const task of Object.values(getRealmCouncil(state,owner)?.monthly||{})){
  if(task.rate&&task.end>now&&councilTaskRegion(state,task))committed+=task.rate;
 }
 const account=owner==='you'?state:state.factions?.[owner];
 return {taxes,upkeep,administration,net,committed,free:net-committed,reparations,penalty:account?.financePenalty||0};
}
function councilBudgetLimit(state,direction,owner='you'){
 const council=getRealmCouncil(state,owner);
 if(!council||!state.economy)return 0;
 const now=state.economy.seconds,current=council.monthly[direction];
 let start=Number.isFinite(current?.end)?Math.max(now,current.end):now;
 if(Number.isFinite(current?.end)){
  for(const task of council.taskQueues[direction]||[]){
   if(!councilTaskRegion(state,task))continue;
   if(COUNCIL_DIRECTIONS[direction].tasks[task.action].ongoing){start=Infinity;break}
   start=councilMonthEnd(start);
  }
 }
 const end=Number.isFinite(start)?councilMonthEnd(start):Infinity;
 if(!Number.isFinite(start))start=now;
 const peak=scheduledCouncilPeak(state,owner,direction,start,end);
 const {taxes,upkeep,reparations}=realmTreasuryReport(state,owner);
 return Math.max(0,Math.floor(taxes-upkeep-reparations.outgoing-peak+1e-8));
}
function scheduledCouncilPeak(state,owner,excluded,start,end=Infinity){
 const council=getRealmCouncil(state,owner),now=state.economy.seconds,events=new Map();
 for(const role of Object.keys(COUNCIL_DIRECTIONS)){
  if(role===excluded)continue;
  const active=council.monthly[role];
  let from=now;
  for(const task of [active,...(council.taskQueues[role]||[])]){
   if(!task||!councilTaskRegion(state,task))continue;
   const to=task===active?Math.max(now,task.end):COUNCIL_DIRECTIONS[role].tasks[task.action].ongoing?Infinity:councilMonthEnd(from);
   const left=Math.max(start,from),right=Math.min(end,to);
   if(task.rate&&left<right){
    events.set(left,(events.get(left)||0)+task.rate);
    events.set(right,(events.get(right)||0)-task.rate);
   }
   from=to;
   if(from===Infinity||from>=end)break;
  }
 }
 let activeRate=0,peak=0;
 for(const time of [...events.keys()].sort((a,b)=>a-b)){
  activeRate+=events.get(time);peak=Math.max(peak,activeRate);
 }
 return peak;
}
function payRealmUpkeep(state,owner,regions,dt,guards){
 const ledger=factionLedger(state,owner);
 let taxes=0,upkeep=garrisonUpkeep(state,owner,guards)*dt/60;
 const houses=new Set();
 for(const region of regions){
  const income=duchyTax(state,region)*dt/60,vassal=vassalFor(state,region);
  const local=shareVassalGold(vassal,income);
  if(vassal)houses.add(vassal);
  taxes+=income-local;
 }
 for(const vassal of houses){
  const paid=Math.min(upkeep,vassal.gold,vassalArmyUpkeep(state,vassal)*dt/60);
  vassal.gold-=paid;
  upkeep-=paid;
 }
 upkeep+=administrationUpkeep(regions.length)*dt/60;
 const cash=Math.max(0,ledger.gold)+taxes;
 ledger.gold=Math.max(0,cash-upkeep);
 recordCampaignIncome(state,owner,taxes-upkeep);
 return {due:upkeep,unpaid:Math.max(0,upkeep-cash)};
}
function updateRealmFinances(state,owner,regions,dt,payroll,councilPayroll,reparations={due:0,unpaid:0}){
 const account=owner==='you'?state:state.factions[owner];
 const unpaid=payroll.unpaid+councilPayroll.unpaid+reparations.unpaid;
 const due=payroll.due+councilPayroll.due+reparations.due;
 const crisis=unpaid>1e-7&&factionLedger(state,owner).gold<1e-7;
 const target=crisis?8+24*Math.min(1,unpaid/Math.max(unpaid,due)):0;
 const before=account.financePenalty||0;
 const penalty=before+(target-before)*(1-Math.exp(-dt/(target>before?45:75)));
 account.financePenalty=penalty;
 for(const region of regions)region.treasuryPenalty=penalty;
 if(owner==='you'&&crisis&&!account.financeCrisis)
  pushNotification(state,{kind:'danger',title:'Казна опустела',body:'Денег не хватает на текущие расходы. Стабильность падает во всех герцогствах.',regionId:state.capitalId});
 account.financeCrisis=crisis;
}
function productionTotals(state,capitalOnly=false,owner='you'){
 const capitalId=realmCapitalId(state,owner),totals=Object.fromEntries(GOODS.map(k=>[k,0]));
 for(const r of state.regions)if(r.owner===owner){
  const workforce=workforceReport(r);
  for(const b of r.buildings){
   if(!b.product)continue;
   if(capitalOnly&&state.economy?.granaries&&b.type==='grain'){
    const share=localGrainShare(r);
    totals.grain+=productionRate(r,b,workforce)*(r.id===capitalId?1:b.route?.length?1-share:0);
   }else if(b.route?.length)totals[b.type]+=productionRate(r,b,workforce)*(vassalFor(state,r)?1-VASSAL_SHARE:1);
  }
 }
 return totals;
}
function populationTotal(state){return state.regions.filter(r=>r.owner==='you').reduce((n,r)=>n+r.buildings.filter(b=>b.type==='city').reduce((s,b)=>s+(b.population||0),0),0)}
// Regional statistics derive from real residents, production and cargo, not estimates of stock.
function regionEconomy(state,r){const empty=()=>Object.fromEntries(GOODS.map(g=>[g,0])),production=empty(),blocked=empty(),transit=empty(),waiting=empty(),delivered=empty();if(!r)return {population:0,tax:0,grainNeed:0,production,blocked,transit,waiting,delivered};let population=r.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+(b.population||0),0),housing=r.buildings.reduce((n,b)=>n+cityHousing(b),0),workforce=workforceReport(r);for(const b of r.buildings){if(!b.product||!GOODS.includes(b.type))continue;const rate=productionRate(r,b,workforce),kept=b.type==='grain'&&state.economy?.granaries?localGrainShare(r):0;if(b.route?.length)production[b.type]+=rate;else{production[b.type]+=rate*kept;blocked[b.type]+=rate*(1-kept);}waiting[b.type]+=Math.max(0,b.produced||0)}for(const ship of state.economy?.shipments||[])if(ship.kind==='supply'&&ship.owner==='you'&&ship.originRegion===r.id&&ship.marketTransfer==null)for(const [good,amount] of Object.entries(ship.cargo||{[ship.good]:ship.amount}))if(good in transit)transit[good]+=amount;let totals=state.economy?.regionDeliveries?.[r.id];if(totals)for(const g of GOODS)delivered[g]=totals[g]||0;return {population,housing,workforce,tax:duchyTax(state,r),grainNeed:regionGrainNeed(state,r),production,blocked,transit,waiting,delivered}}
// Keep capital stocks, goods still at workshops and actual outbound supply distinct.
function logisticsReport(state){let goods=Object.fromEntries(GOODS.map(g=>[g,{stock:state.economy?.stocks?.[g]||0,production:0,blocked:0,waiting:0,transit:0,shipments:0,blockedShipments:0,seaTransit:0,nextArrival:null}])),blockedBuildings=0;for(const r of state.regions||[])if(r.owner==='you'){const workforce=workforceReport(r);for(const b of r.buildings){let g=goods[b.type];if(!b.product||!g)continue;let rate=productionRate(r,b,workforce),grain=b.type==='grain'&&state.economy?.granaries;if(grain&&r.id!==state.capitalId)rate*=1-localGrainShare(r);else if(vassalFor(state,r))rate*=1-VASSAL_SHARE;if(b.route?.length||grain&&r.id===state.capitalId)g.production+=rate;else if(rate>0){g.blocked+=rate;blockedBuildings++}g.waiting+=Math.max(0,b.produced||0)}}for(const ship of state.economy?.shipments||[]){if(ship.kind!=='supply'||ship.owner!=='you'||ship.supplyMarketId!=null)continue;for(const [good,amount] of Object.entries(ship.cargo||{[ship.good]:ship.amount})){let g=goods[good];if(!g)continue;g.transit+=amount;g.shipments++;if(ship.seaSupply)g.seaTransit+=amount;if(ship.supplyBlocked)g.blockedShipments++;if(!ship.supplyBlocked){let eta=Math.max(0,ship.duration-ship.elapsed);g.nextArrival=g.nextArrival==null?eta:Math.min(g.nextArrival,eta)}}}return {goods,blockedBuildings}}
const GRAIN_FLOW_WINDOW=30,BASE_GROWTH=.01,LOCAL_HARVEST_GROWTH=.003,GRAIN_SPOILAGE=.20;
// Frontier catch-up: settlements below this population grow noticeably faster
// (with a floor on the jobs factor), so new territories can reach a workable
// population — enough to raise troops — instead of stalling at a few hundred.
const FRONTIER_POP=1000,FRONTIER_JOB_FLOOR=.6,CITY_GROWTH_MULT=30;
function recordGrainFlow(state,amount,regionId=state.capitalId){
 const e=state.economy;
 if(!e||!Number.isFinite(amount)||!amount)return;
 const event={time:e.seconds,amount};
 e.grainFlow.push(event);
 granaryFor(state,regionId)?.flow.push(event);
}
function localHarvestGrowth(need,harvest){
 return need>0?LOCAL_HARVEST_GROWTH*Math.max(0,Math.min(1,(harvest/need-1)*4)):0;
}
function grainGrowthMetrics(state){
 const e=state.economy,need=populationTotal(state)*GRAIN_PER_RESIDENT+garrisonGrainNeed(state);
 const window=Math.max(8,Math.min(GRAIN_FLOW_WINDOW,e?.seconds||0));
 const delivered=(e?.grainFlow||[]).reduce((sum,event)=>sum+event.amount,0)*60/window;
 const bonus=localHarvestGrowth(need,granaryFor(state,state.capitalId)?.harvestRate||0);
 return {need,delivered,bonus,rate:BASE_GROWTH+bonus};
}
function grainStorageCapacity(state,region,need=regionGrainNeed(state,region)){
 const capital=region.id===realmCapitalId(state,region.owner);
 const settings=region.owner==='you'?state.economy:state.factions?.[region.owner];
 const armyReserve=capital&&settings?.grainPolicy==='army';
 return Math.ceil(Math.max(armyReserve?60:35,need*(armyReserve?6:4))+(region.store?.level||0)*30);
}
function grainReserve(state,owner='you'){
 const settings=owner==='you'?state.economy:state.factions?.[owner];
 const capital=councilRegion(state,realmCapitalId(state,owner),owner);
 const need=capital?(granaryFor(state,capital.id)?.need??regionGrainNeed(state,capital)):0;
 const policy=settings?.grainPolicy;
 return Math.max(policy==='army'?60:12,Math.ceil(need*(policy==='army'?6:policy==='trade'?1.5:2.5)));
}
function grainMarketLimit(state,owner,limit){
 const capital=councilRegion(state,realmCapitalId(state,owner),owner);
 const need=capital?(granaryFor(state,capital.id)?.need??regionGrainNeed(state,capital)):0;
 return Math.min(limit,Math.max(12,Math.ceil(need*2.5)));
}
// Keep roughly one minute of local output before automatically selling surpluses.
function tradeReserve(state,good,owner='you',output=null){
 if(good==='grain')return grainReserve(state,owner);
 const settings=owner==='you'?state.economy:state.factions?.[owner];
 return Math.max(TRADE_RESERVE[good]||0,Math.ceil((output||productionTotals(state,false,owner))[good]||0),
  (EQUIPMENT_RECIPE[good]||0)*(settings?.industryReserve||0));
}

const MARKET_COST={gold:140,wood:24,iron:10}, MARKET_BUILD_SECONDS=36;
const MARKET_GOODS=['wood','iron','cloth'];
const EQUIPMENT_RECIPE={wood:3,iron:4,cloth:3};
const ARMORY_COST={gold:120,wood:16,iron:8};
const ARMORY_BUILD_TIME=32, ARMORY_CYCLE=20, ARMORY_BUFFER=3, ARMORY_OUTPUT_CAP=8;

function armoryCheck(state,region,purse=state,owner='you'){
 if(!state.started||state.defeated||!state.economy||region?.owner!==owner)return {ok:false,reason:'Выберите свой главный город'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(region.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 if(region.armory)return {ok:false,reason:'Оружейная мастерская уже заложена'};
 if((duchySeat(region)?.level||1)<2)return {ok:false,reason:'Нужен главный город второго уровня'};
 const ledger=factionLedger(state,owner,purse),stocks=ledger.stocks;
 const cost=landDevelopmentPrice(state,ARMORY_COST.gold,region);
 const missing=costShortfalls(ledger.gold,stocks,cost,{wood:ARMORY_COST.wood,iron:ARMORY_COST.iron});
 if(missing.length)return {ok:false,reason:'Не хватает · '+missing.join(' · '),missing};
 return {ok:true,cost};
}
function commissionArmory(state,region,purse=state,owner='you'){
 const check=armoryCheck(state,region,purse,owner);
 if(!check.ok)return check;
 const ledger=factionLedger(state,owner,purse);
 ledger.gold-=check.cost;
 ledger.stocks.wood-=ARMORY_COST.wood;
 ledger.stocks.iron-=ARMORY_COST.iron;
 region.armory={ready:false,readyAt:state.economy.seconds+ARMORY_BUILD_TIME,policy:'normal',commissionedByCouncil:purse!==state&&!purse?.vassalId,
  stocks:{wood:0,iron:0,cloth:0},progress:0,output:0,produced:0,blocked:false};
 return {ok:true,armory:region.armory};
}
function setArmoryPolicy(state,region,policy,owner='you'){
 if(region?.owner!==owner||!region.armory?.ready||!['normal','priority','paused'].includes(policy))return false;
 if(!canDevelopLand(state,region))return false;
 region.armory.policy=policy;
 state.economy.industryDispatchByRealm?.delete(region.owner);
 return true;
}
function armoryWarehouse(state,id,owner='you'){
 if(id===realmCapitalId(state,owner)&&councilRegion(state,id,owner))return factionLedger(state,owner).stocks;
 return tradeCenter(state,id,owner)?.market.stocks||null;
}
function armoryReady(state,id,owner='you'){
 const region=councilRegion(state,id,owner);
 return region?.armory?.ready?region:null;
}
function armoryCanWork(armory){
 return MARKET_GOODS.every(good=>armory.stocks[good]>=EQUIPMENT_RECIPE[good]);
}
function armoryRequirements(armory){
 return MARKET_GOODS.filter(good=>armory.stocks[good]<EQUIPMENT_RECIPE[good]);
}
function sendIndustryCargo(state,source,target,cargo,path,purpose){
 const goods=Object.keys(cargo);
 const ship={kind:'industry',owner:source.owner,industryPurpose:purpose,industryDestination:target.id,
  originRegion:source.id,supplyCapitalId:target.id,cargo,good:goods[0],
  amount:goods.reduce((sum,good)=>sum+cargo[good],0),path,
  mode:path.seaSupply?'sea':'land',seaSupply:path.seaSupply,seaStart:path.seaStart,seaEnd:path.seaEnd,
  elapsed:0,duration:journeyDuration(path)};
 state.economy.shipments.push(ship);
}
function finishIndustryCargo(state,ship){
 const purpose=ship.industryPurpose,id=ship.industryDestination,owner=ship.owner||'you';
 const recipient=councilRegion(state,id,owner);
 if(!recipient)return false;
 const stock=purpose==='materials'?armoryReady(state,id,owner)?.armory.stocks:armoryWarehouse(state,id,owner);
 if(!stock)return false;
 if(purpose==='equipment'&&id!==realmCapitalId(state,owner))return false;
 for(const [good,amount] of Object.entries(ship.cargo))stock[good]=(stock[good]||0)+amount;
 return true;
}
function stepArmoryWork(state,workshops,dt){
 const e=state.economy;
 if(!workshops.length)return;
 const opened=[];
 for(const region of workshops){
  const a=region.armory;
  let work=dt;
  if(!a.ready&&a.readyAt<=e.seconds){
   a.ready=true;opened.push(region);work=Math.min(dt,e.seconds-a.readyAt);
   if(region.owner==='you'&&a.commissionedByCouncil)recordCouncilResult(state,region.id,'armory','Открыта оружейная мастерская');
  }
  if(!a.ready||a.policy==='paused'||!armoryCanWork(a)||a.output>=ARMORY_OUTPUT_CAP)continue;
  const job=workforceReport(region).byBuilding.get(a);
  a.progress+=work*(job.workers/job.capacity)*(region.domainYield??1);
  while(a.progress>=ARMORY_CYCLE&&a.output<ARMORY_OUTPUT_CAP&&armoryCanWork(a)){
   for(const good of MARKET_GOODS)a.stocks[good]-=EQUIPMENT_RECIPE[good];
   a.progress-=ARMORY_CYCLE;
   const vassal=vassalFor(state,region);
   if(vassal)vassal.stocks.equipment+=VASSAL_SHARE;
   a.output+=vassal?1-VASSAL_SHARE:1;a.produced++;
  }
  // Time spent idle with no supplies does not turn into free production later.
  if(!armoryCanWork(a)||a.output>=ARMORY_OUTPUT_CAP)a.progress=0;
 }
 if(opened.length){
  for(const region of opened)e.industryDispatchByRealm?.delete(region.owner);
  state.onArmoriesReady?.(opened);
 }
 for(const region of workshops){
  if(region.id!==realmCapitalId(state,region.owner)||!region.armory.output)continue;
  const stocks=factionLedger(state,region.owner).stocks;
  stocks.equipment=(stocks.equipment||0)+region.armory.output;
  region.armory.output=0;
 }
}
function dispatchArmoryShipments(state,workshops,owner='you'){
 if(!workshops.length)return;
 const e=state.economy,capital=councilRegion(state,realmCapitalId(state,owner),owner);
 if(!capital)return;
 const dispatch=e.industryDispatchByRealm??=new Map();
 if(e.seconds<(dispatch.get(owner)||0))return;
 dispatch.set(owner,e.seconds+DISPATCH_SECONDS);
 const industrial=e.shipments.filter(s=>s.kind==='industry'&&s.owner===owner);
 let slots=Math.max(0,Math.min(3,10-industrial.length));
 const donors=state.regions.filter(r=>r.owner===owner&&(r===capital||r.market?.ready))
  .map(source=>({source,stocks:armoryWarehouse(state,source.id,owner)})).filter(donor=>donor.stocks);
 const priority=region=>Number(region.armory.policy==='priority');
 const prioritized=workshops.filter(r=>r.armory.ready).sort((a,b)=>
  Number(priority(b))-Number(priority(a))||
  (a.armory.lastDispatch||0)-(b.armory.lastDispatch||0)||a.id-b.id);
 for(const region of prioritized){
  const a=region.armory;
  a.blocked=false;
  if(slots&&a.output>=1&&region!==capital&&!industrial.some(s=>s.industryPurpose==='equipment'&&s.originRegion===region.id)){
   const path=state.grainRoute?.(region,capital);
   if(path){
    const amount=Math.min(4,Math.floor(a.output));
    a.output-=amount;sendIndustryCargo(state,region,capital,{equipment:amount},path,'equipment');
    slots--;
   }else a.blocked=true;
  }
  if(a.policy==='paused'||a.output>=ARMORY_OUTPUT_CAP||
     industrial.some(s=>s.industryPurpose==='materials'&&s.industryDestination===region.id))continue;
  const needs=Object.fromEntries(MARKET_GOODS.map(good=>[good,Math.max(0,EQUIPMENT_RECIPE[good]*ARMORY_BUFFER-a.stocks[good])]));
  if(!Object.values(needs).some(Boolean))continue;
  // A market and a workshop in one city share a loading yard.
  const vassal=vassalFor(state,region),local=vassal?.stocks||armoryWarehouse(state,region.id,owner);
  if(local)for(const good of MARKET_GOODS){
   const amount=Math.min(needs[good],Math.floor(local[good]||0));
   if(!amount)continue;
   local[good]-=amount;a.stocks[good]+=amount;needs[good]-=amount;
  }
  if(vassal||!slots||!Object.values(needs).some(Boolean))continue;
  const critical=armoryRequirements(a);
  const order=donors.filter(d=>d.source!==region).map(({source,stocks})=>{
   const cargo={};
   for(const good of MARKET_GOODS){
    const amount=Math.min(needs[good],Math.floor(stocks[good]||0));
    if(amount>0)cargo[good]=amount;
   }
   return {source,stocks,cargo,minimum:distance(source.slots[0],region.slots[0])};
  }).filter(x=>critical.length?critical.some(good=>x.cargo[good]):Object.keys(x.cargo).length)
   .sort((a,b)=>a.minimum-b.minimum);
  let best=null;
  for(const candidate of order){
   if(best&&candidate.minimum/SHIP_SPEED>=best.time)break;
   const path=state.grainRoute?.(candidate.source,region);
   if(!path)continue;
   const time=journeyDuration(path);
   if(!best||time<best.time)best={...candidate,path,time};
   if(time<=candidate.minimum/CART_SPEED*1.12)break;
  }
  if(!best){a.blocked||=order.length>0;continue}
  for(const [good,amount] of Object.entries(best.cargo))best.stocks[good]-=amount;
  sendIndustryCargo(state,best.source,region,best.cargo,best.path,'materials');
  a.lastDispatch=e.seconds;slots--;
 }
}

function tradeCenter(state,regionId,owner='you'){
 if(regionId==null||regionId===realmCapitalId(state,owner))return null;
 const region=state.regions.find(r=>r.id===regionId&&r.owner===owner);
 return region?.market?.ready?region:null;
}
function marketCheck(state,region,purse=state,owner='you'){
 if(!state.started||region?.owner!==owner||region.id===realmCapitalId(state,owner))return {ok:false,reason:'Выберите своё герцогство вне столицы'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(region.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 if(region.market||(duchySeat(region)?.level||1)<2)return {ok:false,reason:region.market?'Торговый центр уже заложен':'Улучшите главный город до уровня 2'};
 const ledger=factionLedger(state,owner,purse);
 const cost=landDevelopmentPrice(state,MARKET_COST.gold,region);
 const missing=costShortfalls(ledger.gold,ledger.stocks,cost,{wood:MARKET_COST.wood,iron:MARKET_COST.iron});
 if(missing.length)return {ok:false,reason:'Не хватает · '+missing.join(' · '),missing};
 return {ok:true,cost};
}
function commissionMarket(state,region,purse=state,owner='you'){
 const check=marketCheck(state,region,purse,owner);
 if(!check.ok)return check;
 const ledger=factionLedger(state,owner,purse);ledger.gold-=check.cost;
 for(const resource of ['wood','iron'])ledger.stocks[resource]-=MARKET_COST[resource];
 region.market={ready:false,readyAt:state.economy.seconds+MARKET_BUILD_SECONDS,policy:'export',commissionedByCouncil:purse!==state&&!purse?.vassalId,
  stocks:{wood:0,iron:0,cloth:0},sales:0,revenue:0};
 return {ok:true};
}
// Regional store: keeps more of the local harvest and stretches siege endurance.
function storeCheck(state,region,purse=state,owner='you'){
 if(!state.started||region?.owner!==owner||region.id===realmCapitalId(state,owner))return {ok:false,reason:'Выберите своё герцогство вне столицы'};
 if(region.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if((region.store?.level||0)>=STORE_MAX_LEVEL)return {ok:false,reason:'Склад улучшен до предела'};
 if(!duchySeat(region))return {ok:false,reason:'Нужен главный город'};
 const ledger=factionLedger(state,owner,purse);
 const cost=landDevelopmentPrice(state,STORE_COST.gold,region);
 const missing=costShortfalls(ledger.gold,ledger.stocks,cost,{wood:STORE_COST.wood});
 if(missing.length)return {ok:false,reason:'Не хватает · '+missing.join(' · '),missing};
 return {ok:true,cost};
}
function buildStore(state,region,purse=state,owner='you'){
 const check=storeCheck(state,region,purse,owner);
 if(!check.ok)return check;
 const ledger=factionLedger(state,owner,purse);ledger.gold-=check.cost;
 ledger.stocks.wood-=STORE_COST.wood;
 region.store={level:(region.store?.level||0)+1};
 return {ok:true,store:region.store};
}
function setSupplyPriority(state,region,priority,owner='you'){
 if(!state.started||region?.owner!==owner)return {ok:false,reason:'Земля недоступна'};
 if(region.id===realmCapitalId(state,owner))return {ok:false,reason:'Столица всегда снабжается первой'};
 if(vassalFor(state,region))return {ok:false,reason:'Вассал распоряжается снабжением сам'};
 region.supplyPriority=!!priority;
 return {ok:true,priority:region.supplyPriority};
}
function stepTradeCenters(state){
 const finished=[];
 for(const region of state.regions){
  if(region.owner==='neutral'||!region.market||region.market.ready||region.market.readyAt>state.economy.seconds)continue;
  region.market.ready=true;finished.push(region);
  if(region.owner==='you'&&region.market.commissionedByCouncil)recordCouncilResult(state,region.id,'market','Открыт торговый центр');
 }
 if(finished.length)state.onMarketsReady?.(finished);
}
function depositMarketCargo(state,regionId,cargo,owner='you'){
 const market=tradeCenter(state,regionId,owner)?.market;
 const stocks=market?.stocks||factionLedger(state,owner).stocks;
 for(const [good,amount] of Object.entries(cargo))stocks[good]=(stocks[good]||0)+amount;
}
function shipMarketReserves(state,owner='you'){
 const e=state.economy,capital=councilRegion(state,realmCapitalId(state,owner),owner);
 if(!capital||!state.grainRoute)return;
 const hasBuyer=['you',...Object.keys(state.factions||{})].some(id=>id!==owner&&campaignNationAlive(state,id)&&!isAtWar(state,owner,id));
 const policies=owner==='you'?e:state.factions[owner];
 for(const region of state.regions){
  const market=region.market;
  if(region.owner!==owner||!market?.ready||(market.nextTransfer||0)>e.seconds)continue;
  if(e.shipments.some(ship=>ship.kind==='supply'&&ship.marketTransfer===region.id))continue;
  const restock=market.policy==='export'&&!vassalFor(state,region);
  market.nextTransfer=e.seconds+(restock?30:DISPATCH_SECONDS);
  if(restock&&!hasBuyer)continue;
  const from=restock?capital:region,to=restock?region:capital,stocks=restock?factionLedger(state,owner).stocks:market.stocks;
  const cargo={};let amount=0;
  for(const good of MARKET_GOODS){
   const quantity=restock?(policies.exportPolicy?.[good]==='hold'?0:Math.floor(Math.min(16-market.stocks[good],
    (stocks[good]-tradeReserve(state,good,owner))*.35))):Math.floor(stocks[good]);
   const load=Math.min(48-amount,quantity);
   if(load>0){cargo[good]=load;amount+=load;}
  }
  if(!amount){market.transferBlocked=false;continue;}
  const path=state.grainRoute(from,to);
  market.transferBlocked=!path;
  if(!path)continue;
  for(const [good,quantity] of Object.entries(cargo))stocks[good]-=quantity;
  e.shipments.push({kind:owner==='you'?'supply':'botSupply',owner,marketTransfer:region.id,originRegion:from.id,supplyCapitalId:to.id,
   supplyMarketId:restock?to.id:undefined,good:Object.keys(cargo)[0],amount,cargo,path,
   mode:path.seaSupply?'sea':'land',seaSupply:path.seaSupply,seaStart:path.seaStart,seaEnd:path.seaEnd,
   elapsed:0,duration:journeyDuration(path)});
 }
}

function granaryFor(state,id){
 const stores=state.economy?.granaries;
 if(!stores||id==null)return null;
 if(!stores.has(id))stores.set(id,{stock:0,flow:[],fed:1});
 return stores.get(id);
}
function regionalGrainLedger(state,id){
 if(id==null)return null;
 if(id===state.capitalId)return state.economy?.stocks;
 const owner=state.regions.find(r=>r.id===id)?.owner,faction=state.factions?.[owner];
 return faction?.regionId===id&&!faction.isRebel?faction.stocks:null;
}
function granaryStock(state,id){
 const ledger=regionalGrainLedger(state,id);
 return ledger?ledger.grain||0:granaryFor(state,id)?.stock||0;
}
function changeGranaryStock(state,id,amount){
 const ledger=regionalGrainLedger(state,id);
 if(ledger)ledger.grain=Math.max(0,(ledger.grain||0)+amount);
 else{const granary=granaryFor(state,id);if(granary)granary.stock=Math.max(0,granary.stock+amount);}
}
function regionGrainNeed(state,region){
 const g=state.garrisons?.[region.id];
 return cityExternalGrainNeed(region)+(g?.owner===region.owner?g.troops*.005:0);
}
function setCouncilGrainPolicy(state,policy){
 if(!state.economy||!['growth','trade','army'].includes(policy))return false;
 state.economy.grainPolicy=policy;
 return true;
}
function isGranaryShipment(ship){
 return ship.kind==='granary'||ship.kind==='supply'&&ship.grainDestination!=null;
}
function recordLocalGrain(state,id,amount){
 if(amount)granaryFor(state,id).flow.push({time:state.economy.seconds,amount});
}
function finishGranaryShipment(state,ship){
 const recipient=state.regions.find(r=>r.id===ship.grainDestination&&r.owner===ship.owner);
 if(!recipient)return false;
 changeGranaryStock(state,recipient.id,ship.amount);
 if(ship.grainPurpose==='harvest'){
  if(ship.owner!=='you'){recordLocalGrain(state,recipient.id,ship.amount);return true;}
  recordGrainFlow(state,ship.amount,recipient.id);
  const deliveries=state.economy.regionDeliveries??={};
  const totals=deliveries[ship.originRegion]??={};
  totals.grain=(totals.grain||0)+ship.amount;
 }else recordLocalGrain(state,recipient.id,ship.amount);
 if(ship.grainPurpose==='relief')activateCouncilRelief(state,recipient);
 return true;
}
function localHarvest(region){
 const workforce=workforceReport(region);
 return region.buildings.reduce((total,b)=>total+(b.type==='grain'?productionRate(region,b,workforce):0),0);
}
function granaryReport(state,region){
 if(region.owner!=='you')return null;
 const entry=granaryFor(state,region.id);
 if(!entry)return null;
 const stock=granaryStock(state,region.id),need=entry.need??regionGrainNeed(state,region);
 const runs=state.economy.shipments.filter(ship=>ship.kind==='granary'&&ship.grainPurpose==='relief'&&ship.grainDestination===region.id);
 const trip=runs.find(ship=>!ship.supplyBlocked),blocked=runs.some(ship=>ship.supplyBlocked);
 const workforce=workforceReport(region),share=localGrainShare(region);
 let kept=0,shipped=0,waiting=0;
 for(const building of region.buildings){
  if(building.type!=='grain')continue;
  const output=productionRate(region,building,workforce);
  kept+=output*share;
  if(building.route?.length)shipped+=output*(1-share);
  else waiting+=output*(1-share);
 }
 return {stock,need,kept,shipped,waiting,subsistence:region.buildings.reduce((total,city)=>total+
  (city.type==='city'?Math.min(CITY_SELF_FEED_LIMIT,city.population||0):0),0),capital:share===1,storage:grainStorageCapacity(state,region,need),spoilage:entry.spoilage||0,harvestBonus:localHarvestGrowth(need,kept),
  days:need>0?Math.floor(stock*60/(need*SECONDS_PER_GAME_DAY)):null,
  eta:trip?Math.max(1,Math.ceil((trip.duration-trip.elapsed)/SECONDS_PER_GAME_DAY)):null,amount:trip?.amount,risky:!!trip?.routeRisk,
  blocked:!trip&&blocked,hungry:entry.fed<.999};
}
function consumeRegionalGrain(state,owned,dt){
 const e=state.economy;
 for(const region of owned)granaryFor(state,region.id).need=regionGrainNeed(state,region);
 function consumeForArmy(unit,point){
  if(unit.troops<=0)return;
  const region=point&&state.armyTerritoryAt?.(point);
  const capital=unit.owner==='you'?state.capitalId:state.factions?.[unit.owner]?.regionId;
  const granary=granaryFor(state,region?.owner===unit.owner?region.id:capital);
  if(granary)granary.need=(granary.need||0)+unit.troops*.005;
 }
 for(const unit of state.fieldArmies||[])consumeForArmy(unit,unit.location?.point);
 for(const unit of state.armyMoves||[])consumeForArmy(unit,pointOnRoute(unit.path,unit.elapsed/unit.duration));
 e.hungryRegion=null;
 for(const region of owned){
  const g=granaryFor(state,region.id),stock=granaryStock(state,region.id);
  const need=g.need*dt/60,used=Math.min(need,stock);
  g.fed=need?used/need:1;
  g.growthFood=Math.max(0,stock-used);
  changeGranaryStock(state,region.id,-used);
  const excess=Math.max(0,stock-used-grainStorageCapacity(state,region,g.need));
  const spoiled=excess*(1-(1-GRAIN_SPOILAGE)**(dt/60));
  if(spoiled>0)changeGranaryStock(state,region.id,-spoiled);
  g.spoilage=spoiled*60/dt;
  g.flow=g.flow.filter(event=>e.seconds-event.time<GRAIN_FLOW_WINDOW);
  g.growth=(BASE_GROWTH+localHarvestGrowth(g.need,g.harvestRate||0))*g.fed-.12*(1-g.fed);
  if(region.owner==='you'&&g.fed<.999&&(!e.hungryRegion||g.fed<granaryFor(state,e.hungryRegion.id).fed))e.hungryRegion=region;
 }
 return !e.hungryRegion;
}
function repairBotCities(state,regions){
 for(const region of regions){
  const faction=state.factions?.[region.owner];
  if(!region.occupation||!faction||faction.isRebel||vassalFor(state,region)||faction.gold<SEAT_REPAIR_GOLD+35)continue;
  repairSeat(state,region,region.owner);
 }
}
// Trade capacity is tied to the capital and to owned ports; inbound imports share land capacity.
function tradeFleet(state,owner='you',vassal=null){
 const seat=councilRegion(state,vassal?.seatId??realmCapitalId(state,owner),owner);
 const city=vassal?duchySeat(seat):seat?.buildings.find(b=>b.type==='city'&&b.capital);
 const lands=state.regions.filter(r=>r.owner===owner&&!r.awaitingAdministration&&vassalFor(state,r)===vassal);
 const land=city?Math.max(1,Math.min(3,(city.level||1)+(vassal&&lands.some(r=>r.market?.ready)?1:0))):0;
 const ports=lands.flatMap(r=>r.buildings.filter(b=>b.type==='port').map(b=>r.id+':'+b.slotId));
 const charter=!vassal&&campaignPortCharter(state,owner);
 if(charter)ports.push(charter.key);
 const active=(state.economy?.shipments||[]).filter(ship=>shipmentOwner(ship)===owner&&ship.fleetClass&&(ship.vassalId??null)===(vassal?.id??null)&&
  ['export','import','returnTrade','tradeReturn'].includes(ship.kind));
 const landUsed=active.filter(ship=>ship.fleetClass==='land').length,seaShips=active.filter(ship=>ship.fleetClass==='sea');
 return {land,landUsed,landFree:Math.max(0,land-landUsed),sea:ports.length,seaUsed:seaShips.length,seaFree:Math.max(0,ports.length-seaShips.length),
  ports,busyPorts:new Set(seaShips.map(ship=>ship.portKey))};
}
function tradeFleetAvailable(state,offer,owner='you',vassal=null,fleet=tradeFleet(state,owner,vassal)){
 return offer.mode==='sea'?fleet.seaFree>0&&fleet.ports.includes(offer.portKey)&&!fleet.busyPorts.has(offer.portKey):fleet.landFree>0;
}
function returnMerchantHome(state,ship){const owner=shipmentOwner(ship);let path=(ship.path||[]).slice().reverse(),total=routeLength(path),sea=ship.mode==='sea'&&Number.isFinite(ship.seaStart)&&Number.isFinite(ship.seaEnd),oldStart=ship.seaStart,oldEnd=ship.seaEnd;if(sea)markSeaLeg(path,Math.max(0,total-oldEnd),Math.max(0,total-oldStart));Object.assign(ship,{kind:'tradeReturn',owner,path,elapsed:0,duration:journeyDuration(path),seaStart:sea?Math.max(0,total-oldEnd):null,seaEnd:sea?Math.max(0,total-oldStart):null,amount:0,cargo:null,value:0,returnCapitalId:merchantHomeId(state,ship)});state.planMerchantReturn?.(ship);return ship}
// First military step: station a paid garrison recruited from real local residents.
const RECRUIT_QUEUE_LIMIT=5;
const RECRUIT_BATCH=100,RECRUIT_IRON=6,RECRUIT_CLOTH=4,RECRUIT_GOLD=50,GARRISON_UPKEEP=.02;
function armyTroops(state,owner='you'){return Object.values(state.garrisons||{}).filter(g=>g.owner===owner).reduce((n,g)=>n+g.troops,0)+(state.armyMoves||[]).filter(g=>g.owner===owner).reduce((n,g)=>n+g.troops,0)+(state.fieldArmies||[]).filter(g=>g.owner===owner).reduce((n,g)=>n+g.troops,0)}
function garrisonGrainNeed(state,owner='you'){return armyTroops(state,owner)*.005}
function garrisonUpkeep(state,owner='you',guards=null){
 const task=getRealmCouncil(state,owner)?.monthly.marshal;
 const region=task&&state.regions.find(r=>r.id===task.regionId),support=advisorIsWorking(state,'marshal',region);
 const saved=support?((guards||defendingTroopsByRegion(state)).get(region.id)||0)*(task.action==='supply'?.25:.15):0;
 return (armyTroops(state,owner)-saved)*GARRISON_UPKEEP;
}
const MARSHAL_RECRUIT_STEP=10;
function marshalMarketPrice(troops){
 const share=troops/RECRUIT_BATCH,iron=Math.ceil(RECRUIT_IRON*share),cloth=Math.ceil(RECRUIT_CLOTH*share);
 const materials=iron*TRADE_PRICE.iron+cloth*TRADE_PRICE.cloth;
 return {iron,cloth,materials,total:Math.ceil(RECRUIT_GOLD*share)+materials};
}
function marshalAffordableTroops(gold,residents=RECRUIT_BATCH){
 let troops=Math.floor(Math.min(residents,RECRUIT_BATCH)/MARSHAL_RECRUIT_STEP)*MARSHAL_RECRUIT_STEP;
 while(troops>0&&marshalMarketPrice(troops).total>gold+1e-8)troops-=MARSHAL_RECRUIT_STEP;
 return troops;
}
function recruitSiteCheck(state,region,owner='you',troops=RECRUIT_BATCH){
 if(!state.started||!state.economy)return {ok:false,reason:'Сначала выберите столицу'};
 if(!region||region.owner!==owner)return {ok:false,reason:'Можно нанимать только в своих землях'};
 if(region.awaitingAdministration)return {ok:false,reason:'Сначала выберите управление герцогством'};
 if(recruitQueue(state,region).length>=RECRUIT_QUEUE_LIMIT)return {ok:false,reason:'В очереди уже '+RECRUIT_QUEUE_LIMIT+' отрядов. Дождитесь завершения набора.'};
 if(state.garrisons?.[region.id]?.inBattle)return {ok:false,reason:'Набор недоступен, пока гарнизон в бою'};
 const residents=region.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+Math.max(0,Math.floor(b.population||0)-100),0);
 if(residents<troops)return {ok:false,reason:'Не хватает '+(troops-residents)+' свободных жителей. В каждом городе остаётся минимум 100.'};
 return {ok:true,residents};
}
function realmGeneralLimit(state,owner='you'){
 return REALM_RANKS.findIndex(rank=>rank.id===realmRank(state,owner).id)+1;
}
function generalArmy(state,owner,slot=1,vassalId=null){
 const matches=unit=>unit.owner===owner&&unit.generalSlot===slot&&(unit.vassalId??null)===vassalId&&unit.troops>0;
 return state.armyMoves?.find(matches)||state.fieldArmies?.find(matches)||null;
}
function generalCommanderName(state,owner,slot,assign=false){
 const key=owner+':'+slot;
 const existing=state.generalCommanders?.get(key)||generalArmy(state,owner,slot)?.commanderName;
 if(existing||!assign)return existing||null;
 const origin=state.commanderOrigins?.get(owner)??realmCapitalId(state,owner);
 const region=state.regions.find(r=>r.id===origin);
 if(typeof historicalCommanderPool!=='function')return null;
 const pool=historicalCommanderPool(region);
 const name=pool[(slot-1)%pool.length];
 (state.generalCommanders??=new Map()).set(key,name);
 return name;
}
function vassalArmyUpkeep(state,vassal){
 const troops=generalArmy(state,vassal.owner,1,vassal.id)?.troops||0;
 const garrison=vassal.lands.reduce((sum,id)=>{
  const guard=state.garrisons?.[id];
  return sum+(guard?.owner===vassal.owner?guard.troops:0);
 },0);
 return (troops+garrison)*GARRISON_UPKEEP;
}
function recruitDestination(state,owner,vassalId,requested){
 if(vassalId!=null)return vassalById(state,vassalId,owner)?1:null;
 const limit=realmGeneralLimit(state,owner);
 if(requested!=null)return Number.isInteger(requested)&&requested>=1&&requested<=limit?requested:null;
 if(owner==='you')return 1;
 let slot=1,smallest=Infinity;
 for(let candidate=1;candidate<=limit;candidate++){
  const count=(generalArmy(state,owner,candidate)?.troops||0)+(state.recruitments||[]).reduce((sum,order)=>
   sum+(order.owner===owner&&order.vassalId==null&&order.generalSlot===candidate?order.troops:0),0);
  if(count<smallest){slot=candidate;smallest=count}
 }
 return slot;
}
function reinforceGeneral(state,owner,slot,troops,vassalId=null){
 const house=vassalById(state,vassalId,owner);
 if(!house&&vassalId!=null){vassalId=null;slot=1}
 const existing=generalArmy(state,owner,slot,vassalId);
 if(existing){
  if(!vassalId&&!existing.commanderName)existing.commanderName=generalCommanderName(state,owner,slot,true);
  existing.troops+=troops;return existing;
 }
 const home=councilRegion(state,house?.seatId??realmCapitalId(state,owner),owner);
 if(!home?.slots?.[0])return null;
 const point=home.slots[0],key=state.network?.hubKeys.get(home.id);
 const location=state.roadNodeLocation?.(state.network,key)||{point,links:key?[key]:[]};
 const unit={owner,vassalId:house?.id,generalSlot:slot,troops,location,kind:'field',waiting:false,arrivedAt:state.economy.seconds};
 if(!house)unit.commanderName=generalCommanderName(state,owner,slot,true);
 (state.fieldArmies??=[]).push(unit);
 return unit;
}
function recruitCheck(state,region,owner='you',purse=null,{troops=RECRUIT_BATCH,market=false,generalSlot=null}={}){
 const site=recruitSiteCheck(state,region,owner,troops);
 if(!site.ok)return site;
 if(purse?.vassalId!=null&&vassalFor(state,region)?.id!==purse.vassalId)return {ok:false,reason:'Феодал набирает войска в своих землях'};
 const slot=recruitDestination(state,owner,purse?.vassalId??null,generalSlot);
 if(slot===null)return {ok:false,reason:'Этот генерал недоступен'};
 const ledger=factionLedger(state,owner,purse);
 if(!ledger)return {ok:false,reason:'Неизвестная страна'};
 const settings=owner==='you'?state.economy:state.factions[owner];
 const reserve=getRealmCouncil(state,owner)?.front.musterId!==region.id?(settings.equipmentReserve||0):0;
 const equipped=!market&&(ledger.stocks.equipment||0)>=reserve+1;
 const cost=market?marshalMarketPrice(troops).total:RECRUIT_GOLD;
 const missing=costShortfalls(ledger.gold,ledger.stocks,cost,market||equipped?{}:{iron:RECRUIT_IRON,cloth:RECRUIT_CLOTH});
 if(missing.length)return {ok:false,reason:'Не хватает · '+missing.join(' · '),missing,cost};
 const marshalBoost=market||!!advisorIsWorking(state,'marshal',region);
 return {ok:true,equipped,marshalBoost,cost,troops,generalSlot:slot,
  duration:Math.ceil(recruitmentTime(region,equipped,troops)*(marshalBoost?.75:1))};
}
function recruitmentTime(region,equipped=false,troops=RECRUIT_BATCH){
 const available=region.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+Math.max(0,(b.population||0)-100),0);
 const duration=Math.max(12,Math.min(60,Math.ceil(60/Math.sqrt(Math.max(1,available/100)))));
 const scaled=Math.ceil(duration*Math.max(.4,troops/RECRUIT_BATCH));
 return equipped?Math.ceil(scaled*.7):scaled;
}
function recruitGarrison(state,region,owner='you',purse=null,options={}){
 const check=recruitCheck(state,region,owner,purse,options);
 if(!check.ok)return check;
 const {duration,equipped,marshalBoost,troops,cost}=check,ledger=factionLedger(state,owner,purse),allocations=[];
 let left=troops;
 for(const city of region.buildings.filter(b=>b.type==='city')){
  const taken=Math.min(left,Math.max(0,Math.floor(city.population||0)-100));
  city.population=(city.population||0)-taken;left-=taken;
  if(taken)allocations.push({city,amount:taken});
  if(left<=0)break;
 }
 ledger.gold-=cost;
 if(!options.market){
  if(equipped)ledger.stocks.equipment--;
  else{ledger.stocks.iron-=RECRUIT_IRON;ledger.stocks.cloth-=RECRUIT_CLOTH}
 }
 const order={id:state.nextRecruitmentId=(state.nextRecruitmentId||0)+1,regionId:region.id,owner,vassalId:purse?.vassalId,
  generalSlot:check.generalSlot,troops,elapsed:0,duration,equipped,marshalBoost,allocations,
  purchase:options.market?marshalMarketPrice(troops):null};
 (state.recruitments??=[]).push(order);return {ok:true,order};
}
function recruitQueue(state,region){
 return (state.recruitments||[]).filter(order=>order.regionId===region?.id&&order.owner===region?.owner);
}
function restoreRecruitPopulation(region,order){
 if(region)for(const {city,amount} of order.allocations){
  const room=region.buildings.includes(city)?Math.max(0,cityHousing(city)-(city.population||0)):0;
  const housed=Math.min(room,amount);
  if(housed)city.population=(city.population||0)+housed;
  region.displacedResidents=(region.displacedResidents||0)+amount-housed;
 }
}
function cancelRecruitment(state,region,id,owner='you'){
 const index=(state.recruitments||[]).findIndex(q=>q.id===id&&q.regionId===region?.id&&q.owner===owner&&q.vassalId==null);
 if(index<0||region?.owner!==owner)return {ok:false,reason:'Этот отряд больше недоступен'};
 const order=state.recruitments[index];
 const ledger=factionLedger(state,owner,vassalById(state,order.vassalId,owner));
 if(!ledger)return {ok:false,reason:'Держава недоступна'};
 state.recruitments.splice(index,1);
 restoreRecruitPopulation(region,order);
 const task=getRealmCouncil(state,order.owner)?.monthly.marshal;
 const refund=order.purchase?.total??RECRUIT_GOLD;
 if(task&&task.id===order.councilTask&&task.end>state.economy.seconds){
  task.gold+=refund;task.lastAction='Набор отменён';
  task.recruited=Math.max(0,(task.recruited||0)-order.troops);
 }else ledger.gold+=refund;
 if(!order.purchase){
  if(order.equipped)ledger.stocks.equipment=(ledger.stocks.equipment||0)+1;
  else{ledger.stocks.iron+=RECRUIT_IRON;ledger.stocks.cloth+=RECRUIT_CLOTH}
 }
 return {ok:true};
}
function finishRecruitment(state,region,order){
 if(order.owner==='you'&&order.councilTask)recordCouncilResult(state,region.id,'recruits','',order.troops);
 const army=reinforceGeneral(state,order.owner,order.generalSlot??1,order.troops,order.vassalId??null);
 if(army)state.onRecruitmentFinished?.({region,order,army});
 else restoreRecruitPopulation(region,order);
}
function stepRecruitment(state,dt){
 const orders=state.recruitments||[],remaining=new Map();
 for(let i=0;i<orders.length;){
  const order=orders[i],region=state.regions.find(r=>r.id===order.regionId);
  if(region?.owner!==order.owner){
   orders.splice(i,1);
   restoreRecruitPopulation(region,order);
   state.onRecruitmentInterrupted?.(order,region);
   continue;
  }
  const seconds=remaining.get(region.id)??dt;
  const used=Math.min(seconds,order.duration-order.elapsed);
  order.elapsed+=used;
  remaining.set(region.id,seconds-used);
  if(order.elapsed<order.duration){i++;continue}
  orders.splice(i,1);
  finishRecruitment(state,region,order);
 }
}
// A march moves real troops between neighboring owned duchies along the road graph.
// Neutral lands have no nation yet. Other countries require war or a transit treaty.
function hasArmyAccess(state,owner,other){return !other||other==='neutral'||other===owner||isAtWar(state,owner,other)||!!state.transit?.[owner+'>'+other]||!!state.campaign?.pacts.has(warKey(owner,other))}
// Find exact entry intervals against region polygons, including narrow border crossings.
function segmentRegionSpans(region,a,b,firstOnly=false){
 const dx=b.x-a.x,dz=b.z-a.z,ts=[0,1],cross=(x,z,y,w)=>x*w-z*y;
 for(let k=0;k<region.polys.length;k++){
  const bounds=region.bounds[k];
  if(Math.max(a.x,b.x)<bounds[0]||Math.min(a.x,b.x)>bounds[2]||Math.max(a.z,b.z)<bounds[1]||Math.min(a.z,b.z)>bounds[3])continue;
  for(const ring of region.polys[k])for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const c=ring[j],d=ring[i],ex=d[0]-c[0],ez=d[1]-c[1],den=cross(dx,dz,ex,ez);
   if(Math.abs(den)<1e-10)continue;
   const cx=c[0]-a.x,cz=c[1]-a.z,t=cross(cx,cz,ex,ez)/den,u=cross(cx,cz,dx,dz)/den;
   if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
  }
 }
 ts.sort((x,y)=>x-y);
 const spans=firstOnly?null:[];
 for(let i=0;i<ts.length-1;i++){
  if(ts[i+1]-ts[i]<1e-10)continue;
  const t=(ts[i]+ts[i+1])*.5;
  if(!insideRegion(region,a.x+dx*t,a.z+dz*t))continue;
  if(firstOnly)return ts[i];
  if(spans.at(-1)?.[1]===ts[i])spans.at(-1)[1]=ts[i+1];
  else spans.push([ts[i],ts[i+1]]);
 }
 return spans;
}
function segmentRegionEntry(region,a,b){return segmentRegionSpans(region,a,b,true)}

const FORT_COST={gold:140,wood:30,iron:20};
const FORT_BUILD_SECONDS=24, GATE_GRID=12;
const gateGridKey=(x,z)=>Math.floor(x/GATE_GRID)+','+Math.floor(z/GATE_GRID);

function duchySeat(region){return region?.buildings.find(b=>b.type==='city'&&b.slotId===0)}

function fortificationCrossings(state,region){
 const cache=state.fortCrossings??=new Map();
 if(cache.has(region.id))return cache.get(region.id);
 const crossings=new Map();
 for(const [edgeKey,[a,b]] of state.network.edges){
  if(!region.bounds.some(([x0,z0,x1,z1])=>Math.max(a.x,b.x)>=x0&&Math.min(a.x,b.x)<=x1&&Math.max(a.z,b.z)>=z0&&Math.min(a.z,b.z)<=z1))continue;
  const length=distance(a,b),dx=b.x-a.x,dz=b.z-a.z;
  if(length<1e-7)continue;
  for(const [first,last] of segmentRegionSpans(region,a,b)){
   for(const [t,direction] of [[first,1],[last,-1]]){
    const x=a.x+dx*t,z=a.z+dz*t;
    let nx=direction*dx/length,nz=direction*dz/length;
    if(t===0||t===1){
     const key=edgeKey.split('|')[t],node=state.network.nodes.get(key);
     let branch=null;
     for(const neighborKey of node?.edges.keys()||[]){
      const next=state.network.nodes.get(neighborKey),length=distance(node,next);
      const offset=Math.min(.035,length/2)/length;
      if(!insideRegion(region,x+(next.x-x)*offset,z+(next.z-z)*offset)){branch=next;break}
     }
     if(!branch)continue;
     const length=distance({x,z},branch);
     nx=(x-branch.x)/length;nz=(z-branch.z)/length;
    }
    const outside={x:x-nx*.035,z:z-nz*.035};
    if(insideRegion(region,outside.x,outside.z))continue;
    const neighbor=regionAt(state.regions,outside.x,outside.z)
     ||regionAt(state.regions,x-nx*.22,z-nz*.22);
    if(neighbor===region)continue;
    const key=region.id+':'+x.toFixed(3)+','+z.toFixed(3);
    if(!crossings.has(key))crossings.set(key,{key,point:{x,z},nx,nz,neighbor});
   }
  }
 }
 const result=[...crossings.values()];
 cache.set(region.id,result);
 return result;
}

function fortificationCheck(state,region,owner='you',purse=null){
 if(!state.started||!state.network||!region||region.owner!==owner||!duchySeat(region))return {ok:false,reason:'Нужен главный город в своём герцогстве'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 if(state.fortifications?.get(region.id)?.owner===owner)return {ok:false,reason:'Крепость уже назначена'};
 const passages=fortificationCrossings(state,region).filter(p=>p.neighbor?.owner!==owner);
 if(!passages.length)return {ok:false,reason:'Нет дорог через внешнюю границу'};
 const ledger=factionLedger(state,owner,purse);
 if(!ledger?.stocks)return {ok:false,passages,reason:'Казна недоступна'};
 const cost=landDevelopmentPrice(state,FORT_COST.gold,region);
 const missing=costShortfalls(ledger.gold,ledger.stocks,cost,{wood:FORT_COST.wood,iron:FORT_COST.iron});
 if(missing.length)return {ok:false,passages,reason:'Не хватает · '+missing.join(' · '),missing};
 return {ok:true,cost,passages,ledger};
}

function commissionFortification(state,region,owner='you',purse=null){
 const check=fortificationCheck(state,region,owner,purse);
 if(!check.ok)return check;
 check.ledger.gold-=check.cost;
 check.ledger.stocks.wood-=FORT_COST.wood;
 check.ledger.stocks.iron-=FORT_COST.iron;
 (state.fortifications??=new Map()).set(region.id,{region,owner,gates:new Map(),priority:null});
 refreshFortifications(state);
 return {ok:true,fortification:state.fortifications.get(region.id)};
}

function defendBotFrontier(state,owner,regions,enemies){
 const ledger=factionLedger(state,owner);
 if(!ledger?.stocks||ledger.gold<FORT_COST.gold+80||
  (ledger.stocks.wood||0)<FORT_COST.wood||(ledger.stocks.iron||0)<FORT_COST.iron+RECRUIT_IRON)return;
 if(regions.some(r=>state.fortifications?.has(r.id)))return;
 const atWar=new Set(state.regions.filter(r=>enemies.has(r.owner)).map(r=>r.id));
 const front=regions.filter(r=>r.adj.some(id=>atWar.has(id))&&state.garrisons?.[r.id]?.troops>=50);
 front.sort((a,b)=>state.garrisons[b.id].troops-state.garrisons[a.id].troops);
 for(const region of front)if(commissionFortification(state,region,owner).ok)return;
}

function refreshFortifications(state){
 if(!state.fortifications?.size)return;
 const now=state.economy.seconds;
 let changed=false,visualChange=false;
 for(const [id,fort] of state.fortifications){
  if(fort.region.owner!==fort.owner||!duchySeat(fort.region)){
   state.fortifications.delete(id);changed=true;continue;
  }
  const external=new Set();
  for(const passage of fortificationCrossings(state,fort.region)){
   if(passage.neighbor?.owner===fort.owner)continue;
   external.add(passage.key);
   let gate=fort.gates.get(passage.key);
   if(!gate){
    gate={...passage,fort,readyAt:now+FORT_BUILD_SECONDS,ready:false,health:1,breached:false};
    fort.gates.set(passage.key,gate);changed=true;
   }
   if(!gate.ready&&now>=gate.readyAt){
    gate.ready=true;visualChange=true;
   }
  }
  for(const key of fort.gates.keys()){
   if(external.has(key))continue;
   fort.gates.delete(key);
   if(fort.priority===key)fort.priority=null;
   changed=true;
  }
 }
 if(changed){
  const gates=new Map(),grid=new Map();
  for(const fort of state.fortifications.values())for(const gate of fort.gates.values()){
   gates.set(gate.key,gate);
   const key=gateGridKey(gate.point.x,gate.point.z);
   if(!grid.has(key))grid.set(key,[]);
   grid.get(key).push(gate);
  }
  state.fortificationGates=gates;state.fortificationGrid=grid;
 }
 if(changed||visualChange)state.fortificationRevision=(state.fortificationRevision||0)+1;
}

function gateDefenders(state,gate){
 const {fort}=gate,garrison=state.garrisons?.[fort.region.id];
 if(garrison?.owner!==fort.owner||garrison.inBattle)return 0;
 const gates=[...fort.gates.values()].filter(g=>g.ready&&!g.breached);
 const n=gates.length;
 if(!n||!gates.includes(gate))return 0;
 const priority=fort.gates.get(fort.priority);
 const ordered=priority&&gates.includes(priority)&&n>1?[priority,...gates.filter(g=>g!==priority)]:gates;
 if(ordered[0]===priority&&n>1){
  const reserve=Math.ceil(garrison.troops*.55);
  const index=ordered.indexOf(gate);
  if(index===0)return reserve;
  return Math.floor((garrison.troops-reserve+index-1)/(n-1));
 }
 return Math.floor((garrison.troops+gates.indexOf(gate))/n);
}

function gateStopsArmy(state,gate,owner){
 return gate.ready&&!gate.breached&&gate.fort.region.owner===gate.fort.owner&&
  gate.neighbor?.owner!==gate.fort.owner&&isAtWar(state,owner,gate.fort.owner);
}

function gateAlongMarch(state,march,start,end){
 const grid=state.fortificationGrid;
 if(!grid?.size)return null;
 const path=march.path,lo=routeDistanceAt(path,start),hi=routeDistanceAt(path,end);
 const {distances}=routeMetrics(path);
 let first=1,last=path.length-1;
 while(first<last){
  const middle=(first+last)>>1;
  if(distances[middle]<lo)first=middle+1;
  else last=middle;
 }
 let hit=null;
 for(let i=first;i<path.length&&distances[i-1]<=hi;i++){
  const a=path[i-1],b=path[i],along=distances[i-1],length=distances[i]-along;
  const from=Math.max(lo,along),to=Math.min(hi,distances[i]);
  if(length>1e-8&&to>=from){
   const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
   const x0=a.x+(from-along)*dx,x1=a.x+(to-along)*dx;
   const z0=a.z+(from-along)*dz,z1=a.z+(to-along)*dz;
   for(let x=Math.floor((Math.min(x0,x1)-.6)/GATE_GRID);x<=Math.floor((Math.max(x0,x1)+.6)/GATE_GRID);x++)
    for(let z=Math.floor((Math.min(z0,z1)-.6)/GATE_GRID);z<=Math.floor((Math.max(z0,z1)+.6)/GATE_GRID);z++)
     for(const gate of grid.get(x+','+z)||[]){
      if(!gateStopsArmy(state,gate,march.owner))continue;
      const f=(gate.point.x-a.x)*gate.nx+(gate.point.z-a.z)*gate.nz;
      const projection=dx*gate.nx+dz*gate.nz;
      if(projection<1e-5)continue; // Only an advance through the gate is blocked; retreat stays possible.
      const span=f/projection,at=along+span;
      if(at<from-1e-6||at>to+1e-6||hit&&at>=hit.at)continue;
      if(path.seaStart!=null&&at>path.seaStart&&at<path.seaEnd)continue;
      if(Math.hypot(a.x+dx*span-gate.point.x,a.z+dz*span-gate.point.z)>.55)continue;
      hit={gate,at,before:Math.max(lo,at-.12)};
     }
  }
  if(hit)return hit;
 }
 return null;
}

function stepGateSieges(state,dt){
 if(!state.fortificationGates?.size)return;
 const armies=new Map();
 for(const unit of state.armyMoves||[]){
  if(!unit.gateId||unit.inBattle||unit.troops<=0)continue;
  const gate=state.fortificationGates.get(unit.gateId);
  if(!gate||!gateStopsArmy(state,gate,unit.owner))continue;
  if(!armies.has(gate.key))armies.set(gate.key,new Map());
  const forces=armies.get(gate.key);
  forces.set(unit.owner,(forces.get(unit.owner)||0)+unit.troops);
 }
 const now=state.economy.seconds;
 for(const gate of state.fortificationGates.values()){
  if(!gate.ready)continue;
  const attackers=armies.get(gate.key);
  if(attackers?.size){
   const strongest=[...attackers].sort((a,b)=>b[1]-a[1])[0];
   const [owner,troops]=strongest;
   if(!gate.attacker){
    state.fortificationRevision=(state.fortificationRevision||0)+1;
    state.onGateEvent?.('siege',gate,owner);
   }
   gate.attacker=owner;
   const strength=Math.min(4,troops/(90+gateDefenders(state,gate)));
   gate.health=Math.max(0,gate.health-dt*strength/12);
   gate.repairAt=now+15;
   if(gate.health<=0){
    gate.breached=true;gate.attacker=null;gate.repairAt=now+45;
    state.fortificationRevision=(state.fortificationRevision||0)+1;
    state.onGateEvent?.('breach',gate,owner);
   }
  }else{
   if(gate.attacker)state.fortificationRevision=(state.fortificationRevision||0)+1;
   gate.attacker=null;
   if(gate.health>=1||now<(gate.repairAt||0))continue;
   const region=gate.fort.region,local=gate.fort.owner==='you'&&state.economy.granaries;
   const grain=local?granaryStock(state,region.id):(factionLedger(state,gate.fort.owner)?.stocks?.grain||0);
   const needed=local?Math.min(8,Math.max(1,granaryFor(state,region.id).need??regionGrainNeed(state,region))):8;
   gate.health=Math.min(1,gate.health+dt/(grain>=needed?25:75));
   if(gate.breached&&gate.health>=1){
    gate.breached=false;
    state.fortificationRevision=(state.fortificationRevision||0)+1;
   }
  }
 }
}
function armyRouteAccess(state,owner,path,start=0,end=1,targetOwner=null,exitRegion=null){if(!state.armyTerritoryAt||!path?.length)return {ok:true,owners:[]};let lo=routeDistanceAt(path,start),hi=routeDistanceAt(path,end),owners=[],blockedAt=null,along=0,foreign=state.regions.filter(r=>r!==exitRegion&&!hasArmyAccess(state,owner,r.owner)),exact=foreign.every(r=>Array.isArray(r.polys)&&Array.isArray(r.bounds));for(let i=1;i<path.length;i++){let a=path[i-1],b=path[i],len=distance(a,b),from=Math.max(lo,along),to=Math.min(hi,along+len);if(len>0&&to>=from){let p={x:a.x+(b.x-a.x)*(from-along)/len,z:a.z+(b.z-a.z)*(from-along)/len},q={x:a.x+(b.x-a.x)*(to-along)/len,z:a.z+(b.z-a.z)*(to-along)/len};if(exact){for(const r of foreign){let t=segmentRegionEntry(r,p,q);if(t===null)continue;if(!owners.includes(r.owner))owners.push(r.owner);let entry=routeFractionAt(path,from+(to-from)*t);if(!blockedAt||entry<blockedAt.at)blockedAt={before:Math.max(start,routeFractionAt(path,from+(to-from)*t-.01)),at:entry}}}else{let steps=Math.max(1,Math.ceil((to-from)/1)),last=routeFractionAt(path,from);for(let j=0;j<=steps;j++){let d=from+(to-from)*j/steps,t=(d-along)/len,point={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},territory=state.armyTerritoryAt(point),other=territory===exitRegion?null:territory?.owner;if(!hasArmyAccess(state,owner,other)){if(!owners.includes(other))owners.push(other);if(!blockedAt)blockedAt={before:last,at:routeFractionAt(path,d)}}else if(!blockedAt)last=routeFractionAt(path,d)}}}along+=len;if(along>=hi)break}if(targetOwner&&!hasArmyAccess(state,owner,targetOwner)&&!owners.includes(targetOwner))owners.push(targetOwner);if(!owners.length)return {ok:true,owners:[]};return {ok:false,reason:owner==='you'?'Для прохода нужен договор или война':'Нет разрешения на проход',owners,blockedAt}}
// Build a fresh filter per order so ownership, wars and transit changes take effect immediately.
function armyEdgeFilter(state,owner,exitRegion=null,opponent=null){
 const foreign=(state.regions||[]).filter(r=>r!==exitRegion&&r.owner!==opponent&&!hasArmyAccess(state,owner,r.owner)),exact=foreign.every(r=>Array.isArray(r.polys)&&Array.isArray(r.bounds)),cache=new Map();
 return (a,b)=>{if(!a||!b)return false;if(distance(a,b)<1e-8)return true;let ak=a.x+','+a.z,bk=b.x+','+b.z,key=ak<bk?ak+'|'+bk:bk+'|'+ak;if(cache.has(key))return cache.get(key);let allowed=!state.armyTerritoryAt||!foreign.length||(exact?!foreign.some(r=>segmentRegionEntry(r,a,b)!==null):(opponent?armyRouteAccess(state,owner,[a,b],0,1,null,exitRegion).owners.every(id=>id===opponent):armyRouteAccess(state,owner,[a,b],0,1,null,exitRegion).ok));cache.set(key,allowed);return allowed};
}
// Supply can traverse neutral and peaceful lands; war closes enemy-controlled segments.
function supplyEdgeFilter(state,owner,ownOnly=false,exitRegion=null){let restricted=r=>r!==exitRegion&&(ownOnly?r.owner!==owner:isAtWar(state,owner,r.owner)),hostile=(state.regions||[]).filter(r=>r.owner&&restricted(r)),exact=hostile.every(r=>Array.isArray(r.polys)&&Array.isArray(r.bounds)),cache=new Map(),restrictedRegions=new Set(hostile);return (a,b)=>{if(!a||!b)return false;if(distance(a,b)<1e-8)return true;let ak=a.x+','+a.z,bk=b.x+','+b.z,key=ak<bk?ak+'|'+bk:bk+'|'+ak;if(cache.has(key))return cache.get(key);let allowed=true;if(exact){
 const nearby=GAME_MAP&&hostile.length?regionsAlongSegment(state.regions,a,b):hostile;
 for(const r of nearby)if(restrictedRegions.has(r)&&segmentRegionEntry(r,a,b)!==null){allowed=false;break}
 }else if(state.armyTerritoryAt){let n=Math.max(1,Math.ceil(distance(a,b)));for(let i=0;i<=n;i++){let t=i/n,r=state.armyTerritoryAt({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});if(r&&restricted(r)){allowed=false;break}}}cache.set(key,allowed);return allowed}}
function remainingSupplyPath(ship){let path=ship.path||[];if(path.length<2)return path.slice();let travel=routeDistanceAt(path,ship.elapsed/ship.duration),along=0;for(let i=1;i<path.length;i++){let len=distance(path[i-1],path[i]);if(along+len>=travel)return [pointOnRoute(path,Math.min(1,ship.elapsed/ship.duration)),...path.slice(i)];along+=len}return [path[path.length-1]]}
const TRANSIT_COST=40;
function grantTransit(state,other,owner='you'){
 if(!state.started||other===owner||!campaignNationAlive(state,other)||!campaignNationAlive(state,owner)||isAtWar(state,owner,other))
  return {ok:false,reason:'Договор о проходе недоступен'};
 const agreements=state.transit??={},key=owner+'>'+other;
 if(agreements[key])return {ok:true,existing:true};
 const buyer=factionLedger(state,owner),seller=factionLedger(state,other);
 if(buyer.gold<TRANSIT_COST)return {ok:false,reason:'Не хватает золота на проход'};
 buyer.gold-=TRANSIT_COST;seller.gold+=TRANSIT_COST;agreements[key]=true;
 return {ok:true};
}
function marchCheck(state,from,to,count,owner='you'){if(!state.started||!state.economy)return {ok:false,reason:'Сначала выберите столицу'};if(!from||from.owner!==owner||!to||to.owner!==owner||from.id===to.id)return {ok:false,reason:'Выберите другое своё герцогство'};if(!(from.adj.includes(to.id)||to.adj.includes(from.id)))return {ok:false,reason:'Марш возможен только в соседнее герцогство'};if(vassalFor(state,from)||vassalFor(state,to))return {ok:false,reason:'Этими войсками командует феодал'};let troops=state.garrisons?.[from.id];if(troops?.inBattle)return {ok:false,reason:'Армия уже участвует в бою'};if(!Number.isSafeInteger(count)||count<1||troops?.owner!==owner||count>troops.troops)return {ok:false,reason:'Недостаточно солдат'};let path=state.armyPath?.(from,to,owner);if(!path||path.length<2)return {ok:false,reason:'Нет сухопутной дороги'};let access=armyRouteAccess(state,owner,path);if(!access.ok)return access;return {ok:true,path}}
function sendMarch(state,from,to,count,owner='you'){let q=marchCheck(state,from,to,count,owner);if(!q.ok)return q;state.garrisons[from.id].troops-=count;let march={owner,fromId:from.id,toId:to.id,troops:count,path:q.path,elapsed:0,duration:journeyDuration(q.path),waiting:false};(state.armyMoves??=[]).push(march);state.onArmyChanged?.({kind:'depart',march,region:from});return {ok:true,march}}
function armyMarchElapsed(march,frameOffset){
 const partial=march.inBattle||march.gateId?0:Math.max(0,frameOffset-(march.startOffset??0));
 return Math.min(march.duration,march.elapsed+partial);
}
function prepareArmyOrder(state,selection,destination,owner='you',targetOwner=null){
 if(!state.started||!selection||!destination||!state.network)return {ok:false,reason:'Выберите армию и дорогу'};
 const startOffset=Math.max(0,Math.min(1,selection.offset||0));
 let unit,from;
 if(selection.kind==='garrison'){
  const region=state.regions.find(r=>r.id===selection.regionId),g=state.garrisons?.[selection.regionId];
  if(!region||region.owner!==owner||g?.owner!==owner||g.troops<1)return {ok:false,reason:'Армия больше недоступна'};
  const house=vassalFor(state,region);
  if((house?.id??null)!==(selection.vassalId??null))return {ok:false,reason:'Этими войсками командует феодал'};
  if(g.inBattle)return {ok:false,reason:'Армия уже участвует в бою'};
  from=state.roadNodeLocation?.(state.network,state.network.hubKeys.get(region.id));
  const count=selection.count??g.troops;
  if(!Number.isSafeInteger(count)||count<1||count>g.troops)return {ok:false,reason:'Недостаточно солдат'};
  unit={owner,troops:count,vassalId:house?.id};
 }else{
  unit=selection.unit;
  const moving=state.armyMoves?.includes(unit);
  if(!unit||unit.owner!==owner||!(state.fieldArmies?.includes(unit)||moving))return {ok:false,reason:'Армия больше недоступна'};
  if((unit.vassalId??null)!==(selection.vassalId??null))return {ok:false,reason:'Этими войсками командует феодал'};
  if(unit.inBattle)return {ok:false,reason:'Армия уже участвует в бою'};
  if(unit.exitRegion)return {ok:false,reason:'Дождитесь выхода армии из чужой территории'};
  if(moving){
   const point=pointOnRoute(unit.path,armyMarchElapsed(unit,startOffset)/unit.duration);
   if(unit.path.landingId!=null&&isSeaBackground(point.x,point.z))return {ok:false,reason:'Армия сейчас в море'};
   const road=state.nearestRoadLocation?.(state.network,point.x,point.z);
   if(road)from={...road,point};
  }else from=unit.location;
 }
 const staging=selection.councilMusterId!=null;
 const military=staging?armyEdgeFilter(state,owner):null,supply=staging?supplyEdgeFilter(state,owner):null;
 let path=staging?state.roadRouteBetween?.(state.network,from,destination,(a,b)=>military(a,b)&&supply(a,b)):
  state.armyRoadRouteBetween?.(state.network,from,destination,owner)||state.roadRouteBetween?.(state.network,from,destination);
 let access=path?.length>1?armyRouteAccess(state,owner,path,0,1,targetOwner):null;
 if(!access?.ok||owner!=='you'&&routeLength(path)>distance(from.point,destination.point)*1.8+100){
  const sea=state.navalArmyRoute?.(owner,from,destination);
  if(sea?.length>1&&(!staging||sea.every((point,i)=>!i||supply(sea[i-1],point)))){
   const landing=armyRouteAccess(state,owner,sea,0,1,targetOwner);
   if(landing.ok&&(!access?.ok||journeyDuration(sea)<journeyDuration(path))){path=sea;access=landing}
   else if(!access)access=landing;
  }
 }
 if(!access?.ok)return access||{ok:false,reason:'Нет пути до выбранной точки'};
 return {ok:true,unit,path,startOffset};
}
function orderArmy(state,selection,destination,owner='you',targetOwner=null){let plan=prepareArmyOrder(state,selection,destination,owner,targetOwner);if(!plan.ok)return plan;let {unit,path,startOffset}=plan;if(selection.kind==='garrison')state.garrisons[selection.regionId].troops-=unit.troops;else{let list=state.fieldArmies.includes(unit)?state.fieldArmies:state.armyMoves;list.splice(list.indexOf(unit),1)}delete unit.gateId;delete unit.councilMusterId;
 Object.assign(unit,{owner,path,elapsed:0,startOffset,duration:journeyDuration(path),destination,landingId:path.landingId,kind:'field',waiting:false});
 if(selection.councilMusterId!=null)unit.councilMusterId=selection.councilMusterId;
 state.armyMoves.push(unit);
 if(selection.councilMusterId==null)state.onArmyChanged?.({kind:'depart',march:unit});return {ok:true,march:unit}}
function orderArmyGroup(state,selections,destination,owner='you',targetOwner=null){if(!selections?.length)return {ok:false,reason:'Нет выбранных армий'};let owners=[],seen=new Set();for(const selection of selections){let key=selection.kind==='garrison'?'g:'+selection.regionId:selection.unit;if(seen.has(key))return {ok:false,reason:'Армия выбрана дважды'};seen.add(key);let plan=prepareArmyOrder(state,selection,destination,owner,targetOwner);if(!plan.ok){if(!plan.owners?.length)return plan;for(const id of plan.owners)if(!owners.includes(id))owners.push(id)}}if(owners.length)return {ok:false,reason:'Для прохода нужен договор или война',owners};let marches=[];for(const selection of selections){let result=orderArmy(state,selection,destination,owner,targetOwner);if(!result.ok)return result;marches.push(result.march)}return {ok:true,marches}}

function councilArmyReport(state){
 const front=state.council?.front;
 if(!front)return null;
 const owners=new Map(state.regions.map(r=>[r.id,r.owner]));
 const seat=councilRegion(state,front.musterId),muster=vassalFor(state,seat)?null:seat,target=state.regions.find(r=>r.id===front.targetId);
 const borderReserve=region=>(region.adj||[]).some(id=>owners.has(id)&&owners.get(id)!=='you')?front.reserve:0;
 const available=region=>{
  const g=state.garrisons?.[region.id];
  if(g?.owner!=='you'||g.inBattle||vassalFor(state,region))return 0;
  return Math.max(0,g.troops-borderReserve(region));
 };
 const sources=muster?state.regions.filter(r=>r.owner==='you'&&r!==muster&&available(r)>0).map(r=>({region:r,troops:available(r)})):[];
 const staged=muster?available(muster):0;
 const arrivals=muster?(state.armyMoves||[]).filter(m=>m.owner==='you'&&m.councilMusterId===muster.id):[];
 const inbound=arrivals.reduce((total,m)=>total+m.troops,0);
 const eta=arrivals.length?Math.max(...arrivals.map(m=>m.duration-m.elapsed)):0;
 const eligible=target&&target!==muster&&(target.owner==='you'||isAtWar(state,'you',target.owner));
 const guard=muster&&state.garrisons?.[muster.id];
 const needed=front.troops+(muster?borderReserve(muster):0)-(guard?.owner==='you'?guard.troops:0);
 return {muster,target,eligible,staged,inbound,arrivals,eta,sources,
  available:sources.reduce((n,s)=>n+s.troops,0),missing:Math.max(0,needed-inbound)};
}
function gatherCouncilArmy(state){
 const report=councilArmyReport(state);
 if(!report?.muster||!state.network)return {ok:false,reason:'Выберите свой город сбора'};
 const destination=state.roadNodeLocation?.(state.network,state.network.hubKeys.get(report.muster.id));
 if(!destination||!report.missing)return {ok:false,reason:'Армия уже собрана или подходит к городу'};
 const ordered=report.sources.sort((a,b)=>distance(a.region.slots[0],destination.point)-distance(b.region.slots[0],destination.point));
 let remaining=report.missing,blocked=0,units=0;
 for(const {region,troops} of ordered){
  if(!remaining)break;
  const count=Math.min(remaining,troops);
  const order=orderArmy(state,{kind:'garrison',regionId:region.id,count,councilMusterId:report.muster.id},destination);
  if(!order.ok){blocked++;continue}
  remaining-=count;
  units++;
 }
 state.council.front.lastBlocked=blocked;
 const sent=report.missing-remaining;
 if(!sent)return {ok:false,reason:blocked?'Нет разрешённого пути от гарнизонов':'Нет свободных солдат для сбора'};
 return {ok:true,sent,blocked,units};
}
function launchCouncilExpedition(state){
 const report=councilArmyReport(state),count=state.council?.front.troops;
 if(!report?.muster||!report.eligible||!state.network)return {ok:false,reason:'Выберите город сбора и допустимую цель'};
 if(report.staged<count)return {ok:false,reason:'Для похода нужно собрать ещё '+(count-report.staged)+' солд.'};
 const destination=state.roadNodeLocation?.(state.network,state.network.hubKeys.get(report.target.id));
 return orderArmy(state,{kind:'garrison',regionId:report.muster.id,count},destination);
}

function stepArmies(state,dt){let moves=state.armyMoves||[];for(let i=moves.length-1;i>=0;i--){let march=moves[i];
 // A route issued between ticks only uses the remaining portion of its first tick.
 const advance=Math.max(0,dt-(march.startOffset??0));
 delete march.startOffset;
 if(march.inBattle||!advance)continue;
 const waitingGate=march.gateId&&state.fortificationGates?.get(march.gateId);
 if(waitingGate&&gateStopsArmy(state,waitingGate,march.owner))continue;
 delete march.gateId;
 let before=march.elapsed,next=Math.min(march.duration,before+advance),access=armyRouteAccess(state,march.owner,march.path,before/march.duration,next/march.duration,null,march.exitRegion);
 const barrier=gateAlongMarch(state,march,before/march.duration,next/march.duration);
 if(barrier&&(access.ok||barrier.at<routeDistanceAt(march.path,access.blockedAt?.at??0))){
  march.gateId=barrier.gate.key;
  march.elapsed=routeFractionAt(march.path,barrier.before)*march.duration;
  continue;
 }
 if(!access.ok){let stop=Math.max(before/march.duration,access.blockedAt?.before??before/march.duration),point=pointOnRoute(march.path,stop),location=state.nearestRoadLocation?.(state.network,point.x,point.z)||{point,links:[]};location.point=point;moves.splice(i,1);march.location=location;march.elapsed=stop*march.duration;delete march.exitRegion;(state.fieldArmies??=[]).push(march);state.onArmyChanged?.({kind:'border',march,owners:access.owners});continue}march.elapsed=next;if(march.elapsed<march.duration)continue;delete march.exitRegion;
 const staging=march.councilMusterId==null?null:councilRegion(state,march.councilMusterId);
 if(staging&&!vassalFor(state,staging)){
  const g=state.garrisons[staging.id]?.owner==='you'?state.garrisons[staging.id]:{owner:'you',troops:0};
  g.troops+=march.troops;state.garrisons[staging.id]=g;
  moves.splice(i,1);
  state.onArmyChanged?.({kind:'arrive',march,region:staging});
  continue;
 }
 delete march.councilMusterId;
 if(march.kind==='field'){moves.splice(i,1);march.location=march.destination;march.arrivedAt=state.economy?.seconds||0;let nearbyRegion=!march.generalSlot&&state.regions.find(r=>r.owner===march.owner&&(vassalFor(state,r)?.id??null)===(march.vassalId??null)&&r.slots?.[0]&&state.garrisons?.[r.id]?.owner===march.owner&&state.garrisons[r.id].troops>0&&!state.garrisons[r.id].inBattle&&distance(r.slots[0],march.location.point)<=5),nearby=nearbyRegion?state.garrisons[nearbyRegion.id]:!march.generalSlot&&(state.fieldArmies||[]).find(u=>!u.generalSlot&&u.owner===march.owner&&(u.vassalId??null)===(march.vassalId??null)&&!u.inBattle&&distance(u.location.point,march.location.point)<=5);if(nearby){nearby.troops+=march.troops;state.onArmyChanged?.({kind:'merge',march:nearby,selection:nearbyRegion?{kind:'garrison',regionId:nearbyRegion.id}:{kind:'unit',unit:nearby}})}else{(state.fieldArmies??=[]).push(march);state.onArmyChanged?.({kind:'field-arrive',march})}continue}let target=state.regions.find(r=>r.id===march.toId);if(target?.owner===march.owner&&vassalFor(state,target)){
 const location=state.roadNodeLocation?.(state.network,state.network.hubKeys.get(target.id))||{point:target.slots[0]};
 moves.splice(i,1);Object.assign(march,{kind:'field',location,arrivedAt:state.economy?.seconds||0});
 (state.fieldArmies??=[]).push(march);state.onArmyChanged?.({kind:'field-arrive',march});continue;
 }if(!target||target.owner!==march.owner){if(!march.waiting){march.waiting=true;state.onArmyChanged?.({kind:'waiting',march,region:target})}continue}let g=state.garrisons[target.id];if(!g||g.owner!==march.owner)g=state.garrisons[target.id]={owner:march.owner,troops:0};g.troops+=march.troops;moves.splice(i,1);state.onArmyChanged?.({kind:'arrive',march,region:target})}}
// Wars are explicit: trading partners do not fight until war is declared.
function warKey(a,b){return [a,b].sort().join('|')}
function isAtWar(state,a,b){
 if(!a||!b||a===b||a==='neutral'||b==='neutral')return false;
 const open=(rebel,other)=>state.factions?.[rebel]?.isRebel&&!state.factions[rebel].defeated&&
  (other==='you'?!state.defeated:!!state.factions[other]&&!state.factions[other].defeated);
 return !!state.wars?.[warKey(a,b)]||open(a,b)||open(b,a);
}
function activeWarEnemies(state,owner){
 return Object.keys(state.wars||{}).flatMap(key=>{
  const [a,b]=key.split('|'),other=a===owner?b:b===owner?a:null;
  return other&&(campaignNationAlive(state,other)||state.factions?.[other]?.isRebel&&!state.factions[other].defeated)?[other]:[];
 });
}
const REPARATION_TERM=90*SECONDS_PER_GAME_DAY,TRUCE_TERM=180*SECONDS_PER_GAME_DAY;
function truceDays(state,a,b){
 const end=state.peaceTreaties?.[warKey(a,b)]?.truceEnd||0;
 return Math.max(0,Math.ceil((end-(state.economy?.seconds||0))/SECONDS_PER_GAME_DAY));
}
function warDeclarationCheck(state,other,attacker='you'){
 const exists=id=>id==='you'?!state.defeated:!!state.factions?.[id]&&!state.factions[id].defeated;
 if(!state.started||attacker===other||!exists(attacker)||!exists(other))return {ok:false,reason:'Выберите страну соперника'};
 if(isAtWar(state,attacker,other))return {ok:false,reason:'Война уже объявлена'};
 const days=truceDays(state,attacker,other);
 if(days)return {ok:false,reason:'Действует перемирие · осталось '+days+' дн.'};
 return {ok:true};
}
function warReadiness(state,owner){
 if(owner==='you')return 72;
 const faction=state.factions?.[owner];
 if(!faction)return 60;
 return faction.warReadiness??=(62+([...owner].reduce((sum,char)=>sum*31+char.charCodeAt(0),0)>>>0)%21);
}
function warSide(state,owner){
 const towns=state.regions.filter(r=>r.owner===owner).length,troops=armyTroops(state,owner);
 return {towns,troops,strength:troops+towns*65,
  fleet:(state.warships||[]).filter(ship=>ship.owner===owner).length};
}
function createWarRecord(state,attacker,defender){
 const side=owner=>({...warSide(state,owner),soldiersLost:0,townsLost:0,capitalsLost:0,shipsLost:0,cargoLost:0});
 return {started:state.economy?.seconds||0,attacker,sides:{[attacker]:side(attacker),[defender]:side(defender)},offers:new Set()};
}
function recordWarLoss(state,owner,opponent,loss,amount=1){
 const side=state.warRecords?.[warKey(owner,opponent)]?.sides[owner];
 if(side)side[loss]+=amount;
}
function declareWar(state,other,attacker='you',defensive=false){
 const check=warDeclarationCheck(state,other,attacker);
 if(!check.ok)return check;
 state.wars??={};
 const defenders=defensive?[]:campaignAllies(state,other).filter(ally=>{
  const target=state.campaign.pacts.get(warKey(ally,other))?.against;
  return !target||target===attacker;
 });
 const key=warKey(attacker,other);
 state.wars[key]=true;
 (state.warRecords??={})[key]=createWarRecord(state,attacker,other);
 state.campaign?.pacts.delete(key);
 if(state.transit){delete state.transit[attacker+'>'+other];delete state.transit[other+'>'+attacker]}
 state.onWarDeclared?.({attacker,defender:other,defensive});
 // A defensive call is direct and never recursively summons a second alliance.
 for(const ally of defenders){
  if(ally!==attacker&&!isAtWar(state,attacker,ally))declareWar(state,ally,attacker,true);
 }
 return {ok:true};
}
function warAssessment(state,record,owner,opponent){
 const side=record.sides[owner],current=warSide(state,owner),enemy=warSide(state,opponent);
 const age=state.economy.seconds-record.started;
 const disadvantage=(enemy.strength-current.strength)/Math.max(100,enemy.strength+current.strength);
 const lossPressure=Math.min(38,side.soldiersLost/Math.max(100,side.troops)*33)+
  Math.min(39,side.townsLost/Math.max(1,side.towns)*45)+Math.min(30,side.capitalsLost*22)+
  Math.min(18,side.shipsLost/Math.max(1,side.fleet)*16+side.cargoLost/80);
 const resolve=Math.max(0,Math.min(100,warReadiness(state,owner)+(record.attacker===owner?7:0)-
  Math.min(48,age/3.8)-lossPressure-disadvantage*35));
 return {resolve,age,disadvantage,lossPressure,yielding:(age>=24||side.capitalsLost>0)&&
  resolve<=38&&(disadvantage>=.07||side.capitalsLost>0||lossPressure>=38)};
}
function activePeaceTreaty(state,a,b){
 const treaty=state.peaceTreaties?.[warKey(a,b)];
 return treaty&&treaty.truceEnd>(state.economy?.seconds||0)?treaty:null;
}
function reparationRates(state,owner){
 let incoming=0,outgoing=0;
 const now=state.economy?.seconds||0;
 for(const treaty of Object.values(state.peaceTreaties||{})){
  if(!treaty.rate||treaty.end<=now||!campaignNationAlive(state,treaty.payer)||!campaignNationAlive(state,treaty.recipient))continue;
  if(treaty.payer===owner)outgoing+=treaty.rate;
  else if(treaty.recipient===owner)incoming+=treaty.rate;
 }
 return {incoming,outgoing};
}
function peaceOptions(state,other,owner='you',reparations=false){
 const key=warKey(owner,other);
 if(!state.wars?.[key]||!campaignNationAlive(state,owner)||!campaignNationAlive(state,other))
  return {reason:'Договор доступен во время войны между государствами.'};
 const record=(state.warRecords??={})[key]??=createWarRecord(state,owner,other);
 const rival=warAssessment(state,record,other,owner);
 const white=rival.yielding||rival.age>=34&&rival.resolve<=51;
 const payer=rival.yielding?other:owner,recipient=payer===owner?other:owner;
 const {net,committed}=realmTreasuryReport(state,payer);
 const income=Math.max(0,net-committed),cash=Math.floor(Math.max(0,factionLedger(state,payer).gold));
 const rate=reparations?Math.min(45,Math.floor(income*(payer===owner?.25:.42))):0;
 const price=Math.ceil(Math.max(24,Math.min(240,28+rival.resolve*.9+
  Math.max(0,-rival.disadvantage)*125+taxIncome(state,other)*.3)));
 const indemnity=Math.floor(Math.min(300,cash*.65,income*1.5+Math.max(10,-rival.resolve+45)));
 const gold=payer===owner?Math.max(0,price-Math.floor(rate*REPARATION_TERM/60*.8)):indemnity;
 const reason=rival.yielding?'Соперник готов уступить после военных потерь.':
  white?'Соперник готов прекратить войну.':
  rival.age<20?'Соперник ещё не готов вести переговоры.':
  'Соперник готов обсуждать мир за компенсацию.';
 let paymentReason='';
 if(!rival.yielding&&rival.age<20)paymentReason=reason;
 else if(reparations&&!rate)paymentReason='У плательщика слишком низкий свободный доход для репараций.';
 else if(cash<gold)paymentReason='В казне не хватает '+(gold-cash)+' зл.';
 else if(!gold&&!rate)paymentReason='В казне соперника нет средств для выплаты.';
 return {white,reason,payment:{payer,recipient,gold,rate,ok:!paymentReason,reason:paymentReason}};
}
function settleWar(state,other,owner='you',kind='white',reparations=false){
 const options=peaceOptions(state,other,owner,reparations);
 const payment=kind==='payment'?options.payment:null;
 if(kind==='white'?!options.white:!payment?.ok)return {ok:false,reason:payment?.reason||options.reason};
 const key=warKey(owner,other),now=state.economy.seconds;
 const {payer=null,recipient=null,gold=0,rate=0}=payment||{};
 if(gold){
  factionLedger(state,payer).gold-=gold;
  factionLedger(state,recipient).gold+=gold;
 }
 const treaty={owner,other,payer,recipient,gold,rate,start:now,end:now+REPARATION_TERM,
  truceEnd:now+TRUCE_TERM,paid:0,arrears:0};
 (state.peaceTreaties??={})[key]=treaty;
 delete state.wars[key];
 delete state.warRecords[key];
 const sameWar=(a,b)=>warKey(a,b)===key;
 state.battlePairs=(state.battlePairs||[]).filter(battle=>{
  if(!sameWar(battle.ownerA,battle.ownerB))return true;
  for(const entry of [...(battle.sideA||[]),...(battle.sideB||[])])entry.unit.inBattle=false;
  if(battle.a)battle.a.inBattle=false;
  if(battle.b)battle.b.inBattle=false;
  return false;
 });
 for(const [id,siege] of state.sieges||[]){
  if(sameWar(siege.attacker,siege.defender))state.sieges.delete(id);
 }
 for(const gate of state.fortificationGates?.values()||[]){
  if(gate.attacker&&sameWar(gate.attacker,gate.fort.owner)){
   gate.attacker=null;
   state.fortificationRevision=(state.fortificationRevision||0)+1;
  }
 }
 state._raidTick=null;
 state.onPeaceSigned?.(treaty);
 return {ok:true,treaty};
}
function payWarReparations(state,dt){
 const now=state.economy.seconds,previous=now-dt,debits=new Map(),credits=new Map(),payroll=new Map();
 for(const treaty of Object.values(state.peaceTreaties||{})){
  if(!treaty.rate||previous>=treaty.end||!campaignNationAlive(state,treaty.payer)||!campaignNationAlive(state,treaty.recipient))continue;
  const due=Math.max(0,Math.min(now,treaty.end)-Math.max(previous,treaty.start))*treaty.rate/60;
  if(!debits.has(treaty.payer))debits.set(treaty.payer,[]);
  debits.get(treaty.payer).push({treaty,due,balance:due+treaty.arrears});
 }
 for(const [owner,entries] of debits){
  const ledger=factionLedger(state,owner),total=entries.reduce((sum,entry)=>sum+entry.balance,0);
  const fraction=total?Math.min(1,Math.max(0,ledger.gold)/total):0;
  const bill={due:0,unpaid:0};
  for(const {treaty,due,balance} of entries){
   const paid=balance*fraction;
   treaty.paid+=paid;
   treaty.arrears=Math.max(0,balance-paid);
   bill.due+=due;bill.unpaid+=due*(1-fraction);
   credits.set(treaty.recipient,(credits.get(treaty.recipient)||0)+paid);
  }
  ledger.gold=Math.max(0,ledger.gold-total*fraction);
  recordCampaignIncome(state,owner,-total*fraction);
  payroll.set(owner,bill);
 }
 for(const [owner,paid] of credits){
  factionLedger(state,owner).gold+=paid;
  recordCampaignIncome(state,owner,paid);
 }
 return payroll;
}
function armySelectionVassal(state,selection){
 if(selection?.kind==='garrison')return vassalFor(state,state.regions.find(region=>region.id===selection.regionId));
 const unit=selection?.unit;
 return unit?vassalById(state,unit.vassalId,unit.owner):null;
}
function armyForSelection(state,selection){if(!selection)return null;if(selection.kind==='garrison'){let r=state.regions.find(r=>r.id===selection.regionId),unit=state.garrisons?.[selection.regionId];return r&&unit&&r.owner===unit.owner&&unit.troops>0?{unit,location:state.roadNodeLocation?.(state.network,state.network.hubKeys.get(r.id))}:null}let unit=selection.unit;if(!unit||unit.troops<=0||!state.fieldArmies?.includes(unit))return null;return {unit,location:unit.location}}
function mergeArmies(state,from,target,owner='you'){let a=armyForSelection(state,from),b=armyForSelection(state,target);if(!a||!b||a.unit===b.unit||a.unit.generalSlot||b.unit.generalSlot||a.unit.owner!==owner||b.unit.owner!==owner||armySelectionVassal(state,from)||armySelectionVassal(state,target))return {ok:false,reason:'Выберите две свои остановившиеся армии'};if(a.unit.inBattle||b.unit.inBattle)return {ok:false,reason:'Нельзя объединять войска во время боя'};if(distance(a.location.point,b.location.point)>5)return {ok:false,reason:'Сначала подведите армии друг к другу'};let access=armyRouteAccess(state,owner,[a.location.point,b.location.point]);if(!access.ok)return access;b.unit.troops+=a.unit.troops;a.unit.troops=0;if(from.kind==='unit')state.fieldArmies.splice(state.fieldArmies.indexOf(a.unit),1);state.onArmyChanged?.({kind:'merge',march:b.unit});return {ok:true,unit:b.unit}}
function battleCombatants(state){let result=[];for(const r of state.regions){let g=state.garrisons?.[r.id];if(g&&g.owner===r.owner&&g.troops>0&&r.slots?.[0])result.push({unit:g,point:r.slots[0],garrison:true})}for(const u of state.fieldArmies||[])if(u.troops>0)result.push({unit:u,point:u.location.point,garrison:false});for(const u of state.armyMoves||[])if(u.troops>0){
 let ratio=Math.min(1,u.elapsed/u.duration),along=routeDistanceAt(u.path,ratio);
 if(u.path.landingId!=null&&along>=u.path.seaStart&&along<=u.path.seaEnd)continue;
 result.push({unit:u,point:pointOnRoute(u.path,ratio),garrison:false});
}return result}
// Each battle combines all nearby armies of the two countries. Reinforcements
// join the existing battle as soon as they reach its position.
function battleLosses(side,amount){let total=side.reduce((n,e)=>n+e.unit.troops,0);amount=Math.min(total,amount);if(!total||!amount)return 0;let allocations=side.map((e,i)=>{let exact=amount*e.unit.troops/total;return {e,i,n:Math.floor(exact),fraction:exact-Math.floor(exact)}}),remaining=amount-allocations.reduce((n,x)=>n+x.n,0);allocations.sort((a,b)=>b.fraction-a.fraction||a.i-b.i);for(let i=0;i<remaining;i++)allocations[i].n++;for(const x of allocations)x.e.unit.troops-=x.n;return amount}
function bridgeCover(state,side,total,moving){
 if(!state.bridgeAt||!total)return {factor:1,bridge:null};
 let held=0,bridge=null;
 for(const {unit,point} of side){
  if(moving.has(unit))continue;
  const position=state.bridgeAt(point);
  if(!position)continue;
  bridge??=position;held+=unit.troops;
 }
 return {factor:1-(state.bridgeDefense||0)*held/total,bridge};
}
// Idle armies beside their own city take up defensive positions in it.
const AUTO_GARRISON_RADIUS=8,AUTO_GARRISON_DELAY=3;
function stepAutoGarrison(state){
 if(!state.fieldArmies?.length)return;
 const now=state.economy?.seconds||0;
 for(let i=state.fieldArmies.length-1;i>=0;i--){
  const unit=state.fieldArmies[i];
  if(unit.generalSlot||unit.inBattle||unit.rebellion||unit.exitRegion)continue;
  if(now-(unit.arrivedAt??0)<AUTO_GARRISON_DELAY)continue;
  const region=state.armyTerritoryAt?.(unit.location?.point)||state.regions.find(r=>r.owner===unit.owner&&r.slots?.[0]&&distance(unit.location?.point||{x:-1e9,z:-1e9},r.slots[0])<=AUTO_GARRISON_RADIUS);
  if(!region||region.owner!==unit.owner||(vassalFor(state,region)?.id??null)!==(unit.vassalId??null))continue;
  const seat=duchySeat(region);
  if(!seat||distance(unit.location.point,region.slots[0])>AUTO_GARRISON_RADIUS)continue;
  let g=state.garrisons?.[region.id];
  if(!g||g.owner!==unit.owner||g.inBattle)g=state.garrisons[region.id]={owner:unit.owner,troops:0,inBattle:false};
  g.troops+=unit.troops;
  state.fieldArmies.splice(i,1);
  state.onArmyChanged?.({kind:'garrison',march:unit,region});
 }
}
function stepBattles(state,dt){const armies=battleCombatants(state),previous=state.battlePairs||[],battles=[],used=new Set();for(const a of armies)a.unit.inBattle=false;
 function collect(battle){let A=[],B=[];for(const candidate of armies){if(used.has(candidate.unit)||distance(candidate.point,battle.point)>9)continue;if(candidate.unit.owner===battle.ownerA)A.push(candidate);else if(candidate.unit.owner===battle.ownerB)B.push(candidate)}if(!A.length||!B.length)return false;for(const a of [...A,...B])used.add(a.unit);battle.sideA=A;battle.sideB=B;battle.a=A[0].unit;battle.b=B[0].unit;return true}
 for(const old of previous)if(isAtWar(state,old.ownerA,old.ownerB)&&collect(old))battles.push(old);
 for(let i=0;i<armies.length;i++)for(let j=i+1;j<armies.length;j++){let a=armies[i],b=armies[j];if(used.has(a.unit)||used.has(b.unit)||!isAtWar(state,a.unit.owner,b.unit.owner)||distance(a.point,b.point)>9)continue;let battle={ownerA:a.unit.owner,ownerB:b.unit.owner,point:{x:(a.point.x+b.point.x)/2,z:(a.point.z+b.point.z)/2},lossA:0,lossB:0,carryA:0,carryB:0};if(collect(battle)){battles.push(battle);state.onBattleChanged?.({kind:'start',a:battle.a,b:battle.b,battle})}}
 const active=[],moving=new Set(state.armyMoves||[]);for(const battle of battles){const power=x=>{let level=1;if(x.garrison){const region=state.armyTerritoryAt?.(x.point);level=region?duchySeat(region)?.level||1:1}return x.unit.troops*(x.garrison?1.15+(level-1)*.12:1)};let A=battle.sideA,B=battle.sideB,totalA=A.reduce((n,x)=>n+x.unit.troops,0),totalB=B.reduce((n,x)=>n+x.unit.troops,0),attackA=A.reduce((n,x)=>n+power(x),0),attackB=B.reduce((n,x)=>n+power(x),0);for(const x of [...A,...B])x.unit.inBattle=true;const coverA=bridgeCover(state,A,totalA,moving),coverB=bridgeCover(state,B,totalB,moving);battle.bridgeA=coverA.bridge?.river||null;battle.bridgeB=coverB.bridge?.river||null;let ca=battle.carryA+attackB*.05*dt*coverA.factor,cb=battle.carryB+attackA*.05*dt*coverB.factor,la=Math.min(totalA,Math.floor(ca)),lb=Math.min(totalB,Math.floor(cb));battle.carryA=ca-la;battle.carryB=cb-lb;battle.lossA+=battleLosses(A,la);battle.lossB+=battleLosses(B,lb);
 recordWarLoss(state,battle.ownerA,battle.ownerB,'soldiersLost',la);
 recordWarLoss(state,battle.ownerB,battle.ownerA,'soldiersLost',lb);
 battle.totalA=totalA-la;battle.totalB=totalB-lb;if(battle.totalA>0&&battle.totalB>0)active.push(battle);else{for(const x of [...A,...B])x.unit.inBattle=false;state.onBattleChanged?.({kind:'end',a:battle.a,b:battle.b,battle,winner:battle.totalA>0?battle.ownerA:battle.totalB>0?battle.ownerB:null})}}
 for(const old of previous)if(!battles.includes(old)){for(const x of [...(old.sideA||[]),...(old.sideB||[])])x.unit.inBattle=false;state.onBattleChanged?.({kind:'end',a:old.a,b:old.b,battle:old,winner:null})}
 for(const list of [state.fieldArmies||[],state.armyMoves||[]])for(let i=list.length-1;i>=0;i--)if(list[i].troops<=0){list[i].inBattle=false;list.splice(i,1)}state.battlePairs=active}
// Siege progress requires a stationary, unengaged army beside an enemy town.
const SIEGE_RADIUS=12,SIEGE_BASE_SECONDS=18;
const CAPTURE_POPULATION_RETAINED=.8;
function applyCaptureLosses(region){
 for(const city of region.buildings)if(city.type==='city')city.population=(city.population||0)*CAPTURE_POPULATION_RETAINED;
 if(region.displacedResidents)region.displacedResidents*=CAPTURE_POPULATION_RETAINED;
}
function captureDuchy(state,region,attacker,{rebellion=false,vassalId=null}={}){
 if(!region||!isAtWar(state,attacker,region.owner))return {ok:false};
 const defender=region.owner,oldFaction=state.factions?.[defender];
 const wasCapital=region.id===(defender==='you'?state.capitalId:oldFaction?.regionId);
 recordWarLoss(state,defender,attacker,'townsLost');
 if(wasCapital)recordWarLoss(state,defender,attacker,'capitalsLost');
 for(let i=(state.recruitments||[]).length-1;i>=0;i--){
  const order=state.recruitments[i];
  if(order.regionId!==region.id)continue;
  restoreRecruitPopulation(region,order);
  state.recruitments.splice(i,1);state.onRecruitmentInterrupted?.(order,region);
 }
 releaseVassalDuchy(state,region);
 region.owner=attacker;
 const house=vassalById(state,vassalId,attacker);
 if(house)assignVassalLand(region,house);
 else if(attacker==='you')region.awaitingAdministration=true;
 else delete region.awaitingAdministration;
 applyCaptureLosses(region);
 delete region.armory;delete region.market;delete region.councilReliefUntil;delete region.sabotageUntil;delete region.sabotageControl;
 state.council?.stewards.delete(region.id);
 state.sieges?.delete(region.id);
 if(state.garrisons)delete state.garrisons[region.id];
 if(rebellion){
  region.mood=-15;region.control=65;region.unrest=0;region.unrestAlertStage=0;
  if(region.occupation)region.occupation.repairAt=null;
 }else{
  state.economy?.granaries?.delete(region.id);
  beginOccupation(state,region);
 }
 let newCapital=null,defeated=false;
 if(wasCapital){
  for(const city of region.buildings)if(city.type==='city')city.capital=false;
  const remaining=state.regions.filter(r=>r.owner===defender&&duchySeat(r))
   .sort((a,b)=>Number(!!a.awaitingAdministration)-Number(!!b.awaitingAdministration)||regionalPopulation(b)-regionalPopulation(a)||a.id-b.id);
  newCapital=remaining[0]||null;
  if(newCapital){
   duchySeat(newCapital).capital=true;
   delete newCapital.awaitingAdministration;
  }
  const ledger=factionLedger(state,defender);
  if(ledger?.stocks){for(const good of GOODS)ledger.stocks[good]=0;ledger.stocks.equipment=0;}
  defeated=!newCapital;
  if(defender==='you'){
   state.capitalId=newCapital?.id??null;state.defeated=defeated;
   if(newCapital?.market&&state.economy){
    for(const [good,amount] of Object.entries(newCapital.market.stocks))state.economy.stocks[good]+=amount;
    delete newCapital.market;
   }
   if(newCapital&&state.economy?.granaries){
    const reserve=granaryFor(state,newCapital.id);
    state.economy.stocks.grain=reserve.stock;reserve.stock=0;
   }
  }else if(oldFaction){
   oldFaction.regionId=newCapital?.id??(oldFaction.isRebel?region.id:null);
   oldFaction.defeated=defeated;
   if(defeated)oldFaction.path=null;
   else if(state.economy?.granaries){const reserve=granaryFor(state,newCapital.id);oldFaction.stocks.grain=reserve.stock;reserve.stock=0;}
  }
  if(newCapital)releaseVassalDuchy(state,newCapital,true);
  if(defeated){
   for(const list of [state.fieldArmies||[],state.armyMoves||[]])
    for(let i=list.length-1;i>=0;i--)if(list[i].owner===defender)list.splice(i,1);
   for(const key of Object.keys(state.wars||{}))if(key.split('|').includes(defender)){
    delete state.wars[key];
    if(state.warRecords)delete state.warRecords[key];
   }
  }
 }
 if(rebellion)duchySeat(region).capital=true;
 if(defender==='you'&&state.council?.front.musterId===region.id)state.council.front.musterId=state.capitalId;
 if(defender==='you'&&state.domainPriority)state.domainPriority=state.domainPriority.filter(id=>id!==region.id);
 stepControl(state,0);
 refreshFortifications(state);
 if(oldFaction?.isRebel&&defeated)resolveRebellions(state);
 if(rebellion)state.onRebellion?.({kind:'start',region,owner:defender,rebel:attacker});
 state.onDuchyCaptured?.({region,attacker,defender,wasCapital,newCapital,defeated,rebellion,vassal:house});
 const previousResult=state.campaign?.result;
 if(wasCapital||militaryCampaignTarget(state,region))updateCampaign(state,0,region.id);
 if(defeated&&defender==='you'&&(!state.campaign?.result||previousResult))
  state.onPlayerDefeated?.({owner:attacker,regionId:region.id});
 return {ok:true,region,attacker,defender,wasCapital,newCapital,defeated,vassal:house};
}
function stepSieges(state,dt){
 const sieges=state.sieges??=new Map(),combatants=battleCombatants(state),valid=new Set();
 for(const region of state.regions){
  if(!region.slots?.[0]||region.owner==='neutral')continue;
  const position=region.slots[0],defender=region.owner;
  const near=combatants.filter(a=>distance(a.point,position)<=SIEGE_RADIUS);
  const attackers=near.filter(a=>!a.garrison&&state.fieldArmies?.includes(a.unit)&&isAtWar(state,a.unit.owner,defender)&&
   !a.unit.exitRegion&&(!region.polys||insideRegion(region,a.point.x,a.point.z)));
  let siege=sieges.get(region.id);
  if(siege&&siege.defender!==defender){sieges.delete(region.id);siege=null}
  const leader=attackers.find(a=>!siege||a.unit.owner===siege.attacker);
  if(!leader){
   if(!siege)continue;
   siege.progress=Math.max(0,siege.progress-dt/(SIEGE_BASE_SECONDS*2));
   siege.status='abandoned';
   if(siege.progress<=0){sieges.delete(region.id);state.onSiegeChanged?.({kind:'lifted',region,siege})}
   else valid.add(region.id);
   continue;
  }
  if(!siege){
   siege={regionId:region.id,attacker:leader.unit.owner,defender,progress:0,status:'active'};
   sieges.set(region.id,siege);
   state.onSiegeChanged?.({kind:'start',region,siege});
  }
  valid.add(region.id);
  const defended=near.some(a=>a.unit.owner===defender&&a.unit.troops>0);
  const engaged=(state.battlePairs||[]).some(b=>distance(b.point,position)<=SIEGE_RADIUS);
  if(defended||engaged||attackers.some(a=>a.unit.inBattle)){siege.status='contested';continue}
  const forces=new Map();
  let soldiers=0;
  for(const {unit} of attackers){
   if(unit.owner!==siege.attacker)continue;
   const house=unit.vassalId??null;
   forces.set(house,(forces.get(house)||0)+unit.troops);
   soldiers+=unit.troops;
  }
  siege.status='active';
  siege.troops=soldiers;
  siege.progress=Math.min(1,siege.progress+dt*Math.max(.15,Math.min(4,soldiers/100))/SIEGE_BASE_SECONDS);
  if(siege.progress<1)continue;
  const [commander]=[...forces].sort(([a,n],[b,m])=>m-n||(a??0)-(b??0))[0];
  sieges.delete(region.id);
  captureDuchy(state,region,siege.attacker,{vassalId:commander});
 }
 for(const [id,siege] of sieges)if(!valid.has(id)){
  sieges.delete(id);
  state.onSiegeChanged?.({kind:'lifted',region:state.regions.find(r=>r.id===id),siege});
 }
}
function neutralOccupationCheck(state,region,owner='you'){
 if(!state.started||state.defeated||region?.owner!=='neutral'||!region.slots?.[0])return {ok:false,reason:'Нужен нейтральный город'};
 const city=region.slots[0];
 const army=(state.fieldArmies||[]).find(unit=>unit.owner===owner&&unit.troops>0&&!unit.inBattle&&
  !unit.exitRegion&&distance(city,unit.location.point)<=SIEGE_RADIUS&&
  (!region.polys||insideRegion(region,unit.location.point.x,unit.location.point.z)));
 return army?{ok:true,army}:{ok:false,reason:'Остановите своё войско рядом с городом'};
}
function occupyNeutralDuchy(state,region,owner='you'){
 const check=neutralOccupationCheck(state,region,owner);
 if(!check.ok)return check;
 const q=region.slots[0];
 region.owner=owner;refreshFortifications(state);
 region.buildings.push({type:'city',x:q.x,z:q.z,slotId:q.id,scale:q.scale,terrain:q.terrain,population:NEUTRAL_RESIDENTS,capital:false});
 const house=vassalById(state,check.army.vassalId,owner);
 if(house)assignVassalLand(region,house);
 else if(owner==='you')region.awaitingAdministration=true;
 applyCaptureLosses(region);
 beginOccupation(state,region);
 stepControl(state,0);
 recallSettlers(state,region);
 state.evacuateSettledDuchy?.(region);
 state.onDuchyCaptured?.({region,attacker:owner,defender:'neutral',wasCapital:false,vassal:house});
 return {ok:true,region};
}
// Neutral petitions are one-off diplomatic deliveries, not trade orders.
const PETITION_COST=60,PETITION_REWARD=25,PETITION_AMOUNT=6,NEUTRAL_RESIDENTS=180;
function petitionFor(region){return {good:GOODS[(region.id*7+3)%GOODS.length],amount:PETITION_AMOUNT,cost:PETITION_COST,reward:PETITION_REWARD}}
function realmCapitalId(state,owner='you'){
 return owner==='you'?state.capitalId:state.factions?.[owner]?.regionId;
}
const VASSAL_SHARE=.5,VASSAL_LAND_LIMIT=2,VASSAL_REVIEW_SECONDS=8;
const VASSAL_SPECIALIZATIONS={
 military:{label:'Военный',recruitEvery:8,buildEvery:24,peaceArmy:200,warArmy:350,armyPerLand:80,
  peaceShare:.24,warShare:.36,peaceReserve:70,recruitQueue:2,buildQueue:1,armyInvestment:220},
 trade:{label:'Торговый',recruitEvery:26,buildEvery:12,peaceArmy:70,warArmy:130,armyPerLand:30,
  peaceShare:.12,warShare:.22,peaceReserve:150,recruitQueue:1,buildQueue:2,armyInvestment:70}
};
function vassalSpecialization(vassal){
 if(Object.hasOwn(VASSAL_SPECIALIZATIONS,vassal.specialization))return vassal.specialization;
 return vassal.id%2?'military':'trade';
}
function vassalSpecializationLabel(vassal){return VASSAL_SPECIALIZATIONS[vassalSpecialization(vassal)].label}
function chooseVassalSpecialization(state,owner,id){
 let balance=0;
 for(const vassal of state.vassals?.values()||[]){
  if(vassal.owner===owner)balance+=vassalSpecialization(vassal)==='military'?1:-1;
 }
 return balance>0?'trade':balance<0?'military':vassalSpecialization({id});
}
const VASSAL_COLORS=[[.85,.62,.35],[.55,.72,.55],[.64,.6,.85],[.86,.55,.62],[.55,.76,.8],[.8,.72,.45],[.7,.5,.78],[.5,.7,.86]];
const VASSAL_TIERS=[
 {id:'fief',name:'Лен',vassalTitle:'Барон',capacity:2},
 {id:'march',name:'Марка',vassalTitle:'Граф',capacity:4,lands:2,seatLevel:2,gold:150},
 {id:'principality',name:'Княжество',vassalTitle:'Князь',capacity:6,lands:4,seatLevel:3,gold:400}
];
function vassalTierInfo(vassal){
 return VASSAL_TIERS.find(tier=>tier.id===(vassal?.tier||'fief'))||VASSAL_TIERS[0];
}
function vassalTierIndex(vassal){
 return VASSAL_TIERS.findIndex(tier=>tier.id===(vassal?.tier||'fief'));
}
function vassalPromotionCheck(state,vassal,owner='you'){
 const index=vassalTierIndex(vassal),next=VASSAL_TIERS[index+1];
 if(!next)return {ok:false,next:null,reason:'Высший вассальный титул достигнут'};
 const lands=vassal.lands.map(id=>councilRegion(state,id,owner)).filter(Boolean);
 const seat=lands.find(r=>r.id===vassal.seatId)||lands[0];
 const seatLevel=seat?duchySeat(seat)?.level||1:0;
 const missing=[];
 if(lands.length<next.lands)missing.push('земли '+lands.length+'/'+next.lands);
 if(seatLevel<next.seatLevel)missing.push('столица '+seatLevel+'/'+next.seatLevel+' ур.');
 if(vassal.gold<next.gold)missing.push('казна '+Math.floor(vassal.gold)+'/'+next.gold);
 return {ok:missing.length===0,next,lands:lands.length,seatLevel,missing,reason:missing.length?'Нужно: '+missing.join(' · '):''};
}
function promoteVassal(state,vassal,owner='you'){
 const check=vassalPromotionCheck(state,vassal,owner);
 if(!check.ok)return check;
 vassal.gold-=check.next.gold;
 vassal.tier=check.next.id;
 vassal.status='Получил титул «'+check.next.name+'»';
 if(owner==='you')pushNotification(state,{kind:'diplomacy',title:'Вассал повышен',body:vassalDisplayName(state,vassal)+' · титул «'+check.next.name+'» · владения до '+check.next.capacity+' земель.',regionId:vassal.seatId});
 return {ok:true,tier:check.next};
}
function vassalById(state,id,owner){
 const vassal=state.vassals?.get(id);
 return vassal?.owner===owner?vassal:null;
}
function vassalFor(state,region){
 if(region?.vassalId==null)return null;
 return region.id===realmCapitalId(state,region.owner)?null:vassalById(state,region.vassalId,region.owner);
}
function shareVassalGold(vassal,amount){
 if(!vassal)return 0;
 const share=amount*VASSAL_SHARE;
 vassal.gold+=share;
 return share;
}
function creditVassalGoods(state,region,vassal,good,amount){
 if(good==='grain'&&region&&state.economy.granaries){
  changeGranaryStock(state,region.id,amount);
  recordLocalGrain(state,region.id,amount);
 }else vassal.stocks[good]=(vassal.stocks[good]||0)+amount;
}
function creditRealmCargo(state,owner,cargo,region=null,vassal=vassalFor(state,region)){
 const stocks=factionLedger(state,owner)?.stocks;
 if(!stocks)return {};
 const receipts={};
 for(const [good,amount] of Object.entries(cargo)){
  const retained=vassal?amount*VASSAL_SHARE:0;
  if(retained)creditVassalGoods(state,region,vassal,good,retained);
  receipts[good]=amount-retained;
  stocks[good]=(stocks[good]||0)+receipts[good];
  if(good==='grain'&&owner==='you')recordGrainFlow(state,receipts[good]);
 }
 return receipts;
}
function creditRealmTrade(state,ship,seller,buyer){
 const owner=shipmentOwner(ship),destination=councilRegion(state,ship.destinationRegionId??ship.destinationPortRegionId,ship.buyer);
 ship.realmReceipts=creditRealmCargo(state,ship.buyer,ship.cargo||{[ship.good]:ship.amount},destination);
 ship.realmRevenue=ship.value-shareVassalGold(vassalById(state,ship.vassalId,owner),ship.value);
 seller.gold+=ship.realmRevenue;
 recordCampaignTrade(state,owner,ship.buyer,ship.realmRevenue);
 if(ship.marketTrade||ship.kind==='botSeaTrade'){
  const toll=ship.value*.15;
  ship.realmToll=toll-shareVassalGold(vassalFor(state,destination),toll);
  buyer.gold+=ship.realmToll;
  recordCampaignIncome(state,ship.buyer,ship.realmToll);
  if(ship.buyer!=='you')buyer.tradeTax=(buyer.tradeTax||0)+ship.realmToll;
 }
}
function merchantHomeId(state,ship){
 const owner=shipmentOwner(ship),vassal=vassalById(state,ship.vassalId,owner);
 if(vassal)return vassal.lands.includes(ship.departureRegionId)?ship.departureRegionId:vassal.seatId;
 return tradeCenter(state,ship.marketId,owner)?.id??realmCapitalId(state,owner);
}
function vassalSeatName(state,vassal){
 return state.regions.find(r=>r.id===vassal.originId)?.city||'Местный дом';
}
// Local noble surname derived from the seat city, e.g. Плоцк → Плоцкий.
function vassalSurname(city){
 const root=String(city||'Местный дом').split(/[\s\-]/)[0].replace(/[ьъ]$/,'');
 let surname;
 if(/я$/i.test(root))surname=root.slice(0,-1)+(/[аеёиоуыэю]/i.test(root.slice(-2,-1))?'йский':'ский');
 else if(/[аеёиоуыэю]$/i.test(root))surname=root.slice(0,-1)+'ский';
 else if(/ск$/.test(root))surname=root.slice(0,-2)+'ский';
 else if(/к$/.test(root))surname=root.slice(0,-1)+'кий';
 else surname=root+'ский';
 return surname[0].toUpperCase()+surname.slice(1);
}
function vassalDisplayName(state,vassal){
 return vassalTierInfo(vassal).vassalTitle+' '+(vassal.surname||vassalSurname(vassalSeatName(state,vassal)));
}
function vassalGrantCheck(state,region,vassalId=null,owner='you'){
 if(!state.started||!state.economy||!getRealmCouncil(state,owner)||state.defeated||state.factions?.[owner]?.isRebel||state.factions?.[owner]?.defeated)
  return {ok:false,reason:'Держава недоступна'};
 if(!region||region.owner!==owner||!duchySeat(region))return {ok:false,reason:'Выберите своё герцогство с главным городом'};
 if(region.id===realmCapitalId(state,owner))return {ok:false,reason:'Столица державы остаётся в прямом управлении'};
 if(vassalFor(state,region))return {ok:false,reason:'У герцогства уже есть вассал'};
 const vassal=vassalId==null?null:state.vassals?.get(vassalId);
 if(vassalId!=null&&vassal?.owner!==owner)return {ok:false,reason:'Выберите своего вассала'};
 if(vassal){
  const tier=vassalTierInfo(vassal);
  if(vassal.lands.length>=tier.capacity)return {ok:false,reason:'Титул «'+tier.name+'» позволяет вассалу не более '+tier.capacity+' земель'};
 }
 return {ok:true,vassal};
}
function grantVassalDuchy(state,region,vassalId=null,owner='you'){
 const check=vassalGrantCheck(state,region,vassalId,owner);
 if(!check.ok)return check;
 let vassal=check.vassal;
 if(!vassal){
  const id=state.nextVassalId=(state.nextVassalId||0)+1;
  const stocks=Object.fromEntries([...GOODS,'equipment'].map(good=>[good,0]));
  vassal={id,owner,originId:region.id,seatId:region.id,lands:[],gold:0,stocks,nextReview:state.economy.seconds,
   foundedAt:state.economy.seconds,
   specialization:chooseVassalSpecialization(state,owner,id),surname:vassalSurname(region.city),
   color:VASSAL_COLORS[id%VASSAL_COLORS.length],status:'Оценивает состояние владений'};
  (state.vassals??=new Map()).set(id,vassal);
 }
 assignVassalLand(region,vassal);
 const council=getRealmCouncil(state,owner);
 if(council){
  council.stewards.delete(region.id);
  const refund=council.projects.reduce((total,project)=>total+
   (project.regionId===region.id&&project.finishAt!=null&&project.vassalId==null?project.cost:0),0);
  factionLedger(state,owner).gold+=refund;
  council.projects=council.projects.filter(p=>p.regionId!==region.id);
 }
 stepControl(state,0);
 state.onVassalGranted?.(region);
 return {ok:true,vassal};
}
function assignVassalLand(region,vassal){
 region.vassalId=vassal.id;
 vassal.lands.push(region.id);
 delete region.awaitingAdministration;
}
function administerCapturedDuchy(state,region,choice,vassalId=null){
 if(!state.started||state.defeated||region?.owner!=='you'||!region.awaitingAdministration||!state.regions.includes(region))
  return {ok:false,reason:'Герцогство больше не ждёт решения'};
 if(choice==='local')return grantVassalDuchy(state,region);
 if(choice==='vassal'&&vassalId!=null)return grantVassalDuchy(state,region,vassalId);
 if(choice!=='domain')return {ok:false,reason:'Выберите способ управления'};
 delete region.awaitingAdministration;
 stepControl(state,0);
 return {ok:true};
}
function vassalGiftCheck(state,vassal,amount,owner='you'){
 if(!vassal||vassal.owner!==owner||state.vassals?.get(vassal.id)!==vassal)return {ok:false,reason:'Вассал недоступен'};
 if(!Number.isSafeInteger(amount)||amount<1)return {ok:false,reason:'Введите целую сумму от 1 зл.'};
 const ledger=factionLedger(state,owner);
 if(!ledger||ledger.gold<amount)return {ok:false,reason:'Не хватает '+Math.ceil(amount-(ledger?.gold||0))+' зл. в казне'};
 return {ok:true,ledger};
}
function giftVassalGold(state,vassal,amount,owner='you'){
 const check=vassalGiftCheck(state,vassal,amount,owner);
 if(!check.ok)return check;
 check.ledger.gold-=amount;
 vassal.gold+=amount;
 return {ok:true};
}
function releaseVassalDuchy(state,region,restoreDirect=false,mergeTroops=true){
 if(region.vassalId==null)return;
 const vassal=state.vassals?.get(region.vassalId);
 delete region.vassalId;
 if(!vassal)return;
 const council=getRealmCouncil(state,vassal.owner);
 if(!restoreDirect&&council)council.projects=council.projects.filter(p=>p.regionId!==region.id||p.vassalId!==vassal.id);
 vassal.lands=vassal.lands.filter(id=>id!==region.id);
 if(vassal.lands.length){
  if(vassal.seatId===region.id)vassal.seatId=vassal.lands[0];
 }else{
  if(restoreDirect){
   factionLedger(state,vassal.owner).gold+=vassal.gold;
   creditRealmCargo(state,vassal.owner,vassal.stocks);
  }
  let troops=0;
  for(const list of [state.fieldArmies||[],state.armyMoves||[]])for(let i=list.length-1;i>=0;i--){
   if(list[i].vassalId!==vassal.id)continue;
   troops+=list[i].troops;list.splice(i,1);
  }
  state.vassals.delete(vassal.id);
  if(mergeTroops&&troops>0)reinforceGeneral(state,vassal.owner,1,troops);
 }
}
function vassalFoodPlan(state,region,task){
 const owner=region.owner,workforce=workforceReport(region);
 const farms=region.buildings.filter(b=>b.type==='grain');
 const options=[];
 const site=councilSite(state,region,'grain',owner,task.vassalId);
 if(site.ok)options.push({kind:'building',type:'grain',slot:site.slot,cost:site.cost,label:TYPES.grain.name,
  gain:councilWorkforceGain(region,workforce,{type:'grain',product:site.product},null,true)});
 for(const farm of farms){
  const check=upgradeCheck(state,region,farm,{...task,gold:Infinity},owner);
  if(!check.ok)continue;
  const candidate={...farm,level:check.level+1,product:{rate:check.nextRate}};
  options.push({...councilTaskUpgrade(state,region,farm,task),gain:councilWorkforceGain(region,workforce,candidate,farm,true)});
 }
 return options.filter(plan=>plan.gain>1e-8).sort((a,b)=>b.gain/b.cost-a.gain/a.cost)[0];
}
function sendVassalRelief(state,lands,region,task){
 if(!state.economy.granaries||task.gold<RELIEF_GOLD||moodReport(state,region).cooldown>0)return false;
 if(state.economy.shipments.some(ship=>ship.kind==='granary'&&ship.grainDestination===region.id&&ship.grainPurpose==='relief'))return false;
 for(const source of lands){
  if(source===region||granaryStock(state,source.id)<RELIEF_GRAIN+regionGrainNeed(state,source)*2)continue;
  const path=state.grainRoute?.(source,region);
  if(!path?.length)continue;
  task.gold-=RELIEF_GOLD;
  changeGranaryStock(state,source.id,-RELIEF_GRAIN);
  region.reliefCooldownUntil=state.economy.seconds+RELIEF_COOLDOWN;
  state.economy.shipments.push({kind:'granary',owner:task.realm,originRegion:source.id,grainDestination:region.id,grainPurpose:'relief',
   good:'grain',amount:RELIEF_GRAIN,cargo:{grain:RELIEF_GRAIN},path,mode:path.seaSupply?'sea':'land',seaSupply:path.seaSupply,
   seaStart:path.seaStart,seaEnd:path.seaEnd,elapsed:0,duration:journeyDuration(path)});
  return true;
 }
 return false;
}
function vassalDefense(state,region,task,enemies,guards){
 const owner=region.owner,front=(region.adj||[]).some(id=>enemies.has(state.regions.find(r=>r.id===id)?.owner));
 const revolt=unrestReport(state,region,guards)?.risk;
 if(front||revolt){
  const target=front?100:40,held=Math.max(guards.get(region.id)||0,generalArmy(state,owner,1,task.vassalId)?.troops||0);
  if(held<target&&!state.recruitments.some(order=>order.vassalId===task.vassalId)){
   let result=recruitGarrison(state,region,owner,task);
   if(!result.ok){
    const residents=recruitSiteCheck(state,region,owner,MARSHAL_RECRUIT_STEP).residents||0;
    const troops=marshalAffordableTroops(task.gold,Math.min(residents,target-held));
    if(troops)result=recruitGarrison(state,region,owner,task,{troops,market:true});
   }
   if(result.ok)return 'Набор '+result.order.troops+' солдат';
  }
  if(front&&held>0&&commissionFortification(state,region,owner,task).ok)return 'Пограничная крепость';
 }
 if(!enemies.size)return '';
 const fleet=state.warships||[],port=region.buildings.find(b=>b.type==='port'),berth=port&&state.navalBerth?.(port);
 if(!berth)return '';
 const guard=fleet.find(ship=>ship.homeId===region.id&&ship.owner===owner);
 if(guard){
  if(guard.vassalId!==task.vassalId||guard.repair||guard.prize)return '';
  if(guard.hull<=40&&task.stocks.wood>=6){orderRepair(state,guard);return ''}
  const merchant=state.economy.shipments.find(ship=>ship.vassalId===task.vassalId&&ship.mode==='sea'&&ship.kind==='export'&&
   fleet.some(enemy=>enemies.has(enemy.owner)&&distance(navalPosition(enemy),pointOnRoute(ship.path,ship.elapsed/ship.duration))<=PATROL_RADIUS*2));
  if(merchant&&!guard.escort)orderEscort(state,guard,merchant);
  return '';
 }
 if(!fleet.some(ship=>enemies.has(ship.owner)&&distance(navalPosition(ship),berth)<=PATROL_RADIUS*3))return '';
 const result=commissionWarship(state,region,port,owner,task);
 if(!result.ok)return '';
 orderWarship(state,result.ship,berth,owner);
 return 'Военный корабль';
}
function vassalWarSupport(state,vassal,owner,lands,enemies,combatants){
 if(!lands.length||!state.network||!state.roadNodeLocation)return;
 const now=state.economy.seconds;
 const unit=generalArmy(state,owner,1,vassal.id);
 if(!unit){vassal.militaryStatus='';return}
 const moving=state.armyMoves.includes(unit);
 if(unit?.inBattle)return;
 const hostile=combatants.filter(entry=>enemies.has(entry.unit.owner));
 const enemyStrength=(point,radius,fieldOnly=false)=>hostile.reduce((sum,entry)=>
  sum+((!fieldOnly||!entry.garrison)&&distance(point,entry.point)<=radius?entry.unit.troops:0),0);
 const seat=lands.find(land=>land.id===vassal.seatId)||lands[0];
 const location=land=>state.roadNodeLocation(state.network,state.network.hubKeys.get(land.id));
 const point=unit?(moving?pointOnRoute(unit.path,unit.elapsed/unit.duration):unit.location.point):seat.slots[0];
 const home=lands.slice().sort((a,b)=>enemyStrength(a.slots[0],20,true)-enemyStrength(b.slots[0],20,true)||
  distance(point,a.slots[0])-distance(point,b.slots[0]))[0];
 const localDanger=unit&&enemyStrength(point,28,true)>unit.troops*.9;
 const plannedDanger=moving&&enemyStrength(unit.destination.point,24,true)>unit.troops*.9;
 const selection={kind:'unit',unit,vassalId:vassal.id};
 const issue=(destination,kind,region,targetOwner=null)=>{
  if(!destination||unit&&distance(point,destination.point)<3)return false;
  const plan=prepareArmyOrder(state,selection,destination,owner,targetOwner);
  if(!plan.ok)return false;
  if(kind!=='Отход'){
   const cover=kind==='Прикрытие'?(state.garrisons?.[region.id]?.troops||0):0;
   const unsafe=Array.from({length:7},(_,index)=>pointOnRoute(plan.path,index/6)).some(position=>
    enemyStrength(position,20,true)>(plan.unit.troops+(distance(position,destination.point)<15?cover:0))*.9);
   if(unsafe)return false;
  }
  const result=orderArmy(state,selection,destination,owner,targetOwner);
  if(!result.ok)return false;
  result.march.vassalOrder=kind;
  result.march.vassalOrderAt=now;
  vassal.militaryStatus=kind+(region?' · '+region.city:'');
  return true;
 };
 if(unit&&(!enemies.size||localDanger||plannedDanger||unit.waiting||unit.troops<30)){
  if(moving&&unit.vassalOrder==='Отход'&&!plannedDanger)return;
  issue(location(home),'Отход',home);
  return;
 }
 if(!enemies.size){vassal.militaryStatus='';return}
 const threatened=land=>state.sieges?.get(land.id)?.defender===owner||enemyStrength(land.slots[0],33,true)>0;
 const coverLand=(land,troops)=>enemyStrength(land.slots[0],27,true)<(troops+(state.garrisons?.[land.id]?.troops||0))*.8&&
  issue(location(land),'Прикрытие',land);
 if(moving){
  if(['Осада','Рейд на обоз'].includes(unit.vassalOrder))lands.some(land=>threatened(land)&&coverLand(land,unit.troops));
  return;
 }
 const activeSiege=unit&&[...(state.sieges?.values()||[])].find(siege=>siege.attacker===owner&&
  distance(point,state.regions.find(land=>land.id===siege.regionId)?.slots?.[0]||seat.slots[0])<SIEGE_RADIUS);
 if(activeSiege&&enemyStrength(point,50,true)<unit.troops*.65)return;
 const troops=unit.troops;
 const borders=state.regions.filter(land=>land.owner===owner&&distance(point,land.slots[0])<100&&
  threatened(land));
 borders.sort((a,b)=>Number(vassalFor(state,b)===vassal)-Number(vassalFor(state,a)===vassal)||distance(point,a.slots[0])-distance(point,b.slots[0]));
 let acted=borders.some(land=>coverLand(land,troops));
 if(!acted&&!borders.some(land=>vassalFor(state,land)===vassal)){
  const raid=(state.economy?.shipments||[]).filter(ship=>enemies.has(shipmentOwner(ship))&&ship.path?.length>1&&
   !ship.supplyBlocked&&ship.kind!=='loot'&&ship.duration-ship.elapsed>=5).map(ship=>{
   const eta=Math.min(ship.duration,ship.elapsed+18);
   const along=routeDistanceAt(ship.path,eta/ship.duration);
   return ship.mode==='sea'&&along>=ship.seaStart&&along<=ship.seaEnd?null:pointOnRoute(ship.path,eta/ship.duration);
  }).filter(point=>point).filter(target=>distance(point,target)<65&&enemyStrength(target,30)<troops*.55)
   .sort((a,b)=>distance(point,a)-distance(point,b));
  const raidLocation=raid[0]&&state.nearestRoadLocation?.(state.network,raid[0].x,raid[0].z);
  acted=!!(raidLocation&&issue(raidLocation,'Рейд на обоз'));
  if(!acted){
   const targets=state.regions.filter(land=>enemies.has(land.owner)&&duchySeat(land)&&distance(point,land.slots[0])<130&&
    enemyStrength(land.slots[0],42,true)<troops*.45&&enemyStrength(land.slots[0],18)<troops*.75);
   targets.sort((a,b)=>distance(point,a.slots[0])-distance(point,b.slots[0]));
   acted=targets.slice(0,4).some(land=>issue(location(land),'Осада',land,land.owner));
  }
 }
 if(!acted&&now-(unit.vassalOrderAt||0)>30&&
  !state.regions.some(land=>enemies.has(land.owner)&&distance(point,land.slots[0])<SIEGE_RADIUS)&&
  !borders.some(land=>distance(point,land.slots[0])<SIEGE_RADIUS)){
  issue(location(home),'Отход',home);
 }
}
// Vassal houses settle unoccupied lands on their own, paying from their treasury.
function vassalExpand(state,vassal,owner,lands){
 if(vassal.gold<PETITION_COST+180)return;
 if(vassal.lands.length>=vassalTierInfo(vassal).capacity)return;
 if(state.economy.shipments.some(ship=>ship.kind==='petition'&&ship.vassalId===vassal.id))return;
 const candidates=owner!=='you'&&state.rankBotExpansion?state.rankBotExpansion(owner).map(({region})=>region):state.regions;
 const frontier=candidates.filter(r=>r.owner==='neutral'&&lands.some(land=>land.adj.includes(r.id)||r.adj.includes(land.id)));
 if(!frontier.length)return;
 const region=frontier[0];
 const q=petitionFor(region);
 if(vassal.gold<q.cost||(vassal.stocks[q.good]||0)<q.amount)return;
 const path=state.petitionPath?.(owner,region);
 if(!path||path.length<2)return;
 vassal.gold-=q.cost;
 vassal.stocks[q.good]-=q.amount;
 state.economy.shipments.push({kind:'petition',sequence:state.economy.nextPetitionSequence=(state.economy.nextPetitionSequence||0)+1,
  owner,originRegionId:path.originRegionId??null,targetId:region.id,good:q.good,amount:q.amount,fee:q.cost,reward:q.reward,
  vassalId:vassal.id,path,mode:path.seaStart!=null?'sea':'land',seaStart:path.seaStart,seaEnd:path.seaEnd,elapsed:0,duration:journeyDuration(path)});
 vassal.status='Обоз поселенцев · '+region.city;
}
// Feuds are confined to the two houses and never declare a war for their realm.
const VASSAL_FEUD_GRACE=90*SECONDS_PER_GAME_DAY;
const VASSAL_FEUD_ESCALATION=90*SECONDS_PER_GAME_DAY;
function vassalFeudPair(a,b){return Math.min(a,b)+':'+Math.max(a,b)}
function updateVassalRivalries(state,now){
 const previous=state.vassalRivalries,neighbors=new Map(),eligible=new Map(),atWar=new Map();
 for(const house of state.vassals.values()){
  house.foundedAt??=now;
  if(now<house.foundedAt+VASSAL_FEUD_GRACE||now<(house.feudCooldownUntil||0))continue;
  if(!atWar.has(house.owner))atWar.set(house.owner,activeWarEnemies(state,house.owner).length>0);
  if(!atWar.get(house.owner))eligible.set(house.id,house);
 }
 const lands=new Map(state.regions.filter(region=>eligible.has(region.vassalId)).map(region=>[region.id,region]));
 for(const region of lands.values())for(const id of region.adj){
  const other=lands.get(id);
  if(!other||other.owner!==region.owner||other.vassalId===region.vassalId)continue;
  const key=vassalFeudPair(region.vassalId,other.vassalId);
  if(neighbors.has(key))continue;
  const rivalry=previous?.get(key)||{since:now,warned:false};
  neighbors.set(key,rivalry);
  if(region.owner!=='you'||rivalry.warned||now-rivalry.since<VASSAL_FEUD_ESCALATION/2)continue;
  rivalry.warned=true;
  const a=eligible.get(region.vassalId),b=eligible.get(other.vassalId);
  pushNotification(state,{kind:'danger',title:'Растёт напряжение между вассалами',
   body:vassalDisplayName(state,a)+' и '+vassalDisplayName(state,b)+' спорят о пограничных землях',
   regionId:region.id});
 }
 state.vassalRivalries=neighbors;
}
function vassalFeudFor(state,vassalId){
 return [...(state.vassalFeuds?.values()||[])].find(feud=>feud.attackerId===vassalId||feud.defenderId===vassalId);
}
function orderFeudMarch(state,unit,region){
 const to=state.roadNodeLocation?.(state.network,state.network?.hubKeys.get(region.id));
 if(!to)return false;
 if(unit.location&&state.fieldArmies.includes(unit)&&distance(unit.location.point,to.point)<=SIEGE_RADIUS)return true;
 return orderArmy(state,{kind:'unit',unit,vassalId:unit.vassalId},to,unit.owner).ok;
}
function reportVassalFeud(state,feud,region,kind){
 const attacker=state.vassals.get(feud.attackerId),defender=state.vassals.get(feud.defenderId);
 const body=feud.attackerName+' против '+feud.defenderName+' · '+region.city;
 if(feud.owner==='you'){
  const titles={start:'Началась междоусобица',won:'Вассал захватил герцогство',repelled:'Вассальный поход отбит',ended:'Междоусобица прекращена'};
  pushNotification(state,{kind:'danger',title:titles[kind],body,regionId:region.id});
 }
 if(kind==='start')return;
 state.vassalFeuds.delete(region.id);
 for(const house of [attacker,defender]){
  if(!house)continue;
  house.feudCooldownUntil=state.economy.seconds+300;
  house.militaryStatus=kind==='won'&&house===attacker?'Захватил '+region.city:'';
 }
}
function vassalFeud(state,vassal,owner,lands){
 const army=generalArmy(state,owner,1,vassal.id);
 const now=state.economy.seconds;
 if(!army||army.inBattle||army.troops<100||!state.fieldArmies.includes(army)||
  (vassal.feudCooldownUntil||0)>now||activeWarEnemies(state,owner).length||vassalFeudFor(state,vassal.id)||
  lands.length>=vassalTierInfo(vassal).capacity)return;
 const targets=state.regions.filter(region=>region.owner===owner&&region.vassalId!=null&&region.vassalId!==vassal.id&&
  lands.some(land=>land.adj.includes(region.id)||region.adj.includes(land.id)));
 const candidates=[];
 for(const region of targets){
  const rival=vassalFor(state,region);
  if(!rival||(rival.feudCooldownUntil||0)>now||vassalFeudFor(state,rival.id)||state.sieges?.has(region.id))continue;
  const rivalry=state.vassalRivalries?.get(vassalFeudPair(vassal.id,rival.id));
  if(!rivalry||now-rivalry.since<VASSAL_FEUD_ESCALATION)continue;
  const opposing=generalArmy(state,owner,1,rival.id),guard=state.garrisons?.[region.id];
  const defense=(opposing?.troops||0)+(guard?.owner===owner?guard.troops:0)*(1.1+.10*(duchySeat(region)?.level||1));
  if(army.troops<Math.max(100,defense*1.6+25))continue;
  candidates.push({region,rival,opposing,score:distance(army.location.point,region.slots[0])+defense*.10+
   (region.id===rival.seatId&&rival.lands.length>1?45:0)});
 }
 candidates.sort((a,b)=>a.score-b.score||a.region.id-b.region.id);
 for(const {region,rival,opposing} of candidates){
  if(!orderFeudMarch(state,army,region))continue;
  const feud={owner,attackerId:vassal.id,defenderId:rival.id,attackerName:vassalDisplayName(state,vassal),
   defenderName:vassalDisplayName(state,rival),progress:0,status:'march',deadline:now+Math.max(120,(army.duration||0)+75),
   attackerCarry:0,defenderCarry:0};
  (state.vassalFeuds??=new Map()).set(region.id,feud);
  if(opposing&&!opposing.inBattle)orderFeudMarch(state,opposing,region);
  reportVassalFeud(state,feud,region,'start');
  break;
 }
}
function stepVassalFeuds(state,dt){
 for(const [id,feud] of state.vassalFeuds||[]){
  const region=state.regions.find(r=>r.id===id),house=vassalById(state,feud.attackerId,feud.owner);
  const attacker=house&&generalArmy(state,feud.owner,1,house.id);
  if(!region){state.vassalFeuds.delete(id);continue}
  if(vassalFor(state,region)?.id!==feud.defenderId||activeWarEnemies(state,feud.owner).length||
   state.economy.seconds>feud.deadline){
   reportVassalFeud(state,feud,region,'ended');continue;
  }
  if(!attacker||attacker.troops<20){
   reportVassalFeud(state,feud,region,'repelled');continue;
  }
  const nearby=unit=>unit?.troops>0&&state.fieldArmies.includes(unit)&&distance(unit.location.point,region.slots[0])<=SIEGE_RADIUS;
  if(!nearby(attacker))continue;
  const defender=generalArmy(state,feud.owner,1,feud.defenderId),guard=state.garrisons?.[id];
  const defending=[];
  if(nearby(defender))defending.push({unit:defender});
  if(guard?.owner===feud.owner&&guard.troops>0)defending.push({unit:guard});
  if(defending.length){
   feud.status='battle';
   const defense=defending.reduce((sum,entry)=>sum+entry.unit.troops*(entry.unit===guard?1.2:1),0);
   feud.attackerCarry+=defense*.045*dt;
   feud.defenderCarry+=attacker.troops*.045*dt;
   const attackersLost=Math.floor(feud.attackerCarry),defendersLost=Math.floor(feud.defenderCarry);
   feud.attackerCarry-=attackersLost;feud.defenderCarry-=defendersLost;
   battleLosses([{unit:attacker}],attackersLost);
   battleLosses(defending,defendersLost);
   continue;
  }
  feud.status='siege';
  feud.progress=Math.min(1,feud.progress+dt*Math.min(3,attacker.troops/100)/SIEGE_BASE_SECONDS);
  if(feud.progress<1)continue;
  for(let i=(state.recruitments||[]).length-1;i>=0;i--){
   const order=state.recruitments[i];
   if(order.regionId!==id)continue;
   restoreRecruitPopulation(region,order);
   state.recruitments.splice(i,1);
  }
  releaseVassalDuchy(state,region,false,false);
  assignVassalLand(region,house);
  if(state.garrisons)delete state.garrisons[id];
  applyCaptureLosses(region);
  beginOccupation(state,region);
  stepControl(state,0);
  state.onVassalGranted?.(region);
  state.onFeudCaptured?.(region);
  reportVassalFeud(state,feud,region,'won');
 }
}
function buyVassalSupplies(state,vassal,lands){
 const {economy}=state,capital=councilRegion(state,state.capitalId,'you');
 if(vassal.owner!=='you'||!capital||vassal.gold<TRADE_PRICE.grain||
  economy.shipments.some(ship=>ship.kind==='import'&&ship.vassalId===vassal.id&&ship.domesticPurchase))return false;
 const fleet=tradeFleet(state,'you',vassal);
 if(!fleet.landFree&&!fleet.seaFree)return false;
 const seat=lands.find(region=>region.id===vassal.seatId);
 const open=lands.filter(region=>!moodReport(state,region).besieged);
 const needs=open.map(region=>{
  const need=regionGrainNeed(state,region);
  const stock=economy.granaries?granaryStock(state,region.id):vassal.stocks.grain||0;
  return {region,good:'grain',missing:stock<need*1.2?Math.min(30,Math.ceil(need*2.5-stock)):0,coverage:stock/Math.max(1,need)};
 }).sort((a,b)=>a.coverage-b.coverage);
 if(open.includes(seat))for(const [good,target] of Object.entries({wood:24,iron:10,cloth:6})){
  const stock=vassal.stocks[good]||0;
  if(stock<target)needs.push({region:seat,good,missing:Math.ceil(target-stock)});
 }
 let output;
 for(const {region,good,missing} of needs){
  if(missing<=0||vassal.gold<TRADE_PRICE[good])continue;
  const reserve=tradeReserve(state,good,'you',good==='grain'?null:output??=productionTotals(state));
  const amount=Math.min(missing,Math.floor((economy.stocks[good]||0)-reserve),Math.floor(vassal.gold/TRADE_PRICE[good]));
  if(amount<1)continue;
  const path=state.grainRoute?.(capital,region);
  if(!path?.length)continue;
  const mode=path.seaSupply?'sea':'land';
  const portKey=mode==='sea'?fleet.ports.find(key=>!fleet.busyPorts.has(key)):null;
  if(mode==='sea'?!fleet.seaFree||!portKey:!fleet.landFree)continue;
  const value=amount*TRADE_PRICE[good];
  vassal.gold-=value;
  economy.stocks[good]-=amount;
  economy.shipments.push({kind:'import',domesticPurchase:true,owner:'you',seller:'you',vassalId:vassal.id,
   departureRegionId:region.id,sourceTradeRegionId:capital.id,mode,fleetClass:mode,portKey,good,amount,value,
   path,seaSupply:path.seaSupply,seaStart:path.seaStart,seaEnd:path.seaEnd,elapsed:0,duration:journeyDuration(path)});
  return true;
 }
 return false;
}
function recruitVassalArmy(state,vassal,lands,task,profile,atWar){
 const queued=state.recruitments.filter(order=>order.vassalId===vassal.id);
 const assigned=(generalArmy(state,vassal.owner,1,vassal.id)?.troops||0)+queued.reduce((sum,order)=>sum+order.troops,0);
 const residents=lands.reduce((sum,region)=>sum+regionalPopulation(region),0)+assigned;
 const reserve=atWar?30:profile.peaceReserve;
 const wealthBonus=Math.min(profile.armyInvestment,Math.floor(Math.max(0,task.gold-500)/25));
 const ideal=(atWar?profile.warArmy:profile.peaceArmy)+profile.armyPerLand*(lands.length-1)+wealthBonus;
 const limit=Math.min(ideal,residents*(atWar?profile.warShare:profile.peaceShare));
 const needed=Math.floor((limit-assigned)/MARSHAL_RECRUIT_STEP)*MARSHAL_RECRUIT_STEP;
 if(needed<MARSHAL_RECRUIT_STEP)return 'Дружина укомплектована';
 if(queued.length>=profile.recruitQueue+Number(atWar&&profile.recruitQueue>1))return 'Дружина пополняется';
 const spendable=Math.max(0,task.gold-reserve);
 if(spendable<marshalMarketPrice(MARSHAL_RECRUIT_STEP).total)return 'Копит на набор войск';
 const sources=lands.filter(region=>!moodReport(state,region).besieged)
  .sort((a,b)=>recruitQueue(state,a).length-recruitQueue(state,b).length||regionalPopulation(b)-regionalPopulation(a));
 for(const region of sources){
  const site=recruitSiteCheck(state,region,vassal.owner,MARSHAL_RECRUIT_STEP);
  if(!site.ok)continue;
  let result=needed>=RECRUIT_BATCH&&spendable>=RECRUIT_GOLD?recruitGarrison(state,region,vassal.owner,task):null;
  if(!result?.ok){
   const troops=marshalAffordableTroops(spendable,Math.min(needed,site.residents));
   if(troops)result=recruitGarrison(state,region,vassal.owner,task,{troops,market:true});
  }
  if(result?.ok){
   const cost=result.order.purchase?.total??RECRUIT_GOLD;
   const label='Набор '+result.order.troops+' солдат';
   vassal.lastAction={label,city:region.city,cost};
   return label+' · '+region.city;
  }
 }
 return 'Набор ждёт свободных жителей и мест в очереди';
}
function planVassalInvestment(state,land,task,income){
 const owner=land.owner;
 const future=councilEconomyPlan(state,land,task.gold,{purse:task,income,seconds:90,maximum:task.gold+income*1.5});
 if(future.plans.length)return future.plans[0];
 if(task.gold<160)return future.target;
 // A well-funded house can develop the estate even when the market forecast is weak.
 for(const building of land.buildings){
  if(!building.product||(!building.route?.length&&building.type!=='grain'))continue;
  if(upgradeCheck(state,land,building,task,owner).ok)return councilTaskUpgrade(state,land,building,task);
 }
 const options=[];
 for(const type of GOODS){
  const site=councilSite(state,land,type,owner,task.vassalId);
  if(!site.ok)continue;
  const path=councilProductionPath(state,land,site.slot,type,true);
  if(!path?.length&&type!=='grain')continue;
  options.push({kind:'building',type,slot:site.slot,path,cost:site.cost,label:TYPES[type].name,
   score:site.product.rate/(1+land.buildings.filter(b=>b.type===type).length)});
 }
 options.sort((a,b)=>b.score-a.score);
 if(options.length)return options[0];
 const seat=duchySeat(land);
 if(upgradeCheck(state,land,seat,task,owner).ok)return councilTaskUpgrade(state,land,seat,task);
 if(marketCheck(state,land,task,owner).ok&&land.buildings.some(b=>b.product&&b.type!=='grain'&&b.route?.length))
  return {kind:'market',cost:landDevelopmentPrice(state,MARKET_COST.gold,land),label:'Торговый центр'};
 return future.target;
}
function stepVassals(state){
 if(!state.vassals?.size)return;
 const now=state.economy.seconds,guards=defendingTroopsByRegion(state);
 updateVassalRivalries(state,now);
 let combatants;
 for(const vassal of state.vassals.values()){
  const {owner}=vassal;
  const lands=vassal.lands.map(id=>councilRegion(state,id,owner)).filter(r=>r&&vassalFor(state,r)===vassal);
  if(!lands.length)continue;
  const enemies=new Set(activeWarEnemies(state,owner));
  if(!vassalFeudFor(state,vassal.id)&&now>=(vassal.nextMilitaryReview||0)){
   vassal.nextMilitaryReview=now+6;
   vassalWarSupport(state,vassal,owner,lands,enemies,enemies.size?(combatants??=battleCombatants(state)):[]);
  }
  if(now<vassal.nextReview)continue;
  const council=getRealmCouncil(state,owner);
  const specialization=vassal.specialization=vassalSpecialization(vassal);
  const profile=VASSAL_SPECIALIZATIONS[specialization];
  vassal.nextReview=now+VASSAL_REVIEW_SECONDS;
  if(now>=(vassal.nextTradeReview||0)){
   vassal.nextTradeReview=now+(specialization==='trade'?16:24);
   if(!buyVassalSupplies(state,vassal,lands))state.dispatchVassalTrade?.(vassal,lands);
  }
  if(!vassal.tier)vassal.tier='fief';
  const promotion=vassalPromotionCheck(state,vassal,owner);
  if(promotion.ok){promoteVassal(state,vassal,owner);continue}
  const task={id:'vassal:'+vassal.id,vassalId:vassal.id,realm:owner,gold:vassal.gold,stocks:vassal.stocks,actions:0};
  if(now>=(vassal.nextRecruitReview||0)){
   vassal.nextRecruitReview=now+profile.recruitEvery;
   vassal.recruitmentStatus=recruitVassalArmy(state,vassal,lands,task,profile,enemies.size>0||!!vassalFeudFor(state,vassal.id));
   vassal.gold=task.gold;
  }
  vassalFeud(state,vassal,owner,lands);
  vassalExpand(state,vassal,owner,lands);
  task.gold=vassal.gold;
  const projects=council.projects.filter(p=>p.vassalId===vassal.id);
  if(projects.length>=profile.buildQueue){
   vassal.status='Строительство · '+projects.map(p=>TYPES[p.type].name).join(', ');
   continue;
  }
  if(now<(vassal.nextDevelopmentReview||0))continue;
  vassal.nextDevelopmentReview=now+profile.buildEvery;
  const available=lands.filter(r=>!moodReport(state,r).besieged&&state.vassalFeuds?.get(r.id)?.status!=='siege');
  let project,region;
  for(const land of available){
   if(!duchySeat(land).damaged||land.occupation?.repairAt!=null)continue;
   region=land;
   project={kind:'repair',cost:landDevelopmentPrice(state,SEAT_REPAIR_GOLD,land),label:'Восстановление города'};
   break;
  }
  const home=available.find(land=>land.id===vassal.seatId);
  if(!project&&home&&promotion.next&&lands.length>=promotion.next.lands&&promotion.seatLevel<promotion.next.seatLevel){
   const city=duchySeat(home);
   if(!city.damaged&&!city.housingClosed){
    region=home;
    project=councilTaskUpgrade(state,home,city,task);
   }
  }
  if(!project)for(const land of available){
   const needsGrowth=land.buildings.some(city=>city.type==='city'&&city.population>=CITY_SELF_FEED_LIMIT-10&&
    city.population<cityHousing(city)*.9);
   const need=regionGrainNeed(state,land)+(needsGrowth?1.2:0);
   if(localHarvest(land)*localGrainShare(land)+.05>=need)continue;
   if(!projects.some(p=>p.regionId===land.id&&p.type==='grain'))project=vassalFoodPlan(state,land,task);
   if(project){region=land;break}
   if(granaryFor(state,land.id)?.fed<.999&&sendVassalRelief(state,lands,land,task)){
    project={kind:'done',cost:0,label:'Помощь жителям'};region=land;break;
   }
  }
  if(!project){
   for(const land of available){
    const defense=vassalDefense(state,land,task,enemies,guards);
    if(defense){project={kind:'done',cost:0,label:defense};region=land;break}
    if((enemies.size||specialization==='military'&&task.gold>=400)&&commissionArmory(state,land,task,owner).ok){
     project={kind:'done',cost:0,label:'Оружейная мастерская'};region=land;break;
    }
   }
  }
  if(!project&&task.gold>=TYPES.grain.cost){
   const income=lands.reduce((sum,r)=>sum+duchyTax(state,r)*VASSAL_SHARE,0);
   for(const land of available.slice().sort((a,b)=>a.buildings.length-b.buildings.length)){
    project=planVassalInvestment(state,land,task,income);
    if(project){region=land;break}
   }
  }
  if(!project){
   vassal.status=!available.length?'Ждёт окончания осады':available.some(r=>r.occupation?.repairAt!=null)?'Восстанавливает город':
    task.gold<TYPES.grain.cost?'Копит на развитие':available.every(r=>r.buildings.length>=r.slots.length)?
    'Все графства заняты · доступных улучшений нет':'Ждёт доступной стройки или маршрута для поставок';
   continue;
  }
  if(task.gold+1e-8<project.cost){
   vassal.status='Копит '+Math.ceil(project.cost-task.gold)+' зл. · '+project.label.toLowerCase()+' · '+region.city;
   continue;
  }
  const done=project.kind==='repair'?repairSeat(state,region,owner,task).ok:
   project.kind==='done'||performCouncilAction(state,task,region,project);
  if(!done){vassal.status=task.status||'Проект временно недоступен';continue}
  vassal.lastAction={label:project.label,city:region.city,cost:Math.max(0,vassal.gold-task.gold)};
  vassal.gold=task.gold;
  vassal.status=project.label+' · '+region.city;
 }
}
function getRealmCouncil(state,owner='you'){
 return owner==='you'?state.council:state.factions?.[owner]?.council;
}
function createRealmCouncil(capitalId){
 return {reserve:0,projects:[],nextProject:0,paused:false,stewards:new Map(),monthly:{},taskQueues:{},
  previousMonthly:{},front:{musterId:capitalId,targetId:null,reserve:50,troops:200}};
}
function factionLedger(state,owner,purse=state){
 const faction=owner==='you'?state:state.factions?.[owner];
 if(!faction)return null;
 const account=purse&&purse!==state?purse:faction;
 if(owner!=='you'&&account===faction)return faction;
 const stocks=account.stocks??(owner==='you'?state.economy?.stocks:faction.stocks);
 return {stocks,get gold(){return account.gold},set gold(value){account.gold=value}};
}
function adjacentToFaction(state,region,owner){return state.regions.some(r=>r.owner===owner&&(r.adj.includes(region.id)||region.adj.includes(r.id)))}
function petitionCheck(state,owner,region){if(!state.started||!state.economy)return {ok:false,reason:'Сначала выберите столицу'};if(!region||region.owner!=='neutral')return {ok:false,reason:'Герцогство уже занято'};if(owner!=='you'&&!state.factions?.[owner])return {ok:false,reason:'Неизвестная страна'};if(!adjacentToFaction(state,region,owner)&&(!state.seaPetitionPath||!region.coast))return {ok:false,reason:'Доступны только соседние герцогства'};let q=petitionFor(region),ledger=factionLedger(state,owner);if(state.economy.shipments.some(s=>s.kind==='petition'&&s.owner===owner&&s.targetId===region.id))return {...q,ok:false,reason:'Ваш обоз уже в пути'};if(!ledger)return {...q,ok:false,reason:'Казна недоступна'};
 const missing=costShortfalls(ledger.gold,ledger.stocks,q.cost,{[q.good]:q.amount});
 if(missing.length)return {...q,ok:false,reason:'Не хватает · '+missing.join(' · ')};const path=state.petitionPath?.(owner,region)||state.seaPetitionPath?.(owner,region);if(!path||path.length<2)return {...q,ok:false,reason:state.seaPetitionPath?'Нужна общая граница или свой порт с морским путём':'Нет сухопутного пути'};return {...q,ok:true,path}}
function sendPetition(state,owner,region){const q=petitionCheck(state,owner,region);if(!q.ok)return q;const ledger=factionLedger(state,owner);ledger.gold-=q.cost;ledger.stocks[q.good]-=q.amount;if(owner==='you'&&q.good==='grain')recordGrainFlow(state,-q.amount);let ship={kind:'petition',sequence:state.economy.nextPetitionSequence=(state.economy.nextPetitionSequence||0)+1,owner,originRegionId:q.path.originRegionId??null,targetId:region.id,good:q.good,amount:q.amount,fee:q.cost,reward:q.reward,path:q.path,mode:q.path.seaStart!=null?'sea':'land',seaStart:q.path.seaStart,seaEnd:q.path.seaEnd,elapsed:0,duration:journeyDuration(q.path)};state.economy.shipments.push(ship);return {...q,ship}}
function turnSettlersHome(state,ship,target,advance=0){
 const elapsed=Math.min(ship.duration,ship.elapsed+advance);
 if(advance)recordRoadTraffic(state,ship,ship.elapsed,elapsed);
 const path=retraceRoute(ship,elapsed);
 Object.assign(ship,{kind:'petitionReturn',path,elapsed:0,duration:journeyDuration(path),
  mode:path.seaStart!=null?'sea':'land',seaStart:path.seaStart,seaEnd:path.seaEnd,supplyBlocked:false});
 state.onPetitionResult?.({ok:false,returning:true,ship,target});
}
function recallSettlers(state,target,winner=null,advance=0,turnTimes=null){
 for(const ship of state.economy?.shipments||[]){
  if(ship===winner||ship.kind!=='petition'||ship.targetId!==target.id)continue;
  turnSettlersHome(state,ship,target,advance);
  turnTimes?.set(ship,advance);
 }
}
function finishSettlerReturn(state,ship){
 const ledger=factionLedger(state,ship.owner);
 if(!ledger||!campaignNationAlive(state,ship.owner))return true;
 const home=ship.originRegionId!=null&&state.regions.find(r=>r.id===ship.originRegionId);
 if(home&&home.owner!==ship.owner&&ship.returnCapitalId!==realmCapitalId(state,ship.owner)){
  const capital=realmCapitalId(state,ship.owner);
  if(state.planConvoyDestination?.(ship,capital)){
   ship.returnCapitalId=capital;
   return false;
  }
  if(state.planConvoyDestination){ship.supplyBlocked=true;return false;}
 }
 const purse=ship.vassalId?vassalById(state,ship.vassalId,ship.owner):ledger;
 if(purse){purse.gold+=ship.fee;purse.stocks[ship.good]+=ship.amount}
 if(ship.owner==='you'&&!ship.vassalId&&ship.good==='grain')recordGrainFlow(state,ship.amount);
 state.onPetitionResult?.({ok:false,returned:true,ship,target:state.regions.find(r=>r.id===ship.targetId)});
 return true;
}
function redirectSupplyToCapital(state,ship){
 const owner=shipmentOwner(ship),capital=realmCapitalId(state,owner);
 if(capital==null){ship.supplyBlocked=false;return false;}
 if(state.planConvoyDestination?.(ship,capital)){
  ship.supplyCapitalId=capital;
  return true;
 }
 ship.supplyBlocked=!!state.planConvoyDestination;
 return false;
}
function arrivePetition(state,ship,advance=0,turnTimes=null){
 const target=state.regions.find(r=>r.id===ship.targetId),ledger=factionLedger(state,ship.owner);
 if(!ledger)return {ok:false,reason:'Страна больше не существует'};
 const bySea=state.seaPetitionPath&&ship.mode==='sea'&&state.regions.some(r=>
  r.id===ship.originRegionId&&r.owner===ship.owner&&r.buildings.some(b=>b.type==='port'));
 if(!target||target.owner!=='neutral'||!adjacentToFaction(state,target,ship.owner)&&!bySea){
  if(ship.path?.length>1)turnSettlersHome(state,ship,target);
  return {ok:false,returning:true,reason:'Герцогство недоступно, обоз возвращается'};
 }
 target.owner=ship.owner;refreshFortifications(state);
 target.control=70;target.mood=5;target.conquestUntil=0;target.reliefUntil=0;target.reliefCooldownUntil=0;
 target.moodAlerted=false;target.unrest=0;target.unrestAlertStage=0;target.revoltCooldownUntil=0;
 const q=target.slots[0];
 target.buildings.push({type:'city',x:q.x,z:q.z,slotId:q.id,scale:q.scale,terrain:q.terrain,population:NEUTRAL_RESIDENTS,capital:false});
 if(state.economy.granaries)changeGranaryStock(state,target.id,5);
 if(ship.vassalId){
  const vassal=vassalById(state,ship.vassalId,ship.owner);
  if(vassal){vassal.gold+=ship.reward;vassal.lands.push(target.id);target.vassalId=ship.vassalId}
 }else ledger.gold+=ship.reward;
 stepControl(state,0);
 recallSettlers(state,target,ship,advance,turnTimes);
 const timedX=(name,fn)=>{const s0=Date.now();const result=fn();const d=Date.now()-s0;const w=state._phaseTimings?.worst;if(w&&d>(w[name]||0))w[name]=d;return result};
 timedX('evacuate',()=>state.evacuateSettledDuchy?.(target));
 timedX('petitionResult',()=>state.onPetitionResult?.({ok:true,ship,target}));
 return {ok:true,target};
}
// Traffic is accumulated only along the part of a route actually travelled.
function roadEdgeKey(a,b){let aa=a.x.toFixed(3)+','+a.z.toFixed(3),bb=b.x.toFixed(3)+','+b.z.toFixed(3);return aa<bb?aa+'|'+bb:bb+'|'+aa}
function roadTrafficValue(entry,now){return entry?entry.value*Math.pow(.5,Math.max(0,now-entry.time)/180):0}
function recordRoadTraffic(state,ship,oldElapsed,newElapsed){if(!ship.path||ship.path.length<2||!ship.duration)return;let e=state.economy,traffic=e.roadTraffic??=new Map();const path=ship.path;
 // Кумулятивные длины рёбер кэшируются на самом рейсе, а обход начинается с
 // курсора прошлой секунды: иначе каждый тик весь путь проходился бы заново
 // (сотни рейсов × сотни точек = заметный фриз каждую секунду).
 if(ship._trafficPath!==path){const cum=new Float64Array(path.length);let acc=0;for(let i=1;i<path.length;i++){acc+=distance(path[i-1],path[i]);cum[i]=acc}ship._trafficPath=path;ship._trafficCum=cum;ship._trafficCursor=1;ship._trafficAt=0}
 const cum=ship._trafficCum,total=cum[path.length-1]||0;
 const end=Math.min(1,newElapsed/ship.duration)*total;
 let start=ship._trafficAt;
 if(end<start){ship._trafficCursor=1;ship._trafficAt=0;start=0} // путь отмотан назад — проходим заново
 let i=ship._trafficCursor;
 while(i<path.length&&cum[i]<=start)i++;
 for(;i<path.length&&cum[i-1]<end;i++){let a=path[i-1],b=path[i],len=cum[i]-cum[i-1],overlap=Math.max(0,Math.min(end,cum[i])-Math.max(start,cum[i-1]));if(overlap>0&&len>0&&!(ship.mode==='sea'&&cum[i]>ship.seaStart+1e-8&&cum[i-1]<ship.seaEnd-1e-8)){let key=roadEdgeKey(a,b),old=traffic.get(key),value=roadTrafficValue(old,e.seconds)+overlap/len;traffic.set(key,{value,time:e.seconds});e.trafficDirty=true}ship._trafficCursor=i+1}
 ship._trafficAt=end}
// An army intercepts an enemy caravan on the portion traversed this tick.
function findShipmentRaid(state,ship,fromElapsed,toElapsed){if(ship.kind==='tradeReturn'||!state.raidPath||!ship.path?.length||!state.wars||!Object.keys(state.wars).length||state.economy.seconds<(ship.raidImmuneUntil||0))return null;let victim=shipmentOwner(ship),candidates=(state._raidTick===state.economy.seconds?state._raidCandidates:battleCombatants(state)).filter(a=>!a.unit.inBattle&&isAtWar(state,a.unit.owner,victim));if(!candidates.length)return null;let span=Math.max(0,Math.min(toElapsed,ship.duration)-fromElapsed),samples=Math.max(1,Math.ceil(span*(ship.path.seaStart==null?CART_SPEED:SHIP_SPEED)/2));for(let j=0;j<=samples;j++){let fraction=j/samples,elapsed=fromElapsed+span*fraction,p=pointOnRoute(ship.path,Math.min(1,elapsed/ship.duration));const along=routeDistanceAt(ship.path,elapsed/ship.duration);if(ship.mode==='sea'&&along>=ship.seaStart&&along<=ship.seaEnd)continue;for(const a of candidates){let unit=a.unit,position=a.point;if(unit._raidStamp===state.economy.seconds&&unit.path?.length&&unit._raidBefore!=null){let t=unit._raidBefore+(unit.elapsed-unit._raidBefore)*fraction;position=pointOnRoute(unit.path,Math.min(1,t/unit.duration))}if(distance(p,position)>3.5)continue;const land=regionAt(state.regions,position.x,position.z),house=(a.garrison?vassalFor(state,land):vassalById(state,unit.vassalId,unit.owner));let path=state.raidPath(unit.owner,p,house?.seatId);if(path?.length>=2)return {attacker:unit.owner,victim,point:p,path,elapsed,vassalId:house?.id,sourceRegionId:land?.id}}}return null}
function refundInterceptedTrade(state,ship){
 if(ship.kind==='export'&&!ship.marketTrade){
  const buyer=factionLedger(state,ship.buyer);
  if(buyer)buyer.gold+=ship.value||0;
 }else if(ship.kind==='import'){
  const owner=shipmentOwner(ship),buyer=factionLedger(state,owner,vassalById(state,ship.vassalId,owner));
  if(buyer)buyer.gold+=ship.value||0;
  if(owner==='you'&&!ship.vassalId)state.economy.tradeSpent=Math.max(0,(state.economy.tradeSpent||0)-(ship.value||0));
 }
}
function redirectRaidedShipment(state,ship,raid){const e=state.economy;
 recordWarLoss(state,raid.victim,raid.attacker,'cargoLost',ship.amount||0);
 refundInterceptedTrade(state,ship);Object.assign(ship,{kind:'loot',domesticPurchase:false,mode:'land',seaSupply:null,seaStart:null,seaEnd:null,owner:raid.attacker,vassalId:raid.vassalId,stolenFrom:raid.victim,lootRegionId:raid.sourceRegionId,path:raid.path,elapsed:0,duration:journeyDuration(raid.path),raidImmuneUntil:e.seconds+2,originRegionId:null,targetId:null,value:0,supplyBlocked:false,routeRisk:false,warDetour:false});state.onShipmentRaided?.({ship,attacker:raid.attacker,victim:raid.victim,point:raid.point});return ship}
const WARSHIP_COST={gold:90,wood:20,iron:8};
const WARSHIP_SPEED=30;
const PATROL_SPEED=12;
const PATROL_RADIUS=42;
const NAVAL_GUN_RANGE=12;
const NAVAL_DAMAGE_PER_SECOND=14;

function commissionWarship(state,region,port,owner='you',purse=null){
 const berth=port?.type==='port'&&state.navalBerth?.(port);
 if(!state.started||state.defeated||state.factions?.[owner]?.defeated||region?.owner!==owner||!region.buildings.includes(port)||!berth)
  return {ok:false,reason:'Нужен действующий порт'};
 const ships=state.warships??=[];
 if(ships.some(ship=>ship.owner===owner&&ship.homeId===region.id)) return {ok:false,reason:'В этом порту уже построен корабль'};
 if(!canDevelopLand(state,region,purse?.vassalId??null))return {ok:false,reason:VASSAL_BUILD_REASON};
 const ledger=factionLedger(state,owner,purse),cost=landDevelopmentPrice(state,WARSHIP_COST.gold,region);
 if(!ledger)return {ok:false,reason:'Казна недоступна'};
 const missing=costShortfalls(ledger.gold,ledger.stocks,cost,{wood:WARSHIP_COST.wood,iron:WARSHIP_COST.iron});
 if(missing.length)return {ok:false,reason:'Не хватает '+missing.join(' · ')};
 ledger.gold-=cost;
 ledger.stocks.wood-=WARSHIP_COST.wood;
 ledger.stocks.iron-=WARSHIP_COST.iron;
 const ship={owner,homeId:region.id,point:{...berth},elapsed:0,hull:100,vassalId:purse?.vassalId};
 ships.push(ship);
 return {ok:true,ship};
}

function navalPosition(ship,advance=0){
 return ship.path?.length>1?pointOnRoute(ship.path,(ship.elapsed+advance)/ship.duration):ship.point;
}

function navalVisualPose(ship,phase){
 const motion=ship.visualMotion;
 if(!motion?.length)return {point:navalPosition(ship),heading:ship.visualHeading||0};
 const leg=motion.find(leg=>phase<=leg.end)||motion.at(-1);
 const ratio=Math.min(1,(leg.elapsed+Math.max(0,Math.min(phase,leg.end)-leg.start))/leg.duration);
 return {point:pointOnRoute(leg.path,ratio),heading:routeHeading(leg.path,ratio)};
}

function setNavalCourse(ship,path,speed=WARSHIP_SPEED){
 ship.path=path;
 ship.elapsed=0;
 ship.duration=Math.max(.001,routeLength(path))/speed;
}
function navalMotionLeg(ship,start,span){
 return {path:ship.path,elapsed:ship.elapsed,duration:ship.duration,start,end:start+span};
}

function anyOwnedNavalPort(state,owner,point){
 let best=null, shortest=Infinity;
 for(const region of state.regions){
  if(region.owner!==owner) continue;
  for(const port of region.buildings){
   if(port.type!=='port') continue;
   const berth=state.navalBerth?.(port), path=berth&&state.navalPath?.(point,berth);
   if(!path?.length) continue;
   const length=routeLength(path);
   if(length<shortest){shortest=length;best={regionId:region.id,path}}
  }
 }
 return best;
}

function orderWarship(state,ship,destination,owner='you'){
 if(!state.warships?.includes(ship)||ship.owner!==owner||ship.prize) return {ok:false,reason:'Корабль занят доставкой добычи'};
 const path=state.navalPath?.(navalPosition(ship),destination);
 if(!path?.length) return {ok:false,reason:'Выберите доступную точку в море'};
 const center=path.at(-1);
 ship.escort=null;ship.repair=null;ship.patrol={center,next:0,waypoints:null};
 setNavalCourse(ship,path);
 return {ok:true,point:center};
}

function orderEscort(state,ship,merchant){
 if(!state.warships?.includes(ship)||ship.prize||!state.economy.shipments.includes(merchant)
  ||merchant.mode!=='sea'||!merchant.amount||shipmentOwner(merchant)!==ship.owner) return {ok:false,reason:'Выберите свой морской груз'};
 ship.repair=null;
 ship.escort=merchant;
 ship.point=navalPosition(ship);
 ship.path=null;
 return {ok:true};
}

function orderRepair(state,ship){
 if(!state.warships?.includes(ship)||ship.prize||(ship.hull??100)>=100||ship.repair) return {ok:false,reason:'Ремонт сейчас недоступен'};
 const position=navalPosition(ship);
 const port=anyOwnedNavalPort(state,ship.owner,position);
 if(!port) return {ok:false,reason:'Нет доступного своего порта'};
 ship.escort=null;
 ship.repair={portId:port.regionId,remaining:null};
 setNavalCourse(ship,port.path);
 return {ok:true};
}

function escortCourse(state,ship){
 const merchant=ship.escort;
 const from=navalPosition(ship);
 const length=routeLength(merchant.path);
 const range=merchant.mode==='sea'&&Number.isFinite(merchant.seaStart)&&Number.isFinite(merchant.seaEnd);
 if(!state.economy.shipments.includes(merchant)||shipmentOwner(merchant)!==ship.owner||!merchant.amount
  ||!range||!length||routeDistanceAt(merchant.path,merchant.elapsed/merchant.duration)>merchant.seaEnd){
  ship.escort=null;ship.point=from;ship.path=null;
  return;
 }
 // Wait at the embarkation point before the cargo reaches the water.
 const limit=routeDistanceAt(merchant.path,(merchant.elapsed+(merchant.supplyBlocked?0:1))/merchant.duration);
 const target=pointAtRouteDistance(merchant.path,Math.max(merchant.seaStart,Math.min(merchant.seaEnd,limit)));
 const course=state.navalPath?.(from,target);
 if(course?.length) setNavalCourse(ship,course);
}

function handleNavalRepair(state,ship,dt){
 const repair=ship.repair;
 if(!state.regions.some(r=>r.id===repair.portId&&r.owner===ship.owner&&r.buildings.some(b=>b.type==='port'))){
  ship.point=navalPosition(ship);ship.path=null;ship.repair=null;
  orderRepair(state,ship);
  return false;
 }
 if(ship.path) return true;
 if(ship.firing) return false;
 if(repair.remaining==null){
  const cost=Math.ceil((100-ship.hull)/10);
  const stocks=factionLedger(state,ship.owner,vassalById(state,ship.vassalId,ship.owner))?.stocks;
  if(!stocks||stocks.wood<cost) return false;
  stocks.wood-=cost;
  repair.remaining=Math.ceil((100-ship.hull)/4);
 }
 repair.remaining-=dt;
 if(repair.remaining<=0){
  ship.hull=100;ship.repair=null;
  state.onNavalEvent?.('repaired',ship);
 }
 return false;
}

function recordNavalLoss(state,owner,attacker,point,cargo){
 const value=Object.entries(cargo).reduce((sum,[good,amount])=>sum+(TRADE_PRICE[good]||0)*amount,0);
 if(attacker)recordWarLoss(state,owner,attacker,'cargoLost',Object.values(cargo).reduce((sum,amount)=>sum+amount,0));
 const losses=state.economy.navalLosses??=[];
 losses.push({owner,attacker,point,cargo:{...cargo},value,time:state.economy.seconds});
 if(losses.length>60) losses.shift();
 return losses.at(-1);
}

function patrolCourse(state,ship){
 const {center}=ship.patrol;
 const from=navalPosition(ship);
 const withinPatrol=point=>distance(center,point)<=PATROL_RADIUS;
 if(!withinPatrol(from)) return ship.path?null:state.navalPath?.(from,center);
 let target=null, nearest=Infinity;
 for(const other of state.warships){
  if(other===ship||!isAtWar(state,ship.owner,other.owner)) continue;
  const point=navalPosition(other), gap=distance(from,point);
  if(withinPatrol(point)&&gap<nearest){target=point;nearest=gap}
 }
 if(!target){
  for(const merchant of state.economy.shipments){
   if(merchant.mode!=='sea'||!merchant.amount||!isAtWar(state,ship.owner,shipmentOwner(merchant))) continue;
   const traveled=routeDistanceAt(merchant.path,merchant.elapsed/merchant.duration);
   if(traveled<merchant.seaStart||traveled>merchant.seaEnd) continue;
   const point=pointOnRoute(merchant.path,merchant.elapsed/merchant.duration), gap=distance(from,point);
   if(withinPatrol(point)&&gap<nearest){target=point;nearest=gap}
  }
 }
 if(target){
  if(nearest<=7&&(!state.navalLine||state.navalLine(from,target))) return [from,from];
  const pursuit=state.navalPath?.(from,target);
  if(pursuit?.every(withinPatrol)) return pursuit;
 }
 // Finish the current leg before picking a new patrol waypoint.
 if(ship.path) return null;
 const patrol=ship.patrol;
 if(!patrol.waypoints){
  patrol.waypoints=[];
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   const point={x:center.x+Math.cos(angle)*27,z:center.z+Math.sin(angle)*27};
   const route=state.navalPath?.(center,point);
   if(route?.every(withinPatrol)) patrol.waypoints.push(point);
  }
 }
 for(let attempt=0;attempt<patrol.waypoints.length;attempt++){
  const index=patrol.next++%patrol.waypoints.length;
  const point=patrol.waypoints[index];
  if(distance(point,from)<2) continue;
  const route=state.navalPath?.(from,point);
  if(route?.every(withinPatrol)) return route;
 }
 return distance(from,center)>1?state.navalPath?.(from,center):null;
}

function resolveNavalCombat(state,dt){
 const ships=state.warships||[], damage=new Map(), pinned=new Map(),opponents=new Map();
 for(const ship of ships){ship.firing=false;ship.pinned=false}
 for(let i=0;i<ships.length;i++) for(let j=i+1;j<ships.length;j++){
  const a=ships[i],b=ships[j];
  if(!isAtWar(state,a.owner,b.owner)) continue;
  const initialA=navalPosition(a),initialB=navalPosition(b);
  if(distance(initialA,initialB)>NAVAL_GUN_RANGE+2*WARSHIP_SPEED*dt) continue;
  const steps=a.path||b.path?Math.max(1,Math.ceil(WARSHIP_SPEED*dt/4)):0;
  for(let k=0;k<=steps;k++){
   const time=steps?dt*k/steps:0;
   const from=navalPosition(a,time),to=navalPosition(b,time);
   if(distance(from,to)>NAVAL_GUN_RANGE||state.navalLine&&!state.navalLine(from,to)) continue;
   a.firing=b.firing=true;
   for(const [ship,position,target,opponent] of [[a,from,to,b],[b,to,from,a]]){
    opponents.set(ship,opponent.owner);
    if(!ship.prize&&!ship.repair&&(ship.escort||ship.patrol&&distance(ship.patrol.center,target)<=PATROL_RADIUS)){
     const previous=pinned.get(ship);
     if(!previous||time<previous.time) pinned.set(ship,{position,time});
    }
    damage.set(ship,(damage.get(ship)||0)+NAVAL_DAMAGE_PER_SECOND*Math.max(dt/4,dt-time));
   }
   break;
  }
 }
 for(const [ship,contact] of pinned){
  ship.pinned=true;
  if(ship.path&&contact.time>0)ship.visualMotion=[navalMotionLeg(ship,0,contact.time)];
  ship.point=contact.position;
  ship.path=null;
 }
 for(const [ship,hit] of damage) ship.hull=Math.max(0,(ship.hull??100)-hit);
 for(let i=ships.length-1;i>=0;i--){
  if(ships[i].hull!==0) continue;
  const [sunk]=ships.splice(i,1);
  recordWarLoss(state,sunk.owner,opponents.get(sunk),'shipsLost');
  const loss=sunk.prize?recordNavalLoss(state,sunk.owner,null,navalPosition(sunk),sunk.prize.cargo):null;
  state.onNavalEvent?.('sunk',sunk,null,loss);
 }
}

function catchNavalCargo(state,warship,dt){
 const shipments=state.economy.shipments;
 for(let i=shipments.length-1;i>=0;i--){
  const merchant=shipments[i],victim=shipmentOwner(merchant);
  if(merchant.mode!=='sea'||merchant.kind==='tradeReturn'||!merchant.amount||!isAtWar(state,warship.owner,victim)) continue;
  const advance=merchant.supplyBlocked?0:dt;
  const distanceFromPort=routeDistanceAt(merchant.path,merchant.elapsed/merchant.duration);
  const travel=routeDistanceAt(merchant.path,(merchant.elapsed+advance)/merchant.duration)-distanceFromPort;
  if(distanceFromPort>merchant.seaEnd||distanceFromPort+travel<merchant.seaStart) continue;
  const steps=Math.max(1,Math.ceil((travel+(warship.path?WARSHIP_SPEED*dt:0))/4));
  for(let j=0;j<=steps;j++){
   const t=j/steps, elapsed=merchant.elapsed+advance*t;
   if(elapsed>merchant.duration+1e-8) break;
   const traveled=routeDistanceAt(merchant.path,elapsed/merchant.duration);
   if(traveled<merchant.seaStart||traveled>merchant.seaEnd) continue;
   const point=navalPosition(warship,dt*t);
   const target=pointOnRoute(merchant.path,elapsed/merchant.duration);
   if(distance(point,target)>7||state.navalLine&&!state.navalLine(point,target)) continue;
   if(warship.patrol&&distance(warship.patrol.center,point)<=PATROL_RADIUS&&distance(warship.patrol.center,target)>PATROL_RADIUS) continue;
   const protectedByEscort=state.warships.some(guard=>guard.escort===merchant&&guard.owner===victim
    &&distance(navalPosition(guard,dt*t),target)<=NAVAL_GUN_RANGE
    &&(!state.navalLine||state.navalLine(navalPosition(guard,dt*t),target)));
   if(protectedByEscort) continue;
   const port=anyOwnedNavalPort(state,warship.owner,point);
   if(!port) return false;
   refundInterceptedTrade(state,merchant);
   shipments.splice(i,1);
   if(warship.path&&dt*t>0)warship.visualMotion=[navalMotionLeg(warship,0,dt*t)];
   warship.point=point;
   warship.prize={cargo:merchant.cargo||{[merchant.good]:merchant.amount},victim,portId:port.regionId};
   setNavalCourse(warship,port.path);
   const loss=recordNavalLoss(state,victim,warship.owner,target,warship.prize.cargo);
   state.onNavalEvent?.('capture',warship,victim,loss);
   return true;
  }
 }
 return false;
}

function stepWarships(state,dt){
 const fleet=state.warships||[];
 for(let i=fleet.length-1;i>=0;i--) if(state.factions?.[fleet[i].owner]?.defeated) fleet.splice(i,1);
 for(const ship of fleet)ship.visualMotion=null;
 resolveNavalCombat(state,dt);
 for(const ship of state.warships||[]){
  if(ship.owner==='you'?state.defeated:state.factions?.[ship.owner]?.defeated) continue;
  if(ship.pinned) continue;
  if(ship.repair&&!handleNavalRepair(state,ship,dt)) continue;
  if(!ship.prize&&!ship.repair&&ship.escort) escortCourse(state,ship);
  if(!ship.prize&&!ship.repair&&!ship.escort&&ship.patrol){
   const route=patrolCourse(state,ship);
   if(route) setNavalCourse(ship,route,distance(navalPosition(ship),ship.patrol.center)<=PATROL_RADIUS?PATROL_SPEED:WARSHIP_SPEED);
  }
  if(!ship.prize&&!ship.repair&&!ship.escort&&!ship.firing&&catchNavalCargo(state,ship,dt)) continue;
  if(ship.prize&&(!ship.path||!state.regions.some(r=>r.id===ship.prize.portId&&r.owner===ship.owner&&r.buildings.some(b=>b.type==='port')))){
   ship.point=navalPosition(ship);
   ship.path=null;
   const port=anyOwnedNavalPort(state,ship.owner,ship.point);
   if(!port) continue;
   ship.prize.portId=port.regionId;
   setNavalCourse(ship,port.path);
  }
  let spent=0;
  const motion=[];
  while(ship.path?.length&&spent<dt-1e-7){
   const elapsed=ship.elapsed, span=Math.min(dt-spent,ship.duration-elapsed);
   if(span>0)motion.push(navalMotionLeg(ship,spent,span));
   spent+=span;
   ship.elapsed+=span;
   if(ship.elapsed<ship.duration-1e-7)break;
   ship.point=ship.path.at(-1);
   ship.path=null;
   if(ship.prize||ship.repair||ship.escort||!ship.patrol||spent>=dt-1e-7)break;
   const next=patrolCourse(state,ship);
   if(!next||routeLength(next)<.1)break;
   setNavalCourse(ship,next,PATROL_SPEED);
  }
  if(motion.length)ship.visualMotion=motion;
  if(ship.path||!motion.length)continue;
  if(!ship.prize) continue;
  const vassal=vassalById(state,ship.vassalId,ship.owner);
  const region=vassal&&councilRegion(state,vassal.seatId,ship.owner);
  creditRealmCargo(state,ship.owner,ship.prize.cargo,region,vassal);
  ship.prize=null;
  state.onNavalEvent?.('delivery',ship);
 }
}

// Credit each ship once. Keep accurate totals even when the map has too many receipts to draw.
function recordDeliveryFeedback(state,ship){
 const e=state.economy,kind=ship.kind,point=ship.path?.at(-1);
 if(!point||!['export','import','loot','supply','granary','industry','returnTrade','botSeaTrade'].includes(kind))return;
 const buyer=ship.buyer,seller=shipmentOwner(ship);
 if(kind==='loot'&&seller!=='you'||kind==='botSeaTrade'&&buyer!=='you'||
  kind==='export'&&seller!=='you'&&buyer!=='you'||kind==='import'&&seller!=='you')return;
 const foreign=kind==='export'&&seller==='you',inbound=kind==='botSeaTrade'||kind==='export'&&buyer==='you';
 const market=ship.supplyMarketId??(kind==='returnTrade'?tradeCenter(state,ship.marketId)?.id:null);
 const regionId=foreign||inbound?ship.destinationRegionId??ship.destinationPortRegionId??realmCapitalId(state,ship.buyer)??state.capitalId:
  (ship.domesticPurchase?ship.departureRegionId:null)??ship.grainDestination??ship.industryDestination??market??state.capitalId;
 const cargo=Object.fromEntries(Object.entries(ship.cargo||{[ship.good]:ship.amount}).filter(([,amount])=>amount>0));
 const amount=Object.values(cargo).reduce((sum,units)=>sum+units,0);
 if(!amount)return;
 const value=ship.domesticPurchase?ship.value:foreign?(ship.realmRevenue??ship.value??0):inbound?(ship.realmToll??(ship.value||0)*.15):0;
 const totals=e.deliveryTotals??={gold:0,stocks:{}};
 const destinationIsCapital=regionId===state.capitalId&&kind!=='export'&&
  (kind!=='industry'||ship.industryPurpose!=='materials');
 if(destinationIsCapital||inbound)for(const [good,quantity] of Object.entries(ship.realmReceipts||cargo)){
  if(GOODS.includes(good))totals.stocks[good]=(totals.stocks[good]||0)+quantity;
 }
 totals.gold+=value;
 const last=ship.path.at(-2)||point;
 (e.events??=[]).push({kind,cargo,good:ship.good,amount,point,regionId,value,owner:shipmentOwner(ship),
  heading:Math.atan2(point.z-last.z,point.x-last.x),mode:ship.mode==='sea'&&
   (!Number.isFinite(ship.seaEnd)||routeLength(ship.path)<=ship.seaEnd+.1)?'sea':'land'});
 if(e.events.length>24)e.events.shift();
}
function finishBotSeaTrade(state,ship){
 const seller=factionLedger(state,ship.owner), buyer=factionLedger(state,ship.buyer);
 const port=state.regions.find(r=>r.id===ship.destinationPortRegionId);
 if(!seller||seller.defeated) return;
 if(!buyer||!campaignNationAlive(state,ship.buyer)||(ship.mode==='sea'&&port?.owner!==ship.buyer)||isAtWar(state,ship.owner,ship.buyer)||campaignTradeEmbargo(state,ship.owner,ship.buyer)){
  // Return unsold stock if the destination market changed hands.
  for(const [good,amount] of Object.entries(ship.cargo)) seller.stocks[good]+=amount;
  return;
 }
 creditRealmTrade(state,ship,seller,buyer);
 state.onSeaDelivery?.(ship);
 recordDeliveryFeedback(state,ship);
}

function runBotAction(state,action,owner){
 if(!state[action])return;
 if(state.botActions)state.botActions.set(action+':'+owner,{action,owner});
 else state[action](owner);
}
function stepEconomy(state,dt){if(!state.started||state.defeated||(state.campaign?.result&&!state.campaign.exploring)||!state.economy||!Number.isFinite(dt)||dt<=0)return;const e=state.economy;
 const P=state._phaseTimings??(state._phaseTimings={count:0,worst:{}}),mark=(name,start,end)=>{const d=end-start;if(d>(P.worst[name]||0))P.worst[name]=d};
 const timed=(name,fn)=>{const s=Date.now();const result=fn();const d=Date.now()-s;if(d>(P.worst['s:'+name]||0))P.worst['s:'+name]=d;return result};
 const t0=Date.now();
 e.seconds+=dt;stepTradeCenters(state);stepControl(state,dt);stepRecruitment(state,dt);refreshFortifications(state);for(const unit of state.armyMoves||[]){unit._raidStamp=e.seconds;unit._raidBefore=unit.elapsed}let combatSteps=Object.keys(state.wars||{}).length&&(state.armyMoves||[]).length?Math.ceil(dt/.25):1,combatDt=dt/combatSteps;for(let i=0;i<combatSteps;i++){stepBattles(state,combatDt);stepArmies(state,combatDt);stepGateSieges(state,combatDt)}if(combatSteps>1)stepBattles(state,0);resolveRebellions(state);stepSieges(state,dt);stepVassalFeuds(state,dt);stepAutoGarrison(state);const t1=Date.now();mark('combat',t0,t1);if(state.raidPath&&state.wars&&Object.keys(state.wars).length){state._raidTick=e.seconds;state._raidCandidates=battleCombatants(state)}
 stepWarships(state,dt);
 const workshops=state.regions.filter(r=>r.owner!=='neutral'&&!r.awaitingAdministration&&r.armory);
 stepArmoryWork(state,workshops,dt);
 // Resolve simultaneous arrivals in order of actual arrival time, then dispatch order.
 e.shipments.sort((a,b)=>(b.duration-b.elapsed)-(a.duration-a.elapsed)||(b.sequence||0)-(a.sequence||0));
 const settlerTurnTimes=new Map();
 for(let i=e.shipments.length-1;i>=0;i--){
  const ship=e.shipments[i];
  if(ship.kind==='export'&&!timed('exportDest',()=>ensureExportDestination(state,ship))){returnTradeShipment(state,ship);continue}
  if(ship.kind==='import'&&campaignTradeEmbargo(state,shipmentOwner(ship),ship.seller)){
   const owner=shipmentOwner(ship),vassal=vassalById(state,ship.vassalId,owner);
   const buyer=factionLedger(state,owner,vassal),seller=factionLedger(state,ship.seller);
   if(buyer){buyer.gold+=ship.value;if(ship.vassalId==null)recordCampaignIncome(state,owner,ship.value);}
   if(seller)seller.stocks[ship.good]=(seller.stocks[ship.good]||0)+ship.amount;
   e.shipments.splice(i,1);continue;
  }
  if(ship.kind==='petition'){
   const target=state.regions.find(region=>region.id===ship.targetId);
   if(target?.owner!=='neutral')turnSettlersHome(state,ship,target);
  }
  const turnTime=settlerTurnTimes.get(ship)||0;
  const previousElapsed=ship.elapsed,nextElapsed=ship.elapsed+dt-turnTime;
  const raid=timed('raid',()=>findShipmentRaid(state,ship,previousElapsed,nextElapsed));
  if(raid){
   recordRoadTraffic(state,ship,previousElapsed,raid.elapsed);
   redirectRaidedShipment(state,ship,raid);
   continue;
  }
  ship.elapsed=Math.min(ship.duration,nextElapsed);
  recordRoadTraffic(state,ship,previousElapsed,ship.elapsed);
  if(ship.elapsed<ship.duration)continue;
  if(ship.kind==='botSeaTrade'){finishBotSeaTrade(state,ship);e.shipments.splice(i,1);continue}
  if(ship.kind==='petition'){
   if(!timed('petition',()=>arrivePetition(state,ship,Math.max(0,ship.duration-previousElapsed),settlerTurnTimes)).ok&&ship.kind==='petitionReturn')continue;
  }else if(ship.kind==='petitionReturn'){
   if(finishSettlerReturn(state,ship)===false)continue;
  }else if(ship.kind==='export'){
 const owner=shipmentOwner(ship),buyer=factionLedger(state,ship.buyer),seller=factionLedger(state,owner);
 if(buyer&&seller){
  creditRealmTrade(state,ship,seller,buyer);
  const market=tradeCenter(state,ship.marketId,owner)?.market;
  if(market){market.sales++;market.revenue+=ship.value;market.lastBuyer=ship.buyer}
  if(owner==='you'){
   e.tradeEarned+=ship.realmRevenue;recordRecapDelivery(state,ship);
   if(ship.mode==='sea')state.onSeaDelivery?.(ship);
   const stats=e.tradeStats;
   if(stats){
    const bucket=ship.mode==='sea'?stats.sea:stats.land;
    bucket.count++;bucket.revenue+=ship.realmRevenue;
    if(ship.mode==='sea'&&ship.portKey){
     const port=stats.ports[ship.portKey]??={count:0,revenue:0};
     port.count++;port.revenue+=ship.realmRevenue;
    }
   }
  }
 }
 }else if(ship.kind==='tradeReturn'||ship.kind==='returnTrade'){
 const owner=shipmentOwner(ship),homeId=realmCapitalId(state,owner),hubId=merchantHomeId(state,ship);
 const vassal=vassalById(state,ship.vassalId,owner),origin=councilRegion(state,hubId,owner);
 const endpoint=ship.path?.at(-1),capital=(origin||state.regions.find(r=>r.id===hubId))?.slots?.[0];
 if(vassal&&ship.returnCapitalId!==hubId&&state.planMerchantReturn){
  const previous=ship.path;
  timed('merchantPlan',()=>state.planMerchantReturn(ship));
  if(previous!==ship.path)continue;
 }
 if(state.raidPath&&!vassal&&hubId===homeId&&(ship.returnCapitalId!==hubId||(endpoint&&capital&&distance(endpoint,capital)>1))){
  const path=endpoint&&timed('raidPath',()=>state.raidPath(owner,endpoint));
  if(path?.length>1){
   Object.assign(ship,{path,elapsed:0,duration:journeyDuration(path),mode:'land',seaStart:null,seaEnd:null,returnCapitalId:homeId});
   continue;
  }
 }
 if(ship.kind==='returnTrade'&&factionLedger(state,owner)){
  const cargo=ship.cargo||{[ship.good]:ship.amount};
  if(vassal)for(const [good,amount] of Object.entries(cargo))creditVassalGoods(state,origin,vassal,good,amount);
  else depositMarketCargo(state,ship.marketId,cargo,owner);
 }
 }else if(ship.kind==='import'){
 const owner=shipmentOwner(ship),buyer=factionLedger(state,owner),seller=factionLedger(state,ship.seller);
 const vassal=vassalById(state,ship.vassalId,owner);
 if(ship.domesticPurchase){
  const destination=councilRegion(state,ship.departureRegionId,owner);
  if(!vassal||!destination||vassalFor(state,destination)!==vassal){
   refundInterceptedTrade(state,ship);
   seller.stocks[ship.good]+=ship.amount;
   e.shipments.splice(i,1);continue;
  }
  creditVassalGoods(state,destination,vassal,ship.good,ship.amount);
  seller.gold+=ship.value;
 }else{
  if(vassal)creditVassalGoods(state,councilRegion(state,merchantHomeId(state,ship),owner),vassal,ship.good,ship.amount);
  else if(buyer)creditRealmCargo(state,owner,{[ship.good]:ship.amount});
  if(seller){seller.gold+=ship.value;recordCampaignIncome(state,ship.seller,ship.value);}
 }
 }else if(e.granaries&&isGranaryShipment(ship)){
  if(!finishGranaryShipment(state,ship)){
   if(redirectSupplyToCapital(state,ship)){
    Object.assign(ship,{kind:'granary',grainPurpose:'return',grainDestination:ship.supplyCapitalId});
    continue;
   }
   if(ship.supplyBlocked)continue;
   e.shipments.splice(i,1);continue;
  }
 }else if(ship.kind==='industry'){
  if(!finishIndustryCargo(state,ship)){
   if(redirectSupplyToCapital(state,ship)){
    Object.assign(ship,{industryPurpose:'return',industryDestination:ship.supplyCapitalId});
    continue;
   }
   if(ship.supplyBlocked)continue;
   e.shipments.splice(i,1);continue;
  }
 }else if((ship.kind==='supply'||ship.kind==='botSupply')&&ship.supplyMarketId!=null){
  if(!tradeCenter(state,ship.supplyMarketId,ship.owner)){
   if(redirectSupplyToCapital(state,ship)){delete ship.supplyMarketId;continue}
   if(ship.supplyBlocked)continue;
   e.shipments.splice(i,1);continue;
  }
  depositMarketCargo(state,ship.supplyMarketId,ship.cargo||{[ship.good]:ship.amount},ship.owner);
 }else if(ship.kind==='loot'){
  const house=vassalById(state,ship.vassalId,ship.owner),cargo=ship.cargo||{[ship.good]:ship.amount};
  if(house){
   const recipient=councilRegion(state,house.seatId,ship.owner);
   for(const [good,amount] of Object.entries(cargo))creditVassalGoods(state,recipient,house,good,amount);
   ship.realmReceipts=cargo;
  }else ship.realmReceipts=creditRealmCargo(state,ship.owner,cargo,councilRegion(state,ship.lootRegionId,ship.owner));
 }else if(ship.kind==='botSupply'){let owner=state.factions?.[ship.owner];if(owner&&!owner.defeated)for(const [good,amount] of Object.entries(ship.cargo||{[ship.good]:ship.amount}))owner.stocks[good]=(owner.stocks[good]||0)+amount}else{for(const [good,amount] of Object.entries(ship.cargo||{[ship.good]:ship.amount}))e.stocks[good]=(e.stocks[good]||0)+amount;if(ship.kind==='supply'&&ship.owner==='you'&&ship.originRegion!=null){e.regionDeliveries??={};let totals=e.regionDeliveries[ship.originRegion]??={};for(const [good,amount] of Object.entries(ship.cargo||{[ship.good]:ship.amount}))totals[good]=(totals[good]||0)+amount;}if(ship.cargo?.grain)recordGrainFlow(state,ship.cargo.grain);else if(!ship.cargo&&ship.good==='grain')recordGrainFlow(state,ship.amount);if(ship.kind==='import'){let seller=state.factions?.[ship.seller];if(seller)seller.gold+=ship.value}}recordDeliveryFeedback(state,ship);if(ship.kind==='export'&&ship.fleetClass){returnMerchantHome(state,ship);continue}e.shipments.splice(i,1)}
 const t2=Date.now();mark('shipments',t1,t2);
 const seaInTransit = new Set(e.shipments.filter(ship=>ship.seaSupply && (ship.kind==='supply'||ship.kind==='botSupply'))
  .map(ship=>ship.owner+':'+ship.originRegion));
 for(const region of state.regions){
  if(region.owner!=='you'&&!state.factions?.[region.owner])continue;
  if(region.awaitingAdministration)continue;
  const workforce=workforceReport(region),vassal=vassalFor(state,region);
  let keptGrain=0;
  const share=e.granaries?localGrainShare(region):0;
  for(const building of region.buildings){
   if(!building.product)continue;
   const output=productionRate(region,building,workforce)*dt/60;
   const regionalGrain=building.type==='grain'&&e.granaries;
   const kept=regionalGrain?output*share:vassal?output*VASSAL_SHARE:0;
   if(regionalGrain)keptGrain+=kept;
   else if(kept)creditVassalGoods(state,region,vassal,building.type,kept);
   building.produced=(building.produced||0)+output-kept;
  }
  if(e.granaries){
   const store=granaryFor(state,region.id);
   store.harvestRate=keptGrain*60/dt;
   if(keptGrain>0){
    changeGranaryStock(state,region.id,keptGrain);
    if(region.id===state.capitalId)recordGrainFlow(state,keptGrain);
    else recordLocalGrain(state,region.id,keptGrain);
   }
  }
  region.supplyClock=(region.supplyClock||0)+dt;
  if(region.supplyClock<DISPATCH_SECONDS) continue;
  region.supplyClock%=DISPATCH_SECONDS;
  if(state.factions?.[region.owner]?.isRebel)continue;
  const loads=new Map();
  for(const building of region.buildings){
   if(!building.product||!building.route?.length||!GOODS.includes(building.type)) continue;
   const sea=!!building.route.seaSupply;
   if(sea&&seaInTransit.has(region.owner+':'+region.id)) continue;
   const amount=Math.ceil(building.produced-1e-9);
   if(amount<=0) continue;
   building.produced-=amount;
   const key=sea?'sea':'land';
   if(!loads.has(key))loads.set(key,{cargo:{},path:null,length:0,pickups:[]});
   const load=loads.get(key);
   load.cargo[building.type]=(load.cargo[building.type]||0)+amount;
   if(region.owner==='you'&&state.onSupplyDispatched)load.pickups.push({building,amount});
   const length=routeLength(building.route);
   if(!load.path||length>load.length) Object.assign(load,{path:building.route,length});
  }
  for(const {cargo,path,pickups} of loads.values()){
   if(!path) continue;
   const types=Object.keys(cargo), player=region.owner==='you';
   const ship={kind:player?'supply':'botSupply',owner:region.owner,originRegion:region.id,
    supplyCapitalId:player?state.capitalId:state.factions?.[region.owner]?.regionId,
    good:types[0], amount:types.reduce((sum,good)=>sum+cargo[good],0), cargo, path,
    mode:path.seaSupply?'sea':'land', seaSupply:path.seaSupply, seaStart:path.seaStart, seaEnd:path.seaEnd,
    elapsed:0, duration:journeyDuration(path)};
   e.shipments.push(ship);
   if(player)state.onSupplyDispatched?.(ship,pickups);
  }
 }
 const realmLands=new Map();
 for(const region of state.regions){
  if(region.owner==='neutral')continue;
  if(!realmLands.has(region.owner))realmLands.set(region.owner,[]);
  realmLands.get(region.owner).push(region);
 }
 const guards=defendingTroopsByRegion(state);
 const upkeepBills=new Map();
 for(const [owner,regions] of realmLands){
  const faction=state.factions?.[owner];
  if(owner!=='you'&&(!faction||faction.defeated||faction.isRebel))continue;
  upkeepBills.set(owner,payRealmUpkeep(state,owner,regions,dt,guards));
 }
 const reparations=payWarReparations(state,dt);
 for(const [owner,upkeep] of upkeepBills){
  const councilPay=stepCouncilTasks(state,dt,owner);
  recordCampaignIncome(state,owner,-councilPay.due);
  updateRealmFinances(state,owner,realmLands.get(owner),dt,upkeep,councilPay,reparations.get(owner));
 }
 const t3=Date.now();mark('upkeep',t2,t3);
 for(const [id,f] of Object.entries(state.factions||{})){
  if(f.defeated||f.isRebel)continue;
  const cadence=state.botCadence?.(id)||{build:45,petition:120,recruit:150};
  if(!e.granaries)f.stocks.grain=Math.max(0,f.stocks.grain-(cityExternalGrainNeed(realmLands.get(id)?.find(r=>r.id===f.regionId))+garrisonGrainNeed(state,id))*dt/60);
  f.councilClock=(f.councilClock||0)+dt;
  const councilInterval=16*(f.strategyPace||1);
  if(f.councilClock>=councilInterval){f.councilClock%=councilInterval;runBotAction(state,'planBotCouncil',id)}
  f.revoltClock=(f.revoltClock||0)+dt;if(f.revoltClock>=8){f.revoltClock%=8;state.planRevoltDefense?.(id)}f.buildClock=(f.buildClock||0)+dt;if(f.buildClock>=cadence.build){f.buildClock%=cadence.build;runBotAction(state,'developBot',id)}f.petitionClock=(f.petitionClock||0)+dt;if(f.petitionClock>=cadence.petition){f.petitionClock%=cadence.petition;runBotAction(state,'planBotPetition',id)}f.recruitClock=(f.recruitClock||0)+dt;if(f.recruitClock>=cadence.recruit){f.recruitClock%=cadence.recruit;runBotAction(state,'recruitBot',id)}const diplomacyInterval=40*(f.strategyPace||1);
  f.diplomacyClock=(f.diplomacyClock||0)+dt;
  if(f.diplomacyClock>=diplomacyInterval){f.diplomacyClock%=diplomacyInterval;runBotAction(state,'planBotDiplomacy',id)}
  if(activeWarEnemies(state,id).length){let period=8*(f.strategyPace||1);f.warClock=(f.warClock||0)+dt;if(f.warClock>=period){f.warClock%=period;runBotAction(state,'planBotWar',id)}}else f.warClock=0
 }
 const t4=Date.now();mark('bots',t3,t4);
 for(const [owner,regions] of realmLands){
  if(state.factions?.[owner]?.isRebel)continue;
  dispatchArmoryShipments(state,regions.filter(r=>r.armory),owner);
  if(regions.some(r=>r.market))shipMarketReserves(state,owner);
  if(owner!=='you'&&getRealmCouncil(state,owner)?.projects.length)councilConstruction(state,owner);
 }
 const t5=Date.now();mark('dispatch',t4,t5);
 const inhabited=state.regions.filter(r=>r.owner!=='neutral'&&duchySeat(r));
 const owned=inhabited.filter(r=>r.owner==='you');
 let fed=1;
 if(e.granaries){
  repairBotCities(state,inhabited);
  fed=consumeRegionalGrain(state,inhabited,dt)?1:0;
  for(const region of inhabited)stepSettlement(state,region,dt);
 }else{
  const need=(owned.reduce((sum,r)=>sum+cityExternalGrainNeed(r),0)+garrisonGrainNeed(state))*dt/60,used=Math.min(need,e.stocks.grain);
  e.stocks.grain=Math.max(0,e.stocks.grain-used);
  fed=need?used/need:1;
 }
 const t6=Date.now();mark('settlements',t5,t6);
 e.tradeClock=(e.tradeClock||0)+dt;if(e.tradeClock>=12){e.tradeClock%=12;if(state.dispatchTrade)state.dispatchTrade();state.dispatchBotSeaTrade?.();state.planNavalDefense?.()}
 e.grainFlow=e.grainFlow.filter(event=>e.seconds-event.time<GRAIN_FLOW_WINDOW);let metrics=grainGrowthMetrics(state);e.growthRate=metrics.rate;e.grainNetRate=metrics.delivered;e.grainBonus=metrics.bonus;
 e.hungry=fed<.999;
 if(e.hungry){e.hungerSeconds=(e.hungerSeconds||0)+dt;if(e.hungerSeconds>=10&&!e.hungerAlerted){e.hungerAlerted=true;state.onFoodWarning?.({hungry:true,region:e.hungryRegion})}}
 else{if(e.hungerAlerted)state.onFoodWarning?.({hungry:false});e.hungerAlerted=false;e.hungerSeconds=0}
 stepMood(state,dt);stepUnrest(state,dt);
 e.potentialGrowthRate=metrics.rate*fed-.12*(1-fed);
 const pop=populationTotal(state);
 let naturalGrowth=0,limited=false;
 for(const r of inhabited){
  const store=granaryFor(state,r.id),ownedByPlayer=r.owner==='you';
  let rate=store?.growth??(ownedByPlayer?e.potentialGrowthRate:0);
  const fed=store?store.fed>=.999:rate>=0;
  let foodRoom=(store?.growthFood??factionLedger(state,r.owner)?.stocks?.grain??0)/GRAIN_PER_RESIDENT;
  // Growth needs food, open jobs and free housing.
  const residents=regionalPopulation(r);
  const wf=workforceReport(r);
  let jobFactor=wf.capacity>0?Math.min(1,wf.capacity/Math.max(1,wf.available)):0;
  // Fade out the small-town jobs allowance over a full starting city's capacity.
  const townSupport=Math.max(0,1-Math.max(0,residents-FRONTIER_POP)/(CITY_HOUSING[0]-FRONTIER_POP));
  if(jobFactor>0)jobFactor=Math.max(jobFactor,FRONTIER_JOB_FLOOR*townSupport);
  if(!fed||jobFactor<=0)rate=Math.min(0,rate);
  else rate*=jobFactor*(rate>0?CITY_GROWTH_MULT:1);
  relocateResidents(r,dt,fed,foodRoom>1e-7);
  let localGrowth=0,roomLimited=false,foodLimited=false;
  for(const b of r.buildings)if(b.type==='city'){
   const current=b.population||0,housing=cityHousing(b),room=Math.max(0,housing-current);
   const space=rate>0?Math.min(1,room/Math.max(1,housing*.25)):1;
   const selfRoom=Math.max(0,CITY_SELF_FEED_LIMIT-current);
   const localRate=selfRoom>0?Math.max(rate,BASE_GROWTH*jobFactor*CITY_GROWTH_MULT):rate;
   const change=current*Math.expm1(Math.log1p(localRate*space)*dt/60);
   if(ownedByPlayer&&space<1)limited=true;
   if(space<.99)roomLimited=true;
   foodLimited||=Math.min(change,room)>selfRoom+foodRoom+1e-8;
   const gain=Math.min(change,room,selfRoom+foodRoom);
   const lossFloor=-Math.max(0,current-CITY_SELF_FEED_LIMIT);
   const applied=Math.max(lossFloor,gain);
   foodRoom=Math.max(0,foodRoom-Math.max(0,applied-selfRoom));
   b.population=current+applied;
   localGrowth+=b.population-current;
  }
  r.populationTrend=residents>0?localGrowth*60/dt/residents:0;
  r.growthStatus=!fed&&residents>CITY_SELF_FEED_LIMIT?'food':foodLimited?'subsistence':jobFactor<=0?'jobs':jobFactor<.999?'underwork':roomLimited?'housing':null;
  if(ownedByPlayer)naturalGrowth+=localGrowth;
 }
 e.actualGrowthRate=pop>0?naturalGrowth/pop*60/dt:0;
 e.housingLimited=limited;
 e.housingFull=pop>0&&owned.filter(r=>r.owner==='you').every(r=>r.buildings.filter(b=>b.type==='city').every(b=>(b.population||0)>=cityHousing(b)-.001));
 const t7=Date.now();mark('growth',t6,t7);
 stepCouncil(state);
 stepVassals(state);
 flushCouncilReports(state);
 updateCampaign(state,dt);
 const t8=Date.now();mark('tail',t7,t8);P.count++;
}
if(typeof module!=='undefined')module.exports={warDeclarationCheck,peaceOptions,settleWar,truceDays,reparationRates,TYPES,LAND_NAMES,terrainAt,terrainHeight,productivity,inRing,isSeaBackground,triangulatePolygon,initRegion,regionAt,generateSlots,slotCapacity,slotRadius,slotAt,boundaryDistance,ringArea,buildCheck,build,demolishBuilding,localGrainShare,granaryStock,granaryReport,upgradeCheck,upgradeBuilding,initializeEconomy,gameDate,SECONDS_PER_GAME_DAY,pushNotification,markNotification,segmentWithin,routeWithin,routeLength,journeyDuration,routeDistanceAt,markSeaLeg,CART_SPEED,SHIP_SPEED,MIN_TRADE_CARGO,pointOnRoute,routeHeading,shipmentOwner,commissionWarship,orderWarship,orderEscort,orderRepair,stepWarships,navalPosition,WARSHIP_COST,PATROL_RADIUS,tradeRange,tradePremium,tradeFleet,tradeFleetAvailable,returnMerchantHome,tradePartnerAlive,returnTradeShipment,productionTotals,populationTotal,workforceReport,productionRate,buildingJobs,beginOccupation,settlementReport,seatRepairCheck,repairSeat,consumeRegionalGrain,stepSettlement,relocateResidents,taxIncome,regionEconomy,logisticsReport,vassalFor,vassalGrantCheck,grantVassalDuchy,vassalGiftCheck,giftVassalGold,cityHousing,housingTotal,stepEconomy,controlEfficiency,controlReport,stepControl,REALM_RANKS,realmRanks,realmRank,realmPromotionCheck,promoteRealm,duchyStability,moodEfficiency,economicEfficiency,moodReport,reliefCheck,sendRelief,stepMood,RELIEF_GOLD,RELIEF_GRAIN,unrestReport,startRebellion,stepUnrest,resolveRebellions,UNREST_SECONDS,REVOLT_COOLDOWN,TAX_PER_1000,recordGrainFlow,grainGrowthMetrics,grainReserve,tradeReserve,recruitCheck,recruitGarrison,recruitmentTime,recruitQueue,cancelRecruitment,RECRUIT_QUEUE_LIMIT,stepRecruitment,garrisonUpkeep,garrisonGrainNeed,armyTroops,hasArmyAccess,segmentRegionEntry,armyRouteAccess,armyEdgeFilter,supplyEdgeFilter,remainingSupplyPath,grantTransit,TRANSIT_COST,marchCheck,sendMarch,stepArmies,orderArmy,prepareArmyOrder,orderArmyGroup,warKey,isAtWar,declareWar,mergeArmies,battleCombatants,stepBattles,RECRUIT_BATCH,RECRUIT_IRON,RECRUIT_CLOTH,RECRUIT_GOLD,SIEGE_RADIUS,SIEGE_BASE_SECONDS,captureDuchy,stepSieges,findShipmentRaid,redirectRaidedShipment,roadEdgeKey,roadTrafficValue,recordRoadTraffic,petitionFor,petitionCheck,sendPetition,arrivePetition,adjacentToFaction,initializeCampaign,initializeCampaignRecap,updateCampaign,campaignNationAlive,createRealmCouncil,getRealmCouncil,realmCapitalId,factionLedger,pacifyCheck,pacify,PACIFY_GOLD,PACIFY_GRAIN,PACIFY_SECONDS,PACIFY_COOLDOWN,storeCheck,buildStore,setSupplyPriority,STORE_COST,STORE_SHARE,SUPPLY_PRIORITY_SHARE,VASSAL_TIERS,vassalTierInfo,vassalPromotionCheck,promoteVassal,activeWarEnemies,vassalSeatName,vassalSurname,vassalDisplayName};
