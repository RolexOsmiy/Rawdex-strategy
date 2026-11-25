'use strict';
// Headless match harness. Runs inside the sandbox bundle built by
// scripts/simulate.cjs: after the map data, logic, transport and strategy
// files it has access to HISTORICAL_REGIONS and the exported APIs below.
const L=globalThis.__logicExports;
const T=globalThis.__transportExports;
const S=globalThis.__strategyExports;
const MAP=globalThis.__SIM_MAP;
const OPTS=globalThis.__SIM_OPTS||{};

function alive(state,owner){return L.campaignNationAlive(state,owner)}
function atWar(state,owner,other){return L.isAtWar(state,owner,other)}
function truceUntil(state,owner,other){const t=state.peaceTreaties?.[L.warKey(owner,other)];return t?.truceEnd||0}

function makeState(){
 const regions=HISTORICAL_REGIONS.map(L.initRegion);
 const state={regions,gold:450,started:true,selected:null};
 const playerKey=OPTS.player||(MAP==='mediterranean'?'madrid':'mazowieckie');
 const player=regions.find(r=>r.key===playerKey)||regions[0];
 player.owner='you';
 const seat=player.slots[0];
 player.buildings.push({type:'city',x:seat.x,z:seat.z,slotId:0,scale:seat.scale,terrain:seat.terrain,capital:true,population:1000});
 L.initializeEconomy(state,player);
 state.economy.granaries=new Map();
 if(OPTS.dominate&&!OPTS.dominateBot){
  state.gold=2000;
  state.economy.stocks={grain:200,wood:120,iron:120,cloth:120,equipment:0};
  state.garrisons[player.id]={owner:'you',troops:3000};
 }
 state.network=T.makeTransport(regions);
 state.factions={};
 const candidates=regions.filter(r=>r!==player);
 const rivals=S.selectBotStarts(player,candidates,OPTS.bots||3,new Set(),[]);
 rivals.forEach((other,i)=>{
  const id=i?'bot'+(i+1):'bot';
  other.owner=id;other.control=100;other.mood=20;
  const q=other.slots[0],w=other.slots[1];
  other.buildings.push({type:'city',x:q.x,z:q.z,slotId:0,scale:q.scale,terrain:q.terrain,capital:true,population:1000});
  const good=['wood','iron','cloth'][i%3];
  state.factions[id]={name:'Bot '+(i+1),regionId:other.id,gold:250,
   council:L.createRealmCouncil(other.id),
   stocks:{grain:31,wood:5,iron:8,cloth:8,equipment:0},
   good,strategyPace:1,path:null,_pathHubs:null,
   buildClock:i*5,petitionClock:i*7,recruitClock:i*11,warClock:i*13,defeated:false};
  if(w){
   const workshop={type:good,x:w.x,z:w.z,slotId:1,scale:w.scale,terrain:w.terrain,
    product:L.productivity(good,w.terrain),produced:0,dispatchClock:0,level:1};
   const route=T.attachBuilding(state.network,other,workshop,other.id,L.supplyEdgeFilter(state,id));
   if(route){workshop.route=route;workshop.route.branchLength=route.length}
   other.buildings.push(workshop);
  }
 });
 if(OPTS.dominate&&OPTS.dominateBot){
  const f=state.factions[OPTS.dominateBot];
  if(f){f.gold=2000;f.stocks={grain:200,wood:120,iron:120,cloth:120,equipment:0};state.garrisons[f.regionId]={owner:OPTS.dominateBot,troops:3000}}
 }
 const petitionPaths=new Map();
 state.petitionPath=(owner,region)=>{
  let best=null,bestLength=Infinity;
  for(const source of state.regions){
   if(source.owner!==owner||!(source.adj.includes(region.id)||region.adj.includes(source.id)))continue;
   const key=source.id+':'+region.id;
   if(!petitionPaths.has(key))petitionPaths.set(key,T.networkPath(state.network,state.network.hubKeys.get(source.id),state.network.hubKeys.get(region.id)));
   const path=petitionPaths.get(key);
   if(path&&L.routeLength(path)<bestLength){best=path;bestLength=L.routeLength(path);best.originRegionId=source.id}
  }
  return best;
 };
 state.armyPath=(from,to,owner)=>{
  const a=state.network.hubKeys.get(from.id),b=state.network.hubKeys.get(to.id);
  return T.networkPath(state.network,a,b,L.armyEdgeFilter(state,owner))||T.networkPath(state.network,a,b);
 };
 state.armyTerritoryAt=p=>L.regionAt(state.regions,p.x,p.z);
 state.roadNodeLocation=T.roadNodeLocation;
 state.nearestRoadLocation=T.nearestRoadLocation;
 state.roadRouteBetween=T.roadRouteBetween;
 state.armyRoadRouteBetween=(g,from,to,owner)=>T.roadRouteBetween(g,from,to,L.armyEdgeFilter(state,owner));
 state.attachRoute=(region,b)=>{
  const cap=L.realmCapitalId(state,region.owner);
  return cap==null?null:T.attachBuilding(state.network,region,b,cap,L.supplyEdgeFilter(state,region.owner));
 };
 state.grainRoute=()=>null;
 L.initializeCampaign(state,MAP==='mediterranean'?'mediterranean':'baltic');
 L.initializeCampaignRecap(state,{capitalId:player.id,rivalIds:rivals.map(r=>r.id)});
 return state;
}

