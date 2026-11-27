'use strict';

document.addEventListener('contextmenu',event=>event.preventDefault(),{capture:true});
document.addEventListener('selectstart',event=>{
 const target=event.target instanceof Element?event.target:event.target.parentElement;
 if(!target?.isContentEditable&&!target?.closest('input,textarea'))event.preventDefault();
},{capture:true});

(() => {
 const get=id=>document.getElementById(id);
 const native=globalThis.nativeSettings;
 const shell=get('front-shell'),app=get('app');
 const screens=[...shell.querySelectorAll('[data-front-page]')];
 const maps=Object.fromEntries(globalThis.BALTIC_MAPS.map(entry=>[entry.id,entry]));
 const params=new URLSearchParams(location.search);
 const requested=params.get('map');
 const map=Object.hasOwn(maps,requested)?requested:'baltic';
 const directlyToMap=Object.hasOwn(maps,requested)||params.has('start')||params.has('region');
 let screen='home',pauseFocus=null,loading=null,version=0,deadline;
 const settingsMenu=createSettingsMenu();
 globalThis.gameAudio=createGameAudio(get('feedback-sound'));

 function focus(element){element?.focus?.({preventScroll:true})}
 function show(next,target){
  screen=next;shell.dataset.screen=next;
  for(const page of screens)page.hidden=page.dataset.frontPage!==next;
  shell.hidden=next==='game';app.inert=next!=='game';
  if(target)focus(get(target));
 }
 function progress(value,detail){
  if(!loading||screen!=='loading'||value<loading.progress)return;
  loading.progress=value;
  get('front-loading-progress').value=value;
  get('front-loading-value').textContent=value+'%';
  const status=get('front-loading-detail');
  if(detail&&detail!==status.textContent)status.textContent=detail;
 }
 function fail(message){
  version++;loading=null;clearTimeout(deadline);
  get('front-error-detail').textContent=message;
  show('error','front-retry');
 }
 function begin(kind,title,detail){
  version++;clearTimeout(deadline);
  loading={kind,progress:0,appReady:false,submitting:false};
  get('front-loading-title').textContent=title;
  show('loading');progress(0,detail);
  focus(get('front-loading-title'));
  deadline=setTimeout(()=>fail('Загрузка заняла слишком много времени. Повторите попытку.'),90000);
  return version;
 }
 function afterPaint(work){requestAnimationFrame(()=>requestAnimationFrame(work))}

 const api={
  get paused(){return screen==='pause'||screen==='exit'||screen==='game'&&settingsMenu.open},
  get playing(){return screen==='game'&&!settingsMenu.open},
  progress,
  fail,
  pause(){
   if(screen!=='game')return;
   pauseFocus=document.activeElement;
   show('pause','front-resume');
  },
  startMatch(start){
   if(screen!=='game')return;
   const attempt=begin('match','Подготовка партии','Распределяем земли и готовим стартовые города');
   afterPaint(()=>{
    if(attempt!==version)return;
    try{
     start();loading.appReady=true;
     progress(90,'Отрисовываем карту держав');
    }catch(error){console.error('Campaign start',error);fail('Не удалось начать партию. Попробуйте выбрать карту снова.');}
   });
  },
  materials(total,settled){
   if(!loading||loading.kind!=='map')return;
   loading.appReady=true;
   progress(84+Math.floor(12*(total?settled/total:1)),settled===total?'Отрисовываем первый кадр':'Загружаем материалы ландшафта');
   loading.texturesReady=settled===total;
  },
  frame(graphics,matchStarted){
   if(!loading?.appReady||loading.submitting||loading.kind==='map'&&!loading.texturesReady)return;
   const attempt=version;
   loading.submitting=true;
   progress(98,'Подготавливаем карту к управлению');
   Promise.resolve(graphics.device?.queue?.onSubmittedWorkDone?.()).then(()=>{
    if(attempt!==version)return;
    progress(100);
    clearTimeout(deadline);loading=null;
    show('game',matchStarted?'world':'setup-heading');
   }).catch(()=>{if(attempt===version)fail('Не удалось отобразить карту. Повторите загрузку.');});
  }
 };
 globalThis.gameShell=api;

 for(const id of ['front-loading-title','front-maps-title','setup-heading','world'])get(id).tabIndex=-1;
 function resume(){show('game');focus(pauseFocus||get('game-menu-toggle'));pauseFocus=null;}
 function goBack(){
  if(screen==='maps'){show('home','front-play');return}
  if(screen==='exit'){show('pause','front-exit');return}
  if(screen==='pause')resume();
 }
 get('front-play').onclick=()=>show('maps','front-maps-title');
 if(native?.close){
  const quit=get('front-quit');
  quit.hidden=false;quit.onclick=()=>native.close();
 }
 get('front-retry').onclick=()=>location.reload();
 get('game-menu-toggle').onclick=()=>api.pause();
 get('front-resume').onclick=resume;
 get('front-exit').onclick=()=>show('exit','front-stay');
 get('front-stay').onclick=goBack;
 for(const button of shell.querySelectorAll('[data-front-back]'))button.onclick=goBack;
 window.addEventListener('keydown',event=>{
  if(settingsMenu.open||screen==='game'||event.key==='F11'&&native?.close)return;
  event.stopImmediatePropagation();
  if(event.key==='Escape'){
   if(screen!=='loading'){event.preventDefault();goBack()}
  }else if(event.key==='Tab'){
   const page=screens.find(item=>item.dataset.frontPage===screen);
   const controls=[...page.querySelectorAll('button:not([disabled]),a[href]')];
   if(screen==='home'||screen==='maps'){const language=get('front-language');if(language)controls.unshift(language)}
   const first=controls[0],last=controls.at(-1),active=document.activeElement;
   if(!first){event.preventDefault();return}
   if(event.shiftKey&&(active===first||!controls.includes(active))){event.preventDefault();focus(last)}
   if(!event.shiftKey&&active===last){event.preventDefault();focus(first)}
  }
 },true);
 window.addEventListener('error',event=>{
  if(!loading||!event.error)return;
  console.error('Campaign bootstrap',event.error);
  fail('Не удалось подготовить карту. Попробуйте загрузить её заново.');
 });
 document.documentElement.dataset.scenario=map;
 const mapGrid=get('front-map-list');
 if(mapGrid)for(const entry of globalThis.BALTIC_MAPS){
  const link=document.createElement('a');
  link.className='front-map'+(entry.card?' '+entry.card:'');
  link.href='./?map='+encodeURIComponent(entry.id);
  link.dataset.frontMap=entry.id;
  const text=document.createElement('span');
  text.className='front-map-text';
  const strong=document.createElement('strong');
  strong.textContent=entry.title;
  const small=document.createElement('small');
  small.textContent=entry.subtitle;
  text.append(strong,small);
  link.append(text);
  mapGrid.append(link);
 }
 if(directlyToMap){
  const attempt=begin('map',maps[map].title,'Загружаем карту');
  afterPaint(()=>{
   if(attempt!==version)return;
   globalThis.loadCampaign(maps[map],progress).catch(error=>{if(attempt===version)fail(error.message)});
  });
 }
})();
