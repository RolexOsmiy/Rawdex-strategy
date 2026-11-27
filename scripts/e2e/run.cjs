'use strict';
// E2E-проверка загрузки карты в настоящем Chromium (Edge) без дисплея.
// Запуск: node run.cjs [baltic|mediterranean]
// Возвращает 0, если карта загрузилась до игрового экрана, иначе 1.
const {chromium}=require('playwright-core');
const path=require('node:path');
const {startServer}=require('./static-server.cjs');

const MAP=process.argv[2]||'baltic';
const EDGE=process.env.BALTRIC_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function verifyBorderPaint(page){
 const {visible,black}=await page.evaluate(async()=>{
  const layer=document.getElementById('vassal-border-layer');
  const {width,height}=layer.viewBox.baseVal;
  const svg=layer.cloneNode(true);
  svg.setAttribute('width',width);
  svg.setAttribute('height',height);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try{
   const image=new Image();
   image.src=url;
   await image.decode();
   const canvas=document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');
   context.drawImage(image,0,0);
   const pixels=context.getImageData(0,0,width,height).data;
   let visible=0,black=0;
   for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]>0)visible++;
    if(pixels[i+3]>=250&&Math.max(pixels[i],pixels[i+1],pixels[i+2])<=8)black++;
   }
   return {visible,black};
  }finally{URL.revokeObjectURL(url)}
 });
 if(!visible||black)throw Error('Слой границ: видимых пикселей '+visible+', непрозрачных чёрных '+black);
}

async function verifyPoliticalBorders(page){
 const readBorder=(stage=null)=>page.evaluate(async stage=>{
  for(let frame=0;frame<120;frame++){
   await new Promise(requestAnimationFrame);
   const view=mapView();
   if(!stage||stage==='tilt'&&view.atlasPitch>.25&&view.opacity===0||stage==='blend'&&view.opacity>.15&&view.opacity<.85)break;
  }
  const path=document.querySelector('#vassal-border-layer clipPath path');
  const region=state.regions.find(r=>path.parentElement.id.endsWith('-'+r.id));
  const [x,y,z]=groundedBorderRings(region).find(ring=>ring.length>=3)[0];
  const point=path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
  const view=mapView();
  // project() fades elevation on labels. The outline keeps the rendered terrain height.
  const expected=project(x,z,y);
  expected.y-=y*view.opacity*view.scale*view.height/(2*view.norm);
  return {error:Math.hypot(point.x-expected.x,point.y-expected.y),x:point.x,y:point.y,
   path:path.getAttribute('d'),scale:cam.scale,yaw:cam.yaw,tilt:cam.tilt,pitch:view.atlasPitch,opacity:view.opacity};
 },stage);
 const drag=async (button,x,y,dx,dy,check)=>{
  await page.mouse.move(x,y);
  await page.mouse.down({button});
  try{
   await page.mouse.move(x+dx,y+dy,{steps:8});
   await check();
  }finally{await page.mouse.up({button})}
 };
 const before=await readBorder();
 const [x,y]=await page.evaluate(()=>{
  const world=document.getElementById('world');
  return [[.72,.69],[.8,.4],[.6,.62]].map(([x,y])=>[Math.round(x*innerWidth),Math.round(y*innerHeight)])
   .find(([x,y])=>document.elementFromPoint(x,y)===world);
 });
 let panned;
 await drag('middle',x,y,100,45,async()=>{
  panned=await readBorder();
  if(panned.error>1||Math.hypot(panned.x-before.x,panned.y-before.y)<60||panned.path!==before.path){
   throw Error('Контур державы не следует за камерой при перетаскивании');
  }
 });
 await page.mouse.wheel(0,-160);
 await page.waitForFunction(scale=>cam.scale>scale,panned.scale);
 const zoomed=await readBorder();
 if(zoomed.error>1||zoomed.path!==panned.path)throw Error('Контур державы смещается при зуме');
 await drag('right',x,y,70,25,async()=>{
  const unchanged=await readBorder();
  if(unchanged.yaw!==zoomed.yaw||unchanged.tilt!==zoomed.tilt||unchanged.x!==zoomed.x||unchanged.y!==zoomed.y){
   throw Error('ПКМ меняет положение камеры');
  }
 });
 await page.keyboard.down('KeyE');
 try{
  await page.waitForFunction(yaw=>cam.yaw!==yaw,zoomed.yaw);
  const rotated=await readBorder();
  if(rotated.error>1||rotated.yaw===zoomed.yaw||rotated.path===zoomed.path){
   throw Error('Контур державы не следует за поворотом камеры с клавиатуры');
  }
 }finally{await page.keyboard.up('KeyE')}
 const scale=await page.evaluate(()=>{
  const previous=cam.scale;
  cam.scale=(ATLAS_TILT_START+ATLAS_EXIT_ZOOM)/2;
  return previous;
 });
 try{
  const tilted=await readBorder('tilt');
  if(tilted.pitch<=.25||tilted.opacity!==0||tilted.error>1)throw Error('Контуры расходятся при наклоне перед атласом: '+tilted.error+' пикселей');
  await page.evaluate(()=>{cam.scale=MIN_MAP_ZOOM});
  const blended=await readBorder('blend');
  if(blended.opacity<=.15||blended.opacity>=.85||blended.error>1)throw Error('Контуры расходятся при переходе в атлас: '+blended.error+' пикселей');
 }finally{
  await page.evaluate(scale=>{cam.scale=scale},scale);
  await page.waitForFunction(()=>mapView().opacity===0&&mapView().atlasPitch===0);
 }
}