function rivalsOf(state,owner){
 return ['you',...Object.keys(state.factions||{})].filter(o=>o!==owner&&alive(state,o));
}

// Shared decision loop for the player and every bot. The real app has a richer
// AI; this one stresses the same rule set: build, upgrade, recruit, petitions,
// wars, sieges, peace and realm ranks.
function actorTick(state,owner,now){
 const ledger=L.factionLedger(state,owner);
 if(!ledger)return;
 if(owner!=='you'&&state.factions[owner]?.defeated)return;
 const owned=state.regions.filter(r=>r.owner===owner);
 if(!owned.length){if(owner!=='you')state.factions[owner].defeated=true;return}
 const gold=ledger.gold;
 const enemies=rivalsOf(state,owner).filter(o=>atWar(state,owner,o));
 const myArmy=L.armyTroops(state,owner);
 // Domination scenario: crush every rival capital, no truces, no peace.
 if(OPTS.dominate&&owner===(OPTS.dominateBot||'you')){
  for(const other of rivalsOf(state,owner))if(!atWar(state,owner,other))L.declareWar(state,other,owner);
  const foes=rivalsOf(state,owner).filter(o=>atWar(state,owner,o)).sort((a,b)=>L.armyTroops(state,a)-L.armyTroops(state,b));
  const homeId=L.realmCapitalId(state,owner);
  const besieging=u=>foes.some(foe=>{
   const seat=state.regions.find(r=>r.id===L.realmCapitalId(state,foe))?.slots?.[0];
   return seat&&Math.hypot(u.location.point.x-seat.x,u.location.point.z-seat.z)<=L.SIEGE_RADIUS;
  });
  const farArmies=target=>[...(state.fieldArmies||[])].filter(u=>u.owner===owner&&u.troops>=60&&!u.inBattle&&!besieging(u)&&Math.hypot(u.location.point.x-target.slots[0].x,u.location.point.z-target.slots[0].z)>L.SIEGE_RADIUS);
  for(const foe of foes){
   const capId=L.realmCapitalId(state,foe);
   const target=state.regions.find(r=>r.id===capId);
   if(!target||target.owner!==foe)continue;
   const dest=T.roadNodeLocation(state.network,state.network.hubKeys.get(target.id));
   if(!dest)continue;
   // Any garrison with troops to spare can march; captured towns hold their
   // defenders, so newly garrisoned armies keep pushing forward.
   const sources=owned.filter(r=>{const g=state.garrisons?.[r.id];return g&&g.owner===owner&&g.troops>40&&!g.inBattle});
   const far=farArmies(target);
   // Reachability probe: only when we have forces to move; armies already at
   // the seat keep besieging and are never re-routed.
   let probe=null;
   if(sources.length)probe=L.prepareArmyOrder(state,{kind:'garrison',regionId:sources[0].id,count:41},dest,owner,foe);
   if(!probe?.ok)for(const u of far){
    probe=L.prepareArmyOrder(state,{kind:'unit',unit:u},dest,owner,foe);
    if(probe.ok)break;
   }
   if(!probe?.ok)continue; // unreachable by land; try the next rival
   for(const r of sources)L.orderArmy(state,{kind:'garrison',regionId:r.id,count:state.garrisons[r.id].troops-40},dest,owner,foe);
   for(const u of far)L.orderArmy(state,{kind:'unit',unit:u},dest,owner,foe);
   break;
  }
  return;
 }

 // Develop: cover every resource first (iron and cloth matter for recruiting),
 // then fill the remaining plots.
 if(now%3===0&&gold>170){
  const counts={};
  for(const r of owned)for(const b of r.buildings)if(b.product)counts[b.type]=(counts[b.type]||0)+1;
  const missing=['iron','cloth','grain','wood'].filter(t=>!(counts[t]>=1));
  const order=[...missing,'grain','wood','iron','cloth'];
  let placed=false;
  for(const type of order){
   if(placed)break;
   for(const r of owned){
    for(const slot of r.slots){
     if(r.buildings.some(b=>b.slotId===slot.id))continue;
     const c=L.buildCheck(state,type,slot.x,slot.z,owner);
     if(c.ok){L.build(state,type,slot.x,slot.z,null,owner);placed=true;break}
    }
    if(placed)break;
   }
  }
 }
 // Upgrade production to level 2, then cities.
 if(now%5===0&&gold>260){
  outer:
  for(const r of owned){
   for(const b of r.buildings){
    if(b.product&&(b.level||1)<2){const u=L.upgradeCheck(state,r,b,ledger,owner);if(u.ok){L.upgradeBuilding(state,r,b,ledger,owner);break outer}}
   }
   const city=r.buildings.find(b=>b.type==='city'&&b.capital);
   if(city&&(city.level||1)<2&&gold>420){const u=L.upgradeCheck(state,r,city,ledger,owner);if(u.ok){L.upgradeBuilding(state,r,city,ledger,owner);break outer}}
  }
 }
 // Promote realm rank when the requirements are met.
 if(now%17===0){const q=L.realmPromotionCheck(state,owner);if(q.ok)L.promoteRealm(state,owner)}
 // Calm unrest at home when it reaches a third of the scale.
 if(now%11===0&&gold>90){
  const tense=owned.find(r=>{const u=L.unrestReport(state,r);return u?.progress>=35&&!u.blocked});
  if(tense)L.sendRelief(state,tense,owner);
 }
 // Pacify a restless or freshly captured province.
 if(now%13===0&&gold>180){
  for(const r of owned){const q=L.pacifyCheck(state,r,owner);if(q.ok){L.pacify(state,r,owner);break}}
 }
 // Build storehouses in developed duchies.
 if(now%19===0&&gold>340){
  for(const r of owned){const q=L.storeCheck(state,r,ledger,owner);if(q.ok){L.buildStore(state,r,ledger,owner);break}}
 }
 // Delegate excess lands to vassals.
 if(now%23===0&&owned.length>6){
  for(const r of owned){const q=L.vassalGrantCheck(state,r,null,owner);if(q.ok){L.grantVassalDuchy(state,r,null,owner);break}}
 }
 // Recruit garrisons, but keep an army budget and a war chest.
 const troopTarget=owned.length*150+100;
 if(now%7===0&&gold>170&&myArmy<troopTarget){for(const r of owned){const q=L.recruitGarrison(state,r,owner);if(q.ok)break}}
 // Petition adjacent neutral duchies.
 if(now%9===0&&gold>170){
  const frontier=state.regions.filter(x=>x.owner==='neutral'&&owned.some(o=>o.adj.includes(x.id)||x.adj.includes(o.id)));
  for(const cand of frontier){const q=L.sendPetition(state,owner,cand);if(q.ok)break}
 }
 // March border garrisons toward enemy seats while at war; keep a home reserve
 // of 40 soldiers so unrest stays suppressed.
 if(enemies.length){
  for(const enemy of enemies){
   if(!alive(state,enemy))continue;
   const targets=state.regions.filter(x=>x.owner===enemy);
   for(const r of owned){
    const g=state.garrisons?.[r.id];
    if(!g||g.owner!==owner||g.troops<=40||g.inBattle)continue;
    const target=targets.find(x=>x.adj.includes(r.id)||r.adj.includes(x.id));
    if(!target)continue;
    const dest=T.roadNodeLocation(state.network,state.network.hubKeys.get(target.id));
    if(!dest)continue;
    L.orderArmy(state,{kind:'garrison',regionId:r.id,count:Math.min(g.troops-40,150)},dest,owner,enemy);
   }
  }
  // Give up on hopeless stalemates.
  const key=Object.keys(state.warRecords||{}).find(k=>k.split('|').includes(owner));
  if(key){
   const record=state.warRecords[key],age=now-(record?.started??now);
   if(age>420&&now%30===0){
    const other=enemies.find(e=>atWar(state,owner,e));
    if(other){const p=L.peaceOptions(state,other,owner);if(p.white)L.settleWar(state,other,owner,'white')}
   }
  }
 }else if(now%13===0){
  // Free land first: no aggressive wars while neutral duchies remain
  // adjacent — bots rush the open territory before turning on each other.
  if(state.regions.some(r=>r.owner==='neutral'&&owned.some(o=>o.adj.includes(r.id)||r.adj.includes(o.id))))return;
  // Opportunistic war against the weakest rival with a shared frontier.
  // Early game: the player is spared unless his army is clearly neglected.
  const candidates=rivalsOf(state,owner)
   .filter(other=>truceUntil(state,owner,other)<=now&&!(now<300&&other==='you'&&!(L.armyTroops(state,'you')<60||myArmy>L.armyTroops(state,'you')*2.2)))
   .sort((a,b)=>L.armyTroops(state,a)-L.armyTroops(state,b));
  for(const other of candidates){
   const theirs=L.armyTroops(state,other);
   if(myArmy<140||myArmy<=theirs*1.2)continue;
   const shares=owned.some(o=>state.regions.some(x=>x.owner===other&&(x.adj.includes(o.id)||o.adj.includes(x.id))));
   if(shares){L.declareWar(state,other,owner);break}
  }
 }
}

