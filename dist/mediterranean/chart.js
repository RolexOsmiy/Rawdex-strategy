'use strict';

const $=id=>document.getElementById(id);
const frame=$('chart-frame'), base=$('basemap'), voyage=$('voyage');
const atlas=base.getContext('2d'), ink=voyage.getContext('2d');
const from=$('from'),to=$('to'),sail=$('sail');
const view={w:0,h:0,dpr:1,x:0,y:0,scale:1,fit:1};
const markers=new Map(), trialButtons=new Map();
let chart, worker, landPath, ready=false, route=null, routeRequest=0;
let drag=null, request=0, sailingStart=null, progress=0;

function screen([x,y]){return [view.w/2+(x-view.x)*view.scale,view.h/2+(y-view.y)*view.scale]}
function world(x,y){return [view.x+(x-view.w/2)/view.scale,view.y+(y-view.h/2)/view.scale]}
function roundedKm(km){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(km)+' км'}

function resetView(){
 view.fit=Math.min(view.w/chart.size[0],view.h/chart.size[1]);
 view.scale=view.fit;
 view.x=chart.size[0]/2;
 view.y=chart.size[1]/2;
 render();
}
function resize(){
 const rect=frame.getBoundingClientRect();
 if(!rect.width||!rect.height||!chart) return;
 const prevFit=view.fit,dpr=Math.min(devicePixelRatio||1,2);
 Object.assign(view,{w:rect.width,h:rect.height,dpr});
 for(const canvas of [base,voyage]) {canvas.width=Math.ceil(view.w*dpr);canvas.height=Math.ceil(view.h*dpr)}
 if(!landPath||!view.x){resetView();return}
 view.fit=Math.min(view.w/chart.size[0],view.h/chart.size[1]);
 view.scale*=view.fit/prevFit;
 render();
}
function zoom(factor,x=view.w/2,y=view.h/2){
 if(!chart) return;
 const [wx,wy]=world(x,y);
 view.scale=Math.max(view.fit*.75,Math.min(view.fit*14,view.scale*factor));
 view.x=wx-(x-view.w/2)/view.scale;
 view.y=wy-(y-view.h/2)/view.scale;
 render();
}

function renderBase(){
 const [x,y]=screen([0,0]), w=chart.size[0]*view.scale,h=chart.size[1]*view.scale;
 atlas.setTransform(view.dpr,0,0,view.dpr,0,0);
 atlas.fillStyle='#192c2d';
 atlas.fillRect(0,0,view.w,view.h);
 atlas.save();
 atlas.beginPath();atlas.rect(x,y,w,h);atlas.clip();
 const water=atlas.createLinearGradient(x,y,x+w*.62,y+h);
 water.addColorStop(0,'#36545a');water.addColorStop(.52,'#294651');water.addColorStop(1,'#1a3540');
 atlas.fillStyle=water;atlas.fillRect(x,y,w,h);
 const every=view.scale>2?40:100, spacing=every*view.scale;
 atlas.lineWidth=1;atlas.strokeStyle='#a9bdab20';atlas.beginPath();
 for(let px=x%spacing;px<view.w;px+=spacing){atlas.moveTo(px,0);atlas.lineTo(px,view.h)}
 for(let py=y%spacing;py<view.h;py+=spacing){atlas.moveTo(0,py);atlas.lineTo(view.w,py)}
 atlas.stroke();

 atlas.translate(x,y);atlas.scale(view.scale,view.scale);
 atlas.lineJoin='round';
 const coast=[[18,'#6d8b8027'],[9,'#7b9d9238'],[3.5,'#aebca464']];
 for(const [width,color] of coast){
  atlas.strokeStyle=color;atlas.lineWidth=width/view.scale;
  atlas.stroke(landPath);
 }
 const land=atlas.createLinearGradient(0,0,chart.size[0]*.28,chart.size[1]);
 land.addColorStop(0,'#b2af85');land.addColorStop(.4,'#9b9d73');land.addColorStop(1,'#cdb784');
 atlas.fillStyle=land;atlas.fill(landPath,'evenodd');
 atlas.strokeStyle='#797559';atlas.lineWidth=1.2/view.scale;atlas.stroke(landPath);
 atlas.restore();

 atlas.textAlign='center';atlas.textBaseline='middle';
 for(const {name,point,kind} of chart.labels){
  const [sx,sy]=screen(point);
  if(sx<0||sx>view.w||sy<0||sy>view.h) continue;
  atlas.fillStyle=kind==='water'?'#d9e4d3a8':'#303627d8';
  atlas.font=(kind==='water'?'italic ':'')+(view.scale<.8?11:13)+'px Georgia';
  atlas.fillText(name,sx,sy);
 }
}

