'use strict';

// These classic scripts share bindings. Fetch concurrently, execute in dependency order.
globalThis.loadCampaign = async (map, progress) => {
 const mediterranean=map==='mediterranean';
 const folder=mediterranean?'maps/mediterranean/':'';
 const extras=mediterranean?['mediterranean/navigation.js',folder+'scenario.js',folder+'andalusia.js']:[];
 const data=['map-data.js','terrain-mesh.js','terrain-relief.js','parcel-data.js','road-data.js'].map(file=>folder+file);
 const files=[...extras,...data,'logic.js','transport.js','strategy.js','gpu/map-renderer.js'];
 function load(path){
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');
   tag.async=false;tag.src=path;
   tag.onload=resolve;
   tag.onerror=()=>reject(new Error('Не удалось загрузить файлы кампании. Проверьте соединение и повторите попытку.'));
   document.head.appendChild(tag);
  });
 }
 let loaded=0;
 await Promise.all(files.map(path=>load(path).then(()=>{
  loaded++;
  progress(5+Math.round(loaded/files.length*58),'Границы, земли и дороги');
 })));
 await load('gpu/start.js');
};
