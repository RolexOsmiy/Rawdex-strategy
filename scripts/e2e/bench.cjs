'use strict';
// Бенчмарк FPS в настоящем Chromium (Edge) на разных настройках рендера.
// Запуск: node bench.cjs [baltic|mediterranean]
const {chromium}=require('playwright-core');
const path=require('node:path');
const {startServer}=require('./static-server.cjs');

const MAP=process.argv[2]||'baltic';
const EDGE=process.env.BALTRIC_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function measureFrames(page,seconds=4){
 return page.evaluate(async secs=>{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const deltas=[];let last=performance.now();
  const end=performance.now()+secs*1000;
  await new Promise(resolve=>{
   const tick=t=>{deltas.push(t-last);last=t;if(performance.now()<end)requestAnimationFrame(tick);else resolve()};
   requestAnimationFrame(tick);
  });
  const sorted=[...deltas].sort((a,b)=>a-b);
  const sum=deltas.reduce((a,b)=>a+b,0);
  const avg=sum/deltas.length;
  return {frames:deltas.length,fps:Math.round(1000/avg),
   avg:avg.toFixed(1),p95:sorted[Math.floor(sorted.length*.95)].toFixed(1),
   max:sorted[sorted.length-1].toFixed(1),over16:deltas.filter(d=>d>16.7).length};
 },seconds);
}

async function runConfig(browser,label,deviceScaleFactor,viewport,steps){
 const context=await browser.newContext({viewport,deviceScaleFactor});
 const page=await context.newPage();
 page.on('pageerror',e=>console.log('  PAGEERROR:',e.message.slice(0,200)));
 const server=globalThis.__server;
 await page.goto('http://127.0.0.1:'+server.address().port+'/?map='+MAP,{waitUntil:'domcontentloaded'});
 try{
  await page.waitForFunction(()=>document.getElementById('front-shell')?.dataset.screen==='game',{timeout:90000});
 }catch{
  console.log('  '+label+': карта не загрузилась');
  await context.close();return;
 }
 // старт партии
 await page.evaluate(()=>document.querySelector('#campaign-starts button')?.click());
 await page.waitForSelector('#setup-start:not([disabled])',{timeout:10000});
 await page.click('#setup-start');
 await page.waitForFunction(()=>!document.getElementById('app').classList.contains('campaign-setup'),{timeout:30000});
 // разогрев
 await page.waitForTimeout(2000);
 console.log('  '+label+' (DPR '+deviceScaleFactor+', '+viewport.width+'x'+viewport.height+'):');
 for(const [stepLabel,apply] of steps){
  if(apply)await apply(page);
  const result=await measureFrames(page);
  console.log('    '+stepLabel.padEnd(26)+' FPS '+String(result.fps).padStart(4)+
   ' | кадр '+result.avg+'мс, p95 '+result.p95+'мс, макс '+result.max+'мс, >16.7мс: '+result.over16+'/'+result.frames);
 }
 await context.close();
}

(async()=>{
 const server=await startServer(path.join(__dirname,'..','..','dist'),0);
 globalThis.__server=server;
 const browser=await chromium.launch({
  executablePath:EDGE,
  headless:true,
  args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-gpu-sandbox']
 });
 const setSettings=(page,patch)=>page.evaluate(p=>globalThis.BALTIC_SETTINGS.update(p),patch);
 const steps=[
  ['по умолчанию (MSAA 4, 100%)',null],
  ['MSAA выкл',page=>setSettings(page,{msaa:false})],
  ['MSAA выкл + масштаб 75%',page=>setSettings(page,{renderScale:.75})],
  ['MSAA выкл + масштаб 50%',page=>setSettings(page,{renderScale:.5})]
 ];
 await runConfig(browser,'Полноэкранное разрешение',1,{width:1920,height:1080},steps);
 await runConfig(browser,'Windows-масштаб 125%',1.25,{width:1920,height:1080},steps);
 await browser.close();
 server.close();
})().catch(error=>{console.error('СБОЙ БЕНЧМАРКА:',error.message);process.exit(2)});
