'use strict';
// Headless full-match simulation for both maps.
// Usage: node scripts/simulate.cjs <baltic|mediterranean> [options]
//   --bots N      rival factions (default 3)
//   --seconds N   simulated game seconds (default 7200 = 2 h real time)
//   --player KEY  starting duchy key of the scripted player (default: first region)
//   --seed N      PRNG seed for reproducible battles
//   --json        machine-readable metrics output
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');

const MAPS={
 baltic:{folder:'',files:['map-data.js','parcel-data.js','road-data.js']},
 mediterranean:{folder:'maps/mediterranean/',files:['scenario.js','map-data.js','parcel-data.js','road-data.js']}
};

function parseArgs(argv){
 const mapId=argv[0]==='mediterranean'?'mediterranean':'baltic';
 const opts={bots:3,seconds:7200};
 for(let i=1;i<argv.length;i++){
  if(argv[i]==='--bots')opts.bots=Number(argv[++i]);
  else if(argv[i]==='--seconds')opts.seconds=Number(argv[++i]);
  else if(argv[i]==='--player')opts.player=argv[++i];
  else if(argv[i]==='--seed')opts.seed=Number(argv[++i]);
  else if(argv[i]==='--json')opts.json=true;
  else if(argv[i]==='--dominate')opts.dominate=true;
  else if(argv[i]==='--dominate-bot'){opts.dominate=true;opts.dominateBot=argv[++i];}
 }
 return {mapId,opts};
}

function seededMath(seed){
 let s=seed>>>0||1;
 const rnd=()=>{
  s=(s+0x6D2B79F5)|0;
  let t=Math.imul(s^(s>>>15),1|s);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
 };
 const M=Object.create(Math);
 M.random=rnd;
 return M;
}

function buildBundle(mapId){
 const m=MAPS[mapId];
 let code=m.files.map(f=>fs.readFileSync(path.join(DIST,m.folder,f),'utf8')).join('\n');
 const load=(file,globalName)=>{
  const src=fs.readFileSync(path.join(DIST,file),'utf8');
  return src.replace(/if\(typeof module!=='undefined'\)module\.exports=/g,'globalThis.'+globalName+'=');
 };
 code+='\n'+load('logic.js','__logicExports');
 code+='\n'+load('transport.js','__transportExports');
 code+='\n'+load('strategy.js','__strategyExports');
 code+='\n'+fs.readFileSync(path.join(ROOT,'scripts','sim-harness.js'),'utf8');
 return code;
}

function run(mapId,opts){
 const sandbox={console,Math:seededMath(opts.seed)};
 sandbox.globalThis=sandbox;
 sandbox.__SIM_MAP=mapId;
 sandbox.__SIM_OPTS=opts;
 vm.createContext(sandbox);
 const t0=Date.now();
 vm.runInContext(buildBundle(mapId),sandbox,{filename:'sim-bundle-'+mapId+'.js'});
 const report=sandbox.__simRun();
 report.bundleMs=Date.now()-t0;
 return report;
}

function printReport(report,json){
 if(json){
  for(const row of report.metrics)console.log(JSON.stringify(row));
  for(const e of report.events)console.log(JSON.stringify({event:e}));
  return;
 }
 console.log('=== Балтийские пути · симуляция карты «'+report.map+'» ===');
 console.log('настройки:',JSON.stringify(report.opts),'· сборка '+report.bundleMs+' мс · симулировано '+report.lastSec+' игровых секунд');
 console.log('--- События ---');
 for(const e of report.events)console.log(e);
 console.log('--- Динамика (каждые 60 с = 30 игровых дней) ---');
 const cols={sec:4,date:12,lands:5,bots:4,pop:6,gold:6,army:5,botArmies:8,income:6,capitals:8,trade:6,wars:4,battles:7,sieges:6,shipments:9};
 const head=Object.keys(cols).join('  ');
 console.log(head);
 for(const row of report.metrics){
  const pad=(v,n)=>{const s=String(v);return s.padStart(n)};
  console.log([pad(row.sec,4),row.date.padEnd(12),pad(row.lands,5),pad(row.bots,4),pad(row.pop,6),pad(row.gold,6),pad(row.army,5),pad(row.botArmies,8),pad(row.income,6),pad(row.capitals,8),pad(row.trade,6),pad(row.wars,4),pad(row.battles,7),pad(row.sieges,6),pad(row.shipments,9)].join('  '));
 }
}

const {mapId,opts}=parseArgs(process.argv.slice(2));
printReport(run(mapId,opts),opts.json);
