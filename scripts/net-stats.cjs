'use strict';
// Quick network stats: junctions and degree distribution per map.
const fs=require('fs'),vm=require('vm');
for(const m of ['baltic','mediterranean']){
 const folder=m==='mediterranean'?'dist/maps/mediterranean/':'dist/';
 const files=(m==='mediterranean'?['scenario.js']:[]).concat(['map-data.js','parcel-data.js','road-data.js']).map(f=>folder+f);
 let code=files.map(f=>fs.readFileSync(f,'utf8')).join('\n')
  +'\n'+fs.readFileSync('dist/logic.js','utf8').replace(/if\(typeof module!=='undefined'\)module\.exports=/g,'globalThis.__logicExports=')
  +'\n'+fs.readFileSync('dist/transport.js','utf8').replace(/if\(typeof module!=='undefined'\)module\.exports=/g,'globalThis.__transportExports=')
  +'\n(()=>{const L=globalThis.__logicExports,T=globalThis.__transportExports;'
  +'const g=T.makeTransport(HISTORICAL_REGIONS.map(L.initRegion));'
  +'let j3=0,j4=0,deg2=0;'
  +'for(const [k,n] of g.nodes){if(n.edges.size===2)deg2++;else if(n.edges.size===3)j3++;else if(n.edges.size>=4)j4++}'
  +'globalThis.__stats=[g.nodes.size,j3,j4,deg2]})()';
 const sb={console,Math};sb.globalThis=sb;vm.createContext(sb);vm.runInContext(code,sb);
 const [nodes,j3,j4,deg2]=sb.__stats;
 console.log(m+': узлов '+nodes+' | развилок (3) '+j3+' | перекрёстков (4+) '+j4+' | промежуточных (2) '+deg2);
}