function renderRoute(){
 ink.setTransform(view.dpr,0,0,view.dpr,0,0);
 ink.clearRect(0,0,view.w,view.h);
 if(!route) return;
 const points=route.points.map(screen);
 ink.lineCap='round';ink.lineJoin='round';
 ink.beginPath();
 points.forEach(([x,y],i)=>i?ink.lineTo(x,y):ink.moveTo(x,y));
 ink.strokeStyle='#11272bd9';ink.lineWidth=5;ink.stroke();
 ink.strokeStyle='#f1cf8a';ink.lineWidth=2;ink.setLineDash([7,6]);ink.stroke();ink.setLineDash([]);

 const target=route.km*progress;
 let distanceSoFar=0,a=route.points[0],b=route.points[1];
 for(let i=1;i<route.points.length;i++){
  a=route.points[i-1];b=route.points[i];
  const d=Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(distanceSoFar+d>=target||i===route.points.length-1){
   const t=d?Math.min(1,(target-distanceSoFar)/d):0;
   const [sx,sy]=screen([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
   ink.save();ink.translate(sx,sy);ink.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));
   ink.fillStyle='#f8dfaa';ink.strokeStyle='#243639';ink.lineWidth=1.5;
   ink.beginPath();ink.moveTo(10,0);ink.lineTo(-6,-4);ink.lineTo(-8,0);ink.lineTo(-6,4);ink.closePath();ink.fill();ink.stroke();
   ink.restore();break;
  }
  distanceSoFar+=d;
 }
}

function render(){
 if(!chart||!landPath||!view.w) return;
 renderBase();renderRoute();
 for(const port of chart.ports){
  const el=markers.get(port.id),[x,y]=screen(port.berth);
  el.style.left=x+'px';el.style.top=y+'px';
  el.hidden=x<5||y<5||x>view.w-5||y>view.h-5;
  el.classList.toggle('origin',port.id===from.value);
  el.classList.toggle('destination',port.id===to.value);
  el.dataset.secondary=String(view.scale<.55||view.scale<1.15&&['reggio','messina','milazzo','bizerte','sousse','olbia','annaba'].includes(port.id));
 }
 const bar=[500,300,200,100,50,25,10,5,2].find(km=>km*view.scale<105)||1;
 $('scale-line').style.width=bar*view.scale+'px';$('scale-label').textContent=bar+' км';
}

function fitRoute(){
 if(!route) return;
 const points=route.points,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 view.x=(left+right)/2;view.y=(top+bottom)/2;
 view.scale=Math.max(view.fit,Math.min(view.fit*8,view.w*.73/Math.max(right-left,44),view.h*.65/Math.max(bottom-top,44)));
 render();
}

function setSailLabel(label){sail.firstChild.nodeValue=label+' '}
function stopSailing(){
 if(request) cancelAnimationFrame(request);
 request=0;sailingStart=null;
 setSailLabel('Отправить корабль');
}
function advance(now){
 if(sailingStart==null) sailingStart=now;
 progress=Math.min(1,(now-sailingStart)/(1800+route.km*8));
 renderRoute();
 if(progress<1){request=requestAnimationFrame(advance);return}
 stopSailing();
 $('status').textContent='Корабль прибыл в порт «'+to.selectedOptions[0].textContent+'».';
}
sail.onclick=()=>{
 if(!route) return;
 if(request){stopSailing();$('status').textContent='Рейс остановлен.';return}
 progress=0;fitRoute();setSailLabel('Остановить рейс');
 $('status').textContent='Корабль следует по проложенному маршруту.';
 request=requestAnimationFrame(advance);
};

