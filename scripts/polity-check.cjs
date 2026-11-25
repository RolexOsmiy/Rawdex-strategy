'use strict';
// How many duchies on each map have a historical polity name (strategy.js).
const fs=require('fs'),vm=require('vm');
const POLITIES={
 baltic:['mazowieckie','krakowskie','poznańskie','sandomierskie','lubelskie','kaliskie','ruskie','kijowskie','wołyńskie','czernihowskie','bełskie','bracławskie','podolskie','rawskie','sieradzkie','łęczyckie','płockie','brzeskie kujawskie','inowrocławskie','ziemia dobrzyńska','podlaskie','wileńskie','trockie','żmudzkie','nowogrodzkie','mińskie','brzeskie litewskie','mścisławskie','witebskie','smoleńskie','pomorskie','malborskie','chełmińskie','warmińskie','Prusy Książęce','Księstwo Kurlandii i Semigalii','wendeńskie','parnawskie','doprackie','okręg bytowski','okręg lęborski','połockie','Księstwo Siewierskie','starostwo spiskie'],
 mediterranean:['madrid','toledo','sevilla','cordoba','granada','malaga','murcia','valencia','zaragoza','barcelona','oran','lisbon','algarve','tangier','lyon','provence','toulouse','genoa','milan','venice','split','florence','rome','naples','bari','palermo','sardinia','istanbul','sarajevo','belgrade','durres','sofia','thessaloniki','athens','patras','izmir','bursa','ankara','antalya','adana','beirut','gaza','cairo','alexandria','tripoli','tobruk','benghazi','sirte','tunis','sfax','algiers','annaba','rabat']
};
for(const m of ['baltic','mediterranean']){
 const folder=m==='mediterranean'?'dist/maps/mediterranean/':'dist/';
 const files=(m==='mediterranean'?['scenario.js']:[]).concat(['map-data.js']).map(f=>folder+f);
 const known=POLITIES[m];
 const code=files.map(f=>fs.readFileSync(f,'utf8')).join('\n')
  +'\n(()=>{const known=new Set('+JSON.stringify(known)+');'
  +'const missing=HISTORICAL_REGIONS.filter(r=>!known.has(r.key)).map(r=>r.key);'
  +'globalThis.__out=[HISTORICAL_REGIONS.length,missing]})()';
 const sb={};sb.globalThis=sb;vm.createContext(sb);vm.runInContext(code,sb);
 const [total,missing]=sb.__out;
 console.log(m+': герцогств '+total+' | покрыто историческими именами '+(total-missing.length)+' | без имени: '+missing.join(', '));
}
