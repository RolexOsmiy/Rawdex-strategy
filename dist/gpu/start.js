'use strict';

function loadGameScript(src){
 return new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.src=src+'?v='+(globalThis.__gameScriptStamp||Date.now());
  tag.onload=resolve;tag.onerror=()=>reject(Error('Не удалось загрузить '+src));
  document.head.appendChild(tag);
 });
}

function showGraphicsError(text){
 if(globalThis.gameShell){globalThis.gameShell.fail(text);return}
 const message=document.getElementById('error');
 message.hidden=false;message.setAttribute('role','alert');message.textContent=text;
}

async function startMapGraphics(){
 await globalThis.BALTIC_SETTINGS?.ready;
 globalThis.gameShell?.progress(65,'Проверяем поддержку WebGPU');
 let adapter=null;
 try{adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'})}catch(error){console.warn('WebGPU adapter',error.message)}
 if(!adapter){
  showGraphicsError(globalThis.nativeSettings
   ?'Для запуска карты нужен WebGPU. Проверьте обновления Microsoft Edge WebView2 и драйвера видеокарты.'
   :'Для запуска карты нужен WebGPU. Проверьте аппаратное ускорение в настройках браузера.');
  return;
 }
 globalThis.gameShell?.progress(70,'Загружаем движок отрисовки');
 const [,shaders]=await Promise.all([loadGameScript('vendor/pixi-8.14.3.min.js'),
  fetch('gpu/shaders.json').then(response=>{
   if(!response.ok)throw Error('Не удалось загрузить материалы карты.');
   return response.json();
  })]);
 globalThis.gameShell?.progress(76,'Готовим графические шейдеры');
 // Прогрессивный запуск: сначала полное качество (MSAA 4x), затем без
 // сглаживания и со свежим адаптером — разовый сбой GPU-процесса
 // (device lost, «Instance dropped») не должен ронять запуск.
 const settings=globalThis.BALTIC_SETTINGS?.current||{};
 const attempts=settings.msaa===false?[1,1,1]:[4,1,1];
 let lastError=null;
 for(let attempt=0;attempt<attempts.length;attempt++){
  let renderer=null,device=null,graphics=null;
  try{
   device=await adapter.requestDevice();
   renderer=new PIXI.WebGPURenderer();
   const canvas=document.getElementById('world');
   await renderer.init({canvas,gpu:{adapter,device},width:1,height:1,resolution:1,
    antialias:false,autoDensity:false,backgroundAlpha:1,eventMode:'none',preference:'webgpu'});
   device.pushErrorScope('validation');
   graphics=new PixiMapRenderer(renderer,shaders,[WORLD_WIDTH,WORLD_HEIGHT],.00045*1100/WORLD_WIDTH,GAME_MAP?256:64,
    attempts[attempt]);
   await graphics.prepare();
   graphics.clearColor(.066,.094,.106,1);graphics.clear(graphics.COLOR_BUFFER_BIT);graphics.present();
   const problem=await device.popErrorScope();
   if(problem)throw Error(problem.message);
   graphics.adapterInfo=adapter.info;
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
   return;
  }catch(error){
   lastError=error;
   console.warn('WebGPU attempt '+(attempt+1)+' failed',error.message);
   try{graphics?.destroy?.()}catch{}
   try{renderer?.destroy?.()}finally{try{device?.destroy?.()}catch{}}
   // После падения GPU-процесса адаптер может быть отравлен — берём свежий.
   if(attempt<attempts.length-1){
    try{adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'})}catch{}
    if(!adapter)break;
   }
  }
 }
 if(globalThis.mapGPU)globalThis.mapGPU.stopped=true;
 console.error('WebGPU initialization',lastError);
 showGraphicsError('Не удалось запустить карту на WebGPU. '+lastError.message);
}
startMapGraphics().catch(error=>{
 console.error('WebGPU initialization',error);
 showGraphicsError('Не удалось запустить карту на WebGPU. '+error.message);
});
