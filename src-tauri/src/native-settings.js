(() => {
 const invoke=(...args)=>window.__TAURI__.core.invoke(...args);
 const save=(...args)=>invoke(...args).catch(error=>console.error('Настольные настройки:',error));
 window.nativeSettings={
  get:()=>invoke('get_settings'),
  set:({renderScale,msaa,fpsCounter})=>{
   if([renderScale,msaa,fpsCounter].some(value=>value!==undefined)){
    return save('set_graphics',{patch:{renderScale,msaa,fpsCounter}});
   }
  },
  setFullscreen:on=>save('set_fullscreen',{on}),
  close:()=>save('close_game'),
  defaultFullscreen:true
 };
})();