async function verifyBuildingMarkers(page){
 const audioStarts=await page.evaluate(()=>window.__e2eAudioStarts);
 await page.locator('.tool[data-type="grain"]').click();
 await page.waitForFunction(count=>window.__e2eAudioStarts>count,audioStarts,{timeout:4500});
 const marker=await page.evaluate(()=>{
  const marks=[...document.querySelectorAll('.slot-marker.choosing:not([hidden])')];
  const el=marks.find(node=>parseFloat(node.style.left)>innerWidth*.25&&parseFloat(node.style.left)<innerWidth*.75&&
   parseFloat(node.style.top)>innerHeight*.25&&parseFloat(node.style.top)<innerHeight*.75);
  return el?{...el.dataset,x:parseFloat(el.style.left)}:null;
 });
 if(!marker)throw Error('Нет видимых меток свободных графств');
 await page.keyboard.down('KeyD');
 await page.waitForTimeout(200);
 await page.keyboard.up('KeyD');
 const moved=await page.evaluate(async ({region,slot,x})=>{
  await new Promise(requestAnimationFrame);
  const el=document.querySelector('.slot-marker[data-region="'+region+'"][data-slot="'+slot+'"]');
  const land=state.regions.find(r=>String(r.id)===region);
  const plot=land.slots.find(s=>String(s.id)===slot);
  const point=project(plot.x,plot.z,surfaceHeight(plot.x,plot.z)+.8);
  const left=parseFloat(el.style.left),top=parseFloat(el.style.top);
  return !el.hidden&&Math.abs(left-x)>12&&Math.hypot(left-point.x,top-point.y)<1;
 },marker);
 if(!moved)throw Error('Строительная метка залипла при движении карты');
 const [x,y]=await page.evaluate(()=>{
  const world=document.getElementById('world');
  return [[.72,.69],[.8,.4],[.6,.62]].map(([x,y])=>[Math.round(x*innerWidth),Math.round(y*innerHeight)])
   .find(([x,y])=>document.elementFromPoint(x,y)===world);
 });
 await page.mouse.click(x,y,{button:'right'});
 if(await page.evaluate(()=>mode!==null||!document.getElementById('placement').hidden))
  throw Error('ПКМ не отменяет размещение постройки');
}

async function verifyAudioAssets(page){
 await page.evaluate(async()=>{
  const audio=new AudioContext();
  try{
   await Promise.all(Object.keys(GAME_AUDIO_CUES).map(async name=>{
    const response=await fetch('audio/'+name+'.mp3');
    if(!response.ok)throw Error('Не загрузился звук '+name);
    const buffer=await audio.decodeAudioData(await response.arrayBuffer());
    if(buffer.duration<.15)throw Error('Пустой звук '+name);
   }));
  }finally{await audio.close()}
 });
}

