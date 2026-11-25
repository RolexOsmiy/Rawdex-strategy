'use strict';
// Headless population-growth scenario: a frontier town (180 residents, one
// grain field) grows for one hour of game time; prints its population curve
// and how fast it reaches 1000 souls.
const L=globalThis.__logicExports;
const T=globalThis.__transportExports;

function makeState(){
 const regions=HISTORICAL_REGIONS.map(L.initRegion);
 const state={regions,gold:450,started:true,selected:null};
 const player=regions.find(r=>r.key==='mazowieckie')||regions[0];
 player.owner='you';
 const seat=player.slots[0];
 player.buildings.push({type:'city',x:seat.x,z:seat.z,slotId:0,scale:seat.scale,terrain:seat.terrain,capital:true,population:1000});
 L.initializeEconomy(state,player);
 state.economy.granaries=new Map();
 state.network=T.makeTransport(regions);
 state.attachRoute=(region,b)=>{const cap=L.realmCapitalId(state,region.owner);return cap==null?null:T.attachBuilding(state.network,region,b,cap,L.supplyEdgeFilter(state,region.owner))};
 state.grainRoute=()=>null;
 state.armyTerritoryAt=p=>L.regionAt(state.regions,p.x,p.z);
 state.factions={};
 L.initializeCampaign(state,'baltic');
 return state;
}

function frontierScenario(state,{fed=true}={}){
 // Take an adjacent region as a fresh frontier town.
 const frontier=state.regions.find(r=>r.owner!=='you'&&(state.regions.some(o=>o.owner==='you'&&(o.adj.includes(r.id)||r.adj.includes(o.id))))&&!r.coast)||state.regions.find(r=>r.owner!=='you');
 frontier.owner='you';frontier.control=100;frontier.mood=20;
 const q=frontier.slots[0];
 frontier.buildings.push({type:'city',x:q.x,z:q.z,slotId:0,scale:q.scale,terrain:q.terrain,population:180,capital:false});
 const f=frontier.slots.find(s=>!frontier.buildings.some(b=>b.slotId===s.id));
 if(f){
  frontier.buildings.push({type:'grain',x:f.x,z:f.z,slotId:f.id,scale:f.scale,terrain:f.terrain,product:L.productivity('grain',f.terrain),produced:0,dispatchClock:0,level:1});
 }
 state.__feed=(state,frontierRegion)=>{
  // Simulate the relief logistics: a well-fed granary (stock + steady flow).
  const stores=state.economy.granaries;
  if(!stores.has(frontierRegion.id))stores.set(frontierRegion.id,{stock:0,flow:[],fed:1});
  const g=stores.get(frontierRegion.id);
  const need=frontierRegion.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+(b.population||0),0)*.006;
  if(fed){
   g.stock=Math.max(g.stock,200);
   g.flow.push({time:state.economy.seconds,amount:need*1.5/60});
  }
 };
 return {frontier,feed:()=>state.__feed(state,frontier)};
}

globalThis.__growthRun=()=>{
 const results={};
 for(const fed of [true,false]){
  const state=makeState();
  const {frontier,feed}=frontierScenario(state,{fed});
  let reached1000=null;
  const rows=[];
  for(let t=1;t<=3600;t++){
   if(fed)feed();
   L.stepEconomy(state,1);
   if(t%60===0){
    const pop=frontier.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+Math.floor(b.population||0),0);
    if(reached1000===null&&pop>=1000)reached1000=t;
    rows.push([t,pop]);
   }
  }
  results[fed?'fed':'starved']={reached1000,rows};
 }
 console.log('Фронтир: город 180 жителей + 1 ферма');
 for(const [label,data] of Object.entries(results)){
  console.log(label+': до 1000 жителей — '+(data.reached1000?Math.floor(data.reached1000/60)+' мин '+(data.reached1000%60)+' с':'не достиг за час'));
  const marks=new Set([0,2,4,6,8,10,12,15,20,25,30,40,50,59]);
  console.log(data.rows.filter((_,i)=>marks.has(i)).map(([t,p])=>'t'+String(Math.floor(t/60)).padStart(2)+'м:'+p).join(' '));
 }
 // Modest logistics: relief delivers exactly the need, small reserve.
 {
  const state=makeState();
  const {frontier}=frontierScenario(state,{fed:true});
  let reached1000=null;
  const rows=[];
  const stores=state.economy.granaries;
  for(let t=1;t<=3600;t++){
   if(!stores.has(frontier.id))stores.set(frontier.id,{stock:0,flow:[],fed:1});
   const g=stores.get(frontier.id);
   const need=frontier.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+(b.population||0),0)*.006;
   g.stock=Math.max(g.stock,need*2);
   g.flow.push({time:state.economy.seconds,amount:need/60});
   L.stepEconomy(state,1);
   if(t%60===0){
    const pop=frontier.buildings.filter(b=>b.type==='city').reduce((n,b)=>n+Math.floor(b.population||0),0);
    if(reached1000===null&&pop>=1000)reached1000=t;
    rows.push([t,pop]);
   }
  }
  console.log('modest: до 1000 жителей — '+(reached1000?Math.floor(reached1000/60)+' мин '+(reached1000%60)+' с':'не достиг за час'));
  const marks=new Set([0,2,4,6,8,10,12,15,20,25,30,40,50,59]);
  console.log(rows.filter((_,i)=>marks.has(i)).map(([t,p])=>'t'+String(Math.floor(t/60)).padStart(2)+'м:'+p).join(' '));
 }
};
