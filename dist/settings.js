'use strict';

(()=>{
 const KEY='baltic-settings';
 const bridge=globalThis.nativeSettings;
 const bindings={
  cameraUp:['Камера вверх','KeyW','ArrowUp'],cameraLeft:['Камера влево','KeyA','ArrowLeft'],
  cameraDown:['Камера вниз','KeyS','ArrowDown'],cameraRight:['Камера вправо','KeyD','ArrowRight'],
  turnLeft:['Повернуть влево','KeyQ'],turnRight:['Повернуть вправо','KeyE'],
  tiltUp:['Увеличить наклон','KeyR'],tiltDown:['Уменьшить наклон','KeyF'],
  capital:['Вернуться к столице','Home'],muster:['Набор войска','KeyG'],
  city:['Город','Digit1'],grain:['Ферма','Digit2'],wood:['Лесопилка','Digit3'],
  iron:['Рудник','Digit4'],cloth:['Ткацкая','Digit5'],port:['Порт','Digit6']
 };
 const defaultKeys=Object.fromEntries(Object.entries(bindings).map(([action,[,primary,secondary]])=>[action,secondary?[primary,secondary]:[primary]]));
 const groups={
  graphics:{renderScale:1,msaa:true,fpsCounter:false,fullscreen:bridge?.defaultFullscreen??false,fpsLimit:0,trees:true,actorShadows:true},
  audio:{muted:false,volume:100,selectionVolume:100,worldVolume:100,battleVolume:100},
  controls:{panSpeed:100,zoomSpeed:100,mouseSpeed:100,keys:defaultKeys}
 };
 const defaults=Object.assign({},...Object.values(groups));
 const settings={...defaults};
 const listeners=new Set(),pending=new Set();
 let loading=!!bridge;
 const validKey=code=>typeof code==='string'&&/^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown|Insert|Delete|Space|Bracket(Left|Right)|Minus|Equal|Comma|Period|Slash|Backslash|Semicolon|Quote|Backquote)$/.test(code);
 const normalizeKey=code=>/^Numpad\d$/.test(code)?'Digit'+code.at(-1):code;
 const keyName=code=>({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'Space',PageUp:'PgUp',PageDown:'PgDn',Insert:'Ins',Delete:'Del',BracketLeft:'[',BracketRight:']',Minus:'−',Equal:'=',Comma:',',Period:'.',Slash:'/',Backslash:'\\',Semicolon:';',Quote:"'",Backquote:'`'}[code]??code?.replace(/^(Key|Digit)/,'')??'—');
 function sanitizeKeys(value){
  const keys=Object.fromEntries(Object.entries(defaultKeys).map(([action,list])=>[
   action,list.map((fallback,index)=>{
    const code=value?.[action]?.[index];
    return validKey(code)||code===null&&index===1?code:fallback;
   })
  ]));
  const codes=Object.values(keys).flat().filter(Boolean);
  return codes.length===new Set(codes).size?keys:defaultKeys;
 }
 function sanitize(key,value){
  if(key==='keys')return sanitizeKeys(value);
  if(key==='renderScale')return [.5,.75,1].includes(value)?value:undefined;
  if(key==='fpsLimit')return [0,30,60,120].includes(value)?value:undefined;
  if(typeof defaults[key]==='boolean')return typeof value==='boolean'?value:undefined;
  if(Number.isFinite(value))return Math.min(key.endsWith('Speed')?160:100,Math.max(key.endsWith('Speed')?40:0,Math.round(value)));
 }
 function snapshot(){return {...settings,keys:Object.fromEntries(Object.entries(settings.keys).map(([action,list])=>[action,[...list]]))};}
 function apply(patch,send=false){
  const changed={};
  for(const key of Object.keys(defaults)){
   const value=sanitize(key,patch?.[key]);
   if(patch?.[key]===undefined||value===undefined||JSON.stringify(value)===JSON.stringify(settings[key]))continue;
   settings[key]=changed[key]=value;
   if(send&&loading)pending.add(key);
  }
  if(!Object.keys(changed).length)return;
  try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}
  if(send&&bridge)Promise.resolve(bridge.set(changed)).catch(console.warn);
  for(const listener of listeners)listener(snapshot());
 }
 try{apply(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
 const ready=bridge?Promise.resolve().then(()=>bridge.get()).then(native=>{
  const initial={...native};
  for(const key of pending)delete initial[key];
  apply(initial);
 }).catch(()=>{}).finally(()=>{loading=false;pending.clear();}):Promise.resolve();
 globalThis.BALTIC_SETTINGS={
  get current(){return snapshot();},ready,bindings,validKey,normalizeKey,keyName,
  getKey(action,index=0){return settings.keys[action]?.[index];},
  actionFor(code){return Object.keys(bindings).find(action=>settings.keys[action].includes(normalizeKey(code)));},
  update(patch){apply(patch,true);},
  reset(group='graphics'){const {fullscreen,...rest}=groups[group];apply(rest,true);},
  defaultFullscreen:defaults.fullscreen,
  onChange(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  hasNative:!!bridge
 };
})();
