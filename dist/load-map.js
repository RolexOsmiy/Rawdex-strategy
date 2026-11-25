'use strict';

// These classic scripts share bindings. Fetch concurrently, execute in dependency order.
// A per-page-load stamp defeats stale browser caches mixing old and new scripts.
const GAME_SCRIPT_STAMP=Date.now();
globalThis.__gameScriptStamp=GAME_SCRIPT_STAMP;
globalThis.loadCampaign = async (entry, progress) => {
 const folder=entry.folder;
 const extras=[...(entry.extras||[])];
 const data=['map-data.js','terrain-mesh.js','terrain-relief.js','parcel-data.js','road-data.js'].map(file=>folder+file);
 const files=[...extras,...data,'logic.js','transport.js','strategy.js','gpu/map-renderer.js','audio-cues.js'];
 function load(path){
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');
   tag.async=false;tag.src=path+'?v='+GAME_SCRIPT_STAMP;
   tag.onload=resolve;
   tag.onerror=()=>reject(new Error('Не удалось загрузить файлы карты. Проверьте соединение и повторите попытку.'));
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