async function verifyArmyOrders(page){
 await page.evaluate(()=>{
  const region=state.regions.find(r=>r.id===state.capitalId);
  const network=state.network,hub=roadNodeLocation(network,network.hubKeys.get(region.id));
  state.garrisons[region.id]={...state.garrisons[region.id],owner:'you',troops:72};
  state.fieldArmies.push({kind:'field',owner:'you',troops:38,location:hub});
  cam.x=hub.point.x;cam.z=hub.point.z;cam.scale=.033;cam.yaw=0;cam.tilt=DEFAULT_CAMERA_TILT;dirtyLabels=true;
 });
 const box=await page.evaluate(async()=>{
  await new Promise(requestAnimationFrame);
  const badges=[...marchElements.values()].filter(el=>el.armyItem.owner==='you'&&!el.hidden).map(el=>el.armyItem.badge);
  const xs=badges.map(p=>p.x),ys=badges.map(p=>p.y);
  const world=document.getElementById('world');
  for(const padding of [24,36,48,60]){
   const left=Math.round(Math.min(...xs)-padding),right=Math.round(Math.max(...xs)+padding);
   const top=Math.round(Math.min(...ys)-padding),bottom=Math.round(Math.max(...ys)+padding);
   for(const [x,y,toX,toY] of [[left,top,right,bottom],[right,top,left,bottom],[left,bottom,right,top]]){
    if(document.elementFromPoint(x,y)===world)return [x,y,toX,toY];
   }
  }
  throw Error('Рамку выбора перекрыл интерфейс: '+JSON.stringify({xs,ys}));
 });
 await page.mouse.move(box[0],box[1]);
 await page.mouse.down();
 try{await page.mouse.move(box[2],box[3],{steps:8})}finally{await page.mouse.up()}
 await page.locator('#army-selection').waitFor({timeout:2500});
 const counts=await page.locator('#army-selection-list .army-selection-row b').allTextContents();
 if(counts.sort().join(',')!=='38,72'||!(await page.locator('#army-selection-total').textContent()).includes('110')){
  throw Error('Панель не показывает два отряда и 110 солдат');
 }
 const overlapsControls=await page.evaluate(()=>{
  const panel=document.getElementById('army-selection').getBoundingClientRect();
  const controls=document.querySelector('.camera-help').getBoundingClientRect();
  return panel.left<controls.right&&panel.right>controls.left&&panel.top<controls.bottom&&panel.bottom>controls.top;
 });
 if(overlapsControls)throw Error('Панель войск перекрывает кнопки камеры и звука');
 const target=await page.evaluate(()=>{
  const world=document.getElementById('world'),network=state.network;
  for(let y=170;y<innerHeight-150;y+=48){
   for(let x=Math.round(innerWidth*.33);x<innerWidth*.74;x+=46){
    if(document.elementFromPoint(x,y)!==world)continue;
    const point=unproject(x,y);
    if(regionAt(state.regions,point.x,point.z)?.owner!=='you')continue;
    const road=nearestRoadLocation(network,point.x,point.z);
    if(!road||road.distance*innerHeight*cam.scale/2<30||roadLocationAtScreen(x,y))continue;
    if(selectedGroup.every(selection=>{
     const route=prepareArmyOrder(state,selection,road);
     return route.ok&&journeyDuration(route.path)>1;
    }))return {x,y,road:road.point};
   }
  }
  return null;
 });
 if(!target)throw Error('Нет пригодной цели вне зоны прямого клика по дороге');
 const positions=()=>page.evaluate(()=>[...marchElements.values()]
  .map(el=>el.armyItem).filter(item=>item.owner==='you').sort((a,b)=>a.troops-b.troops)
  .map(item=>item.point));
 const displacement=(a,b)=>a.length===b.length?Math.max(...a.map((point,i)=>
  Math.hypot(point.x-b[i].x,point.z-b[i].z))):Infinity;
 const origin=await positions();
 await page.mouse.click(target.x,target.y);
 const destinations=()=>page.evaluate(()=>({
  group:selectedGroup.length,alert:document.getElementById('toast').textContent,
  routes:state.armyMoves.filter(unit=>unit.owner==='you').map(unit=>({
   target:unit.destination?.point,end:unit.path.at(-1),ribbon:armyRouteBuffers.get(unit)?.ribbon?.count
  }))
 }));
 await page.waitForFunction(({x,z})=>{
  const ordered=state.armyMoves.filter(unit=>unit.owner==='you'&&
   unit.destination&&Math.hypot(unit.destination.point.x-x,unit.destination.point.z-z)<.001);
  return ordered.length===2&&ordered.every(unit=>armyRouteBuffers.get(unit)?.ribbon?.count>0);
 },target.road,{timeout:4000}).catch(async error=>{
  throw Error('Приказ в точку '+JSON.stringify(target)+' · '+JSON.stringify(await destinations()),{cause:error});
 });
 if(displacement(origin,await positions())>.01)throw Error('Первый приказ сдвинул отряд мгновенно');
 await page.evaluate(async()=>{simClock=.9;await new Promise(requestAnimationFrame)});
 const advanced=await positions(),movement=displacement(origin,advanced);
 if(Math.abs(movement-2.4)>.01)throw Error('Неверная скорость движения между тиками: '+movement);
 for(let i=0;i<8;i++)await page.mouse.click(target.x,target.y);
 if(displacement(advanced,await positions())>.01)throw Error('Повторные приказы ускорили войска');
 const elapsed=await page.evaluate(()=>{
  stepArmies(state,1);
  simClock=0;
  return state.armyMoves.filter(unit=>unit.owner==='you').map(unit=>unit.elapsed);
 });
 if(elapsed.length!==2||elapsed.some(value=>Math.abs(value-.1)>.001))throw Error('Первый тик повторного приказа учёл уже прошедшее время');
}