function checkInvariants(state,ctx){
 const issues=[];
 const finite=(v,label)=>{if(typeof v==='number'&&!Number.isFinite(v))issues.push(ctx+': '+label+' = '+v)};
 finite(state.gold,'player gold');
 for(const g of ['grain','wood','iron','cloth','equipment'])finite(state.economy?.stocks?.[g],'stock '+g);
 for(const [id,f] of Object.entries(state.factions||{})){
  finite(f.gold,id+' gold');
  for(const g of ['grain','wood','iron','cloth','equipment'])finite(f.stocks?.[g],id+' stock '+g);
 }
 for(const r of state.regions){
  if(r.owner==='neutral')continue;
  for(const b of r.buildings)if(b.population!=null&&(b.population<0||!Number.isFinite(b.population)))issues.push(ctx+': '+r.city+' population '+b.population);
  const gr=state.garrisons?.[r.id];
  if(gr&&(!Number.isFinite(gr.troops)||gr.troops<0))issues.push(ctx+': '+r.city+' garrison '+gr.troops);
 }
 for(const m of state.armyMoves||[])finite(m.troops,'march troops');
 for(const u of state.fieldArmies||[])finite(u.troops,'field troops');
 for(const s of state.economy?.shipments||[]){finite(s.elapsed,'shipment elapsed');finite(s.duration,'shipment duration')}
 return issues;
}

