'use strict';
// Headless check of the road-chain renderer: walk the real transport graph,
// build chains, smooth them and generate ribbon geometry; report coverage
// (every edge must belong to a chain) and vertex stats.
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const mapId=process.argv[2]==='mediterranean'?'mediterranean':'baltic';
const M=mapId==='mediterranean'
 ?{folder:'maps/mediterranean/',files:['scenario.js','map-data.js','parcel-data.js','road-data.js']}
 :{folder:'',files:['map-data.js','parcel-data.js','road-data.js']};
let code=M.files.map(f=>fs.readFileSync(path.join(DIST,M.folder,f),'utf8')).join('\n');
const load=(file,g)=>{const src=fs.readFileSync(path.join(DIST,file),'utf8');return src.replace(/if\(typeof module!=='undefined'\)module\.exports=/g,'globalThis.'+g+'=')};
code+='\n'+load('logic.js','__logicExports');
code+='\n'+load('transport.js','__transportExports');
code+='\n'+fs.readFileSync(path.join(ROOT,'scripts','road-check-body.js'),'utf8');
const sandbox={console,Math};sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{filename:'road-check-'+mapId+'.js'});
sandbox.__roadCheck(mapId);