function suggest(focus=false){
 stopSailing();route=null;progress=0;sail.disabled=true;
 $('distance').textContent=$('direct').textContent='—';
 for(const [button,pair] of trialButtons)
  button.setAttribute('aria-pressed',String(pair.from===from.value&&pair.to===to.value));
 render();
 const id=++routeRequest;
 if(!ready) return;
 if(from.value===to.value){$('status').textContent='Выбери другой порт назначения.';return}
 $('status').textContent='Прокладываю курс по воде…';
 worker.postMessage({id,from:from.value,to:to.value});
 pendingFocus=focus;
}
let pendingFocus=false;

function wireNavigation(){
 $('zoom-in').onclick=()=>zoom(1.35);
 $('zoom-out').onclick=()=>zoom(1/1.35);
 $('reset-view').onclick=resetView;
 frame.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=frame.getBoundingClientRect();
  zoom(e.deltaY>0?.85:1.18,e.clientX-rect.left,e.clientY-rect.top);
 },{passive:false});
 frame.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button')) return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  frame.setPointerCapture(e.pointerId);frame.classList.add('dragging');
 });
 frame.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id) return;
  view.x=Math.max(0,Math.min(chart.size[0],view.x-(e.clientX-drag.x)/view.scale));
  view.y=Math.max(0,Math.min(chart.size[1],view.y-(e.clientY-drag.y)/view.scale));
  drag.x=e.clientX;drag.y=e.clientY;render();
 });
 for(const end of ['pointerup','pointercancel','lostpointercapture']) frame.addEventListener(end,()=>{
  drag=null;frame.classList.remove('dragging');
 });
}

async function start(){
 const response=await fetch('chart.json');
 if(!response.ok) throw Error('Не удалось загрузить береговую карту');
 chart=await response.json();
 landPath=new Path2D();
 for(const poly of chart.land) for(const ring of poly){
  landPath.moveTo(...ring[0]);
  for(const p of ring.slice(1)) landPath.lineTo(...p);
  landPath.closePath();
 }
 for(const p of chart.ports){
  from.add(new Option(p.name,p.id));to.add(new Option(p.name,p.id));
  const button=document.createElement('button');
  button.type='button';button.className='port';button.setAttribute('aria-label','Выбрать порт '+p.name);
  button.dataset.side=({palermo:'up',milazzo:'left',messina:'up',reggio:'down',tunis:'right',bizerte:'up',naples:'up'})[p.id]||'right';
  const label=document.createElement('span');label.textContent=p.name;button.append(label);
  button.onclick=()=>{
   if(p.id===to.value) return;
   if(p.id===from.value) from.value=to.value;
   to.value=p.id;suggest();
  };
  $('port-layer').append(button);markers.set(p.id,button);
 }
 for(const trial of chart.trials){
  const button=document.createElement('button');
  button.type='button';button.className='trial';
  button.textContent=trial.name;
  const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');button.append(arrow);
  button.onclick=()=>{from.value=trial.from;to.value=trial.to;suggest(true)};
  $('trials').append(button);trialButtons.set(button,trial);
 }
 from.value='tunis';to.value='palermo';
 from.onchange=to.onchange=()=>suggest();
 wireNavigation();resize();new ResizeObserver(resize).observe(frame);
 worker=new Worker('route-worker.js');
 worker.onerror=()=>{$('status').textContent='Не удалось запустить поиск пути.'};
 worker.onmessage=({data})=>{
  if(data.ready){ready=true;suggest();return}
  if(data.id!==routeRequest) return;
  route=data.route;
  if(!route){$('status').textContent='Морской путь не найден. Выбери другую пару портов.';return}
  const a=route.points[0],b=route.points.at(-1);
  $('distance').textContent=roundedKm(route.km);
  $('direct').textContent=roundedKm(Math.hypot(a[0]-b[0],a[1]-b[1]));
  $('status').textContent='Курс проложен. Можно отправить корабль.';
  sail.disabled=false;
  if(pendingFocus) fitRoute();else renderRoute();
 };
 worker.postMessage({chart});
}
start().catch(error=>{$('status').textContent=error.message});