function run(){
 const state=makeState();
 const limit=OPTS.seconds||7200;
 const owners=['you',...Object.keys(state.factions)];
 const metrics=[],events=[];
 let prevLands=1,prevWars=0,prevRebels=0,prevRealm='duchy';
 const prevBotRealm=new Map();
 const ownedCount=o=>state.regions.filter(r=>r.owner===o).length;
 const dateStr=now=>{const d=L.gameDate(now);return d.day+'.'+(d.month+1)+'.'+d.year};
 const snapshot=now=>{
  const p=state.campaign?.progress?.get('you')||{};
  metrics.push({
   sec:now,date:dateStr(now),
   lands:ownedCount('you'),
   bots:owners.slice(1).filter(o=>alive(state,o)).length,
   pop:Math.floor(L.populationTotal(state)),
   gold:Math.floor(state.gold),
   army:L.armyTroops(state,'you'),
   botArmies:owners.slice(1).reduce((n,o)=>n+L.armyTroops(state,o),0),
   income:Math.floor(L.taxIncome(state,'you')),
   capitals:(p.military?.held?.length)||0,
   trade:p.trade?.turnover||0,
   wars:Object.keys(state.wars||{}).length,
   battles:(state.battlePairs||[]).length,
   sieges:state.sieges?.size||0,
   shipments:state.economy?.shipments?.length||0
  });
 };
 snapshot(0);
 for(let now=1;now<=limit;now++){
  try{L.stepEconomy(state,1)}
  catch(e){events.push('CRASH t='+now+'s: '+(e&&e.stack||e));break}
  const issues=checkInvariants(state,'t='+now+'s');
  if(issues.length){events.push('INVARIANT '+issues.join(' | '));break}
  // Narrative events.
  const lands=ownedCount('you');
  if(lands>prevLands)events.push('t='+now+'s ('+dateStr(now)+') игрок получил герцогство: земель '+lands);
  if(lands<prevLands)events.push('t='+now+'s ('+dateStr(now)+') игрок потерял герцогство: земель '+lands);
  prevLands=lands;
  const wars=Object.keys(state.wars||{}).length;
  if(wars>prevWars){
   const previous=new Set(state.__prevWarKeys||[]);
   const fresh=Object.keys(state.wars||{}).filter(k=>!previous.has(k));
   state.__prevWarKeys=Object.keys(state.wars||{});
   events.push('t='+now+'s ('+dateStr(now)+') война: '+(fresh.join(', ')||'?'))
  }
  if(wars<prevWars)events.push('t='+now+'s ('+dateStr(now)+') мир, войн: '+wars);
  prevWars=wars;
  const rebels=Object.values(state.factions||{}).filter(f=>f.isRebel).length;
  if(rebels>prevRebels)events.push('t='+now+'s ('+dateStr(now)+') ВОССТАНИЕ, повстанцев: '+rebels);
  if(rebels<prevRebels)events.push('t='+now+'s ('+dateStr(now)+') восстание подавлено, повстанцев: '+rebels);
  prevRebels=rebels;
  // Realm promotions.
  if(state.realmRank!==prevRealm){events.push('t='+now+'s ('+dateStr(now)+') игрок повысил ранг: '+state.realmRank);prevRealm=state.realmRank}
  for(const [id,f] of Object.entries(state.factions||{})){if(f.realmRank&&f.realmRank!==prevBotRealm.get(id)){events.push('t='+now+'s ('+dateStr(now)+') '+id+' повысил ранг: '+f.realmRank);prevBotRealm.set(id,f.realmRank)}}
  // Actors.
  for(const owner of owners)actorTick(state,owner,now);
  // Keep log-like arrays bounded in headless mode.
  if(state.notifications?.length>300)state.notifications.splice(0,100);
  if(state.economy?.events?.length>300)state.economy.events.splice(0,100);
  if(state.economy?.grainFlow?.length>300)state.economy.grainFlow.splice(0,100);
  if(now%60===0)snapshot(now);
  if(state.campaign?.result){
   const r=state.campaign.result;
   events.push('РЕЗУЛЬТАТ t='+now+'s ('+dateStr(now)+'): '+(r.owner==='you'?'игрок':'бот')+' победил путём '+r.path);
   snapshot(now);
   break;
  }
  if(state.defeated){events.push('ИГРОК РАЗГРОМЛЕН t='+now+'s ('+dateStr(now)+')');snapshot(now);break}
 }
 if(metrics[metrics.length-1].sec!==Math.min(limit,metrics[metrics.length-1].sec)){}
 return {map:MAP,opts:OPTS,events,metrics,lastSec:metrics[metrics.length-1].sec};
}
globalThis.__simRun=run;