async function verifyVictoryRings(page){
 const baseline=await page.evaluate(()=>{
  const ring=document.querySelector('[data-victory-path="military"]');
  return {visible:!document.getElementById('victory-rings').hidden,color:ring.style.getPropertyValue('--victory-color')};
 });
 if(!baseline.visible||baseline.color)throw Error('При равном прогрессе стартовый военный контур должен быть нейтральным');
 await page.evaluate(()=>{
  const c=state.campaign,[merchant,ally,rival]=Object.keys(state.factions);
  const capital=state.regions.find(r=>r.id===state.factions[ally].regionId).buildings.find(b=>b.capital);
  const captured=state.regions.find(r=>r.id===state.factions[rival].regionId);
  const initialLevel=capital.level,initialOwner=captured.owner;
  const original={pacts:c.pacts,trades:c.trades,turnover:c.turnover};
  try{
   capital.level=2;captured.owner='you';
   c.pacts=new Map([['test',{a:'you',b:ally}]]);
   c.trades=new Map([[merchant,Array.from({length:2},()=>({
    time:state.economy.seconds,buyer:'you',value:c.rules.baseIncome*3
   }))]]);
   c.turnover=new Map([[merchant,c.rules.turnover]]);
   updateCampaign(state,0);
   renderCampaignPanel();
   for(const [path,owner] of Object.entries({military:'you',trade:merchant,diplomacy:ally})){
    const ring=document.querySelector('[data-victory-path="'+path+'"]'),leader=c.pathLeaders[path];
    const border=getComputedStyle(ring).borderTopColor.replaceAll(' ','');
    if(leader.owners.length!==1||leader.owners[0]!==owner||border!==factionCss(owner)||
      Math.abs(parseFloat(ring.style.getPropertyValue('--victory-progress'))-leader.score*100)>.01){
     throw Error('Неверный лидер, цвет или прогресс победы '+path);
    }
   }
  }finally{
   capital.level=initialLevel;captured.owner=initialOwner;
   Object.assign(c,original);
   updateCampaign(state,0);
   renderCampaignPanel();
  }
 });
 const ring=page.locator('[data-victory-path="trade"]');
 await ring.click();
 await page.locator('#campaign-panel').waitFor();
 await ring.click();
 await page.locator('#campaign-panel').waitFor({state:'hidden'});
 const fitsHeader=()=>page.evaluate(()=>{
  const header=document.querySelector('#app>header').getBoundingClientRect();
  const rings=document.getElementById('victory-rings').getBoundingClientRect();
  return rings.right<=header.right+1&&rings.left>=header.left;
 });
 if(!await fitsHeader())throw Error('Индикаторы выходят за пределы верхней панели');
 const viewport=page.viewportSize();
 if(viewport&&viewport.width>960){
  try{
   await page.setViewportSize({width:960,height:viewport.height});
   if(!await fitsHeader())throw Error('Индикаторы не помещаются в окне шириной 960 пикселей');
  }finally{await page.setViewportSize(viewport)}
 }
}

