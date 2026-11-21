'use strict';

function loadGameScript(src){
 return new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.src=src;tag.onload=resolve;tag.onerror=()=>reject(Error('Не удалось загрузить '+src));
  document.head.appendChild(tag);
 });
}

function showGraphicsError(text){
 if(globalThis.gameShell){globalThis.gameShell.fail(text);return}
 const message=document.getElementById('error');
 message.hidden=false;message.setAttribute('role','alert');message.textContent=text;
}

async function startMapGraphics(){
 globalThis.gameShell?.progress(65,'Проверяем поддержку WebGPU');
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
 if(!adapter){
  showGraphicsError('Для запуска карты нужен WebGPU. Проверьте аппаратное ускорение в настройках браузера.');
  return;
 }
 globalThis.gameShell?.progress(70,'Загружаем движок отрисовки');
 const [,shaders]=await Promise.all([loadGameScript('vendor/pixi-8.14.3.min.js'),
  fetch('gpu/shaders.json').then(response=>{
   if(!response.ok)throw Error('Не удалось загрузить материалы карты.');
   return response.json();
  })]);
 globalThis.gameShell?.progress(76,'Готовим графические шейдеры');
 const device=await adapter.requestDevice();
 const renderer=new PIXI.WebGPURenderer();
 try{
  const canvas=document.getElementById('world');
  await renderer.init({canvas,gpu:{adapter,device},width:1,height:1,resolution:1,
   antialias:false,autoDensity:false,backgroundAlpha:1,eventMode:'none',preference:'webgpu'});
  device.pushErrorScope('validation');
  const graphics=new PixiMapRenderer(renderer,shaders,[WORLD_WIDTH,WORLD_HEIGHT],.00045*1100/WORLD_WIDTH,GAME_MAP?256:64);
  await graphics.prepare();
  graphics.clearColor(.066,.094,.106,1);graphics.clear(graphics.COLOR_BUFFER_BIT);graphics.present();
  const problem=await device.popErrorScope();
  if(problem)throw Error(problem.message);
  globalThis.mapGPU=graphics;
  document.documentElement.dataset.renderer='webgpu';
  document.getElementById('camera-home').title+=' · Графика: PixiJS · WebGPU';
  device.lost.then(()=>{
   if(graphics.stopped)return;
   graphics.stopped=true;
   showGraphicsError('Связь с видеокартой потеряна. Обновите страницу, чтобы заново запустить игру.');
  });
  globalThis.gameShell?.progress(82,'Готовим ландшафт и объекты');
  await loadGameScript('app.js');
 }catch(error){
  if(globalThis.mapGPU)globalThis.mapGPU.stopped=true;
  try{renderer.destroy()}finally{device.destroy()}
  throw error;
 }
}
startMapGraphics().catch(error=>{
 console.error('WebGPU initialization',error);
 showGraphicsError('Не удалось запустить карту на WebGPU. '+error.message);
});
