'use strict';
// Strategy is based on the visible board and real economic state; it never grants resources.
// Political names are tied to the founding city. A crowded match may start
// several playable powers from the same historical polity.
const BALTIC_POLITIES=[
 ['Корона Польская','mazowieckie','krakowskie','poznańskie','sandomierskie','lubelskie','kaliskie','ruskie','kijowskie','wołyńskie','czernihowskie','bełskie','bracławskie','podolskie','rawskie','sieradzkie','łęczyckie','płockie','brzeskie kujawskie','inowrocławskie','ziemia dobrzyńska','podlaskie'],
 ['Великое княжество Литовское','wileńskie','trockie','żmudzkie','nowogrodzkie','mińskie','brzeskie litewskie','mścisławskie','witebskie','smoleńskie'],
 ['Королевская Пруссия','pomorskie','malborskie','chełmińskie','warmińskie'],
 ['Герцогство Пруссия','Prusy Książęce'],['Герцогство Курляндии и Семигалии','Księstwo Kurlandii i Semigalii'],
 ['Инфлянтское герцогство','wendeńskie','parnawskie','doprackie'],['Померанское герцогство','okręg bytowski','okręg lęborski'],
 ['Полоцкое княжество','połockie'],['Севежское княжество','Księstwo Siewierskie'],['Спишское староство','starostwo spiskie']
];
const MEDITERRANEAN_POLITIES=[
 ['Испанская монархия','madrid','toledo','sevilla','cordoba','granada','malaga','murcia','valencia','zaragoza','barcelona','oran'],
 ['Королевство Португалия','lisbon','algarve','tangier'],['Королевство Франция','lyon','provence','toulouse'],
 ['Генуэзская республика','genoa'],['Миланское герцогство','milan'],['Венецианская республика','venice','split'],
 ['Великое герцогство Тосканское','florence'],['Папская область','rome'],['Неаполитанское королевство','naples','bari'],
 ['Сицилийское королевство','palermo'],['Сардинское королевство','sardinia'],
 ['Османская империя','istanbul','sarajevo','belgrade','durres','sofia','thessaloniki','athens','patras','izmir','bursa','ankara','antalya','adana','beirut','gaza'],
 ['Египетский эялет','cairo','alexandria'],['Триполитанский эялет','tripoli','tobruk','benghazi','sirte'],
 ['Тунисский эялет','tunis','sfax'],['Алжирский эялет','algiers','annaba'],['Саадидский султанат','rabat']
];
const HISTORICAL_STARTS={
 baltic:['mazowieckie','wileńskie','Prusy Książęce','Księstwo Kurlandii i Semigalii','pomorskie','wendeńskie','okręg bytowski'],
 mediterranean:['madrid','lisbon','genoa','venice','rome','florence','istanbul','algiers','tunis','tripoli','rabat','cairo','lyon','milan','naples','palermo','sardinia']
};
function historicalPolity(region,mediterranean){
 const key=region.key?.replace(/-district-\d+$/,'');
 const entry=(mediterranean?MEDITERRANEAN_POLITIES:BALTIC_POLITIES).find(([, ...keys])=>keys.includes(key));
 return entry?.[0]||region.name;
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
function factionPower(state,owner){let regions=state.regions.filter(r=>r.owner===owner),population=0,production=0,buildings=0,troops=0;for(const r of regions){const workforce=workforceReport(r);for(const b of r.buildings||[]){buildings++;if(b.type==='city')population+=b.population||0;if(b.product&&b.route?.length)production+=productionRate(r,b,workforce)}let g=state.garrisons?.[r.id];if(g?.owner===owner)troops+=g.troops||0}troops+=(state.armyMoves||[]).filter(m=>m.owner===owner).reduce((n,m)=>n+m.troops,0)+(state.fieldArmies||[]).filter(m=>m.owner===owner).reduce((n,m)=>n+m.troops,0);let gold=owner==='you'?state.gold:state.factions?.[owner]?.gold||0;let total=regions.length*100+population*.1+production*3+troops*.5+Math.max(0,Math.min(1000,gold))*.04;return {total,regions:regions.length,population,production,buildings,troops,gold}}
function strategicNeighbors(state,owner){const owned=state.regions.filter(r=>r.owner===owner),frontier=state.regions.filter(r=>r.owner==='neutral'&&owned.some(o=>strategyAdj(o).includes(r.id)||strategyAdj(r).includes(o.id)));return {owned,frontier}}
function neutralReach(state,owner,blockedId=null){const byId=new Map(state.regions.map(r=>[r.id,r])),owned=state.regions.filter(r=>r.owner===owner),seen=new Set(owned.map(r=>r.id)),queue=owned.slice(),reached=new Set();for(let i=0;i<queue.length;i++){let current=queue[i];for(const id of strategyAdj(current)){if(id===blockedId||seen.has(id))continue;let next=byId.get(id);if(!next||(next.owner!=='neutral'&&next.owner!==owner))continue;seen.add(id);queue.push(next);if(next.owner==='neutral')reached.add(id)}}return reached}
function strategySignals(state,owner){let {owned,frontier}=strategicNeighbors(state,owner),player=state.regions.filter(r=>r.owner==='you'),pressure=frontier.filter(r=>player.some(p=>strategyAdj(r).includes(p.id)||strategyAdj(p).includes(r.id))).length,direct=owned.some(r=>player.some(p=>strategyAdj(r).includes(p.id)||strategyAdj(p).includes(r.id))),mine=factionPower(state,owner).total,enemy=factionPower(state,'you').total,ratio=mine>0?enemy/mine:1,urgency=Math.max(0,Math.min(1,(ratio-1)/1.1+(direct ? .25 : 0)+(pressure? .20:0)+(frontier.length <= 2 ? .30 : 0)));return {mine,enemy,ratio,pressure,direct,exits:frontier.length,urgency}}
function strategyCadence(state,owner){let v=strategySignals(state,owner),f=state.factions?.[owner],temper=f?.strategyPace||1;const war=Object.keys(state.wars||{}).some(key=>key.split('|').includes(owner)),pressure=Math.max(v.urgency,war ? .75 : 0);return {build:Math.max(10,(22-10*pressure)*temper),petition:Math.max(20,(54-30*pressure)*temper),recruit:Math.max(32,(70-32*pressure)*temper),...v}}
function rankBotExpansion(state,owner){let {owned,frontier}=strategicNeighbors(state,owner);if(!owned.length)return [];let all=neutralReach(state,owner),player=state.regions.filter(r=>r.owner==='you'),byId=new Map(state.regions.map(r=>[r.id,r])),capital=state.regions.find(r=>r.id===state.factions?.[owner]?.regionId)||owned[0],pending=state.economy?.shipments||[],hasCoast=owned.some(r=>r.coast),foreignPort=state.regions.some(r=>r.owner!=='neutral'&&r.owner!==owner&&!state.factions?.[r.owner]?.isRebel&&!state.wars?.[[owner,r.owner].sort().join('|')]&&(r.buildings||[]).some(b=>b.type==='port'));return frontier.map(r=>{let after=neutralReach(state,owner,r.id),cutoff=Math.max(0,all.size-after.size-1),playerAdjacent=player.some(p=>strategyAdj(r).includes(p.id)||strategyAdj(p).includes(r.id)),twoSteps=strategyAdj(r).some(id=>{let x=byId.get(id);return x?.owner==='neutral'&&player.some(p=>strategyAdj(x).includes(p.id)||strategyAdj(p).includes(x.id))}),newExits=strategyAdj(r).filter(id=>byId.get(id)?.owner==='neutral').length,enemyEnRoute=pending.some(s=>s.kind==='petition'&&s.owner!==owner&&s.targetId===r.id),danger=playerAdjacent||enemyEnRoute;let coastBonus=!hasCoast&&foreignPort&&r.coast?35:0,score=coastBonus+(danger?30:twoSteps?10:0)+cutoff*(danger?13:twoSteps?6:1.5)+newExits*2-strategyDistance(capital,r)*.045;return {region:r,score,cutoff,coastBonus,playerAdjacent,enemyEnRoute}}).sort((a,b)=>b.score-a.score||a.region.id-b.region.id)}
if(typeof module!=='undefined')module.exports={selectBotStarts,factionPower,strategicNeighbors,neutralReach,strategySignals,strategyCadence,rankBotExpansion};
