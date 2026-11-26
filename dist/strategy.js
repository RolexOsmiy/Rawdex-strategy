'use strict';
// Strategy is based on the visible board and real economic state; it never grants resources.
// Political names are tied to the founding city. A crowded match may start
// several playable powers from the same historical polity.
const BALTIC_POLITIES=[
 ['Корона Польская','Королевство Польское','Речь Посполитая','mazowieckie','krakowskie','poznańskie','sandomierskie','lubelskie','kaliskie','ruskie','kijowskie','wołyńskie','czernihowskie','bełskie','bracławskie','podolskie','rawskie','sieradzkie','łęczyckie','płockie','brzeskie kujawskie','inowrocławskie','ziemia dobrzyńska','podlaskie','ovruch','zytomierz','cherkasy','pereiaslav','włodzimierz','krzemieniec'],
 ['Великое княжество Литовское','Великое княжество Литовское','Речь Посполитая','wileńskie','trockie','żmudzkie','nowogrodzkie','mińskie','brzeskie litewskie','mścisławskie','witebskie','smoleńskie','pinsk','mozyrz'],
 ['Королевская Пруссия','Прусское королевство','Прусская империя','pomorskie','malborskie','chełmińskie','warmińskie'],
 ['Герцогство Пруссия','Королевство Пруссия','Прусская империя','Prusy Książęce'],
 ['Герцогство Курляндии и Семигалии','Курляндское герцогство','Балтийская империя','Księstwo Kurlandii i Semigalii'],
 ['Инфлянтское герцогство','Ливонское королевство','Балтийская империя','wendeńskie','parnawskie','doprackie'],
 ['Померанское герцогство','Померанское герцогство','Балтийская империя','okręg bytowski','okręg lęborski'],
 ['Полоцкое княжество','Полоцкое княжество','Речь Посполитая','połockie'],
 ['Севежское княжество','Севежское княжество','Речь Посполитая','Księstwo Siewierskie'],
 ['Спишское староство','Спишское староство','Речь Посполитая','starostwo spiskie']
];
const MEDITERRANEAN_POLITIES=[
 ['Испанская монархия','Королевство Испания','Испанская империя','madrid','toledo','sevilla','cordoba','granada','malaga','murcia','valencia','zaragoza','barcelona','oran'],
 ['Королевство Португалия','Королевство Португалия','Португальская империя','lisbon','algarve','tangier'],
 ['Королевство Франция','Королевство Франция','Французская империя','lyon','provence','toulouse'],
 ['Генуэзская республика','Генуэзская республика','Генуэзская империя','genoa'],
 ['Миланское герцогство','Миланское герцогство','Ломбардское королевство','milan'],
 ['Венецианская республика','Венецианская республика','Венецианская империя','venice','split'],
 ['Великое герцогство Тосканское','Великое герцогство Тосканское','Тосканское королевство','florence'],
 ['Папская область','Папская область','Папская область','rome'],
 ['Неаполитанское королевство','Неаполитанское королевство','Королевство Обеих Сицилий','naples','bari'],
 ['Сицилийское королевство','Сицилийское королевство','Королевство Обеих Сицилий','palermo'],
 ['Сардинское королевство','Сардинское королевство','Итальянское королевство','sardinia'],
 ['Османская империя','Османский султанат','Османская империя','istanbul','sarajevo','belgrade','durres','sofia','thessaloniki','athens','patras','izmir','bursa','ankara','antalya','adana','beirut','gaza'],
 ['Египетский эялет','Египетский султанат','Египетская империя','cairo','alexandria'],
 ['Триполитанский эялет','Триполитанский эялет','Триполитанская империя','tripoli','tobruk','benghazi','sirte'],
 ['Тунисский эялет','Тунисский султанат','Тунисская империя','tunis','sfax'],
 ['Алжирский эялет','Алжирский султанат','Алжирская империя','algiers','annaba'],
 ['Саадидский султанат','Саадидский султанат','Марокканская империя','rabat']
];
const HISTORICAL_STARTS={
 baltic:['mazowieckie','wileńskie','Prusy Książęce','Księstwo Kurlandii i Semigalii','pomorskie','wendeńskie','okręg bytowski'],
 mediterranean:['madrid','lisbon','genoa','venice','rome','florence','istanbul','algiers','tunis','tripoli','rabat','cairo','lyon','milan','naples','palermo','sardinia']
};
function historicalPolity(region,mediterranean){
 const key=region.key?.replace(/-district-\d+$/,'');
 const entry=(mediterranean?MEDITERRANEAN_POLITIES:BALTIC_POLITIES).find(([,,,...keys])=>keys.includes(key));
 return entry?.[0]||region.name;
}
// [duchy-name, kingdom-name, empire-name] — the realm's title grows with its
// rank: a duchy is named by its seat, higher ranks take historical titles.
function historicalPolityTitles(region,mediterranean){
 const key=region.key?.replace(/-district-\d+$/,'');
 const entry=(mediterranean?MEDITERRANEAN_POLITIES:BALTIC_POLITIES).find(([,,,...keys])=>keys.includes(key));
 return entry?[entry[0],entry[1],entry[2]]:[region.name,region.name,region.name];
}
function historicalRivals(player,candidates,count,mediterranean,presetKeys=[],preferred=new Set()){
 const keys=HISTORICAL_STARTS[mediterranean?'mediterranean':'baltic'];
 const selected=presetKeys.map(key=>candidates.find(r=>r.key===key)).filter(Boolean).slice(0,count);
 const historic=new Set(keys.map(key=>candidates.find(r=>r.key===key)?.id).filter(id=>id!=null));
 const available=candidates.filter(r=>!selected.includes(r));
 // Prioritise named capitals, then ordinary starts when the lobby is larger.
 const picks=selectBotStarts(player,available,count-selected.length,historic.size?historic:preferred,selected);
 return selected.concat(picks);
}
function strategyAdj(r){return Array.isArray(r.adj)?r.adj:[]}
function strategyPoint(r){let p=r.slots?.[0];return p?{x:p.x,z:p.z}:{x:r.x||0,z:r.y||0}}
function strategyDistance(a,b){let p=strategyPoint(a),q=strategyPoint(b);return Math.hypot(p.x-q.x,p.z-q.z)}
function selectBotStarts(player,candidates,count=3,preferred=new Set(),anchors=[]){
 const entries=candidates.filter(r=>r.id!==player.id).map(region=>({
  region,gap:Math.min(strategyDistance(region,player),...anchors.map(anchor=>strategyDistance(region,anchor))),
  near:[player,...anchors].filter(anchor=>strategyAdj(region).includes(anchor.id)||strategyAdj(anchor).includes(region.id)).length
 }));
 const available=new Set(entries.map(({region})=>region.id)),out=[];
 function bestStart(pool){
  let best=null;
  for(const entry of pool){
   const {region,gap,near}=entry,exits=strategyAdj(region).filter(id=>available.has(id)).length;
   const score=gap+Math.min(4,exits)*5-near*80;
   if(!best||score>best.score||score===best.score&&region.id<best.entry.region.id)best={entry,score};
  }
  return best.entry.region;
 }
 while(out.length<count&&available.size){
  let pool=entries.filter(({region})=>available.has(region.id));
  const favored=pool.filter(({region})=>preferred.has(region.id));
  if(favored.length)pool=favored;
  const withExits=pool.filter(({region})=>strategyAdj(region).some(id=>available.has(id)&&(!favored.length||preferred.has(id))));
  const selected=bestStart(withExits.length?withExits:pool),neighbors=new Set(strategyAdj(selected));
  out.push(selected);
  available.delete(selected.id);
  for(const entry of entries)if(available.has(entry.region.id)){
   entry.gap=Math.min(entry.gap,strategyDistance(entry.region,selected));
   if(neighbors.has(entry.region.id)||strategyAdj(entry.region).includes(selected.id))entry.near++;
  }
 }
 return out;
}
function factionPower(state,owner){
 const lands=state.regions.filter(r=>r.owner===owner);
 let population=0,production=0,territory=0,infrastructure=0;
 for(const region of lands){
  const workforce=workforceReport(region);
  population+=regionalPopulation(region);
  const garrison=state.garrisons?.[region.id];
  const guards=garrison?.owner===owner?garrison.troops:0;
  territory+=70*(.35+.65*duchyStability(region,guards)/100);
  for(const building of region.buildings||[]){
   if(building.product&&building.route?.length)production+=productionRate(region,building,workforce);
   if(building.type==='city')infrastructure+=12*Math.max(0,(building.level||1)-1);
   if(building.type==='port'&&building.route?.length)infrastructure+=18;
  }
  if(region.market?.ready)infrastructure+=18;
 }
 const troops=armyTroops(state,owner);
 const fleet=(state.warships||[]).filter(ship=>ship.owner===owner&&ship.hull>0);
 const gold=Math.max(0,(owner==='you'?state.gold:state.factions?.[owner]?.gold)||0);
 const allies=campaignAllies(state,owner).length;
 const economy=Math.sqrt(population)*1.8+production*3+infrastructure+90*gold/(gold+500);
 const military=troops*.8+fleet.reduce((sum,ship)=>sum+.65*ship.hull,0);
 const diplomacy=allies*28;
 const total=territory+economy+military+diplomacy;
 return {total,territory,economy,military,diplomacy};
}
function strategicNeighbors(state,owner){const owned=state.regions.filter(r=>r.owner===owner),frontier=state.regions.filter(r=>r.owner==='neutral'&&owned.some(o=>strategyAdj(o).includes(r.id)||strategyAdj(r).includes(o.id)));return {owned,frontier}}
function neutralReach(state,owner,blockedId=null){const byId=new Map(state.regions.map(r=>[r.id,r])),owned=state.regions.filter(r=>r.owner===owner),seen=new Set(owned.map(r=>r.id)),queue=owned.slice(),reached=new Set();for(let i=0;i<queue.length;i++){let current=queue[i];for(const id of strategyAdj(current)){if(id===blockedId||seen.has(id))continue;let next=byId.get(id);if(!next||(next.owner!=='neutral'&&next.owner!==owner))continue;seen.add(id);queue.push(next);if(next.owner==='neutral')reached.add(id)}}return reached}
function regionalBotRival(state,owner,frontiers=campaignFrontiers(state),strength=rival=>factionPower(state,rival).total){
 const neighbors=frontiers.get(owner);
 if(!neighbors?.size)return null;
 const allies=new Set(campaignAllies(state,owner));
 const enemies=new Set(activeWarEnemies(state,owner));
 const pact=[...(state.campaign?.pacts.values()||[])].find(p=>p.against&&(p.a===owner||p.b===owner)&&
  regionalPactHasFrontier(frontiers,p.a,p.b,p.against));
 if(pact&&(!enemies.size||enemies.has(pact.against)))return pact.against;
 const focus=state.factions?.[owner]?.regionalRival;
 if(neighbors.has(focus)&&!allies.has(focus)&&(!enemies.size||enemies.has(focus)))return focus;
 let best=null;
 for(const rival of neighbors){
  if(allies.has(rival))continue;
  const progress=state.campaign?.progress.get(rival);
  const urgency=Math.max(progress?.trade?.eligible ? .75 : 0,progress?.diplomacy?.eligible ? .60 : 0);
  const score=Number(enemies.has(rival))*10000+strength(rival)*(1+urgency);
  if(!best||score>best.score||score===best.score&&rival<best.rival)best={rival,score};
 }
 return best?.rival||null;
}
function strategySignals(state,owner,context){
 const {frontier}=strategicNeighbors(state,owner);
 const frontiers=context?.frontiers??campaignFrontiers(state),strength=context?.strength??(id=>factionPower(state,id).total);
 const rival=regionalBotRival(state,owner,frontiers,strength);
 const mine=strength(owner),enemy=rival?strength(rival):0;
 const ratio=rival&&mine>0?enemy/mine:0;
 const pressure=rival?frontier.filter(region=>adjacentToFaction(state,region,rival)).length:0;
 const direct=!!rival;
 const urgency=Math.max(0,Math.min(1,(ratio-1)/1.1+(direct ? .25 : 0)+(pressure ? .20 : 0)+(direct&&frontier.length<=2 ? .30 : 0)));
 return {mine,enemy,ratio,pressure,direct,exits:frontier.length,urgency};
}
const cadenceContexts=new WeakMap();
function strategyCadence(state,owner){
 const time=state.economy?.seconds;
 let context=cadenceContexts.get(state);
 if(!context||context.time!==time){
  const scores=new Map();
  context={time,frontiers:campaignFrontiers(state),strength(id){
   if(!scores.has(id))scores.set(id,factionPower(state,id).total);
   return scores.get(id);
  }};
  cadenceContexts.set(state,context);
 }
 const signal=strategySignals(state,owner,context),temper=state.factions?.[owner]?.strategyPace||1;
 const pressure=Math.max(signal.urgency,activeWarEnemies(state,owner).length ? .75 : 0);
 return {build:Math.max(10,(22-10*pressure)*temper),petition:Math.max(20,(54-30*pressure)*temper),
  recruit:Math.max(32,(70-32*pressure)*temper),...signal};
}
function rankBotExpansion(state,owner){
 const {owned,frontier}=strategicNeighbors(state,owner);
 if(!owned.length)return [];
 const capitalId=owner==='you'?state.capitalId:state.factions?.[owner]?.regionId;
 const capital=owned.find(region=>region.id===capitalId)||owned[0];
 const byId=new Map(state.regions.map(region=>[region.id,region]));
 const distances=strategyAdj(capital).map(id=>byId.get(id)).filter(Boolean)
  .map(region=>strategyDistance(capital,region)).filter(distance=>distance>0).sort((a,b)=>a-b);
 const isolatedCoast=!distances.length&&capital.coast&&!!state.seaPetitionPath;
 const spacing=distances.length?distances[Math.floor((distances.length-1)/2)]:isolatedCoast?
  Math.min(...state.regions.filter(region=>region!==capital&&region.coast).map(region=>strategyDistance(capital,region))):0;
 if(!Number.isFinite(spacing)||!spacing)return [];
 const growth=Math.min(1.2,Math.sqrt(owned.length)/3);
 const radius=2.25+growth,maxDepth=owned.length>=8?3:2;
 const reachable=new Map([[capital.id,0]]),queue=[capital];
 // Only the contiguous core can sponsor land expansion. Enclaves and far-off ports do not create new fronts.
 for(let i=0;i<queue.length;i++){
  const region=queue[i],depth=reachable.get(region.id)+1;
  if(depth>maxDepth)continue;
  for(const id of strategyAdj(region)){
   const next=byId.get(id);
   if(!next||(next.owner!==owner&&next.owner!=='neutral')||reachable.has(id))continue;
   reachable.set(id,depth);
   if(next.owner===owner)queue.push(next);
  }
 }
 const sea=!!state.seaPetitionPath&&owned.some(region=>region.coast&&reachable.has(region.id)&&
  strategyDistance(capital,region)<=spacing*radius&&region.buildings?.some(building=>building.type==='port'));
 const pending=state.economy?.shipments||[],land=new Set(frontier.map(region=>region.id)),core=new Set(queue.map(region=>region.id));
 const candidates=[];
 for(const region of state.regions){
  if(region.owner!=='neutral')continue;
  const distance=strategyDistance(capital,region)/spacing,depth=reachable.get(region.id);
  const byLand=land.has(region.id)&&depth!=null&&distance<=radius;
  if(!byLand&&(!sea||!region.coast||distance>(isolatedCoast?1.35:1.75)||land.has(region.id)))continue;
  const shared=strategyAdj(region).filter(id=>core.has(id)).length;
  const contested=pending.some(ship=>ship.kind==='petition'&&ship.owner!==owner&&ship.targetId===region.id);
  const score=-(byLand?depth:3)*18-distance*40+Math.min(4,shared)*12+(contested?4:0);
  candidates.push({region,score,byLand,contested});
 }
 return candidates.sort((a,b)=>Number(b.byLand)-Number(a.byLand)||b.score-a.score||a.region.id-b.region.id);
}
if(typeof module!=='undefined')module.exports={selectBotStarts,factionPower,strategicNeighbors,neutralReach,strategySignals,strategyCadence,rankBotExpansion};
