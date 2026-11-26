'use strict';

function createSettingsMenu(){
 const settings=globalThis.BALTIC_SETTINGS,native=globalThis.nativeSettings;
 const get=id=>document.getElementById(id);
 const panel=get('settings-panel'),feedback=get('settings-feedback');
 const tabs=[...panel.querySelectorAll('[data-settings-tab]')],pages=[...panel.querySelectorAll('[data-settings-page]')];
 const toggles={fullscreen:'set-fullscreen',fpsCounter:'set-fps',msaa:'set-msaa',trees:'set-trees',actorShadows:'set-actor-shadows',muted:'set-muted'};
 const selects={renderScale:'set-scale',fpsLimit:'set-fps-limit'};
 const ranges={volume:'set-volume',selectionVolume:'set-selection-volume',worldVolume:'set-world-volume',battleVolume:'set-battle-volume',
  panSpeed:'set-pan-speed',mouseSpeed:'set-mouse-speed',zoomSpeed:'set-zoom-speed'};
 const keyButtons=[];
 let section='graphics',capture=null,openedFrom=null;
 const tr=text=>globalThis.gameI18n?.text(text)??text;
 function message(text){
  feedback.textContent=text;
  feedback.hidden=!text;
 }
 function sync(){
  if(!panel.open)return;
  const current=settings.current;
  for(const [key,id] of Object.entries(toggles))get(id).checked=current[key];
  get('set-fullscreen').checked=settings.hasNative?current.fullscreen:!!document.fullscreenElement;
  for(const [key,id] of Object.entries(selects))get(id).value=String(current[key]);
  for(const [key,id] of Object.entries(ranges)){
   get(id).value=String(current[key]);get(id+'-value').value=current[key]+'%';
  }
  get('settings-test-sound').disabled=current.muted||current.volume===0||current.selectionVolume===0;
  for(const {button,action,index,label} of keyButtons){
   const key=settings.keyName(current.keys[action][index]);
   button.textContent=capture?.button===button?'…':key;
   button.setAttribute('aria-label',tr(label)+(index?' · '+tr('Вторая клавиша'):'')+' · '+key);
   button.setAttribute('aria-pressed',String(capture?.button===button));
  }
  const adapter=globalThis.mapGPU?.adapterInfo,note=get('settings-gpu-info');
  note.hidden=!adapter;
  if(adapter)note.textContent=(adapter.description||[adapter.vendor,adapter.architecture].filter(Boolean).join(' · '));
 }
 function select(group){
  section=group;capture=null;message('');
  for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.settingsTab===group));
  for(const page of pages)page.hidden=page.dataset.settingsPage!==group;
  sync();
 }
 function open(group='graphics',trigger=document.activeElement){
  if(!panel.open){
   openedFrom=trigger;
   panel.hidden=false;panel.showModal();
   globalThis.dispatchEvent(new Event('game-settings-open'));
   globalThis.gameAudio?.stop();
  }
  select(group);
  tabs.find(tab=>tab.dataset.settingsTab===group)?.focus();
 }
 function close(){
  if(!panel.open)return;
  capture=null;panel.close();panel.hidden=true;
  globalThis.gameAudio?.stop();
  openedFrom?.focus?.({preventScroll:true});openedFrom=null;
 }
 async function fullscreen(on){
  try{
   if(settings.hasNative){
    const actual=await native.setFullscreen(on);
    if(typeof actual==='boolean')settings.update({fullscreen:actual});
   }else if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();
   else if(!on&&document.fullscreenElement)await document.exitFullscreen();
  }catch{message(tr('Не удалось изменить полноэкранный режим.'));}
  sync();
 }
 for(const tab of tabs)tab.onclick=()=>select(tab.dataset.settingsTab);
 for(const button of document.querySelectorAll('[data-open-settings]')){
  button.setAttribute('aria-haspopup','dialog');
  button.onclick=()=>open(button.dataset.openSettings||'graphics',button);
 }
 get('settings-toggle').onclick=()=>open('graphics',get('settings-toggle'));
 get('settings-close').onclick=get('settings-done').onclick=close;
 for(const [key,id] of Object.entries(toggles))get(id).onchange=event=>{
  const value=event.target.checked;
  if(key==='fullscreen')fullscreen(value);else settings.update({[key]:value});
 };
 for(const [key,id] of Object.entries(selects))get(id).onchange=event=>settings.update({[key]:Number(event.target.value)});
 for(const [key,id] of Object.entries(ranges))get(id).oninput=event=>settings.update({[key]:Number(event.target.value)});
 get('settings-reset').onclick=()=>{
  capture=null;settings.reset(section);message('');
  if(section==='graphics')fullscreen(settings.defaultFullscreen);
  sync();
 };
 get('settings-test-sound').onclick=()=>globalThis.gameAudio?.preview();
 for(const [action,[label,...keys]] of Object.entries(settings.bindings)){
  const row=document.createElement('div'),name=document.createElement('span');
  row.className='settings-binding';name.textContent=label;row.append(name);
  for(const index of keys.keys()){
   const button=document.createElement('button');
   const item={action,index,label,button};
   button.type='button';button.dataset.binding=action;button.dataset.slot=index;
   button.onclick=()=>{capture=item;sync();message(tr('Нажмите новую клавишу.'));};
   row.append(button);keyButtons.push(item);
  }
  get('settings-bindings').append(row);
 }
 function cancelCapture(){capture=null;message('');sync();}
 panel.addEventListener('cancel',event=>{
  event.preventDefault();
  if(capture)cancelCapture();else close();
 });
 panel.addEventListener('keydown',event=>{
  if(!capture)return;
  if(event.code==='Tab'){cancelCapture();return;}
  event.preventDefault();event.stopImmediatePropagation();
  if(event.repeat)return;
  if(event.code==='Escape'){cancelCapture();return;}
  const {action,index}=capture,code=settings.normalizeKey(event.code);
  const clear=event.code==='Backspace'&&index===1;
  if(!clear&&(event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||!settings.validKey(code))){
   message(tr('Выберите обычную клавишу без модификаторов.'));return;
  }
  const keys=settings.current.keys;
  const conflict=Object.entries(keys).find(([other,values])=>values.some((key,slot)=>key===code&&(other!==action||slot!==index)));
  if(!clear&&conflict){
   message(settings.keyName(code)+' · '+tr('Уже назначена')+' — '+tr(settings.bindings[conflict[0]][0]));return;
  }
  keys[action][index]=clear?null:code;
  settings.update({keys});cancelCapture();
 },true);
 document.addEventListener('fullscreenchange',sync);
 settings.onChange(sync);
 if(settings.hasNative)window.addEventListener('keydown',event=>{
  if(event.key!=='F11'||capture)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat)settings.ready.then(()=>fullscreen(!settings.current.fullscreen));
 },true);
 return {get open(){return panel.open;}};
}