(async()=>{
 const server=await startServer(path.join(__dirname,'..','..','dist'),0);
 const port=server.address().port;
 const browser=await chromium.launch({
  executablePath:EDGE,
  headless:true,
  args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-gpu-sandbox']
 });
 const page=await browser.newPage();
 await page.addInitScript(()=>{
  window.__e2eAudioStarts=0;
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
   const result=start.apply(this,args);
   window.__e2eAudioStarts++;
   return result;
  };
 });
 const logs=[];
 page.on('console',m=>{
  const line='['+m.type()+'] '+m.text();
  logs.push(line);
  if(m.type()==='error')console.log(line.slice(0,300));
 });
 page.on('pageerror',e=>console.log('PAGEERROR: '+e.message.slice(0,300)));
 await page.goto('http://127.0.0.1:'+port+'/?map='+MAP,{waitUntil:'domcontentloaded'});
 const started=Date.now();
 let loaded=false;
 try{
  await page.waitForFunction(
   ()=>document.getElementById('front-shell')?.dataset.screen==='game',
   {timeout:90000});
  loaded=true;
 }catch{
  // не загрузилась — смотрим, что случилось
 }
 if(!loaded){
  const err=await page.evaluate(()=>{
   const detail=document.getElementById('front-error-detail');
   const error=document.getElementById('error');
   return (detail&&!detail.hidden?detail.textContent:'')||(error&&!error.hidden?error.textContent:'')||'';
  });
  console.log('ИСХОД: ОШИБКА ЗАГРУЗКИ ('+(Date.now()-started)+'мс): '+(err||'(сообщения нет)'));
  console.log('Консоль (последние 15):');
  console.log(logs.slice(-15).join('\n'));
 }else{
  console.log('ИСХОД: КАРТА ЗАГРУЗИЛАСЬ за '+(Date.now()-started)+'мс');
  // Смоук-тест настроек: панель, MSAA на лету, масштаб, счётчик FPS.
  try{
   // На экране подготовки camera-help скрыт — открываем панель программно.
   await page.evaluate(()=>document.getElementById('settings-toggle').click());
   const panelVisible=await page.evaluate(()=>!document.getElementById('settings-panel').hidden);
   await page.evaluate(()=>{
    document.getElementById('set-msaa').click();
    document.getElementById('set-scale').value='0.5';
    document.getElementById('set-scale').dispatchEvent(new Event('change'));
    document.getElementById('set-fps').click();
   });
   await page.locator('#settings-close').click();
   await page.waitForTimeout(2500);
   const msaa=await page.evaluate(()=>globalThis.mapGPU?.sampleCount??-1);
   const visiblePixels=await page.evaluate(async()=>{
    const preview=document.createElement('canvas');
    preview.width=48;preview.height=27;
    const context=preview.getContext('2d');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    context.drawImage(document.getElementById('world'),0,0,preview.width,preview.height);
    const pixels=context.getImageData(0,0,preview.width,preview.height).data;
    let visible=0;
    for(let i=0;i<pixels.length;i+=4){
     if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>=42)visible++;
    }
    return visible;
   });
   if(msaa!==1||visiblePixels<32){
    throw Error('Карта не отрисовалась без MSAA: sampleCount='+msaa+', видимых пикселей '+visiblePixels);
   }
   const size=await page.evaluate(()=>{const w=document.getElementById('world');return w.width+'x'+w.height});
   const fpsText=await page.evaluate(()=>document.getElementById('fps-meter')?.textContent||'');
   // Партию запускаем выбором первого доступного стартового герцогства.
   let sim='не проверялась';
   try{
    await page.evaluate(()=>{
     const first=document.querySelector('#campaign-starts button');
     if(first)first.click();
    });
    await page.waitForSelector('#setup-start:not([disabled])',{timeout:10000});
    await page.click('#setup-start');
    await page.waitForFunction(()=>!document.getElementById('app').classList.contains('campaign-setup'),{timeout:30000});
    const dateBefore=await page.evaluate(()=>document.getElementById('game-date')?.textContent);
    await page.waitForFunction(before=>document.getElementById('game-date')?.textContent!==before,dateBefore,{timeout:12000});
    const dateAfter=await page.evaluate(()=>document.getElementById('game-date')?.textContent);
    sim='идёт ('+dateBefore+' → '+dateAfter+')';
    await verifyBorderPaint(page);
    await verifyPoliticalBorders(page);
    console.log('Контуры держав видны, местность не перекрыта при перетаскивании, зуме и повороте.');
    await page.keyboard.press('Home');
    await verifyBuildingMarkers(page);
    await verifyAudioAssets(page);
    await verifyVictoryRings(page);
    // Freeze the simulation clock while checking the first rendered march frame.
    const beforeArmyTest=await page.evaluate(()=>{
     window.__playingBeforeArmyTest=Object.getOwnPropertyDescriptor(gameShell,'playing');
     Object.defineProperty(gameShell,'playing',{configurable:true,value:false});
     const previous={scale:cam.scale,clock:simClock};
     simClock=.7;
     return previous;
    });
    try{await verifyArmyOrders(page)}finally{
     await page.evaluate(({scale,clock})=>{
      Object.defineProperty(gameShell,'playing',window.__playingBeforeArmyTest);
      delete window.__playingBeforeArmyTest;
      cam.scale=scale;simClock=clock;dirtyLabels=true;
     },beforeArmyTest);
    }
    console.log('Метки строительства следуют за картой. Два отряда получили общий маршрут по клику вне дороги. Звуковые записи загрузились и воспроизводятся.');
    console.log('Быстрые приказы не меняют скорость отрядов. Все три индикатора показывают прогресс и цвет своего лидера.');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Home');
    await page.evaluate(()=>{
     const scale=cam.scale;
     const redraw=offset=>{cam.scale=ATLAS_TILT_START+offset/WORLD_SCALE;renderLabels()};
     try{
      redraw(.0002);if(labelsJob&&labelStep(Infinity))labelsJob=null;
      for(const offset of [.00004,.00008,.00004,.00008]){
       redraw(offset);
       if(labelsJob||labelMeta.overview)throw Error('Label mode flickers inside the zoom threshold band');
      }
      redraw(-.00004);
      if(!labelsJob?.overview)throw Error('Overview label update did not start');
      redraw(.0002);
      if(labelsJob||labelMeta.overview)throw Error('Obsolete overview labels survived a zoom reversal');
     }finally{cam.scale=scale;dirtyLabels=true}
    });
    // Зум колесом: метки не должны исчезать/мигать при движении камеры.
    await page.mouse.move(960,540);
    const zoomCounts=[];
    for(let i=0;i<10;i++){
     await page.mouse.wheel(0,i%2?-140:140);
     await page.waitForTimeout(90);
     zoomCounts.push(await page.evaluate(()=>({
      all:document.querySelectorAll('#labels .map-label').length,
      visible:[...document.querySelectorAll('#labels .map-label')].filter(el=>el.style.display!=='none').length
     })));
    }
    const minVisible=Math.min(...zoomCounts.map(c=>c.visible));
    console.log('Зум колесом: меток',zoomCounts[0].all,'→',zoomCounts.at(-1).all,'| видимых минимум',minVisible);
    console.log('Зум:',minVisible>0?'метки остаются на карте':'МЕТКИ ИСЧЕЗАЮТ — регресс');
    await page.waitForTimeout(1500);
    const afterZoom=await page.evaluate(()=>[...document.querySelectorAll('#labels .map-label')].filter(el=>el.style.display!=='none').length);
    console.log('После остановки зума видимых меток:',afterZoom);
    // Обзорный зум: строки держав не должны копиться, подпись моря — одна.
    const moveToWorld=async()=>{
     const point=await page.evaluate(()=>{
      const world=document.getElementById('world');
      return [[.52,.4],[.65,.65],[.73,.38],[.36,.36]].map(([x,y])=>[Math.round(x*innerWidth),Math.round(y*innerHeight)])
       .find(([x,y])=>document.elementFromPoint(x,y)===world);
     });
     if(!point)throw Error('Нет точки на карте для проверки атласа');
     await page.mouse.move(...point);
    };
    for(let i=0;i<22;i++){
     if(await page.evaluate(()=>cam.scale<=ATLAS_ENTER_ZOOM))break;
     await moveToWorld();await page.mouse.wheel(0,300);await page.waitForTimeout(75);
    }
    await page.waitForFunction(()=>mapView().cartographic&&atlasProgress===1&&
     getComputedStyle(document.getElementById('diplomatic-atlas')).opacity==='1',null,{timeout:4000}).catch(async error=>{
      const view=await page.evaluate(()=>({scale:cam.scale,target:ATLAS_ENTER_ZOOM,progress:atlasProgress,mode,paused:gameShell.paused}));
      throw Error('Атлас не открылся после отдаления · '+JSON.stringify(view),{cause:error});
     });
    await page.waitForTimeout(400);
    const ov1=await page.evaluate(()=>({realms:document.querySelectorAll('#labels .label-realms > *').length,sea:document.querySelectorAll('#labels .sea-label').length,scale:document.getElementById('atlas-scale')?.textContent||''}));
    for(let i=0;i<8;i++){await moveToWorld();await page.mouse.wheel(0,i%2?-160:160);await page.waitForTimeout(60);}
    await page.waitForTimeout(400);
    const ov2=await page.evaluate(()=>({realms:document.querySelectorAll('#labels .label-realms > *').length,sea:document.querySelectorAll('#labels .sea-label').length}));
    console.log('Обзорный зум:',ov1.scale,'| строк держав',ov1.realms,'→',ov2.realms,'| море',ov1.sea,'→',ov2.sea);
    console.log('Обзор:',ov2.sea<=1&&ov2.realms<=12?'без дублей':'ЕСТЬ ДУБЛИ — регресс');
   }catch(startError){throw Error('Проверка партии: '+startError.message,{cause:startError})}
   console.log('Панель настроек:',panelVisible?'открылась':'НЕ открылась');
   console.log('MSAA после тумблера:',msaa,'(ожидание 1)');
   console.log('Холст после масштаба 50%:',size);
   console.log('Счётчик FPS:',fpsText||'не обновился');
   console.log('Симуляция:',sim);
  }catch(smokeError){
   console.log('СМОУК-ТЕСТ НАСТРОЕК УПАЛ: '+smokeError.message.slice(0,300));
   loaded=false;
  }
 }
 const gpu=await page.evaluate(async()=>{
  const adapter=await navigator.gpu?.requestAdapter().catch(()=>null);
  return adapter?((adapter.info?.description||'')+' | '+(adapter.info?.vendor||'')):null;
 }).catch(()=>null);
 console.log('GPU-адаптер:',gpu||'нет');
 const errors=logs.filter(line=>line.startsWith('[error]'));
 console.log('Ошибок в консоли:',errors.length);
 await browser.close();
 server.close();
 process.exit(loaded?0:1);
})().catch(error=>{console.error('СБОЙ ТЕСТА:',error.message);process.exit(2)});
