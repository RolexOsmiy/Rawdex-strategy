'use strict';

// Настройки графики и окна. Едины для браузера и настольной обёртки:
// localStorage и, в настольной сборке, файл через window.nativeSettings.
// Любая ошибка здесь не должна мешать запуску: всегда есть дефолты.
(()=>{
 try{
  const KEY='baltic-settings';
  const bridge=globalThis.nativeSettings||null;
  const DEFAULTS={renderScale:1,msaa:true,fpsCounter:false,fullscreen:bridge?.defaultFullscreen??false};
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
  const settings={...DEFAULTS};
  for(const key of Object.keys(DEFAULTS)){
   if(saved[key]!==undefined)settings[key]=saved[key];
  }
  const listeners=new Set();
  const notify=()=>{for(const fn of listeners)try{fn({...settings})}catch{}};
  const pending=new Set();
  let loading=!!bridge;
  const apply=(patch,send=false)=>{
   const changed={};
   for(const key of Object.keys(DEFAULTS)){
    if(patch?.[key]===undefined||patch[key]===settings[key])continue;
    if(send&&loading)pending.add(key);
    settings[key]=changed[key]=patch[key];
   }
   if(!Object.keys(changed).length)return;
   try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}
   if(send&&bridge)try{bridge.set(changed)}catch{}
   notify();
  };
  const ready=bridge?Promise.resolve().then(()=>bridge.get()).then(native=>{
   const initial={...native};
   for(const key of pending)delete initial[key];
   apply(initial);
  }).catch(()=>{}).finally(()=>{loading=false;pending.clear()}):Promise.resolve();
  globalThis.BALTIC_SETTINGS={
   get current(){return {...settings}},
   ready,
   update(patch){apply(patch,true)},
   reset(){
    const {fullscreen,...graphics}=DEFAULTS;
    apply(graphics,true);
   },
   defaultFullscreen:DEFAULTS.fullscreen,
   onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)},
   hasNative:!!bridge
  };
 }catch(error){
  console.warn('Настройки недоступны, используются значения по умолчанию',error);
  globalThis.BALTIC_SETTINGS={current:{renderScale:1,msaa:true,fpsCounter:false,fullscreen:false},ready:Promise.resolve(),defaultFullscreen:false,update(){},reset(){},onChange(){return()=>{}},hasNative:false};
 }
})();
