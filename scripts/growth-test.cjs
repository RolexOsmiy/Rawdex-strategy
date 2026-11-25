'use strict';
// Run: node scripts/growth-test.cjs [baltic|mediterranean]
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const MAPS={
 baltic:{folder:'',files:['map-data.js','parcel-data.js','road-data.js']},
 mediterranean:{folder:'maps/mediterranean/',files:['scenario.js','map-data.js','parcel-data.js','road-data.js']}
};
const mapId=process.argv[2]==='mediterranean'?'mediterranean':'baltic';
const m=MAPS[mapId];
let code=m.files.map(f=>fs.readFileSync(path.join(DIST,m.folder,f),'utf8')).join('\n');
const load=(file,globalName)=>{
 const src=fs.readFileSync(path.join(DIST,file),'utf8');
 return src.replace(/if\(typeof module!=='undefined'\)module\.exports=/g,'globalThis.'+globalName+'=');
};
code+='\n'+load('logic.js','__logicExports');
code+='\n'+load('transport.js','__transportExports');
code+='\n'+load('strategy.js','__strategyExports');
code+='\n'+fs.readFileSync(path.join(ROOT,'scripts','growth-harness.js'),'utf8');
const sandbox={console,Math};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{filename:'growth-bundle-'+mapId+'.js'});
sandbox.__growthRun();
