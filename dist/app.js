'use strict';
const localizedLabel=value=>globalThis.gameI18n?.display(value)??value;
const interfaceLocale=globalThis.gameI18n?.locale||'ru-RU';
const $=id=>document.getElementById(id),canvas=$('world'),gl=globalThis.mapGPU;
const PARCEL_STYLE_ROWS=GAME_MAP?256:64;
const WORLD_SCALE=WORLD_WIDTH/1100;
const MIN_MAP_ZOOM=.0023/WORLD_SCALE,MAX_MAP_ZOOM=.08;
const WAGON_DETAIL_ZOOM=Math.sqrt(MIN_MAP_ZOOM*MAX_MAP_ZOOM);
const SHIP_CLEARANCE=3.1;
const prog=gl.createMapProgram('world');gl.useProgram(prog);
const loc={p:gl.getAttribLocation(prog,'aPos'),c:gl.getAttribLocation(prog,'aColor'),edge:gl.getAttribLocation(prog,'aEdge'),center:gl.getUniformLocation(prog,'uCenter'),size:gl.getUniformLocation(prog,'uViewport'),scale:gl.getUniformLocation(prog,'uScale'),orientation:gl.getUniformLocation(prog,'uOrientation'),tilt:gl.getUniformLocation(prog,'uTilt'),tint:gl.getUniformLocation(prog,'uTint'),tintAmount:gl.getUniformLocation(prog,'uTintAmount'),captureOrigin:gl.getUniformLocation(prog,'uCaptureOrigin'),captureRadius:gl.getUniformLocation(prog,'uCaptureRadius'),captureStrength:gl.getUniformLocation(prog,'uCaptureStrength'),captureOld:gl.getUniformLocation(prog,'uCaptureOld'),captureOldMix:gl.getUniformLocation(prog,'uCaptureOldMix'),terrainDetail:gl.getUniformLocation(prog,'uTerrainDetail'),parcel:gl.getUniformLocation(prog,'uParcel'),paintPlots:gl.getUniformLocation(prog,'uPaintPlots'),parcelIndexReady:gl.getUniformLocation(prog,'uParcelIndexReady'),parcelIndexSize:gl.getUniformLocation(prog,'uParcelIndexSize'),parcelIndex:gl.getUniformLocation(prog,'uParcelIndex'),parcelStyle:gl.getUniformLocation(prog,'uParcelStyle'),showPlotBorders:gl.getUniformLocation(prog,'uShowPlotBorders'),andalusiaReady:gl.getUniformLocation(prog,'uAndalusiaReady'),hoverPlot:gl.getUniformLocation(prog,'uHoverPlot'),hoverValid:gl.getUniformLocation(prog,'uHoverValid'),water:gl.getUniformLocation(prog,'uWater'),roadDetail:gl.getUniformLocation(prog,'uRoadDetail'),roadMap:gl.getUniformLocation(prog,'uRoadMap'),time:gl.getUniformLocation(prog,'uTime'),ground:gl.getUniformLocation(prog,'uGround'),waterMap:gl.getUniformLocation(prog,'uWaterMap'),textureReady:gl.getUniformLocation(prog,'uTextureReady'),waterReady:gl.getUniformLocation(prog,'uWaterReady'),
 modelDetail:gl.getUniformLocation(prog,'uModelDetail'),materialMap:gl.getUniformLocation(prog,'uMaterialMap'),materialsReady:gl.getUniformLocation(prog,'uMaterialsReady'),
 shoreMap:gl.getUniformLocation(prog,'uShoreMap'),shoreReady:gl.getUniformLocation(prog,'uShoreReady')};gl.enableVertexAttribArray(loc.p);gl.enableVertexAttribArray(loc.c);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.066,.094,.106,1);
// Original map materials load asynchronously; a safe flat fallback is available immediately.
const textureLimit=Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE))||2048;
const anisotropy=gl.getExtension?.('EXT_texture_filter_anisotropic')||null;
let totalMapImages=0,loadedMapImages=0,mapImagesRegistered=false;
function reportMapMaterials(){
 if(mapImagesRegistered)globalThis.gameShell?.materials(totalMapImages,loadedMapImages);
}
function queueMapImage(path,upload){
 if(typeof Image==='undefined')return;
 totalMapImages++;
 const img=new Image();
 function settle(){
  loadedMapImages++;reportMapMaterials();
 }
 img.onload=()=>{
  try{upload(img)}
  catch(error){console.warn('Не удалось применить материал карты',path,error)}
  finally{settle()}
 };
 img.onerror=()=>{console.warn('Не удалось загрузить материал карты',path);settle()};
 img.src=path;
}

function loadMapTexture(path,unit,repeat=true,preserveSize=false){
 const asset={texture:gl.createTexture(),ready:false};
 gl.activeTexture(gl.TEXTURE0+unit);
 gl.bindTexture(gl.TEXTURE_2D,asset.texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 queueMapImage(path,img=>{
    const originalWidth=img.naturalWidth||img.width||1024,originalHeight=img.naturalHeight||img.height||1024;
    const ratio=Math.min(1,textureLimit/Math.max(originalWidth,originalHeight));
    const width=Math.max(1,Math.round(originalWidth*ratio));
    const height=Math.max(1,Math.round(originalHeight*ratio));
    let tile=img;
    if(width!==originalWidth||height!==originalHeight){
     tile=document.createElement('canvas');tile.width=width;tile.height=height;
     const ctx=tile.getContext('2d');
     if(!ctx)return;
     ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,width,height);
    }
    gl.activeTexture(gl.TEXTURE0+unit);
    gl.bindTexture(gl.TEXTURE_2D,asset.texture);
    const format=preserveSize?gl.LUMINANCE:gl.RGBA;
    gl.texImage2D(gl.TEXTURE_2D,0,format,format,gl.UNSIGNED_BYTE,tile);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,preserveSize?gl.LINEAR:gl.LINEAR_MIPMAP_LINEAR);
    if(!preserveSize){
     gl.generateMipmap(gl.TEXTURE_2D);
     if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    asset.ready=true;
 });
 return asset;
}
const groundAsset=loadMapTexture((GAME_MAP?'maps/'+GAME_MAP.id+'/':'')+'terrain-meadow.png',0,false),waterAsset=loadMapTexture('terrain-water.png',1),forestAsset=loadMapTexture('maps/mediterranean/woodland.png',2,false),forestSpruceAsset=loadMapTexture('forest-spruce.png',3,false);
const closeGroundAsset=loadMapTexture('terrain-close.png',2);
const meadowBrushAsset=loadMapTexture('terrain-painted-meadow.png',16);
const materialsAsset=loadMapTexture('terrain-materials.png',4);
const paintedMaterials=loadMapTexture('terrain-andalusia-materials.png',12);
const habitatAsset=loadMapTexture((GAME_MAP?'maps/'+GAME_MAP.id+'/':'')+'terrain-habitats.png',14,false);

const shoreAsset=loadMapTexture((GAME_MAP?'maps/'+GAME_MAP.id+'/':'')+'terrain-shore.png',5,false,true);
// A repeatable cart-road material is sampled in world space by road meshes:
// warm packed sand with pebbles, fine speckle and faint damp patches — the
// wheel ruts themselves are drawn by the shader along the road direction.
function makeRoadTexture(){
 const n=256,data=new Uint8Array(n*n*4);
 const hash=(x,z)=>{let h=(x*374761393+z*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296};
 const vnoise=(x,z)=>{
  const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  const sx=xf*xf*(3-2*xf),tz=zf*zf*(3-2*zf);
  const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);
  return a+(b-a)*sx+(c-a)*tz+(a-b-c+d)*sx*tz;
 };
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const coarse=vnoise(x/40,z/40),fine=vnoise(x/6.5+3,z/6.5-1);
  const patch=vnoise(x/70+17,z/70+5);
  const pebble=hash(x*3.7+1,z*3.7);
  const grain=.85+coarse*.17+fine*.12+(pebble>.94?.19:0)+(patch-.5)*.085;
  const i=(z*n+x)*4;
  data[i]=Math.min(255,Math.round(223*grain));
  data[i+1]=Math.min(255,Math.round(198*grain));
  data[i+2]=Math.min(255,Math.round(147*grain));
  data[i+3]=255;
 }
 let texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+4);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);return texture
}
const roadTexture=makeRoadTexture();
const pilotLand=typeof ANDALUSIA==='undefined'?null:ANDALUSIA;
const floodplainAsset=loadMapTexture('forest-floodplain.png',2,false);
const woodlandAsset=forestAsset;
const oliveAsset=pilotLand?loadMapTexture('maps/mediterranean/olive-trees.png',2,false):null;
const andalusiaAsset=pilotLand?loadMapTexture('maps/mediterranean/andalusia-ground.png',3,false):null;
// Pixel-exact parcel IDs: sampled while rendering the original terrain triangles.
function createParcelIndex(){
 const limit=Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE))||2048;
 const precision=gl.getShaderPrecisionFormat?.(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
 const width=limit>=4096&&precision?.precision>0?4096:2048;
 const asset={texture:gl.createTexture(),width,height:Math.round(width*WORLD_HEIGHT/WORLD_WIDTH),ready:false};
 const bind=()=>{gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,asset.texture)};
 bind();
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 queueMapImage((GAME_MAP?'maps/'+GAME_MAP.id+'/':'')+'parcel-index-'+width+'.png',img=>{
  bind();
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);asset.ready=true}
  finally{gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.BROWSER_DEFAULT_WEBGL)}
 });
 return asset;
}
const parcelIndexAsset=createParcelIndex(),parcelStyleTexture=gl.createTexture(),parcelAnchorTexture=gl.createTexture();
let parcelStylePixels=null;
function updateParcelStyles(all){let pixels=new Uint8Array(32*PARCEL_STYLE_ROWS*4),types={grain:1,wood:2,iron:3,cloth:4,city:5,port:6};for(const r of state.regions)for(const q of r.slots){let x=q.id+1,y=r.id+1;if(x>=32||y>=PARCEL_STYLE_ROWS)continue;let i=(y*32+x)*4;pixels[i+2]=r.owner==='you'?255:0;pixels[i+3]=r.id===pilotLand?.region?160:255}for(const {r,b,slot} of all){let x=slot.id+1,y=r.id+1;if(x>=32||y>=PARCEL_STYLE_ROWS)continue;let i=(y*32+x)*4;pixels[i]=types[b.type]||0;pixels[i+1]=b.type==='grain'?Math.min(3,Math.max(1,b.level||1))+farmVariation(r,slot)*4:b.level||1}parcelStylePixels=pixels;gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,parcelStyleTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,32,PARCEL_STYLE_ROWS,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
function uploadParcelAnchors(){
 const width=32,data=new Uint8Array(width*PARCEL_STYLE_ROWS*4);
 for(const r of state.regions)for(const slot of r.slots){
  const col=slot.id+1,row=r.id+1;
  if(col>=width||row>=PARCEL_STYLE_ROWS)continue;
  const x=Math.round(slot.x/WORLD_WIDTH*65535),z=Math.round(slot.z/WORLD_HEIGHT*65535);
  data.set([x>>8,x&255,z>>8,z&255],(row*width+col)*4);
 }
 gl.activeTexture(gl.TEXTURE0+12);gl.bindTexture(gl.TEXTURE_2D,paintedMaterials.texture);
 gl.activeTexture(gl.TEXTURE0+14);gl.bindTexture(gl.TEXTURE_2D,habitatAsset.texture);
 gl.activeTexture(gl.TEXTURE0+13);gl.bindTexture(gl.TEXTURE_2D,parcelAnchorTexture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,PARCEL_STYLE_ROWS,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
}

const FACTION_COLORS={you:[.84,.67,.34],bot:[.69,.32,.28],bot2:[.43,.44,.68],bot3:[.43,.60,.30]};
function rivalColor(index){
 const hue=(index*.618034+.48)%1;
 return [0,4,2].map(offset=>{
  const segment=(hue*6+offset)%6;
  return .38+.37*Math.max(0,Math.min(segment,4-segment,1));
 });
}
const paletteCss=color=>'rgb('+color.map(value=>Math.round(value*255)).join(',')+')';
function factionCss(owner){return paletteCss(FACTION_COLORS[owner]);}
function colorUnitMarker(marker,owner,house=null){
 const key=house?owner+'>'+house.id:owner;
 if(marker.dataset.faction===key)return;
 marker.dataset.faction=key;
 marker.style.setProperty('--unit-faction',house?paletteCss(house.color):FACTION_COLORS[owner]?factionCss(owner):'#718784');
}
const DEFAULT_CAMERA_TILT=.85;
$('setup-scenario').textContent=GAME_MAP?.name||'Речь Посполитая';
function startingCamera(){return {...(GAME_MAP?.camera||{x:430,z:330,scale:.0035}),yaw:0,tilt:DEFAULT_CAMERA_TILT}}
const actionExplanation=new WeakMap(),actionExplanationFrames=new WeakMap();
let actionExplanationTarget=null;
function explainAction(control,title,details){
 if(!control||!details)return;
 let target=actionExplanationFrames.get(control);
 if(!target&&control.tagName==='BUTTON'&&control.disabled&&control.parentElement){
  target=document.createElement('span');
  target.className='explain-frame';
  control.parentElement.insertBefore(target,control);target.appendChild(control);
  actionExplanationFrames.set(control,target);
 }
 if(target){
  delete control.dataset.actionExplanation;
  target.tabIndex=control.disabled?0:-1;
  control.setAttribute('aria-describedby','action-tooltip');
 }
 target||=control;
 target.dataset.actionExplanation='';
 target.setAttribute('aria-describedby','action-tooltip');
 control.removeAttribute?.('title');
 actionExplanation.set(target,{title,details});
 if(target===actionExplanationTarget)showActionExplanation(target);
 return target;
}
function hideActionExplanation(){
 actionExplanationTarget=null;
 $('action-tooltip').hidden=true;
}
const gameStatTokens={
 grain:'зерн[а-яё]*',wood:'древесин[а-яё]*|дер\\.',iron:'желез[а-яё]*|жел\\.',cloth:'ткан[а-яё]*',
 gold:'зл\\.(?:\\s*/\\s*мин)?|золот[а-яё]*|казн[а-яё]*',jobs:'рабочи[а-яё]*\\s+мест[а-яё]*|ваканси[а-яё]*',
 housing:'жиль[а-яё]*|мест\\s+жилья|жилых\\s+мест',income:'доход[а-яё]*|выручк[а-яё]*|налог[а-яё]*',
 military:'солдат[а-яё]*|гарнизон[а-яё]*|вооружени[а-яё]*|снаряжени[а-яё]*',loss:'штраф[а-яё]*|дефицит[а-яё]*|порч[а-яё]*'
};
const statNumber='[+−-]?\\d+(?:[., \u00a0\u202f]\\d+)*(?:\\s*(?:→|/)\\s*\\d+(?:[., \u00a0\u202f]\\d+)*)?';
const gameStatPattern=new RegExp(Object.entries(gameStatTokens).map(([key,words])=>
 '(?<'+key+'>(?<![\\p{L}\\d])(?:'+statNumber+'\\s*(?:ед\\.\\s*)?)?(?:'+words+')(?![\\p{L}]))').join('|'),'giu');
function setGameStatText(node,value){
 if(node.textContent===value&&node.dataset.statText===value)return;
 const parts=document.createDocumentFragment();
 let index=0;
 for(const match of value.matchAll(gameStatPattern)){
  parts.append(value.slice(index,match.index));
  const token=document.createElement('span');
  token.dataset.gameStat=Object.keys(match.groups).find(key=>match.groups[key]!==undefined);
  if(/^[−-]/.test(match[0]))token.dataset.trend='negative';
  token.textContent=match[0];parts.append(token);
  index=match.index+match[0].length;
 }
 parts.append(value.slice(index));
 node.dataset.statText=value;
 node.replaceChildren(parts);
}
function showActionExplanation(target){
 const help=actionExplanation.get(target);
 if(!help)return;
 if(!target.getClientRects?.().length){hideActionExplanation();return}
 actionExplanationTarget=target;
 const popup=$('action-tooltip');
 $('action-tooltip-title').textContent=help.title;
 setGameStatText($('action-tooltip-body'),help.details);
 popup.hidden=false;
 const bounds=target.getBoundingClientRect(),size=popup.getBoundingClientRect(),viewport=document.documentElement;
 const left=Math.max(8,Math.min(bounds.left,viewport.clientWidth-size.width-8));
 const below=bounds.bottom+8,top=below+size.height<=viewport.clientHeight-8?below:Math.max(8,bounds.top-size.height-8);
 popup.style.left=left+'px';popup.style.top=top+'px';
}
const explanationOwner=event=>event.target.closest?.('[data-action-explanation]');
for(const type of ['pointerover','focusin'])document.addEventListener?.(type,event=>{
 if(event.pointerType==='touch')return;
 const target=explanationOwner(event);
 if(target)showActionExplanation(target);
});
for(const type of ['pointerout','focusout'])document.addEventListener?.(type,event=>{
 if(!actionExplanationTarget||actionExplanationTarget!==explanationOwner(event))return;
 if(event.relatedTarget&&actionExplanationTarget.contains(event.relatedTarget))return;
 hideActionExplanation();
});
document.addEventListener?.('scroll',hideActionExplanation,true);
document.addEventListener?.('keydown',event=>{if(event.key==='Escape')hideActionExplanation()});
function useActionTitles(entries){
 for(const [id,title,fallback] of entries){
  const button=$(id);
  if(!button.hidden&&(button.title||fallback))explainAction(button,title,button.title||fallback);
 }
}

let state={regions:HISTORICAL_REGIONS.map(initRegion),gold:450,started:false,selected:null,visualJobs:[]},cam=startingCamera(),mode=null,hover=null,hoverRegion=null,drag=null,dirtyLabels=true,ghost=null;globalThis.__gameState=state;
uploadParcelAnchors();
function updateBotSetup(){
 const slider=$('bot-count'),max=Math.max(1,state.regions.length-1);
 const requested=Number(slider.value||3);
 const count=Math.max(1,Math.min(max,Number.isFinite(requested)?Math.round(requested):3));
 slider.max=String(max);
 slider.value=String(count);
 $('bot-count-value').textContent=String(count);
 const available=state.regions.length-1-count;
 $('bot-count-hint').textContent=globalThis.gameI18n?.text('Свободные герцогства после старта: {0}',available)??('Свободные герцогства после старта: '+available);
 return count;
}
$('bot-count').oninput=updateBotSetup;
updateBotSetup();
updateParcelStyles([]);
const colors={field:[.63,.68,.47],forest:[.32,.48,.35],mountain:[.55,.56,.49]},ownerColors={you:[.14,.12,.045]};
function vertex(out,x,y,z,c){out.push(x,y,z,c[0],c[1],c[2])}
function tri(out,a,b,c,col){vertex(out,...a,col);vertex(out,...b,col);vertex(out,...c,col)}
function quad(out,a,b,c,d,col){tri(out,a,b,c,col);tri(out,a,c,d,col)}
function tint(c,f){return c.map(v=>Math.min(1,Math.max(0,v*f)))}
function makeBuffer(values){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);return {buffer:b,count:values.length/6}}
function drawBuffer(b,kind=gl.TRIANGLES,weights=null,edge=0){if(!b||!b.count)return;gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(loc.c,3,gl.FLOAT,false,24,12);if(weights){gl.bindBuffer(gl.ARRAY_BUFFER,weights.buffer);gl.enableVertexAttribArray(loc.edge);gl.vertexAttribPointer(loc.edge,1,gl.FLOAT,false,4,0)}else{gl.disableVertexAttribArray(loc.edge);gl.vertexAttrib1f(loc.edge,edge)}gl.drawArrays(kind,0,b.count)}
const regionMeshes=new Map(),terrainSummary=new Map(),placementMeshes=new Map();
let terrainMinHeight=Infinity,terrainMaxHeight=-Infinity;
function mixColor(a,b,t){return a.map((v,i)=>v*(1-t)+b[i]*t)}
// The strip is generated only where a region meets open sea.
// Bake a spatial index of genuine open-water coast segments once. Ground height,
// sand and all map objects then use the same smoothly sloped surface.
function makeCoastIndex(){const buckets=new Map(),segments=[];const sea=(x,z)=>isSeaBackground(x,z)&&(GAME_MAP||!regionAt(state.regions,x,z)),key=(x,z)=>x+','+z;for(const poly of GAME_MAP?SCENARIO_LAND:state.regions.flatMap(r=>r.polys))for(const ring of poly)for(let i=0;i<ring.length;i++){let a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;let nx=-dz/len,nz=dx/len,n=Math.ceil(len/2);for(let j=0;j<n;j++){let t=j/n,u=(j+1)/n,m=(t+u)/2,x=a[0]+dx*m,z=a[1]+dz*m;let offset=GAME_MAP?.id==='mediterranean'?.24:2;if(sea(x+nx*offset,z+nz*offset)===sea(x-nx*offset,z-nz*offset))continue;let seg=[a[0]+dx*t,a[1]+dz*t,a[0]+dx*u,a[1]+dz*u];segments.push(seg);let k=key(Math.floor(x/12),Math.floor(z/12));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(seg)}}return {buckets,segments}}
const coastIndex=makeCoastIndex();
function coastDistance(x,z){let best=12,cx=Math.floor(x/12),cz=Math.floor(z/12);for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){let group=coastIndex.buckets.get((cx+i)+','+(cz+j));if(!group)continue;for(const [ax,az,bx,bz] of group){let dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-ax-t*dx,z-az-t*dz);if(d<best)best=d}}return best}
function localRelief(x,z,base){
 const p=pilotLand;
 if(!p)return base;
 const u=(x-p.x)/p.w,v=(z-p.z)/p.h;
 if(u<=0||v<=0||u>=1||v>=1)return base;
 const gx=u*(p.cols-1),gz=v*(p.rows-1),ix=Math.floor(gx),iz=Math.floor(gz);
 const i=iz*p.cols+ix,tx=gx-ix,tz=gz-iz,h=p.heights;
 const lower=h[i]+tx*(h[i+1]-h[i]),upper=h[i+p.cols]+tx*(h[i+p.cols+1]-h[i+p.cols]);
 const t=Math.min(1,Math.min(u*p.w,(1-u)*p.w,v*p.h,(1-v)*p.h)/8);
 return base+(0.05*(lower+tz*(upper-lower))-base)*t*t*(3-2*t);
}
const landscapeGrid=typeof TERRAIN_RELIEF==='undefined'?null:{
 cols:TERRAIN_RELIEF.cols,rows:TERRAIN_RELIEF.rows,bytes:atob(TERRAIN_RELIEF.data)
};
function landscapeSample(x,z,forest=false){
 const {cols,rows,bytes}=landscapeGrid;
 const u=Math.max(0,Math.min(cols-1,x/WORLD_WIDTH*(cols-1)));
 const v=Math.max(0,Math.min(rows-1,z/WORLD_HEIGHT*(rows-1)));
 const col=Math.min(cols-2,Math.floor(u)),row=Math.min(rows-2,Math.floor(v));
 const i=(row*cols+col)*3,step=3*cols,tx=u-col,tz=v-row;
 function at(offset){
  if(forest)return bytes.charCodeAt(offset+2)/255;
  return (bytes.charCodeAt(offset)+256*bytes.charCodeAt(offset+1))/256;
 }
 const a=at(i)+(at(i+3)-at(i))*tx,b=at(i+step)+(at(i+step+3)-at(i+step))*tx;
 return a+(b-a)*tz;
}
function landscapeRelief(x,z){
 if(landscapeGrid)return landscapeSample(x,z);
 const height=terrainHeight(x,z);
 if(GAME_MAP)return height;
 const profile=Math.max(0,Math.min(1,(x-555)/274));
 const flatten=profile*profile*(3-2*profile);
 return height*(1-flatten*.79)+flatten*6.15;
}
function surfaceHeight(x,z){
 const h=landscapeRelief(x,z),t=Math.min(1,coastDistance(x,z)/6);
 return -1+localRelief(x,z,.08+.19*h)*t*t*(3-2*t);
}
// World-space moisture and warmth samples. The material baker reads these same anchors.
const REGIONAL_CLIMATE={
 "baltic":{"reach":151,"anchors":[
   [174,300,0.83,0.31],
   [500,182,0.85,0.24],
   [570,265,0.8,0.31],
   [330,403,0.71,0.39],
   [122,424,0.64,0.42],
   [295,501,0.76,0.42],
   [533,533,0.69,0.43],
   [740,458,0.65,0.45],
   [866,534,0.45,0.58],
   [1045,624,0.39,0.62],
   [760,699,0.47,0.57]
 ]},
 "mediterranean":{"reach":147,"anchors":[
   [66,584,0.79,0.62],
   [180,419,0.78,0.49],
   [303,511,0.43,0.68],
   [283,700,0.49,0.75],
   [475,541,0.48,0.68],
   [605,362,0.69,0.54],
   [747,192,0.82,0.35],
   [929,208,0.84,0.29],
   [995,325,0.67,0.57],
   [1050,650,0.53,0.72],
   [1243,332,0.76,0.43],
   [1340,494,0.66,0.53],
   [1530,593,0.52,0.67],
   [1775,475,0.62,0.59],
   [1938,506,0.39,0.62],
   [1954,675,0.53,0.7],
   [2104,770,0.43,0.77],
   [2150,939,0.22,0.88],
   [209,774,0.63,0.73],
   [233,964,0.28,0.84],
   [110,1088,0.13,0.89],
   [595,799,0.55,0.72],
   [925,749,0.47,0.77],
   [1057,960,0.15,0.92],
   [1410,923,0.2,0.86],
   [1618,1000,0.1,0.93],
   [1838,1052,0.12,0.91],
   [1919,1110,0.09,0.93]
 ]}
};
const campaignClimate=REGIONAL_CLIMATE[GAME_MAP?'mediterranean':'baltic'];
function landscapeClimate(x,z){
 let moisture=0,warmth=0,total=0;
 for(const [cx,cz,wet,warm] of campaignClimate.anchors){
  const weight=Math.exp(-((x-cx)**2+(z-cz)**2)/campaignClimate.reach**2);
  moisture+=weight*wet;warmth+=weight*warm;total+=weight;
 }
 moisture=total>1e-7?moisture/total:.46;
 warmth=total>1e-7?warmth/total:.50;
 if(GAME_MAP&&z>1000&&x>1770&&x<1920){
  const river=1858+(z-1034)*.34+3.8*Math.sin((z-1018)*.101);
  const irrigation=Math.exp(-(((x-river)/(5+18*Math.max(0,1-(z-1030)/63)))**2));
  moisture+=(1-moisture)*irrigation*.71*Math.min(1,(z-1000)/24);
 }
 return {moisture,warmth};
}
function isDryArchitecture(climate){
 return climate.warmth>.80||(climate.warmth>.73&&climate.moisture<.52);
}
function landscapeColor(x,z){
 const f=terrainFeatures(x,z),height=landscapeRelief(x,z);
 const woodland=Math.max(0,Math.min(1,(-f.forest+.04)*1.12));
 const roll=.5+.5*Math.sin(x*.037+Math.cos(z*.026))*Math.cos(z*.032-x*.009);
 const south=GAME_MAP?Math.max(0,Math.min(1,(z/WORLD_HEIGHT-.24)*1.49)):0;
 const meadow=GAME_MAP?mixColor([.37,.50,.34],[.61,.55,.34],south):[.37,.49,.36];
 let color=mixColor(meadow,[.49,.53,.34],roll*.37);
 color=mixColor(color, GAME_MAP?[.29,.39,.28]:[.24,.37,.32],woodland*(.77-south*.19));
 const foothill=Math.max(0,Math.min(1,(height-8)/25));
 const highland=Math.max(0,Math.min(1,(height-23)/32));
 const summit=Math.max(0,Math.min(1,(height-49)/28));
 color=mixColor(color,[.43,.43,.35],foothill*.65);
 color=mixColor(color,[.48,.47,.43],highland*.81);
 color=mixColor(color,[.71,.68,.60],summit*.78);
 const dx=landscapeRelief(x+3,z)-landscapeRelief(x-3,z),dz=landscapeRelief(x,z+3)-landscapeRelief(x,z-3);
 const grade=Math.max(-.31,Math.min(.22,(dx*.047+dz*.030)*(.46+foothill*.54)));
 return mixColor(tint(color,1+grade),[.27,.34,.36],Math.max(0,-grade)*.35);
}
// Refinement decisions depend on the edge alone, so adjoining provinces share their relief.
function refineRegionalMesh(mesh){
 const p=pilotLand;
 const intersectsPilot=p&&state.regions.find(r=>r.id===mesh.id).bounds.some(
  b=>b[0]<p.x+p.w&&b[2]>p.x&&b[1]<p.z+p.h&&b[3]>p.z);
 if(!landscapeGrid&&!intersectsPilot)return mesh;
 const vertices=mesh.v.slice(),midpoints=new Map();
 const heights=landscapeGrid?Array.from({length:vertices.length/2},(_,i)=>landscapeRelief(vertices[i*2],vertices[i*2+1])):null;
 function midpoint(i,j){
  const key=Math.min(i,j)+':'+Math.max(i,j);
  if(midpoints.has(key))return midpoints.get(key);
  const ax=vertices[i*2],az=vertices[i*2+1],bx=vertices[j*2],bz=vertices[j*2+1];
  const length=(ax-bx)**2+(az-bz)**2;
  if(length<=2.8**2)return -1;
  const x=(ax+bx)*.5,z=(az+bz)*.5;
  const local=intersectsPilot&&x>=p.x&&x<=p.x+p.w&&z>=p.z&&z<=p.z+p.h;
  const height=heights?landscapeRelief(x,z):0;
  const curved=heights&&length>3.65**2&&Math.abs(height-(heights[i]+heights[j])*.5)>(GAME_MAP?.70:.62);
  if(!local&&!curved&&!(heights&&length>(GAME_MAP?13.2**2:6.35**2))){
   midpoints.set(key,-1);
   return -1;
  }
  const index=vertices.length/2;
  vertices.push(x,z);if(heights)heights.push(height);
  midpoints.set(key,index);
  return index;
 }
 let indices=mesh.i;
 // Split marked edges simultaneously. Bounded passes also handle narrow coastal slivers.
 for(let pass=0;pass<3;pass++){
  const refined=[];
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i],b=indices[i+1],c=indices[i+2];
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   if(ab>=0&&bc>=0&&ca>=0)refined.push(a,ab,ca,ab,b,bc,bc,c,ca,ab,bc,ca);
   else if(ab>=0&&bc>=0)refined.push(a,ab,bc,ab,b,bc,a,bc,c);
   else if(bc>=0&&ca>=0)refined.push(b,bc,ca,bc,c,ca,b,ca,a);
   else if(ca>=0&&ab>=0)refined.push(c,ca,ab,ca,a,ab,c,ab,b);
   else if(ab>=0)refined.push(a,ab,c,ab,b,c);
   else if(bc>=0)refined.push(b,bc,a,bc,c,a);
   else if(ca>=0)refined.push(c,ca,b,ca,a,b);
   else refined.push(a,b,c);
  }
  if(refined.length===indices.length)break;
  indices=refined;
 }
 return {...mesh,v:vertices,i:indices};
}
const surfaceMeshes=pilotLand||landscapeGrid?TERRAIN_MESH.map(refineRegionalMesh):TERRAIN_MESH;
function createTerrain(){
 for(let i=0;i<surfaceMeshes.length;i++){
  const mesh=surfaceMeshes[i],base=TERRAIN_MESH[i],vertices=[],cache=[],counts={field:0,forest:0,mountain:0};
  const positions=new Float32Array(mesh.v.length/2*3);
  for(let j=0;j<mesh.v.length;j+=2){
   const x=mesh.v[j],z=mesh.v[j+1],y=surfaceHeight(x,z);
   cache.push({x,z,y,color:landscapeColor(x,z)});
   const offset=j/2*3;
   positions[offset]=x;
   positions[offset+1]=y;
   positions[offset+2]=z;
   terrainMinHeight=Math.min(terrainMinHeight,y);
   terrainMaxHeight=Math.max(terrainMaxHeight,y);
  }
  for(const index of mesh.i){
   const p=cache[index];
   vertex(vertices,p.x,p.y,p.z,p.color);
  }
  // These statistics describe the base terrain, independent of display subdivision.
  for(let j=0;j<base.i.length;j+=3){
   const a=cache[base.i[j]],b=cache[base.i[j+1]],c=cache[base.i[j+2]];
   const size=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
   counts[terrainAt((a.x+b.x+c.x)/3,(a.z+b.z+c.z)/3)]+=size;
  }
  regionMeshes.set(mesh.id,makeBuffer(vertices));
  terrainSummary.set(mesh.id,counts);
  placementMeshes.set(mesh.id,{positions,indices:mesh.i});
 }
}

function cube(out,x,y,z,w,h,d,col){let a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2],A=[a[0],y+h,a[2]],B=[b[0],y+h,b[2]],C=[c[0],y+h,c[2]],E=[e[0],y+h,e[2]];quad(out,A,B,C,E,tint(col,1.15));quad(out,a,b,B,A,tint(col,.83));quad(out,b,c,C,B,tint(col,.7));quad(out,c,e,E,C,tint(col,.76));quad(out,e,a,A,E,tint(col,.92))}
function cone(out,x,y,z,r,h,col,sides=6){let top=[x,y+h,z];for(let i=0;i<sides;i++){let a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;tri(out,[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],top,tint(col,.84+.14*(i%3)))}}
function timberBeam(out,a,b,width,col){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
 if(length<1e-5)return;
 const horizontal=Math.hypot(dx,dz),u=horizontal?[dz/horizontal,0,-dx/horizontal]:[1,0,0];
 const v=[(dy*u[2]-dz*u[1])/length,(dz*u[0]-dx*u[2])/length,(dx*u[1]-dy*u[0])/length];
 const corners=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([s,t])=>p.map((n,i)=>n+(u[i]*s+v[i]*t)*width/2));
 const p=corners(a),q=corners(b);
 for(let i=0;i<4;i++){const j=(i+1)%4;quad(out,p[i],p[j],q[j],q[i],tint(col,[.83,.69,.9,1.08][i]))}
 quad(out,q[0],q[1],q[2],q[3],col);
}
function roundTimber(out,x,y,z,length,radius,col,sides=10){
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
  const p=[x-length/2,y+Math.cos(a)*radius,z+Math.sin(a)*radius],q=[x-length/2,y+Math.cos(b)*radius,z+Math.sin(b)*radius];
  quad(out,p,[p[0]+length,p[1],p[2]],[q[0]+length,q[1],q[2]],q,tint(col,.77+.30*Math.max(0,Math.cos(a))));
  tri(out,[x+length/2,y,z],[p[0]+length,p[1],p[2]],[q[0]+length,q[1],q[2]],tint(col,1.17));
 }
}
function tiledRoof(out,x,y,z,w,d,rise,col){
 const e=w/2,z0=z-d/2,z1=z+d/2;
 tri(out,[x-e,y,z0],[x+e,y,z0],[x,y+rise,z0],tint(col,.79));
 tri(out,[x-e,y,z1],[x+e,y,z1],[x,y+rise,z1],tint(col,.91));
 for(const side of [-1,1]){
  const point=(t,z)=>[x+e*side*(1-t),y+rise*t,z];
  for(let row=0;row<5;row++){
   const a=row/5,b=(row+1)/5;
   quad(out,point(a,z0),point(b,z0),point(b,z1),point(a,z1),tint(col,(side===1?.83:1.1)*(1+(row%3-1)*.08)));
   if(row<4)timberBeam(out,point(b,z0),point(b,z1),.10,tint(col,.76));
  }
 }
 timberBeam(out,[x,y+rise,z0-.06],[x,y+rise,z1+.06],.24,tint(col,1.18));
}
function buildingHouse(out,x,y,z,w,h,d,wall,roofColor){
 const timber=[.29,.22,.16],glass=[.16,.20,.19],trim=[.56,.48,.36],front=z+d/2;
 cube(out,x,y,z,w,h,d,wall);
 cube(out,x,y,z,w+.35,.52,d+.3,trim);
 tiledRoof(out,x,y+h,z,w+.85,d+.85,Math.min(4.1,w*.41),roofColor);
 for(const sign of [-1,1]){
  const corner=x+sign*(w/2-.22),window=x+sign*w*.26;
  cube(out,corner,y+.36,front+.08,.30,h-.30,.20,timber);
  cube(out,window,y+h*.58,front+.15,Math.max(.62,w*.19),h*.23,.16,trim);
  cube(out,window,y+h*.61,front+.25,Math.max(.42,w*.13),h*.17,.10,glass);
  cube(out,window,y+h*.61,front+.32,.10,h*.17,.08,timber);
  timberBeam(out,[corner,y+h*.53,front+.18],[window,y+h*.35,front+.18],.15,timber);
  cube(out,x+sign*(w/2+.08),y+h*.43,z,.19,.26,d,timber);
  cube(out,x+sign*(w/2+.10),y+h*.59,z-d*.15,.23,h*.23,Math.max(.45,d*.18),trim);
  cube(out,x+sign*(w/2+.24),y+h*.62,z-d*.15,.12,h*.17,Math.max(.30,d*.12),glass);
 }
 cube(out,x,y+.36,front+.13,Math.max(.65,w*.19),h*.41,.22,timber);
 cube(out,x,y+h*.45,front+.13,w,.22,.22,timber);
 cube(out,x-w*.24,y+h*.9,z-d*.14,.78,h*.58,.86,trim);
 cube(out,x-w*.24,y+h*1.44,z-d*.14,.98,.24,1,timber);
}
// Buildings are authored in model units; each independent structure sits on its own footing.
function farmFooting(b,dx,dz){
 const s=b.scale??.34;
 return (surfaceHeight(b.x+dx*s,b.z+dz*s)-surfaceHeight(b.x,b.z))/s;
}
const farmPlaster=[.85,.80,.65],farmStone=[.52,.49,.39],farmOak=[.34,.235,.15];
function hippedFarmRoof(out,x,y,z,w,d,rise){
 const tile=[.66,.351,.224],e=w*.5,hip=Math.min(w*.26,d*.36),half=d*.5;
 // Short hips and unequal courses keep the long ridge legible at the normal camera angle.
 for(const side of [-1,1]){
  const p=(t,k)=>[x+(2*k-1)*(e-hip*t),y+rise*t,z+side*half*(1-t)];
  const rows=6,columns=Math.max(5,Math.round(w/.88));
  for(let row=0;row<rows;row++){
   for(let col=0;col<=columns;col++){
    const a=Math.max(0,(col-(row%2)*.5)/columns),b=Math.min(1,(col+1-(row%2)*.5)/columns);
    if(b<=a)continue;
    const low=row/rows,high=(row+1)/rows,exposure=side>0?.93:1.09;
    const shade=.925+.115*(.5+.5*Math.sin(col*13.3+row*28.9+x));
    quad(out,p(low,a),p(low,b),p(high,b),p(high,a),tint(tile,exposure*shade));
   }
  }
  // Clay barrel tiles catch light lengthwise down the pitch.
  const ribs=Math.ceil(w/.56);
  for(let n=1;n<ribs;n++){
   const k=n/ribs,half=.061/w;
   const lo=p(0,k),hi=p(1,k);
   lo[1]+=.065;hi[1]+=.065;
   quad(out,p(0,k-half),lo,hi,p(1,k-half),tint(tile,1.13));
   quad(out,lo,p(0,k+half),p(1,k+half),hi,tint(tile,.92));
  }
  timberBeam(out,p(0,0),p(0,1),.23,[.46,.25,.17]);
  const end=x+side*e,peak=x+side*(e-hip);
  tri(out,[end,y,z-half],[end,y,z+half],[peak,y+rise,z],tint(tile,side>0?.83:.97));
  for(const sign of [-1,1])timberBeam(out,[end,y,z+sign*half],[peak,y+rise,z],.15,tint(tile,1.15));
 }
 roundTimber(out,x,y+rise,z,w-2*hip+.28,.17,[.70,.402,.25],8);
}
function farmRange(out,x,y,z,w,d,h,barn=false){
 const front=z+d/2,door=barn?w*.39:1.26;
 cube(out,x,y-1.45,z,w+.16,1.65,d+.16,farmStone);
 cube(out,x,y+.2,z,w,h-.2,d,barn?[.69,.60,.46]:farmPlaster);
 hippedFarmRoof(out,x,y+h,z,w+.86,d+.92,Math.min(2.1,d*.39));
 cube(out,x,y+.11,front+.03,door+.34,h*.80,.22,[.48,.43,.34]);
 cube(out,x,y+.15,front+.17,door,h*.72,.14,[.22,.17,.115]);
 if(barn){
  for(const side of [-1,1]){
   const bx=x+side*door*.29;
   cube(out,bx,y+.15,front+.28,door*.38,h*.69,.14,farmOak);
   timberBeam(out,[bx-door*.16,y+.35,front+.39],[bx+door*.16,y+h*.65,front+.39],.17,[.56,.41,.25]);
  }
  cube(out,x,y+h*.82,front+.19,w*.74,.30,.22,farmOak);
 }else{
  for(const side of [-1,1]){
   const bx=x+side*w*.32,shade=[.23,.34,.28];
   cube(out,bx,y+h*.41,front+.10,1.00,1.15,.18,[.20,.22,.18]);
   for(const shutter of [-1,1])cube(out,bx+shutter*.60,y+h*.41,front+.18,.25,1.18,.17,shade);
   cube(out,bx,y+h*.39,front+.21,1.55,.15,.34,farmStone);
  }
  cube(out,x-w*.28,y+h+.45,z-.32,.86,2.35,.83,farmPlaster);
  cube(out,x-w*.28,y+h+2.65,z-.32,1.13,.25,1.05,[.51,.31,.20]);
 }
}
function farmRing(out,x,y,z,rings,col){
 const sides=16;
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
  const point=([height,radius],t)=>[x+radius*Math.cos(t),y+height,z+radius*Math.sin(t)];
  const sun=.90+.17*Math.cos((a+b)/2+1.15);
  for(let j=1;j<rings.length;j++)
   quad(out,point(rings[j-1],a),point(rings[j-1],b),point(rings[j],b),point(rings[j],a),tint(col,sun));
 }
}
function grainSack(out,x,y,z,size){
 const cloth=[.73,.64,.45];
 farmRing(out,x,y,z,[[0,.41*size],[.19*size,.61*size],[.72*size,.55*size],
  [.96*size,.19*size],[1.11*size,.23*size],[1.13*size,.02*size]],cloth);
 farmRing(out,x,y,z,[[.92*size,.22*size],[1.01*size,.22*size]],farmOak);
}
function millSails(out,cx,cy,cz,s,angle){
 for(let i=0;i<4;i++){
  const a=angle+i*Math.PI/2,co=Math.cos(a),si=Math.sin(a);
  const p=(r,w,depth=0)=>[cx+(co*r-si*w)*s,cy+(si*r+co*w)*s,cz+depth*s];
  quad(out,p(.12,-.13),p(4.6,-.13),p(4.6,.13),p(.12,.13),farmOak);
  quad(out,p(1.48,.05),p(4.48,.05),p(4.34,1.04),p(1.48,.72),[.88,.80,.60]);
  for(const radius of [1.75,2.65,3.55,4.34]){
   const w=.72+(radius-1.48)*.105;
   quad(out,p(radius,0,.02),p(radius+.08,0,.02),p(radius+.08,w,.02),p(radius,w,.02),[.60,.47,.30]);
  }
 }
}
function farmFormFor(region,slotId){
 return (region?.id===pilotLand?.region?pilotLand?.forms[slotId]:null)??((slotId||0)%3);
}
function coastalFarm(out,b,x,y,z,ghost){
 const form=b.farmForm,level=b.level||1,at=(dx,dz)=>y+farmFooting(b,dx,dz);
 if(form===0){
  const mx=x-4,mz=z-.8,my=at(-4,-.8);
  farmRing(out,mx,my,mz,[[-1.5,2.03],[.6,2.03]],farmStone);
  farmRing(out,mx,my,mz,[[.60,2.03],[5.7,1.67],[7.28,1.49]],farmPlaster);
  farmRing(out,mx,my,mz,[[7.28,1.72],[7.68,1.85],[8.62,1.18],[9.16,.01]],[.40,.28,.20]);
  cube(out,mx,my+.1,mz+1.96,1.17,2.2,.22,farmOak);
  cube(out,mx,my+4,mz+1.78,.56,.74,.14,[.20,.21,.18]);
  cube(out,mx,my+6.80,mz+1.7,.68,.72,1.3,farmOak);
  if(ghost)millSails(out,mx,my+7.15,mz+2.46,1,.38);
  farmRange(out,x+2.6,at(2.6,-2.4),z-2.4,6.6,3.6,3.18);
  for(const [dx,dz,size] of [[-1.8,1.7,1.07],[-1.1,2.3,.98],[-2.45,2.45,1.04]])
   grainSack(out,x+dx,at(dx,dz),z+dz,size);
 }else if(form===1){
  farmRange(out,x,at(0,-2.8),z-2.8,10.6,4.15,3.75);
  const ex=x+4.35,ey=at(4.35,1.02),ez=z+1.02;
  cube(out,ex,ey-.85,ez,2.6,3.42,5.0,farmPlaster);
  hippedFarmRoof(out,ex,ey+2.57,ez,3.05,5.45,1.18);
  // The gallery has a deep shaded wall and a three-bay timber arcade.
  cube(out,x,ey+2.7,z+.43,7.8,.32,2.2,[.49,.32,.21]);
  for(const dx of [-3.55,-1.18,1.18,3.55]){
   cube(out,x+dx,ey-.30,z+1.42,.38,3.12,.38,farmPlaster);
   timberBeam(out,[x+dx,ey+2.17,z+1.42],[x+dx+.48,ey+2.68,z+1.42],.18,farmOak);
  }
  const wx=x-3.05,wz=z+3.7,wy=at(-3.05,3.7);
  farmRing(out,wx,wy,wz,[[-.6,.94],[.95,.94],[1.06,1.04],[1.06,.70],[.54,.70]],farmStone);
  cone(out,wx,wy+.43,wz,.72,.04,[.18,.22,.19],16);
  for(const side of [-1,1])cube(out,wx+side*.93,wy+.90,wz,.20,1.58,.20,farmOak);
  roundTimber(out,wx,wy+2.42,wz,2.18,.15,farmOak,8);
 }else{
  farmRange(out,x-.8,at(-.8,-3.6),z-3.6,10.5,5.1,4.55,true);
  const sy=at(1,3.9);
  for(const dx of [-2.6,.9,4.4]){
   cube(out,x+dx,sy-.48,z+4.15,.36,3.28,.36,farmOak);
   cube(out,x+dx,sy-.48,z+2.15,.34,3.65,.34,farmOak);
   timberBeam(out,[x+dx,sy+2.12,z+4.15],[x+dx,sy+3.18,z+2.85],.17,farmOak);
  }
  quad(out,[x-3.25,sy+2.87,z+4.72],[x+5.05,sy+2.87,z+4.72],[x+5.05,sy+3.36,z+1.74],[x-3.25,sy+3.36,z+1.74],[.55,.43,.29]);
  timberBeam(out,[x-3.25,sy+2.80,z+4.60],[x+5.05,sy+2.80,z+4.60],.25,farmOak);
  for(let i=0;i<6;i++)grainSack(out,x-1.9+(i%3)*1.35,sy,z+3.70-Math.floor(i/3)*1.10,1.12+(i%2)*.1);
 }
 if(level>=2)farmRange(out,x-4.3,at(-4.3,5.45),z+5.45,4.55,3.05,2.5,true);
 if(level>=3){
  const sx=x+5.0,sz=z+5.2,sy=at(5,5.2);
  farmRing(out,sx,sy,sz,[[-.9,1.37],[.3,1.37],[3.6,1.20]],farmPlaster);
  cone(out,sx,sy+3.6,sz,1.51,1.2,[.60,.31,.20],16);
 }
}
// Plan residential frontages once. Population selects a stable prefix of this plan.
const coastalTownPlans=new Map();
let surveyedRoads=null;
function landscapeRoads(region){
 if(!GAME_MAP||typeof SCENARIO_ROADS==='undefined'){
  const hub=region.slots[0];
  return (region.adj||[]).map(id=>state.regions.find(r=>r.id===id)?.slots[0]).filter(Boolean)
   .map(q=>({x:hub.x,z:hub.z,dx:q.x-hub.x,dz:q.z-hub.z}));
 }
 if(!surveyedRoads){
  const nodes=new Map(SCENARIO_ROADS.nodes.map(([id,x,z])=>[id,{x,z}]));
  surveyedRoads=SCENARIO_ROADS.links.map(([a,b])=>{
   const p=nodes.get(a),q=nodes.get(b);
   return {x:p.x,z:p.z,dx:q.x-p.x,dz:q.z-p.z};
  });
 }
 return surveyedRoads;
}
function roadsNearSite(region,slot,reach){
 return landscapeRoads(region).filter(r=>
  Math.min(r.x,r.x+r.dx)<slot.x+reach&&Math.max(r.x,r.x+r.dx)>slot.x-reach&&
  Math.min(r.z,r.z+r.dz)<slot.z+reach&&Math.max(r.z,r.z+r.dz)>slot.z-reach);
}
function coastalTownPlan(r,slot){
 const key=r.id+':'+slot.id;
 if(coastalTownPlans.has(key))return coastalTownPlans.get(key);
 const malaga=r.id===pilotLand?.region;
 const climate=landscapeClimate(slot.x,slot.z);
 const arid=isDryArchitecture(climate);
 const roads=roadsNearSite(r,slot,23).map(e=>({...e,l2:e.dx*e.dx+e.dz*e.dz||1}));
 function roadClearance(x,z){
  let nearest=Infinity;
  for(const e of roads){
   const t=Math.max(0,Math.min(1,((x-e.x)*e.dx+(z-e.z)*e.dz)/e.l2));
   nearest=Math.min(nearest,Math.hypot(x-e.x-t*e.dx,z-e.z-t*e.dz));
  }
  return nearest;
 }
 const reference=roads.reduce((first,edge)=>{
  const t=Math.max(0,Math.min(1,((slot.x-edge.x)*edge.dx+(slot.z-edge.z)*edge.dz)/edge.l2));
  const distance=(slot.x-edge.x-t*edge.dx)**2+(slot.z-edge.z-t*edge.dz)**2;
  return !first||distance<first.distance?{edge,distance}:first;
 },null);
 const bearing=reference?Math.atan2(reference.edge.dz,reference.edge.dx):0;
 const angle=malaga?-.32+.13*(slot.id%4):bearing+(.11*Math.sin(r.id*5.7)+.09);
 const ca=Math.cos(angle),sa=Math.sin(angle);
 const project=(u,v)=>({x:slot.x+ca*u-sa*v,z:slot.z+sa*u+ca*v});
 const lane=(u,row)=>row*(arid?2.91:3.51)+.44*Math.sin(u*.29+row)-.44*Math.sin(row);
 const houses=[];
 for(let row=-5;row<=5;row++)for(let col=-10;col<=10;col++)for(const side of [-1,1]){
  const seed=Math.abs(row*59+col*31+side*13+slot.id*11);
  const u=col*(arid?1.59:1.79)+.04*Math.sin(seed*2.3)+(side>0?.21:0);
  const v=lane(u,row);
  const approach=project(u,v),p=project(u,v+side*(.99+.06*Math.sin(seed)));
  const radius=Math.hypot(p.x-slot.x,p.z-slot.z);
  if(radius<(malaga?2.25:2.8)||radius>19||coastDistance(p.x,p.z)<1.15)continue;
  const heading=angle+Math.atan(.1276*Math.cos(u*.29+row))+(side>0?Math.PI:0);
  const w=1.24+.25*(.5+.5*Math.sin(seed*1.9)),d=.84+.21*(.5+.5*Math.cos(seed));
  const co=Math.cos(heading),si=Math.sin(heading);
  const y=surfaceHeight(p.x,p.z);
  if(slotAt(r,approach.x,approach.z)?.id!==slot.id)continue;
  // Test the oriented footprint against both verges, including the middle of each facade.
  if([[-1,-1],[-1,1],[1,-1],[1,1],[0,-1],[0,1],[-1,0],[1,0],[0,0]].some(([i,j])=>{
   const u=i*(w*.5+.12),v=j*(d*.5+.10);
   return roadClearance(p.x+co*u-si*v,p.z+si*u+co*v)<.49;
  }))continue;
  if(![-1,1].every(i=>[-1,1].every(j=>{
   const a=i*(w*.5+.12),b=j*(d*.5+.12),x=p.x+co*a-si*b,z=p.z+si*a+co*b;
   return slotAt(r,x,z)?.id===slot.id&&Math.abs(surfaceHeight(x,z)-y)<.52;
  })))continue;
  // Near the square, keep two corners open for the market stalls.
  if(Math.abs(u)<1.6&&Math.abs(v)<2)continue;
  houses.push({...p,y,w,d,heading,row,u,approach,seed,rank:radius+.16*Math.abs(row),north:!GAME_MAP,arid});
 }
 houses.sort((a,b)=>a.rank-b.rank||a.seed-b.seed);
 const plan={houses,project,lane};
 coastalTownPlans.set(key,plan);
 return plan;
}
// The regional paint lives on the terrain itself. Only the district's population stage changes it.
const urbanPaint=pilotLand?{texture:gl.createTexture(),signature:null}:null;
function refreshUrbanPaint(all){
 if(!urbanPaint)return;
 const towns=all.filter(({r,b})=>r.id===pilotLand.region&&(b.type==='city'||b.type==='port'||b.type==='wood'||b.type==='iron'||b.type==='cloth'));
 const signature=towns.map(({slot,b})=>slot.id+':'+(b.type==='city'?cityGrowthStage(b):b.type+(b.level||1))).join('|');
 if(urbanPaint.signature===signature)return;
 urbanPaint.signature=signature;
 const density=8,p=pilotLand,w=towns.length?p.w*density:1,h=towns.length?p.h*density:1;
 const data=new Uint8Array(w*h*4);
 function stamp(cx,cz,rx,rz,angle,soft,channel,amount){
  const ca=Math.cos(angle),sa=Math.sin(angle),extent=Math.hypot(rx,rz)+soft;
  const x0=Math.max(0,Math.floor((cx-extent-p.x)*density)),x1=Math.min(w,Math.ceil((cx+extent-p.x)*density));
  const z0=Math.max(0,Math.floor((cz-extent-p.z)*density)),z1=Math.min(h,Math.ceil((cz+extent-p.z)*density));
  for(let iz=z0;iz<z1;iz++)for(let ix=x0;ix<x1;ix++){
   const dx=p.x+(ix+.5)/density-cx,dz=p.z+(iz+.5)/density-cz;
   const u=Math.abs(dx*ca+dz*sa)-rx,v=Math.abs(dz*ca-dx*sa)-rz;
   const distance=Math.hypot(Math.max(0,u),Math.max(0,v))+Math.min(Math.max(u,v),0);
   const fade=Math.max(0,Math.min(1,1-distance/soft));
   const i=(iz*w+ix)*4+channel;
   data[i]=Math.max(data[i],Math.round(255*amount*fade*fade*(3-2*fade)));
  }
 }
 for(const {r,slot,b} of towns){
  if(b.type==='wood'){
   const k=b.scale??.34;
   stamp(b.x,b.z-2*k,4.1*k,2.2*k,0,.33,0,.73);
   stamp(b.x+1.2*k,b.z+1.5*k,2.1*k,.78*k,.13,.65,2,.90);
   for(const side of [-1,1])stamp(b.x+3.4*k,b.z+(2.9+side*.57)*k,2.7*k,.13*k,.22,.16,2,.58);
   if(b.level>=2)stamp(b.x+6.9*k,b.z-3.5*k,2.4*k,2.0*k,0,.31,0,.65);
   continue;
  }
  if(b.type==='iron'){
   const k=b.scale??.34;
   stamp(b.x,b.z+1.2*k,4.8*k,3.55*k,.10,.95,2,.85);
   stamp(b.x-2.2*k,b.z+4.75*k,1.45*k,2.29*k,-.22,.39,2,.86);
   stamp(b.x-3.60*k,b.z-.83*k,2.6*k,1.55*k,0,.34,0,.63);
   if(b.level>=2)stamp(b.x-6.75*k,b.z+2.80*k,1.88*k,1.56*k,0,.50,2,.71);
   if(b.level>=3)stamp(b.x+6.65*k,b.z-2.05*k,1.75*k,2.83*k,0,.50,2,.77);
   continue;
  }
  if(b.type==='cloth'){
   const k=b.scale??.34;
   stamp(b.x-1.45*k,b.z-2.2*k,3.58*k,2.11*k,0,.34,0,.73);
   stamp(b.x+1.10*k,b.z+2.9*k,4.5*k,2.20*k,.14,.68,1,.43);
   if(b.level>=2){
    stamp(b.x+4.60*k,b.z-.90*k,2.38*k,2.67*k,0,.43,1,.82);
    stamp(b.x+3.65*k,b.z+.51*k,.96*k,1.04*k,.16,.27,2,.40);
    stamp(b.x+5.68*k,b.z+.56*k,.94*k,1.03*k,-.17,.25,2,.63);
   }
   if(b.level>=3)stamp(b.x-5.56*k,b.z+3.64*k,1.82*k,3.33*k,0,.47,1,.53);
   continue;
  }
  if(b.type==='port'){
   const scale=b.scale??.34;
   stamp(b.x,b.z,5.8*scale,4.9*scale,0,.63,1,.85);
   stamp(b.x+.28,b.z+.12,4.6*scale,2.25*scale,0,.32,0,.65);
   continue;
  }
  const {houses,project,lane}=coastalTownPlan(r,slot),stage=cityGrowthStage(b);
  const occupied=houses.slice(0,Math.ceil(stage*1.65)),rows=new Map();
  stamp(b.x,b.z,1.6,1.33,-.32,.38,1,.83);
  stamp(b.x+.30,b.z+.30,1.0,.64,0,.35,0,.65);
  for(const home of occupied){
   const {x,z,w,d,heading,row}=home;
   stamp(x,z,w*.61,d*.64,heading,.28,1,.66);
   stamp(x+.26,z+.22,w*.54,d*.56,heading,.31,0,.66);
   if(!rows.has(row))rows.set(row,[]);
   rows.get(row).push(home.u);
  }
  for(const [row,values] of rows){
   values.sort((a,b)=>a-b);
   let last=null;
   for(const u of values){
    const start=last!==null&&u-last<3.7?last:u-.70;
    for(let t=start;t<u+.70;t+=.32){
     const q=project(t,lane(t,row));
     stamp(q.x,q.z,.22,.18,0,.20,1,.86);
    }
    last=u;
   }
  }
 }
 gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,urbanPaint.texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
}
function coastalTownHall(out,x,y,z,level,flag){
 const cream=[.85,.78,.62],trim=[.66,.58,.45],tile=[.63,.34,.23],dark=[.22,.22,.18];
 cube(out,x-2,y-1.2,z-1,9.5,1.65,6.2,trim);
 cube(out,x-2,y+.45,z-1,9.2,4.65,5.9,cream);
 hippedFarmRoof(out,x-2,y+5.1,z-1,10.2,6.7,2.35);
 // A recessed loggia faces the square. Side piers leave actual openings.
 cube(out,x-2,y+1.1,z+2.03,7.5,2.97,.13,dark);
 for(const dx of [-5.7,-3.24,-.78,1.68]){
  cube(out,x+dx,y+.10,z+2.75,.56,3.3,.60,trim);
  cube(out,x+dx,y+3.25,z+2.75,.77,.37,.82,cream);
 }
 cube(out,x-2,y+3.61,z+2.55,8.05,.41,1.26,cream);
 const tx=x+2.65,tz=z-.62;
 cube(out,tx,y-1.2,tz,2.85,9.5,2.8,trim);
 cube(out,tx,y+1,tz,2.6,7.45,2.6,cream);
 cube(out,tx,y+8.35,tz,3.24,.53,3.18,trim);
 for(const i of [-1,1])for(const j of [-1,1])
  cube(out,tx+i*.99,y+8.86,tz+j*.96,.51,2.32,.51,cream);
 cone(out,tx,y+9.14,tz,.62,1.06,[.38,.33,.22],12);
 cube(out,tx,y+11.15,tz,3.04,.42,3.01,trim);
 cone(out,tx,y+11.56,tz,2.19,2.02,tile,4);
 timberBeam(out,[tx,y+13.45,tz],[tx,y+15.72,tz],.14,farmOak);
 tri(out,[tx,y+15.6,tz],[tx,y+14.65,tz],[tx+1.64,y+15.24,tz+.20],flag);
 if(level>=2)farmRange(out,x-4.25,y,z-4.62,5.6,2.8,2.68);
 if(level>=3)farmRange(out,x+1.48,y,z-4.88,4.8,3.0,3.51);
}
function coastalTownHome(out,p,stage){
 const v=[],w=p.w,d=p.d;
 if(p.arid){
  const h=.91+(p.seed%4)*.14+(stage>=8&&p.seed%5===0?.59:0);
  const clay=[[.71,.58,.41],[.76,.66,.49],[.81,.71,.55],[.65,.53,.37]][p.seed%4];
  const face=[.29,.25,.18],ridge=tint(clay,1.12);
  cube(v,0,-.30,0,w+.05,.37,d+.05,tint(clay,.79));
  cube(v,0,.06,0,w,h,d,clay);
  for(const side of [-1,1]){
   cube(v,side*(w*.5-.05),h+.04,0,.102,.18,d,ridge);
   cube(v,0,h+.04,side*(d*.5-.05),w,.18,.102,ridge);
   cube(v,side*(w*.5+.015),h*.57,-.14,.055,.19,.20,face);
  }
  cube(v,-w*.15,.07,d*.5+.025,.20,h*.59,.06,face);
  cube(v,w*.24,h*.54,d*.5+.032,.17,.167,.067,face);
  if(p.seed%3===0){
   for(let i=0;i<3;i++)cube(v,w*.27,.055+i*.11,d*.51+.085*(3-i),.32,.14,.16,ridge);
  }else if(p.seed%3===1)cube(v,w*.22,h-.02,-d*.19,.36,.23,.31,ridge);
  const co=Math.cos(p.heading),si=Math.sin(p.heading);
  for(let i=0;i<v.length;i+=6)out.push(p.x+co*v[i]-si*v[i+2],p.y+.06+v[i+1],p.z+si*v[i]+co*v[i+2],v[i+3],v[i+4],v[i+5]);
  return;
 }
 const upperFloor=p.rank<8.4&&stage>=9+p.seed%11;
 const h=.90+(p.seed%4)*.125+(p.rank<5.4?.27:0)+(upperFloor?.64:0),rise=d*(.28+(p.seed%3)*.08);
 const cream=(p.north?[[.64,.47,.37],[.69,.66,.55],[.59,.51,.40],[.62,.57,.45]]:[[.80,.72,.56],[.85,.80,.69],[.72,.63,.50],[.76,.69,.57]])[p.seed%4];
 const roof=(p.north?[[.32,.34,.36],[.49,.31,.22],[.36,.37,.35],[.53,.34,.24]]:[[.60,.32,.22],[.55,.34,.25],[.67,.39,.26],[.56,.40,.29]])[(p.seed*3)%4];
 const trim=[.48,.42,.33],shade=[.23,.25,.21],e=w*.5+.11,f=d*.5+.10,hip=p.north?0:Math.min(w*.2,d*.32);
 cube(v,0,-.52,0,w+.06,.63,d+.07,trim);
 cube(v,0,.10,0,w,h-.10,d,cream);
 const a=[-e,h,-f],b=[e,h,-f],c=[e,h,f],q=[-e,h,f],l=[-e+hip,h+rise,0],r=[e-hip,h+rise,0];
 quad(v,a,b,r,l,tint(roof,1.12));quad(v,c,q,l,r,tint(roof,.94));
 tri(v,b,c,r,tint(roof,.83));tri(v,q,a,l,roof);
 timberBeam(v,l,r,.075,tint(roof,1.15));
 const front=d/2+.03;
 if(upperFloor){
  cube(v,0,h-.58,front,w,.075,.07,trim);
  for(const i of [-1,1])cube(v,i*w*.25,h-.43,front+.02,.19,.24,.08,shade);
  if(p.seed%2===0)cube(v,0,h-.51,front+.11,w*.73,.08,.26,trim);
 }
 cube(v,-w*.22,.10,front,.23,h*.52,.06,shade);
 cube(v,w*.23,h*.50,front,.20,.24,.065,shade);
 cube(v,w*.23,h*.49,front+.03,.27,.045,.09,trim);
 if(p.seed%3===0)cube(v,w*.26,h+.06,-.07,.18,rise+.35,.20,cream);
 if(p.seed%3===1){
  quad(v,[.02,h*.68,front],[w*.43,h*.68,front],[w*.43,h*.57,front+.21],[.02,h*.57,front+.21],[.49,.52,.40]);
 }
 // The lane and both gables are visible as the camera turns.
 for(const side of [-1,1]){
  const end=side*(w/2+.02);
  cube(v,end,h*.51,-.06,.06,.21,.21,shade);
  if(p.seed%2===0)cube(v,end+side*.018,h*.49,-.06,.09,.05,.28,trim);
 }
 cube(v,w*.17,h*.56,-d*.5-.015,.22,.23,.056,shade);
 for(let i=0;i<5;i++){
  const x=-e+(i+.5)*(2*e/5);
  const ridge=x*.72,frontSlope=[x,h+.015,f],backSlope=[x,h+.015,-f],peak=[ridge,h+rise+.012,0];
  timberBeam(v,frontSlope,peak,.037,tint(roof,1.09));
  timberBeam(v,backSlope,peak,.037,tint(roof,.94));
 }
 const co=Math.cos(p.heading),si=Math.sin(p.heading);
 for(let i=0;i<v.length;i+=6)out.push(p.x+co*v[i]-si*v[i+2],p.y+.09+v[i+1],p.z+si*v[i]+co*v[i+2],v[i+3],v[i+4],v[i+5]);
}
function marketStall(out,x,z,cloth){
 const y=surfaceHeight(x,z)+.12;
 for(const i of [-1,1])for(const j of [-1,1])cube(out,x+i*.43,y-.18,z+j*.29,.074,1.04,.074,farmOak);
 cube(out,x,y+.31,z,.90,.16,.58,[.49,.37,.25]);
 for(let i=0;i<4;i++){
  const l=x-.55+i*.275,r=l+.275,col=i%2?cloth:[.83,.74,.55];
  quad(out,[l,y+.88,z-.39],[r,y+.88,z-.39],[r,y+1.03,z],[l,y+1.03,z],col);
  quad(out,[l,y+1.03,z],[r,y+1.03,z],[r,y+.82,z+.41],[l,y+.82,z+.41],tint(col,.92));
 }
}
function drawCoastalDistrict(out,r,slot,b){
 const plan=coastalTownPlan(r,slot),stage=cityGrowthStage(b);
 const homes=plan.houses.slice(0,Math.ceil(stage*1.65));
 for(const p of homes)coastalTownHome(out,p,stage);
 if(stage>=4){
  for(const [i,[dx,dz]] of [[-1.2,1.13],[.06,1.43],[1.30,.99]].entries()){
   if(i>0&&stage<8*i)continue;
   const p=plan.project(dx,dz);
   if(slotAt(r,p.x,p.z)?.id===slot.id&&coastDistance(p.x,p.z)>.70)marketStall(out,p.x,p.z,i%2?[.45,.51,.42]:[.66,.35,.25]);
  }
 }
}
const millBark=[.32,.238,.16],millOak=[.46,.32,.19],millCut=[.78,.61,.37];
function millLog(out,x,y,z,length,radius){
 roundTimber(out,x,y,z,length,radius,millBark,8);
 for(const side of [-1,1]){
  const end=x+side*(length*.5+.009);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,b=a+Math.PI/4;
   const ring=(angle,r)=>[end,y+Math.cos(angle)*radius*r,z+Math.sin(angle)*radius*r];
   quad(out,ring(a,.39),ring(a,.88),ring(b,.88),ring(b,.39),millCut);
   tri(out,[end,y,z],ring(a,.39),ring(b,.39),tint(millCut,.79));
  }
 }
}
function millShelter(out,x,y,z,width,depth,height){
 const w=width/2,d=depth/2;
 const eave=t=>height-.78*t;
 for(const s of [-1,1]){
  for(const t of [-1,1]){
   const px=x+s*(w-.32),pz=z+t*(d-.24),top=y+eave(t);
   cube(out,px,y,pz,.43,eave(t),.46,millOak);
   timberBeam(out,[px,top-1.35,pz],[px-s*1.28,top,pz],.25,millOak);
  }
  timberBeam(out,[x-w,y+eave(s),z+s*(d-.24)],[x+w,y+eave(s),z+s*(d-.24)],.38,millOak);
 }
 const count=Math.ceil(width/.70),roof=[.38,.34,.27];
 for(let i=0;i<count;i++){
  const l=x-w+i*width/count,r=l+width/count-.018;
  const lip=.09*Math.sin(i*3.5);
  quad(out,[l,y+eave(-1)+.19,z-d-.36],[r,y+eave(-1)+.19,z-d-.36],
   [r,y+eave(1)+.12,z+d+.42+lip],[l,y+eave(1)+.12,z+d+.42+lip],tint(roof,.90+(i*7%5)*.062));
 }
}
function millBoards(out,x,y,z,length,rows){
 for(const s of [-1,1])cube(out,x+s*length*.32,y,z,.39,.27,1.95,millBark);
 for(let i=0;i<rows;i++){
  const base=y+.28+i*.39;
  for(let j=0;j<3;j++)cube(out,x+.12*Math.sin(i+j),base,z+(j-1)*.57,length,.24,.54,tint(millCut,.83+((i+j)%3)*.075));
  if(i+1<rows)for(const s of [-1,1])cube(out,x+s*length*.32,base+.24,z,.21,.15,1.78,millOak);
 }
}
function sawmillYard(out,b,x,y,z){
 const level=b.level||1,ground=(dx,dz)=>y+farmFooting(b,dx,dz);
 const bench=ground(0,0);
 millShelter(out,x,bench,z-2.1,8.8,4.2,5.4);
 for(const s of [-1,1]){
  cube(out,x+s*2.75,bench,z+.70,.51,2.05,1.45,millOak);
  cube(out,x+s*2.75,bench+2.05,z+.70,.68,.31,2.02,millBark);
 }
 millLog(out,x-.33,bench+2.86,z+.62,8.1,.51);
 const stock=ground(-3.3,4.1);
 for(let i=0;i<3;i++){
  millLog(out,x-3.3+i*.18,stock+.54,z+3.45+i*1.1,5.8+(i%2)*.42,.55);
 }
 millBoards(out,x+4.8,ground(4.8,3.9),z+3.9,3.9,2);
 if(level>=2){
  const yard=ground(6.9,-3.5);
  millShelter(out,x+6.9,yard,z-3.5,4.8,4.3,3.8);
  millBoards(out,x+6.9,yard,z-3.5,4.1,6);
 }
 if(level>=3){
  const base=ground(-6.5,-1.15),cx=x-6.5,cz=z-1.15;
  for(const t of [-1,1]){
   timberBeam(out,[cx-1.25,base,cz+t*1.4],[cx,base+6.5,cz+t*.87],.43,millOak);
   timberBeam(out,[cx+1.15,base,cz+t*1.4],[cx,base+6.5,cz+t*.87],.43,millOak);
  }
  timberBeam(out,[cx,base+5.8,cz-1.65],[cx,base+7.5,cz+3.35],.49,millOak);
  timberBeam(out,[cx,base+7.42,cz+3.10],[cx,base+3.2,cz+3.10],.12,[.60,.51,.34]);
  millLog(out,cx,base+2.85,cz+3.10,3.9,.42);
 }
}
function sawFrame(out,x,y,z,s,stroke){
 const beam=[.44,.29,.16],iron=[.59,.64,.64],cy=y+stroke*s;
 for(const n of [-1,1]){
  cube(out,x+n*.69*s,cy+1.2*s,z,.16*s,2.95*s,.17*s,beam);
  cube(out,x,cy+(n<0?1.18:4.07)*s,z,1.63*s,.19*s,.21*s,beam);
 }
 cube(out,x,cy+1.32*s,z,.25*s,2.76*s,.11*s,iron);
 // Both hands move with the frame. The sawyer stays braced at the bench.
 const foot=z+.92*s,body=y+1.02*s,sleeve=[.61,.52,.35],skin=[.68,.49,.33];
 for(const side of [-1,1]){
  const px=x+.37*s*side;
  cube(out,px,y,foot,.29*s,1.04*s,.45*s,[.28,.25,.20]);
  timberBeam(out,[px,body+.61*s,foot],[x+side*.64*s,cy+1.25*s,z+.10*s],.22*s,sleeve);
 }
 cube(out,x,body,foot,.85*s,.86*s,.52*s,[.36,.39,.33]);
 cube(out,x,body+.83*s,foot-.08*s,.39*s,.43*s,.39*s,skin);
 cube(out,x,body+1.15*s,foot-.09*s,.51*s,.14*s,.47*s,[.52,.38,.22]);
}
const mineTimber=[.40,.29,.18],mineIron=[.34,.37,.39],mineStone=[.50,.48,.43];
function oreRock(out,x,y,z,r,h,angle,col){
 const tip=[x+r*.16,y+h,z-r*.18];
 for(let i=0;i<5;i++){
  const a=angle+i*2*Math.PI/5,b=a+2*Math.PI/5;
  const at=(t,height,scale)=>[x+Math.cos(t)*r*scale,y+height,z+Math.sin(t)*r*scale*.82];
  const p=at(a,h*.43,.86),q=at(b,h*.43,.86);
  quad(out,at(a,0,.94),at(b,0,.94),q,p,tint(col,.75+i*.04));
  tri(out,p,q,tip,tint(col,.90+(i*3%5)*.083));
 }
}
function mineWheel(out,x,y,z,rim,angle,scale){
 const point=(a,r)=>[x,y+Math.cos(a)*r*scale,z+Math.sin(a)*r*scale];
 for(let i=0;i<12;i++){
  const a=angle+i*Math.PI/6,b=a+Math.PI/6;
  quad(out,point(a,rim),point(b,rim),point(b,rim-.16),point(a,rim-.16),tint(mineTimber,i%2?.85:1.15));
 }
 for(let i=0;i<6;i++)timberBeam(out,[x,y,z],point(angle+i*Math.PI/3,rim-.08),.13*scale,mineTimber);
 roundTimber(out,x,y,z,.28*scale,.23*scale,mineIron,8);
}
function mineHoist(out,x,y,z,scale,phase,lift){
 const bottom=y+lift*scale,top=y+6.85*scale,rope=[.74,.61,.42];
 mineWheel(out,x+1.66*scale,top,z-.34*scale,.91,phase,scale);
 for(const j of [-1,1]){
  const dx=j*.29*scale;
  timberBeam(out,[x+dx,top,z],[x+dx,bottom+.67*scale,z],.062*scale,rope);
 }
 cube(out,x,bottom,z,1.29*scale,.22*scale,1.09*scale,mineTimber);
 for(const side of [-1,1]){
  cube(out,x+side*.54*scale,bottom+.17*scale,z,.18*scale,.41*scale,1.09*scale,mineTimber);
  cube(out,x,bottom+.17*scale,z+side*.46*scale,1.12*scale,.41*scale,.18*scale,mineTimber);
 }
 oreRock(out,x,bottom+.23*scale,z,.44*scale,.38*scale,.45,[.47,.43,.43]);
}
function drawMineStructure(out,b,x,y,z,preview){
 const level=b.level||1,foot=(dx,dz)=>y+farmFooting(b,dx,dz);
 const shaftX=x+2.7,shaftZ=z-1.2,base=foot(2.7,-1.2);
 const iron=mineIron,wood=mineTimber,stone=mineStone;
 // Stone curb and deep shaft below the exposed winding gear.
 for(const side of [-1,1]){
  cube(out,shaftX+side*1.52,base,shaftZ,.55,.46,3.52,stone);
  cube(out,shaftX,base,shaftZ+side*1.48,2.54,.46,.55,tint(stone,1.08));
 }
 cube(out,shaftX,base+.12,shaftZ,2.62,.03,2.78,[.115,.097,.083]);
 for(const side of [-1,1]){
  const px=shaftX+side*1.66;
  for(const q of [-1,1]){
   const zz=q*2.1;
   const bottom=foot(px-x,shaftZ+zz-z);
   cube(out,px,bottom,shaftZ+zz,.91,.63,.80,stone);
   timberBeam(out,[px,bottom+.44,shaftZ+zz],[px,base+7.1,shaftZ-.34],.47,wood);
   timberBeam(out,[px,bottom+1.25,shaftZ+zz],[shaftX-side*.91,base+4.9,shaftZ-.34],.22,tint(wood,.82));
  }
  timberBeam(out,[px,base+3.30,shaftZ-1.38],[px,base+3.30,shaftZ+1.07],.40,wood);
  cube(out,px,base+6.57,shaftZ-.34,.79,.54,.72,stone);
 }
 timberBeam(out,[shaftX-2.29,base+7.22,shaftZ-.34],[shaftX+2.30,base+7.22,shaftZ-.34],.57,wood);
 roundTimber(out,shaftX,base+6.85,shaftZ-.34,3.54,.22,iron,10);
 roundTimber(out,shaftX,base+6.85,shaftZ-.34,.96,.51,wood,10);
 if(preview)mineHoist(out,shaftX,base,shaftZ,1,.35,1.50);

 // An adjoining stone-faced adit opens onto the timber wagonway.
 const ax=x-3.25,az=z-.55,aditBase=foot(-3.25,-.55),front=az+1.60;
 for(let course=0;course<4;course++)for(const side of [-1,1]){
  const rx=ax+side*(1.62-.09*course);
  cube(out,rx,aditBase+course*.55,az,1.04,.55,3.28,tint(stone,.85+(course%3)*.12));
 }
 cube(out,ax,aditBase,az-1.25,3.62,2.45,.65,[.135,.116,.105]);
 cube(out,ax,aditBase+.04,front-.34,2.27,1.51,.13,[.099,.084,.078]);
 // The voussoirs follow the arch and leave the entrance in shadow.
 for(let i=0;i<9;i++){
  const a=i*Math.PI/9+.027,b=(i+1)*Math.PI/9-.027;
  const at=(t,r)=>[ax+Math.cos(t)*r,aditBase+1.54+Math.sin(t)*r,front];
  const innerA=at(a,1.17),outerA=at(a,1.68),outerB=at(b,1.68),innerB=at(b,1.17);
  const back=p=>[p[0],p[1],p[2]-.44];
  quad(out,innerA,outerA,outerB,innerB,tint(stone,i===4?1.25:.88+(i*7%6)*.06));
  quad(out,outerA,back(outerA),back(outerB),outerB,tint(stone,1.06));
  quad(out,innerB,back(innerB),back(innerA),innerA,tint(stone,.60));
  tri(out,[ax,aditBase+1.54,front-.40],back(innerA),back(innerB),[.099,.084,.078]);
 }
 timberBeam(out,[ax-1.04,aditBase,front+.07],[ax-1.04,aditBase+1.54,front+.07],.22,wood);
 timberBeam(out,[ax+1.04,aditBase,front+.07],[ax+1.04,aditBase+1.54,front+.07],.22,wood);
 for(let i=0;i<13;i++){
  const dx=-5.4+i%5*.70,dz=-1.76-Math.floor(i/5)*.74;
  oreRock(out,x+dx,foot(dx,dz),z+dz,1.06+(i%3)*.31,1.14+(i%4)*.29,i*.41,tint(stone,.82+i%5*.066));
 }
 for(let i=0;i<9;i++){
  const t=i/8,dx=-3.25+1.8*t*t,dz=1+5.22*t;
  const top=foot(dx,dz);
  cube(out,x+dx,top,z+dz,1.83,.16,.23,tint(wood,.82+i%3*.10));
  if(!i)continue;
  const u=(i-1)/8,px=-3.25+1.8*u*u,pz=1+5.22*u,from=foot(px,pz);
  for(const side of [-1,1]){
   timberBeam(out,[x+px+side*.63,from+.17,z+pz],[x+dx+side*.63,top+.17,z+dz],.11,iron);
  }
 }
 // Graded spoil and a timber edge keep the entry lane clear.
 for(let i=0;i<8;i++){
  const dx=-4.78-i%4*.47,dz=4.4+Math.floor(i/4)*.57;
  oreRock(out,x+dx,foot(dx,dz),z+dz,.35+i%4*.14,.24+i%3*.14,i*.83,tint(stone,.69+i%4*.08));
 }
 const ore=[.41,.335,.31],pile=level>=2?14:8;
 for(let i=0;i<pile;i++){
  const dx=2.8+(i%4)*.69,dz=3.85+Math.floor(i/4)*.65;
  oreRock(out,x+dx,foot(dx,dz),z+dz,.49+(i%3)*.22,.48+(i%3)*.34,i*.72,tint(ore,.80+(i*5%7)*.073));
 }
 if(level>=2){
  const sx=x-6.75,sz=z+2.80,fy=foot(-6.75,2.80);
  millShelter(out,sx,fy,sz,3.75,4.05,3.45);
  cube(out,sx,fy+.72,sz+.30,2.39,.23,2.12,wood);
  for(let i=0;i<5;i++)oreRock(out,sx+(i%3-1)*.59,fy+.94,sz+(i%2)*.59,.4,.37,i*.54,tint(ore,1+i*.06));
  for(const dx of [-.89,.89])cube(out,sx+dx,fy,sz+.30,.20,.75,1.80,wood);
 }
 if(level>=3){
  const bx=x+6.65,bz=z-2.98,fy=foot(6.65,-2.98),wall=tint(stone,.86);
  cube(out,bx,fy,bz,3.24,.53,3.31,wall);
  for(const side of [-1,1]){
   cube(out,bx+side*1.36,fy+.5,bz,.53,2.58,3.37,wall);
   cube(out,bx+side*1.42,fy+2.96,bz,.69,.27,3.54,tint(stone,1.05));
  }
  cube(out,bx,fy+.48,bz-1.30,2.54,2.78,.58,wall);
  for(let i=0;i<6;i++)oreRock(out,bx+(i%3-1)*.62,fy+.52,bz-.13+(i%2)*.62,.68,1.29+(i%3)*.35,i*.48,tint(ore,1.06));
  timberBeam(out,[bx-1.18,fy+1.15,bz+1.56],[bx+1.18,fy+1.15,bz+1.56],.25,wood);
  const tip=[bx,fy+.32,bz+3.15];
  for(const side of [-1,1])timberBeam(out,[bx+side*.41,fy+1.45,bz+1.25],[tip[0]+side*.45,tip[1],tip[2]],.24,wood);
  quad(out,[bx-.31,fy+1.38,bz+1.25],[bx+.31,fy+1.38,bz+1.25],[bx+.36,tip[1],tip[2]],[bx-.36,tip[1],tip[2]],tint(wood,1.22));
 }
}
const loomOak=[.40,.28,.17],loomStone=[.53,.51,.43];
const loomLinen=[.78,.69,.51],loomMadder=[.64,.26,.19],loomIndigo=[.24,.38,.59];
function clothRoll(out,x,y,z,length,radius,dye){
 roundTimber(out,x,y,z,length,radius,dye,10);
 const linen=tint(loomLinen,.92);
 for(let i=0;i<10;i++){
  const a=i*Math.PI/5,b=(i+1)*Math.PI/5;
  const cap=(t,r)=>[x-length*.5-.007,y+Math.cos(t)*r,z+Math.sin(t)*r];
  tri(out,cap(a,0),cap(a,radius*.85),cap(b,radius*.85),linen);
 }
 for(const side of [-1,1])roundTimber(out,x+side*.34*length,y,z,length*.069,radius*1.025,tint(loomLinen,.90),10);
}
function dryingCloth(out,x,y,z,width,height,dye,seed){
 const divisions=[0,.07,.24,.40,.58,.74,.92,1];
 const p=(u,t)=>{
  const wave=Math.sin(u*15+seed)*.20+Math.cos(u*26)*.07;
  return [x+(u-.5)*width,y-t*height+Math.sin(u*9+seed)*(.06+.12*t),z+wave*(.30+.7*t)+t*t*.2];
 };
 for(let i=1;i<divisions.length;i++){
  const left=divisions[i-1],right=divisions[i];
  const face=tint(dye,.78+(i*5%6)*.073);
  quad(out,p(left,0),p(right,0),p(right,.87),p(left,.87),face);
  quad(out,p(left,.87),p(right,.87),p(right,.94),p(left,.94),tint(loomLinen,.86+(i%3)*.10));
  quad(out,p(left,.94),p(right,.94),p(right,1),p(left,1),face);
 }
}
function clothRack(out,x,y,z,width,height,dyes){
 for(const q of [-1,1]){
  const post=x+q*width*.5;
  cube(out,post,y,z,.21,height+.3,.23,loomOak);
  timberBeam(out,[post,y+.88,z],[post+q*.38,y,z+.52],.12,loomOak);
 }
 timberBeam(out,[x-width*.5,y+height,z],[x+width*.5,y+height,z],.092,loomOak);
 for(let i=0;i<dyes.length;i++){
  const pitch=width/dyes.length,middle=x-width*.5+pitch*(i+.5);
  dryingCloth(out,middle,y+height,z,pitch*.84,height*(i%2?.72:.80),dyes[i],i+.2);
 }
}
function dyeVat(out,x,y,z,r,dye){
 const rim=y+1.08,center=[x,rim-.15,z];
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
  const p=(t,h,k)=>[x+Math.cos(t)*r*k,y+h,z+Math.sin(t)*r*k];
  const wood=tint(loomOak,.84+i%4*.11);
  quad(out,p(a,0,.82),p(b,0,.82),p(b,1.08,1),p(a,1.08,1),wood);
  quad(out,p(a,.78,.961),p(b,.78,.961),p(b,.87,.976),p(a,.87,.976),[.37,.38,.35]);
  quad(out,p(a,1.08,1),p(b,1.08,1),p(b,1.08,.82),p(a,1.08,.82),tint(wood,1.15));
  quad(out,p(a,1.08,.82),p(b,1.08,.82),p(b,.93,.79),p(a,.93,.79),tint(wood,.61));
  tri(out,center,p(a,.93,.79),p(b,.93,.79),tint(dye,.86+(i*3%5)*.053));
 }
}
function handloom(out,x,y,z){
 for(const side of [-1,1]){
  for(const q of [-1,1])cube(out,x+side*1.33,y,z+q*.92,.22,1.95,.24,loomOak);
  timberBeam(out,[x+side*1.33,y+.48,z-.92],[x+side*1.33,y+1.46,z+.92],.14,tint(loomOak,.91));
 }
 for(const q of [-1,1])roundTimber(out,x,y+1.97,z+q*.97,3.08,.15,loomOak,8);
 const at=(i,v)=>[x-1.23+i*.205,y+2.0+v*.02,z+v];
 for(let i=0;i<12;i++){
  quad(out,at(i,-.90),at(i+1,-.90),at(i+1,.42),at(i,.42),tint(loomLinen,.91+(i%3)*.056));
  quad(out,at(i,.42),at(i+1,.42),at(i+1,.90),at(i,.90),tint(loomIndigo,.89+(i%3)*.061));
 }
 cube(out,x,y+.07,z+1.65,1.87,.29,.58,loomOak);
 for(const side of [-1,1])cube(out,x+side*.65,y,z+1.65,.19,.23,.53,loomOak);
}
function drawWeavingYard(out,b,x,y,z){
 const level=b.level||1,ground=(dx,dz)=>y+farmFooting(b,dx,dz);
 const hall=ground(-1.45,-2.2),hx=x-1.45,hz=z-2.2;
 cube(out,hx,hall-.12,hz,7.28,.42,4.5,loomStone);
 // Open south side. Sunlight reaches the frame loom and its warp.
 for(const dx of [-3.30,0,3.30]){
  cube(out,hx+dx,hall,hz+2.11,.32,4.13,.33,loomOak);
  if(dx!==0)timberBeam(out,[hx+dx,hall+2.99,hz+2.11],[hx+dx*.68,hall+4.05,hz+2.11],.22,loomOak);
 }
 cube(out,hx,hall,hz-2.02,6.9,3.81,.35,[.71,.66,.54]);
 for(const side of [-1,1]){
  cube(out,hx+side*3.42,hall,hz-1.0,.31,3.81,2.01,[.72,.67,.56]);
  cube(out,hx+side*3.42,hall+2.90,hz-1.0,.40,.21,2.05,loomOak);
 }
 timberBeam(out,[hx-3.55,hall+4.02,hz+2.11],[hx+3.55,hall+4.02,hz+2.11],.32,loomOak);
 hippedFarmRoof(out,hx,hall+4.08,hz,7.6,4.75,1.83);
 handloom(out,x-2.12,ground(-2.12,2.20),z+2.20);
 clothRack(out,x+1.80,ground(1.8,5.65),z+5.65,6.10,2.99,[loomMadder,loomIndigo,loomLinen]);
 const by=ground(-4.2,2.62);
 clothRoll(out,x-4.2,by+.35,z+2.62,1.60,.28,loomLinen);
 clothRoll(out,x-4.2,by+.31,z+3.28,1.52,.24,loomIndigo);
 if(level>=2){
  const tx=x+4.6,tz=z-1.40,ty=ground(4.6,-1.4);
  millShelter(out,tx,ty,tz,4.55,3.7,3.75);
  dyeVat(out,tx-1.13,ground(3.47,.10),z+.10,.93,loomMadder);
  dyeVat(out,tx+1.13,ground(5.73,.10),z+.10,1.05,loomIndigo);
  const table=ground(5.62,2.5);
  cube(out,x+5.62,table+.63,z+2.5,2.1,.26,1.21,loomOak);
  for(const q of [-1,1])cube(out,x+5.62+q*.86,table,z+2.5,.19,.63,1.13,loomOak);
  clothRoll(out,x+5.63,table+1.10,z+2.52,1.56,.23,loomMadder);
 }
 if(level>=3){
  clothRack(out,x-5.32,ground(-5.32,6.6),z+6.60,4.70,2.90,[loomIndigo,loomMadder]);
  const dx=-6.7,dz=-1.0,py=ground(dx,dz);
  millShelter(out,x+dx,py,z+dz,3.35,4,3.41);
  const bolts=[loomMadder,loomLinen,loomIndigo];
  for(let i=0;i<6;i++)clothRoll(out,x+dx,py+.54+Math.floor(i/3)*.56,z+dz+(i%3-1)*.71,2.64,.37,bolts[(i+Math.floor(i/3))%3]);
 }
}
function loomActivity(out,x,y,z,s,phase){
 const travel=Math.sin(phase)*.99*s,beat=Math.cos(phase*2)*.39*s;
 const reedZ=z+.32*s+beat;
 timberBeam(out,[x-1.25*s,y+2.11*s,reedZ],[x+1.25*s,y+2.11*s,reedZ],.09*s,loomOak);
 cube(out,x+travel,y+2.06*s,z+.66*s,.29*s,.12*s,.12*s,loomMadder);
 const front=z+1.52*s,workerCloth=[.45,.47,.34],skin=[.68,.49,.33];
 cube(out,x,y+.28*s,front-.16*s,.68*s,.49*s,.48*s,[.33,.29,.23]);
 cube(out,x,y+.62*s,front,.69*s,.82*s,.44*s,workerCloth);
 cube(out,x,y+1.40*s,front-.08*s,.40*s,.45*s,.39*s,skin);
 cube(out,x,y+1.76*s,front-.08*s,.56*s,.15*s,.49*s,loomLinen);
 for(const side of [-1,1]){
  timberBeam(out,[x+side*.33*s,y+1.28*s,front],[x+side*.42*s+travel*.33,y+2.08*s,z+.67*s],.19*s,workerCloth);
 }
}
function northernTown(out,b,x,y,z,faction){
 const local=(dx,dz)=>y+farmFooting(b,dx,dz),brick=[.57,.32,.24],tile=[.34,.34,.34],baseStone=[.49,.48,.43];
 const tx=x+2.45,tz=z-2.60,base=local(2.45,-2.60);
 buildingHouse(out,x-2.5,local(-2.5,-.20),z-.20,6.4,4.64,5.35,[.67,.56,.46],tile);
 cube(out,tx,base-.38,tz,3.43,1.12,3.65,baseStone);
 cube(out,tx,base+.53,tz,3.24,7.27,3.44,brick);
 for(const h of [3.10,5.16,7.44])cube(out,tx,base+h,tz,3.48,.19,3.70,[.63,.55,.44]);
 for(const side of [-1,1]){
  cube(out,tx,base+5.78,tz+side*1.73,.49,1.32,.08,[.17,.20,.22]);
  cube(out,tx+side*1.63,base+5.78,tz,.10,1.32,.49,[.17,.20,.22]);
 }
 cone(out,tx,base+7.65,tz,2.46,3.9,[.29,.34,.35],4);
 timberBeam(out,[tx,base+11.50,tz],[tx,base+13.45,tz],.14,loomOak);
 tri(out,[tx,base+13.35,tz],[tx,base+12.26,tz],[tx+2.25,base+13.05,tz+.22],faction);
 buildingHouse(out,x+3.70,local(3.7,2.20),z+2.20,3.8,3.12,3.5,[.62,.56,.46],[.43,.29,.22]);
 if(b.level>=2)buildingHouse(out,x-5.5,local(-5.5,4.55),z+4.55,3.66,3.36,3.52,[.61,.56,.44],tile);
 if(b.level>=3)buildingHouse(out,x+2.3,local(2.3,5.65),z+5.65,3.29,3.02,3.03,brick,tile);
}
function northernFarm(out,b,x,y,z,ghost){
 const local=(dx,dz)=>y+farmFooting(b,dx,dz),walls=[.70,.64,.49],thatch=[.51,.43,.29];
 buildingHouse(out,x+1.6,local(1.6,-2.8),z-2.8,7.10,3.0,4.15,walls,thatch);
 const mx=x-4.0,my=local(-4.0,-1.10),mz=z-1.10;
 cube(out,mx,my-.28,mz,2.68,1.25,2.57,loomStone);
 for(const side of [-1,1]){
  timberBeam(out,[mx+side*1.21,my+.35,mz-.91],[mx+side*.39,my+3.26,mz+.10],.29,loomOak);
  timberBeam(out,[mx+side*1.21,my+.35,mz+.91],[mx+side*.39,my+3.26,mz-.10],.29,loomOak);
 }
 timberBeam(out,[mx,my+.02,mz],[mx,my+5.28,mz],.43,loomOak);
 buildingHouse(out,mx,my+3.25,mz,2.92,2.14,2.94,[.48,.36,.25],[.33,.35,.33]);
 if(ghost)millSails(out,mx,my+5.05,mz+1.72,.76,.48);
 for(const [dx,dz] of [[-3.0,3.05],[-1.92,3.32],[-2.64,4.24],[1.19,3.62]])grainSack(out,x+dx,local(dx,dz),z+dz,1.13);
 if(b.level>=2){
  const sy=local(4.65,2.42);
  millShelter(out,x+4.65,sy,z+2.42,3.63,3.13,3.42);
  for(const dx of [3.75,4.65,5.35])grainSack(out,x+dx,sy,z+2.90,1.12);
 }
 if(b.level>=3){
  const sy=local(-5.14,4.75);
  buildingHouse(out,x-5.14,sy,z+4.75,3.12,2.63,3.19,[.54,.42,.30],thatch);
 }
}
function aridTown(out,b,x,y,z,flag){
 const plinth=[.57,.47,.34],plaster=[.76,.64,.47],sun=[.83,.73,.53];
 cube(out,x-1.2,y-.46,z-.85,10,1,7.4,plinth);
 for(const [dx,dz,w,d,h] of [[-3.55,-1.5,3.62,5.72,3.25],[.22,-3.07,4.32,2.62,3.92],[1.88,.26,2.72,3.78,3.52]]){
  cube(out,x+dx,y+.39,z+dz,w,h,d,plaster);
  for(const side of [-1,1]){
   cube(out,x+dx+side*(w*.5-.17),y+h+.36,z+dz,.34,.48,d,sun);
   cube(out,x+dx,y+h+.36,z+dz+side*(d*.5-.16),w,.46,.32,sun);
  }
  cube(out,x+dx,y+1.47,z+dz+d*.5+.03,.59,.88,.15,[.27,.23,.17]);
 }
 const tx=x-3.2,tz=z-2.1;
 cube(out,tx,y+.52,tz,1.77,7.6,1.84,plaster);
 cube(out,tx,y+7.86,tz,2.03,.38,2.09,sun);
 for(const side of [-1,1]){
  cube(out,tx+side*.80,y+8.18,tz,.26,1.03,1.98,plaster);
  cube(out,tx,y+8.18,tz+side*.83,1.94,1.03,.27,plaster);
 }
 timberBeam(out,[tx,y+9.16,tz],[tx,y+11.52,tz],.11,loomOak);
 tri(out,[tx,y+11.41,tz],[tx,y+10.49,tz],[tx+1.86,y+11.07,tz+.18],flag);
 if(b.level>=2)millShelter(out,x+.36,y,z+3.1,3.81,2.96,2.79);
 if(b.level>=3)dyeVat(out,x+4.4,y,z+2.3,1.16,[.28,.39,.34]);
}
function addBuilding(out,b,ghostColor){
 const parts=[],x=b.x,z=b.z,y=(b.groundY??surfaceHeight(x,z))+.35;
 const faction=FACTION_COLORS[b.faction]||[.62,.55,.44],level=b.level||1;
 if(b.type==='city'){
  const climate=landscapeClimate(x,z);
  if(GAME_MAP&&isDryArchitecture(climate))aridTown(parts,b,x,y,z,faction);
  else if(GAME_MAP)coastalTownHall(parts,x,y,z,level,faction);
  else northernTown(parts,b,x,y,z,faction);
 }else if(b.type==='grain'){
  if(GAME_MAP)coastalFarm(parts,b,x,y,z,!!ghostColor);
  else northernFarm(parts,b,x,y,z,!!ghostColor);
 }else if(b.type==='wood'){
  sawmillYard(parts,b,x,y,z);
  if(ghostColor)sawFrame(parts,x+1.5,y+farmFooting(b,0,0),z+1.17,1,.3);
 }else if(b.type==='iron')drawMineStructure(parts,b,x,y,z,!!ghostColor);
 else if(b.type==='cloth'){
  drawWeavingYard(parts,b,x,y,z);
  if(ghostColor)loomActivity(parts,x-2.12,y+farmFooting(b,-2.12,2.20),z+2.20,1,0);
 }else if(b.type==='port'){
  portWarehouse(parts,x,y,z);
 }
 const scale=b.scale??.34;
 for(let i=0;i<parts.length;i+=6){
  out.push(x+(parts[i]-x)*scale,y+(parts[i+1]-y)*scale,z+(parts[i+2]-z)*scale,
   ...(ghostColor||[parts[i+3],parts[i+4],parts[i+5]]));
 }
}
function roundedTree(out,x,y,z,r,h,color){
 const trunk=[.30,.27,.19];cube(out,x,y,z,r*.28,h*.52,r*.28,trunk);const rings=[[.32,.55],[.82,.95],[1,1.25],[.8,1.57],[.34,1.86]],sides=6;
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){let a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides,rr=r*rings[j][0],ss=r*rings[j+1][0],y1=y+h*rings[j][1]/2,y2=y+h*rings[j+1][1]/2,col=tint(color,.78+.1*((i+1)%4));quad(out,[x+Math.cos(a)*rr,y1,z+Math.sin(a)*rr],[x+Math.cos(b)*rr,y1,z+Math.sin(b)*rr],[x+Math.cos(b)*ss,y2,z+Math.sin(b)*ss],[x+Math.cos(a)*ss,y2,z+Math.sin(a)*ss],col)}
 const top=y+h;for(let i=0;i<sides;i++){let a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides,rr=r*rings.at(-1)[0];tri(out,[x+Math.cos(a)*rr,y+h*.93,z+Math.sin(a)*rr],[x+Math.cos(b)*rr,y+h*.93,z+Math.sin(b)*rr],[x,top,z],tint(color,1.08))}
}
function forestGround(x,z){return coastDistance(x,z)>=1&&!!regionAt(state.regions,x,z)}
function inCoastalWoods(x,z){
 const p=pilotLand;
 return p&&x>=p.x&&x<p.x+p.w&&z>=p.z&&z<p.z+p.h;
}
function makeCoastalWoods(){
 const p=pilotLand;
 if(!p)return null;
 // Keep crowns clear of the actual campaign roads, including segments crossing the window.
 const nodes=new Map(SCENARIO_ROADS.nodes.map(([id,x,z])=>[id,[x,z]]));
 const roads=[];
 for(const [a,b] of SCENARIO_ROADS.links){
  const [x,z]=nodes.get(a),[ex,ez]=nodes.get(b);
  if(Math.min(x,ex)>p.x+p.w+3||Math.max(x,ex)<p.x-3||Math.min(z,ez)>p.z+p.h+3||Math.max(z,ez)<p.z-3)continue;
  const dx=ex-x,dz=ez-z;
  roads.push([x,z,dx,dz,dx*dx+dz*dz||1]);
 }
 function nearRoad(x,z,radius){
  return roads.some(([ax,az,dx,dz,l2])=>{
   const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));
   return (x-ax-t*dx)**2+(z-az-t*dz)**2<radius*radius;
  });
 }
 let seed=32119;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const crowns=[],shadows=[],cells=new Map();
 const key=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
 for(let iz=p.z;iz<p.z+p.h;iz+=8)for(let ix=p.x;ix<p.x+p.w;ix+=8){
  const cx=ix+random()*8,cz=iz+random()*8;
  if(terrainAt(cx,cz)!=='forest')continue;
  const count=4+Math.floor(random()*13),radius=2.6+random()*3.9,stand=random();
  for(let j=0;j<count;j++){
   const angle=random()*2*Math.PI,dist=radius*Math.sqrt(random());
   const x=cx+Math.cos(angle)*dist,z=cz+Math.sin(angle)*dist*.82;
   if(!inCoastalWoods(x,z)||!forestGround(x,z))continue;
   const vigor=(1-.45*dist/radius)*(.65+random()*.58);
   const w=2.25*vigor,h=(3.2+1.3*random())*vigor;
   if(nearRoad(x,z,.8+w*.72))continue;
   let crowded=false;
   for(const dx of [-2,0,2])for(const dz of [-2,0,2])
    if(cells.get(key(x+dx,z+dz))?.some(t=>(t[0]-x)**2+(t[1]-z)**2<1.4**2))crowded=true;
   if(crowded)continue;
   const bucket=key(x,z);
   if(!cells.has(bucket))cells.set(bucket,[]);
   cells.get(bucket).push([x,z]);
   const variant=stand>.72&&random()<.78?2:random()<.43?0:random()<.5?1:3;
   const y=surfaceHeight(x,z)+.04,flip=random()<.5;
   for(const [u,v] of [[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]]){
    const s=flip?1-u:u;
    crowns.push(x,y,z,(u*2-1)*w,(1-v)*h,((variant%2)+s)*.5,(Math.floor(variant/2)+v)*.5);
   }
   shadows.push({x:x+.38*w,z:z+.33*w,rx:w*1.65,rz:w*1.10,opacity:.24});
  }
 }
 return {crowns:packForestVertices(crowns),shadows};
}
function packForestVertices(data){
 const buffer=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
 return {buffer,count:data.length/7};
}
function woodlandRoadIndex(){
 const size=24,cells=new Map();
 const key=(x,z)=>x+','+z;
 const roads=GAME_MAP?landscapeRoads(state.regions[0]):state.regions.flatMap(landscapeRoads);
 for(const road of roads){
  const {x,z,dx,dz}=road,l2=dx*dx+dz*dz||1;
  for(let row=Math.floor((Math.min(z,z+dz)-3)/size);row<=Math.floor((Math.max(z,z+dz)+3)/size);row++)
   for(let col=Math.floor((Math.min(x,x+dx)-3)/size);col<=Math.floor((Math.max(x,x+dx)+3)/size);col++){
    const id=key(col,row);
    if(!cells.has(id))cells.set(id,[]);
    cells.get(id).push({x,z,dx,dz,l2});
   }
 }
 return (x,z,radius)=>{
  const edges=cells.get(key(Math.floor(x/size),Math.floor(z/size)))||[];
  return edges.some(e=>{
   const t=Math.max(0,Math.min(1,((x-e.x)*e.dx+(z-e.z)*e.dz)/e.l2));
   return (x-e.x-t*e.dx)**2+(z-e.z-t*e.dz)**2<radius**2;
  });
 };
}
function appendTreeSprite(out,x,z,y,w,h,flip,from=0,to=1,top=0,bottom=1){
 for(const [u,v] of [[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]])
  out.push(x,y,z,(2*u-1)*w,(1-v)*h,from+(to-from)*(flip?1-u:u),top+(bottom-top)*v);
}
function forestSprites(){
 const deciduous=[],pines=[],scrub=[],floodplain=[],shadow=[],trees=[],nearRoad=woodlandRoadIndex();
 const cells=new Map(),cell=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
 let seed=21619;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const grid=landscapeGrid?(GAME_MAP?9.4:8.2):(GAME_MAP?13:10);
 for(let z=0;z<WORLD_HEIGHT;z+=grid)for(let x=0;x<WORLD_WIDTH;x+=grid){
  const cx=x+rand()*grid,cz=z+rand()*grid;
  if(inCoastalWoods(cx,cz)||!regionAt(state.regions,cx,cz))continue;
  const {moisture,warmth}=landscapeClimate(cx,cz),land=terrainFeatures(cx,cz);
  const height=landscapeRelief(cx,cz);
  const forest=Math.max(0,Math.min(1,(-land.forest+.56)*.58));
  const arid=warmth>.74&&moisture<.43;
  const density=landscapeGrid?landscapeSample(cx,cz,true):Math.max(0,Math.min(1,(forest*(.33+moisture*.85)+moisture*.12)*(1-height/95)));
  const stand=landscapeGrid?density*(.55+.45*density):density;
  if(rand()>(arid?.09+stand*.52:.045+stand*.97))continue;
  const count=arid?1+Math.floor(rand()*2):2+Math.floor((6+rand()*8)*stand),radius=2.1+rand()*4.65;
  for(let i=0;i<count;i++){
   const a=rand()*6.2832,radiusAt=Math.sqrt(rand())*radius;
   const px=cx+Math.cos(a)*radiusAt,pz=cz+Math.sin(a)*radiusAt*.79;
   if(inCoastalWoods(px,pz)||!forestGround(px,pz)||nearRoad(px,pz,arid?.94:1.66))continue;
   if(landscapeGrid&&!arid&&landscapeSample(px,pz,true)<.25)continue;
   let busy=false;
   for(const dx of [-2,0,2])for(const dz of [-2,0,2])
    if(cells.get(cell(px+dx,pz+dz))?.some(t=>(t.x-px)**2+(t.z-pz)**2<1.35**2))busy=true;
   if(busy)continue;
   const oasis=GAME_MAP&&warmth>.79&&moisture>.38&&height<26;
   const wetWood=moisture>.69&&height<18&&density>.32;
   const kind=oasis&&rand()<.86?'palm':wetWood&&rand()<.34?'poplar':GAME_MAP&&(arid||height<32&&warmth>.61&&moisture<.58&&rand()<.64-stand*.40)?'scrub':
    rand()<Math.max(.06,Math.min(.86,(1-warmth)*.53+height*.009-moisture*.22))?'spruce':'oak';
   const size=(.69+rand()*.69)*(arid?.46:1)*(1-radiusAt/radius*.24);
   const tree={x:px,z:pz,y:surfaceHeight(px,pz)+.05,kind,size,flip:rand()>.5};
   const index=cell(px,pz);
   if(!cells.has(index))cells.set(index,[]);
   cells.get(index).push(tree);trees.push(tree);
  }
 }
 trees.sort((a,b)=>a.z-b.z);
 for(const tree of trees){
  const {x,z,y,kind,size,flip}=tree;
  const riparian=kind==='palm'||kind==='poplar';
  const target=riparian?floodplain:kind==='oak'?deciduous:kind==='spruce'?pines:scrub;
  const half=size*({oak:2.43,spruce:1.54,scrub:1.32,palm:2.35,poplar:1.70}[kind]),height=size*({oak:4.82,spruce:5.50,scrub:2.46,palm:5.24,poplar:5.12}[kind]);
  if(kind==='oak'||riparian){
   const variant=riparian?Math.floor(rand()*2)+(kind==='poplar'?2:0):Math.floor(rand()*4),u=(variant%2)*.5,v=Math.floor(variant/2)*.5;
   appendTreeSprite(target,x,z,y,half,height,flip,u+.002,u+.498,v+.002,v+.498);
  }else appendTreeSprite(target,x,z,y,half,height,flip,kind==='scrub'?.005:0,kind==='scrub'?.495:1);
  if(kind==='scrub'&&size<.68)continue;
  shadow.push({x:x+half*.56,z:z+half*.44,rx:half*1.62,rz:half*1.04,opacity:.28});
 }
 return {...packForestVertices(deciduous),spruce:packForestVertices(pines),scrub:packForestVertices(scrub),floodplain:packForestVertices(floodplain),
  shadows:shadow,trees:trees.length};
}
const coastalWoods=makeCoastalWoods();
const treeProgram=gl.createMapProgram('forest');
const treeLoc={tone:gl.getUniformLocation(treeProgram,'uWidth'),orchard:gl.getUniformLocation(treeProgram,'uPaintPlots'),p:gl.getAttribLocation(treeProgram,'aPosition'),uv:gl.getAttribLocation(treeProgram,'aUV'),offset:gl.getAttribLocation(treeProgram,'aOffset'),orientation:gl.getUniformLocation(treeProgram,'uOrientation'),tilt:gl.getUniformLocation(treeProgram,'uTilt'),center:gl.getUniformLocation(treeProgram,'uCenter'),viewport:gl.getUniformLocation(treeProgram,'uViewport'),scale:gl.getUniformLocation(treeProgram,'uScale'),texture:gl.getUniformLocation(treeProgram,'uTree'),mask:gl.getUniformLocation(treeProgram,'uForestMask')};
let oliveBuffer=null,oliveSignature='';
function rebuildOlives(){
 if(!oliveAsset)return;
 const farms=state.regions.flatMap(r=>r.buildings.filter(b=>b.type==='grain').map(b=>({r,b})));
 const signature=farms.map(({r,b})=>r.id+':'+b.slotId).join('|');
 if(signature===oliveSignature)return;
 oliveSignature=signature;
 if(oliveBuffer)gl.deleteBuffer(oliveBuffer.buffer);
 const data=[];
 for(const {r,b} of farms){
  if(r.id===pilotLand.region){
   for(const [x,z,size,slender] of pilotLand.trees[b.slotId]||[]){
    const offset=(Math.floor(x*10+z*7)%2)*.5;
    appendTreeSprite(data,x,z,surfaceHeight(x,z)+.09,size*(slender?.76:1.17),size*(slender?2.6:2.1),Math.floor(z*6)%2,offset+.005,offset+.495);
   }
   continue;
  }
  const climate=landscapeClimate(b.x,b.z);
  if(climate.warmth<.59||climate.moisture<.37||climate.moisture>.70||terrainHeight(b.x,b.z)>30||r.id%3===0)continue;
  const turn=r.id*.65+b.slotId*.17,cos=Math.cos(turn),sin=Math.sin(turn),roads=roadsNearSite(r,b,17);
  for(let row=0;row<4;row++)for(let col=-3;col<=3;col++){
   const u=col*2.45,v=6.1+row*2.44, x=b.x+u*cos-v*sin,z=b.z+u*sin+v*cos;
   const size=.75+.17*Math.sin((row+1)*1.6+col);
   if(slotAt(r,x,z)?.id!==b.slotId||coastDistance(x,z)<1.4)continue;
   if(roads.some(e=>{
    const t=Math.max(0,Math.min(1,((x-e.x)*e.dx+(z-e.z)*e.dz)/(e.dx*e.dx+e.dz*e.dz||1)));
    return (x-e.x-t*e.dx)**2+(z-e.z-t*e.dz)**2<1.7;
   }))continue;
   appendTreeSprite(data,x,z,surfaceHeight(x,z)+.072,size*1.23,size*2.03,col%2===0,.006,.493);
  }
 }
 oliveBuffer=packForestVertices(data);
}
const shadowOctagon=Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4)]);
let buildingShadows=null,buildingShadowSignature='';
const actorShadowVertices=[],actorShadows={buffer:gl.createBuffer(),count:0};
function addActorShadow(x,z,width,depth,ground=null){
 if(!preferences.actorShadows)return;
 const center=ground??roadGround(x,z);
 const rim=shadowOctagon.map(([u,v])=>{
  const px=x+u*width,pz=z+v*depth;
  return [px,(ground??roadGround(px,pz))+.346,pz,0,0,.5+u*.5,.5+v*.5];
 });
 for(let i=0;i<rim.length;i++){
  actorShadowVertices.push(x,center+.346,z,0,0,.5,.5,...rim[i],...rim[(i+1)%rim.length]);
 }
}
function rebuildBuildingShadows(){
 const sites=[];
 for(const r of state.regions){
  if(r.owner==='neutral')sites.push(r.slots[0]);
  else sites.push(...r.buildings);
 }
 const signature=sites.map(b=>[b.x,b.z,b.type,b.level].join(':')).join('|');
 if(signature===buildingShadowSignature)return;
 buildingShadowSignature=signature;
 const data=[];
 for(const b of sites){
  const scale=b.scale??.34,city=!b.type||b.type==='city';
  const x=b.x+1.45*scale,z=b.z+1.18*scale;
  const width=(city?9.7:7.35)*scale,depth=(city?7.8:6.45)*scale;
  const vertex=(u,v)=>{
   const px=x+u*width,pz=z+v*depth;
   data.push(px,surfaceHeight(px,pz)+.119,pz,0,0,.5+u*.5,.5+v*.5);
  };
  for(let i=0;i<shadowOctagon.length;i++){
   vertex(0,0);vertex(...shadowOctagon[i]);vertex(...shadowOctagon[(i+1)%shadowOctagon.length]);
  }
 }
 if(buildingShadows)gl.deleteBuffer(buildingShadows.buffer);
 buildingShadows=packForestVertices(data);
}
function drawForest(shadowsOnly=false){if(!forestAsset.ready)return;gl.useProgram(treeProgram);gl.uniform1f(treeLoc.orchard,0);gl.uniform2f(treeLoc.center,cam.x,cam.z);gl.uniform2f(treeLoc.viewport,canvas.width,canvas.height);gl.uniform1f(treeLoc.scale,cam.scale);cameraUniforms(treeLoc);gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,forestMask);gl.uniform1i(treeLoc.mask,5);gl.enableVertexAttribArray(treeLoc.p);gl.enableVertexAttribArray(treeLoc.uv);gl.enableVertexAttribArray(treeLoc.offset);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 function group(mesh,asset,unit,cool=false){if(!mesh.count)return;gl.uniform1f(treeLoc.tone,cool?1:0);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,asset.texture);gl.uniform1i(treeLoc.texture,unit);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.vertexAttribPointer(treeLoc.p,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(treeLoc.offset,2,gl.FLOAT,false,28,12);gl.vertexAttribPointer(treeLoc.uv,2,gl.FLOAT,false,28,20);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 if(shadowsOnly){
  if(actorShadowVertices.length){
   gl.bindBuffer(gl.ARRAY_BUFFER,actorShadows.buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(actorShadowVertices),gl.DYNAMIC_DRAW);
   actorShadows.count=actorShadowVertices.length/7;
   gl.uniform1f(treeLoc.orchard,4);gl.depthMask(false);
   group(actorShadows,forestAsset,2);
   gl.depthMask(true);
  }
 }else{
 if(buildingShadows?.count&&cam.scale>=.006){
  gl.uniform1f(treeLoc.orchard,3);gl.depthMask(false);
  group(buildingShadows,forestAsset,2);
  gl.depthMask(true);gl.uniform1f(treeLoc.orchard,0);
 }
 if(coastalWoods&&woodlandAsset.ready)group(coastalWoods.crowns,woodlandAsset,2);
 if(woodlandAsset.ready)group(forestSpriteBuffer,woodlandAsset,2);if(forestSpruceAsset.ready)group(forestSpriteBuffer.spruce,forestSpruceAsset,3,true);
 if(floodplainAsset.ready)group(forestSpriteBuffer.floodplain,floodplainAsset,2);
 if(forestSpriteBuffer.scrub.count&&oliveAsset?.ready)group(forestSpriteBuffer.scrub,oliveAsset,2);
 if(oliveBuffer?.count&&oliveAsset.ready){gl.uniform1f(treeLoc.orchard,1);group(oliveBuffer,oliveAsset,2)}
 }
 gl.disable(gl.BLEND);gl.useProgram(prog);for(const i of [treeLoc.p,treeLoc.uv,treeLoc.offset])if(i!==loc.p&&i!==loc.c)gl.disableVertexAttribArray(i);gl.enableVertexAttribArray(loc.p);gl.enableVertexAttribArray(loc.c)}

// One compact exclusion texture keeps trees away from placed buildings, including free placements.
const forestMask=gl.createTexture();
function updateForestMask(){const n=256,data=new Uint8Array(n*n*4);function clearAt(p,range=5){let cx=Math.round(p.x/WORLD_WIDTH*(n-1)),cz=Math.round(p.z/WORLD_HEIGHT*(n-1));for(let dz=-Math.ceil(range/2.7);dz<=Math.ceil(range/2.7);dz++)for(let dx=-Math.ceil(range/2.7);dx<=Math.ceil(range/2.7);dx++){let x=cx+dx,z=cz+dz;if(x<0||x>=n||z<0||z>=n)continue;let wx=(x/(n-1))*WORLD_WIDTH,wz=(z/(n-1))*WORLD_HEIGHT;if(Math.hypot(wx-p.x,wz-p.z)<=range){let i=(z*n+x)*4;data[i]=255;data[i+3]=255}}}for(const r of state.regions){if(r.owner==='neutral')clearAt(r.slots[0]);else for(const b of r.buildings){let slot=r.slots.find(q=>q.id===b.slotId),cell=slot&&typeof PARCEL_DATA!=='undefined'?PARCEL_DATA[r.id]?.cells?.[slot.id]:null;const localYard=(b.type==='wood'||b.type==='iron'||b.type==='cloth')&&r.id===pilotLand?.region;if(cell&&b.type!=='wood'&&!localYard){for(const index of cell.mask){data[index*4]=255;data[index*4+3]=255}}else clearAt(b,localYard?7.5:5)}if(state.garrisons?.[r.id]?.troops>0)clearAt({x:r.slots[0].x+3,z:r.slots[0].z+3})}for(const army of state.fieldArmies||[])clearAt({x:army.location.point.x+3,z:army.location.point.z+3});gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,forestMask);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
function addArmyCamp(v,p,troops,owner){let y=roadGround(p.x,p.z)+.5,col=FACTION_COLORS[owner]||FACTION_COLORS.you,tents=Math.min(5,1+Math.floor(troops/200));for(let i=0;i<tents;i++){let x=p.x+2.5+i*1.8,z=p.z+2.5,base=y+.1,a=[x-.65,base,z-.55],b=[x+.65,base,z-.55],c=[x+.65,base,z+.55],d=[x-.65,base,z+.55],top1=[x,base+1.1,z-.55],top2=[x,base+1.1,z+.55];quad(v,a,top1,top2,d,[.64,.58,.43]);quad(v,top1,b,c,top2,[.76,.68,.49]);tri(v,a,b,top1,[.60,.53,.39]);tri(v,d,top2,c,[.60,.53,.39])}let n=Math.min(24,Math.max(6,Math.ceil(troops/15)));for(let i=0;i<n;i++){let x=p.x+2+(i%6)*.42,z=p.z+4+Math.floor(i/6)*.45;cube(v,x,y+.35,z,.18,.65,.18,col);cube(v,x,y+.78,z,.17,.18,.17,[.78,.68,.52])}cube(v,p.x+2,y+1.1,p.z+2,.06,2,.06,[.38,.3,.2]);cube(v,p.x+2,y+1.8,p.z+2.3,.06,.5,.6,col)}
// Parcel geometry is baked from the historical province mesh, not circles.
let parcelSignature='',parcelSurfaceSignature='',parcelDecorBuffer=null;const parcelDecorCache=new Map();
function parcelCell(r,slot){return typeof PARCEL_DATA==='undefined'?null:PARCEL_DATA[r.id]?.cells?.[slot.id]||null}
// Stable, low-poly auxiliary scenery distributed over each actual parcel.
function parcelDecorPoints(r,slot,b){let cell=parcelCell(r,slot);if(!cell)return [];let level=Math.max(1,Math.min(3,b.level||1)),pool=[],seen=new Set(),seed=(r.id+1)*37+(slot.id+1)*109,noise=n=>{let v=Math.sin(n*12.9898+seed*78.233)*43758.5453;return v-Math.floor(v)},inside=(x,z)=>slotAt(r,x,z)?.id===slot.id,minBuildingDistance=Math.max(1,Math.min(3.5,Math.sqrt(cell.area)*.25));function candidate(x,z,key){let signature=Math.round(x*5)+':'+Math.round(z*5);if(seen.has(signature)||Math.hypot(x-b.x,z-b.z)<minBuildingDistance||!inside(x,z))return;for(const [dx,dz] of [[.42,0],[-.42,0],[0,.42],[0,-.42]])if(!inside(x+dx,z+dz))return;seen.add(signature);let fullFit=true;for(const [dx,dz] of [[.95,0],[-.95,0],[0,.95],[0,-.95]])if(!inside(x+dx,z+dz)){fullFit=false;break}pool.push({x,z,rank:noise(key+71),fullFit,distance:Math.hypot(x-b.x,z-b.z)})}for(const index of cell.mask){let ix=index%256,iz=Math.floor(index/256),x=ix/255*WORLD_WIDTH+(noise(index+5)-.5)*2.4,z=iz/255*WORLD_HEIGHT+(noise(index+29)-.5)*1.7;candidate(x,z,index)}if(pool.length<16){let step=Math.max(3,Math.ceil(cell.i.length/900)*3);for(let i=0;i+2<cell.i.length;i+=step){let a=cell.i[i]*2,c=cell.i[i+1]*2,d=cell.i[i+2]*2;candidate((cell.v[a]+cell.v[c]+cell.v[d])/3,(cell.v[a+1]+cell.v[c+1]+cell.v[d+1])/3,i+100000)}}pool.sort((a,b)=>a.rank-b.rank);let near=pool.filter(p=>p.fullFit&&p.distance>=2.5).slice().sort((a,b)=>a.distance-b.distance).slice(0,3),ordered=[...near,...pool.filter(p=>!near.includes(p))],baseCount=Math.min(44,Math.max(8,Math.ceil(cell.area/90))),count=Math.min(44,baseCount+4*(level-1)),spacing=Math.max(.8,Math.min(2.6,Math.sqrt(cell.area)/(Math.sqrt(baseCount)*2.5))),points=[];for(const p of ordered){if(points.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<spacing))continue;let i=points.length,kind;if(b.type==='grain')kind=i<2&&p.fullFit&&p.distance>=2.5?'hut':i%8===2&&p.fullFit?'tree':i%5===3&&p.fullFit?'hay':'shrub';else if(b.type==='wood')kind=i<2&&p.fullFit?'woodpile':i%5===2&&p.fullFit?'hut':'shrub';else if(b.type==='iron')kind=i<2&&p.fullFit&&p.distance>=2.5?'minehut':i%4===2&&p.fullFit?'ore':'shrub';else if(b.type==='cloth')kind=i<2&&p.fullFit&&p.distance>=2.5?'hut':i%4===2&&p.fullFit?'rack':'shrub';else if(b.type==='port')kind=i<2&&p.fullFit&&p.distance>=2.5?'hut':i%4===2&&p.fullFit?'crate':'shrub';else kind=i<4&&p.fullFit&&p.distance>=2.5?'hut':i%7===0&&p.fullFit?'tree':'shrub';points.push({x:p.x,z:p.z,kind});if(points.length>=count)break}return points}

function parcelHut(out,x,z,variant){let y=surfaceHeight(x,z)+.22,wall=variant==='minehut'?[.52,.51,.46]:[.68,.61,.48],roofColor=variant==='minehut'?[.32,.30,.27]:[.43,.30,.23],w=1.5,d=1.15,h=.95;cube(out,x,y,z,w,h,d,wall);let a=[x-w*.58,y+h,z-d*.55],b=[x+w*.58,y+h,z-d*.55],c=[x+w*.58,y+h,z+d*.55],e=[x-w*.58,y+h,z+d*.55],top1=[x,y+h+.62,z-d*.55],top2=[x,y+h+.62,z+d*.55];quad(out,a,top1,top2,e,roofColor);quad(out,top1,b,c,top2,tint(roofColor,.78));tri(out,a,b,top1,roofColor);tri(out,e,top2,c,roofColor);cube(out,x,y+.12,z+d*.51,.26,.58,.08,[.28,.24,.20])}
function parcelTrail(out,r,slot,a,b){let dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.1)return;let nx=-dz/length*.11,nz=dx/length*.11,steps=Math.max(2,Math.ceil(length/2));for(let i=0;i<steps;i++){let t=i/steps,u=(i+1)/steps,x=a.x+dx*t,z=a.z+dz*t,xx=a.x+dx*u,zz=a.z+dz*u,mid=slotAt(r,(x+xx)/2,(z+zz)/2);if(!mid||mid.id!==slot.id||slotAt(r,x,z)?.id!==slot.id||slotAt(r,xx,zz)?.id!==slot.id)continue;let y=surfaceHeight(x,z)+.3,yy=surfaceHeight(xx,zz)+.3;quad(out,[x+nx,y,z+nz],[xx+nx,yy,zz+nz],[xx-nx,yy,zz-nz],[x-nx,y,z-nz],[.52,.45,.33])}}
// Population controls the amount of housing drawn inside the city's own parcel.
// Positions are deterministic and form a compact settlement around the city centre.
function cityGrowthStage(b){return b.type==='city'?Math.min(20,Math.floor(Math.max(0,b.population||0)/200)):0}
function cityGrowthPoints(r,slot,b){
 return coastalTownPlan(r,slot).houses.slice(0,Math.ceil(cityGrowthStage(b)*1.55));
}
function appendCityGrowth(out,r,slot,b,points){
 const stage=cityGrowthStage(b),lanes=new Map();
 for(const home of points){
  coastalTownHome(out,home,stage);
  if(!lanes.has(home.row))lanes.set(home.row,[]);
  lanes.get(home.row).push(home);
 }
 const plan=coastalTownPlan(r,slot);
 for(const [row,homes] of lanes){
  homes.sort((a,b)=>a.u-b.u);
  let end=null;
  for(const home of homes){
   const start=end!==null&&home.u-end<4.4?end:home.u-.78;
   const goal=home.u+.79;
   for(let u=start;u<goal;u+=1.03){
    const next=Math.min(goal,u+1.03);
    parcelTrail(out,r,slot,plan.project(u,plan.lane(u,row)),plan.project(next,plan.lane(next,row)));
   }
   end=goal;
  }
 }
 if(stage>=3){
  const market=points.find(p=>Math.abs(p.u)>2.9&&Math.abs(p.row)<2);
  if(market){
   const p=plan.project(market.u+1.36,plan.lane(market.u+1.36,market.row));
   if(!points.some(h=>distance(h,p)<1.25)&&slotAt(r,p.x,p.z)?.id===slot.id)
    marketStall(out,p.x,p.z,[.49,.37,.28]);
  }
 }
}
function fieldMargins(out,r,slot,b){
 const {moisture,warmth}=landscapeClimate(b.x,b.z);
 const walls=GAME_MAP&&warmth>.57&&moisture<.67;
 const thickets=moisture>.57;
 const angle=farmVariation(r,slot)*.39+.31,cs=Math.cos(angle),sn=Math.sin(angle);
 const roads=roadsNearSite(r,b,15);
 const point=(u,v)=>({x:b.x+u*cs-v*sn,z:b.z+u*sn+v*cs});
 const admissible=p=>slotAt(r,p.x,p.z)?.id===slot.id&&coastDistance(p.x,p.z)>1.2&&
  !roads.some(e=>{
   const t=Math.max(0,Math.min(1,((p.x-e.x)*e.dx+(p.z-e.z)*e.dz)/(e.dx*e.dx+e.dz*e.dz||1)));
   return (p.x-e.x-t*e.dx)**2+(p.z-e.z-t*e.dz)**2<.91;
  });
 for(const side of [-1,1]){
  const foot=side*(4.55+(b.level||1)*.49), count=8+(b.level||1)*2;
  for(let i=0;i<count;i++){
   const u=-count*.49+i*.98;
   // Gates break the hedges and wall runs at the access to the farm.
   if(i===Math.floor(count*.46)||i===Math.floor(count*.46)+1)continue;
   const v=foot+.36*Math.sin(u*.36+side),a=point(u,v),c=point(u+.93,v+.15*Math.cos(u));
   if(!admissible(a)||!admissible(c))continue;
   const y=surfaceHeight(a.x,a.z),yy=surfaceHeight(c.x,c.z);
   if(Math.abs(y-yy)>.56)continue;
   if(walls){
    const stone=tint([.61,.56,.46],.80+i%4*.07);
    timberBeam(out,[a.x,y+.18,a.z],[c.x,yy+.18,c.z],.37,stone);
    if(i%2===0)oreRock(out,a.x,y+.26,a.z,.28,.19,i*.7,tint(stone,1.16));
   }else if(thickets){
    oreRock(out,a.x,y,a.z,.57,.77+(i%3)*.12,i*.89,tint([.23,.39,.26],.86+i%5*.08));
   }else {
    cube(out,a.x,y,a.z,.10,.59,.12,[.41,.32,.22]);
    timberBeam(out,[a.x,y+.43,a.z],[c.x,yy+.43,c.z],.072,[.43,.33,.23]);
   }
  }
 }
}
function appendParcelDecor(out,r,slot,b){
 if(r.id===pilotLand?.region&&(b.type==='port'||b.type==='wood'||b.type==='iron'||b.type==='cloth'))return;
 if(r.id===pilotLand?.region&&b.type==='city'){
  drawCoastalDistrict(out,r,slot,b);
  return;
 }
 let key=r.id+':'+slot.id+':'+b.type+':'+(b.level||1)+':'+cityGrowthStage(b),cached=parcelDecorCache.get(key);if(!cached){cached=[];let houses=b.type==='city'?cityGrowthPoints(r,slot,b):[],points=parcelDecorPoints(r,slot,b);if(b.type==='grain'&&r.id===pilotLand?.region){
 points=points.filter(p=>p.kind==='hay'&&Math.hypot(b.x-p.x,b.z-p.z)<6);
}for(const p of points){if(b.type==='city'&&(p.kind==='hut'||houses.some(h=>Math.hypot(h.x-p.x,h.z-p.z)<1.5)))continue;let x=p.x,z=p.z,y=surfaceHeight(x,z)+.25;if(p.kind==='hut'||p.kind==='minehut'){parcelHut(cached,x,z,p.kind);parcelTrail(cached,r,slot,{x:b.x,z:b.z},p)}else if(p.kind==='tree'){roundedTree(cached,x,y,z,.58,1.7,[.30,.42,.27])}else if(p.kind==='hay'){cube(cached,x,y,z,.68,.46,.48,[.71,.59,.32]);cube(cached,x+.5,y,z+.18,.56,.38,.43,[.63,.50,.28])}else if(p.kind==='woodpile'){for(let j=0;j<3;j++)cube(cached,x,y+j*.17,z,1.15,.15,.25,[.49+j*.04,.36,.24])}else if(p.kind==='ore'){cone(cached,x,y,z,.65,.65,[.42,.43,.41],5)}else if(p.kind==='rack'){cube(cached,x-.5,y,z,.08,1.15,.08,[.36,.28,.20]);cube(cached,x+.5,y,z,.08,1.15,.08,[.36,.28,.20]);quad(cached,[x-.5,y+1,z],[x+.5,y+1,z],[x+.5,y+.45,z],[x-.5,y+.45,z],[.75,.65,.55])}else if(p.kind==='crate'){cube(cached,x,y,z,.60,.55,.55,[.49,.36,.25])}else{cone(cached,x,y,z,.40,.42,[.35,.45,.29],5)}}if(b.type==='city')appendCityGrowth(cached,r,slot,b,houses);if(b.type==='grain'&&r.id!==pilotLand?.region)fieldMargins(cached,r,slot,b);parcelDecorCache.set(key,cached)}for(const n of cached)out.push(n)}
function updateMeshBatch(previous,groups){
 const chunks=new Map();
 let count=0;
 for(const [id,group] of groups){
  let chunk=previous?.chunks.get(id);
  const signature=group.map(item=>item.signature).join('|');
  if(chunk?.signature!==signature){
   if(chunk)gl.deleteBuffer(chunk.buffer);
   const vertices=[];
   for(const item of group)item.append(vertices);
   chunk={...makeBuffer(vertices),signature};
  }
  count+=chunk.count;
  chunks.set(id,chunk);
 }
 for(const [id,chunk] of previous?.chunks||[])if(!chunks.has(id))gl.deleteBuffer(chunk.buffer);
 return {chunks,count};
}
function addMeshItem(groups,id,item){
 if(!groups.has(id))groups.set(id,[]);
 groups.get(id).push(item);
}
function drawMeshBatch(batch){
 if(batch)for(const chunk of batch.chunks.values())drawBuffer(chunk);
}
function deleteMeshBatch(batch){
 if(batch)for(const chunk of batch.chunks.values())gl.deleteBuffer(chunk.buffer);
}
function farmVariation(r,slot){return ((r.id*17+slot.id*31)%8+8)%8}
function rebuildParcelSurfaces(){
 let all=[];for(const r of state.regions)if(r.owner!=='neutral')for(const b of r.buildings){let slot=r.slots.find(s=>s.id===b.slotId);if(slot)all.push({r,b,slot})}
 let surfaceSignature=all.map(({r,b})=>[r.id,r.owner,b.slotId,b.type,b.level||1].join(':')).join('|'),signature=all.map(({r,b})=>[r.id,b.slotId,b.type,b.level||1,cityGrowthStage(b)].join(':')).join('|');
 if(surfaceSignature!==parcelSurfaceSignature){parcelSurfaceSignature=surfaceSignature;updateParcelStyles(all)}
 if(signature===parcelSignature)return;
 refreshUrbanPaint(all);
 parcelSignature=signature;
 const groups=new Map();
 for(const {r,b,slot} of all)addMeshItem(groups,Math.floor(r.id/4),{
  signature:[r.id,b.slotId,b.type,b.level||1,cityGrowthStage(b)].join(':'),
  append:vertices=>appendParcelDecor(vertices,r,slot,b)
 });
 parcelDecorBuffer=updateMeshBatch(parcelDecorBuffer,groups);
}
// A shared sea-side landing marks the port at the exact water waypoint used by ships.
function scenarioBerth(port,exclude){
 const key=port.x+':'+port.z+(exclude?':'+exclude.x+':'+exclude.z:'');
 const cache=state._portWaterCache??=new Map();
 if(cache.has(key)) return cache.get(key);
 let best=null,shore=null,gap=Infinity;
 for(const [ax,az,bx,bz] of coastIndex.segments){
  const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
  const t=Math.max(0,Math.min(1,((port.x-ax)*dx+(port.z-az)*dz)/(length*length)));
  const x=ax+dx*t,z=az+dz*t;
  if(Math.hypot(x-port.x,z-port.z)>gap+SHIP_CLEARANCE+8) continue;
  for(const side of [-1,1]) for(const offset of [SHIP_CLEARANCE+.5,SHIP_CLEARANCE+2,SHIP_CLEARANCE+4,SHIP_CLEARANCE+8]){
   const point={x:x-dz/length*side*offset,z:z+dx/length*side*offset};
   const d=distance(port,point);
   if(d>=gap||exclude&&distance(exclude,point)<.25||!navigableWater(point)) continue;
   best=point;shore={x,z};gap=d;
  }
 }
 if(best&&!exclude)storeHarborFrame(best,shore);
 cache.set(key,best);
 return best;
}

function portWaterCell(port,exclude=null){if(GAME_MAP)return scenarioBerth(port,exclude);let cache=state._portWaterCache??=new Map(),key=port.x+':'+port.z+(exclude?':'+exclude.x+':'+exclude.z:'');if(cache.has(key))return cache.get(key);let cells=state._seaWaterCells??=new Map(),best=null,d=Infinity;for(let x=0;x<=784;x+=14)for(let z=0;z<=280;z+=14){if(exclude&&x===exclude.x&&z===exclude.z)continue;let dd=(x-port.x)**2+(z-port.z)**2;if(dd>=d)continue;let k=x+','+z;if(!cells.has(k))cells.set(k,navigableWater({x,z}));if(cells.get(k)){best={x,z};d=dd}}cache.set(key,best);return best}
// The berth is reserved for the hull. All loading gear sits on its landward side.
function berthKey(p){return p.x.toFixed(4)+':'+p.z.toFixed(4)}
function harborFrame(port){
 if(!GAME_MAP)return null;
 const berth=portWaterCell(port);
 if(!berth)return null;
 return state._harborFrames?.get(berthKey(berth))||null;
}
function storeHarborFrame(berth,shore){
 const depth=distance(berth,shore),nx=(berth.x-shore.x)/depth,nz=(berth.z-shore.z)/depth;
 const frame={berth,shore,depth,nx,nz,angle:Math.atan2(-nx,nz)};
 (state._harborFrames??=new Map()).set(berthKey(berth),frame);
}
function harborCargo(out,x,y,z,size,barrel){
 const plank=[.49,.34,.21],band=[.25,.25,.22];
 if(barrel){
  const r=.37*size;
  farmRing(out,x,y,z,[[0,r*.83],[.18*size,r],[.52*size,r*1.07],[.82*size,r*.82],[.82*size,.01]],plank);
  for(const [h,rad] of [[.16,1],[.61,1.01]])farmRing(out,x,y,z,[[h*size,r*rad],[(h+.058)*size,r*rad]],band);
 }else{
  cube(out,x,y,z,.87*size,.73*size,.71*size,plank);
  for(const side of [-1,1])cube(out,x+side*.28*size,y,z,.10*size,.76*size,.75*size,tint(plank,1.24));
  timberBeam(out,[x-.37*size,y+.1*size,z+.37*size],[x+.37*size,y+.65*size,z+.37*size],.09*size,tint(plank,1.16));
 }
}
function portWarehouse(out,x,y,z){
 farmRange(out,x-.75,y,z-1.15,8.5,4.05,3.85,true);
 const wood=[.40,.285,.18];
 for(const dx of [-3.85,-.60,2.65]){
  cube(out,x+dx,y-.48,z+2.74,.24,2.72,.24,wood);
  timberBeam(out,[x+dx,y+1.68,z+2.74],[x+dx,y+2.68,z+1.34],.16,wood);
 }
 for(let i=0;i<5;i++){
  const left=x-4.2+i*1.48,right=left+1.48;
  quad(out,[left,y+2.75,z+.74],[right,y+2.75,z+.74],[right,y+2.28,z+3.15],[left,y+2.28,z+3.15],i%2?[.48,.52,.42]:[.78,.70,.53]);
 }
 for(let i=0;i<5;i++)harborCargo(out,x-3.05+i*1.16,y,z+1.84+(i%2)*.30,1.12,i<3);
 for(let i=0;i<3;i++)harborCargo(out,x+4.25+(i%2)*1.05,y,z-.55+Math.floor(i/2)*.95,1.08,i===2);
}
function harborCrane(out,x,y,z){
 const wood=[.43,.29,.17],light=[.59,.42,.25],iron=[.26,.25,.21];
 for(const sign of [-1,1]){
  timberBeam(out,[x-.53,y,z+sign*.45],[x,y+2.12,z+sign*.27],.17,wood);
  timberBeam(out,[x+.54,y,z+sign*.45],[x,y+2.12,z+sign*.27],.17,wood);
 }
 timberBeam(out,[x-.24,y+1.86,z+.18],[x+.29,y+2.86,z-1.25],.17,light);
 timberBeam(out,[x,y+.87,z+.28],[x+.20,y+2.60,z-.90],.13,wood);
 const wx=x-.48,wy=y+1.05,wz=z+.22;
 // The crane's winding wheel turns around a horizontal axle.
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
  const point=t=>[wx,wy+Math.cos(t)*.64,wz+Math.sin(t)*.64];
  timberBeam(out,point(a),point(b),.12,light);
  if(i%2===0)timberBeam(out,[wx,wy,wz],point(a),.07,wood);
 }
 roundTimber(out,x,wy,wz,1.11,.09,iron,10);
 timberBeam(out,[x+.29,y+2.85,z-1.25],[x+.29,y+2.63,z-1.25],.045,iron);
}
function drawHarborLanding(out,port,f){
 const local=[],wood=[.40,.29,.20],stone=[.61,.56,.45],deck=-.54;
 // Local +z points inland and x runs along the waterfront.
 const front=1.43,back=front+1.18,reach=f.depth+1.0;
 for(let i=0;i<20;i++){
  const x=-2.75+(i+.5)*.275;
  cube(local,x,deck-.16,(front+back)/2,.27,.16,back-front,tint(wood,.94+.15*Math.sin(i*17)));
 }
 for(const x of [-2.55,-1.25,0,1.25,2.55])for(const z of [front+.08,back-.08]){
  cube(local,x,-1.86,z,.18,1.45,.18,tint(wood,.78));
  cube(local,x,deck+.09,z,.22,.09,.22,wood);
 }
 // The walkway meets the land behind the actual chosen shoreline.
 const steps=Math.max(2,Math.ceil((reach-front)/.34));
 for(let i=0;i<steps;i++){
  const z1=front+(reach-front)*i/steps,z2=front+(reach-front)*(i+1)/steps;
  cube(local,1.55,deck-.11,(z1+z2)/2,.91,.14,z2-z1-.012,tint(wood,.92+.11*(i%3)));
  if(i%4===0)for(const side of [-1,1])cube(local,1.55+side*.39,-1.72,z2,.13,1.28,.14,wood);
 }
 for(let i=0;i<6;i++)cube(local,-2.18+i*.87,deck-.19,back+.22,.84,.42,.47,tint(stone,.89+.06*(i%3)));
 harborCrane(local,-.96,deck+.02,back-.20);
 for(let i=0;i<4;i++)harborCargo(local,.23+(i%2)*.52,deck+.02,front+.31+Math.floor(i/2)*.51,.61,i<2);
 const color=FACTION_COLORS[port.faction]||[.73,.60,.38];
 timberBeam(local,[2.48,deck,back],[2.48,deck+1.83,back],.075,wood);
 tri(local,[2.48,deck+1.78,back],[2.48,deck+1.39,back],[1.78,deck+1.57,back+.08],color);
 for(let i=0;i<local.length;i+=6){
  const u=local[i],v=local[i+2];
  out.push(f.berth.x+u*f.nz-v*f.nx,local[i+1],f.berth.z-u*f.nx-v*f.nz,local[i+3],local[i+4],local[i+5]);
 }
 // A short shore access follows the ground and stops at complex inlets.
 const end={x:f.shore.x+1.55*f.nz-f.nx,z:f.shore.z-1.55*f.nx-f.nz};
 const length=distance(port,end),region=regionAt(state.regions,port.x,port.z);
 if(length<.4||length>28||!region)return;
 const dx=(end.x-port.x)/length,dz=(end.z-port.z)/length,n=Math.ceil(length/.46);
 const point=(t,side)=>{
  const x=port.x+dx*length*t-dz*.23*side,z=port.z+dz*length*t+dx*.23*side;
  return [x,surfaceHeight(x,z)+.09,z];
 };
 const edges=[];
 for(let j=0;j<=n;j++){
  const l=point(j/n,-1),r=point(j/n,1);
  if(!insideRegion(region,l[0],l[2])||!insideRegion(region,r[0],r[2])||isSeaBackground(l[0],l[2])||isSeaBackground(r[0],r[2]))return;
  edges.push([l,r]);
 }
 for(let j=1;j<edges.length;j++)quad(out,edges[j-1][0],edges[j-1][1],edges[j][1],edges[j][0],[.54,.46,.33]);
}
function addPortLanding(out,port){const frame=harborFrame(port);if(frame){drawHarborLanding(out,port,frame);return}let p=portWaterCell(port);if(!p)return;let y=-.83,wood=[.44,.32,.21],wall=[.70,.64,.49],roofColor=[.44,.29,.23];cube(out,p.x,y,p.z,3.8,.3,2.6,wood);cube(out,p.x-1,y+.3,p.z,1.3,1.2,1.2,wall);cone(out,p.x-1,y+1.5,p.z,1.0,.7,roofColor,4);cube(out,p.x+1.3,y+.3,p.z+.8,.12,1.9,.12,wood);cube(out,p.x+1.3,y+1.9,p.z+.56,.08,.45,.50,FACTION_COLORS[port.faction]||[.80,.70,.48])}
function addArmoryAnnex(out,region){
 const seat=duchySeat(region);
 if(!seat)return;
 const s=seat.scale??.34;
 const site=[[-8,5],[8,5],[-7,-6],[7,-6]].map(([dx,dz])=>({x:seat.x+dx*s,z:seat.z+dz*s}))
  .find(p=>slotAt(region,p.x,p.z)?.id===seat.slotId);
 if(!site)return;
 const {x,z}=site,y=surfaceHeight(x,z)+.25;
 const stone=[.53,.49,.40],roof=[.28,.26,.24],oak=[.36,.26,.19];
 cube(out,x,y,z,5.8*s,.36*s,4.0*s,stone);
 cube(out,x,y+.28*s,z,5.4*s,2.55*s,3.6*s,stone);
 tiledRoof(out,x,y+2.8*s,z,5.9*s,4.0*s,1.28*s,roof);
 cube(out,x+1.77*s,y+1.0*s,z+.60*s,.83*s,4.1*s,.86*s,[.47,.34,.27]);
 cube(out,x+1.77*s,y+5.1*s,z+.60*s,1.03*s,.24*s,1.06*s,[.39,.30,.24]);
 cube(out,x-.73*s,y+.36*s,z+1.82*s,.91*s,1.72*s,.11*s,oak);
 for(const dx of [-1.9,1.2])cube(out,x+dx*s,y+1.37*s,z+1.83*s,.52*s,.55*s,.12*s,[.24,.18,.12]);
 cube(out,x+2.2*s,y+.27*s,z+2.6*s,1.25*s,.49*s,.70*s,oak);
 cube(out,x+2.2*s,y+.75*s,z+2.6*s,.92*s,.22*s,.47*s,[.39,.41,.40]);
}
function geometryForBuildings(){
 rebuildOlives();updateForestMask();rebuildBuildingShadows();
 const groups=new Map();
 for(const region of state.regions){
  const owner=region.owner,garrison=state.garrisons?.[region.id];
  const troops=garrison?.owner===owner?garrison.troops:0;
  const buildings=region.buildings.map(b=>[b.type,b.x,b.z,b.capital,b.level].join(',')).join(':');
  addMeshItem(groups,Math.floor(region.id/4),{
   signature:[region.id,owner,troops,buildings,!!region.armory?.ready].join(':'),
   append(vertices){
    if(owner==='neutral'){
     const site=region.slots[0];
     const town={type:'city',x:site.x,z:site.z,scale:Math.min(site.scale,.24),slotId:0,faction:owner,population:800};
     addBuilding(vertices,town);
     appendCityGrowth(vertices,region,site,town,cityGrowthPoints(region,site,town));
    }else for(const building of region.buildings){
     const model={...building,faction:owner,farmForm:farmFormFor(region,building.slotId)};
     addBuilding(vertices,model);
     if(building.type==='port')addPortLanding(vertices,model);
    }
    if(owner==='you'&&region.armory?.ready)addArmoryAnnex(vertices,region);
    if(troops>0)addArmyCamp(vertices,region.slots[0],troops,owner);
   }
  });
 }
 for(const army of state.fieldArmies||[])addMeshItem(groups,-1,{
  signature:[army.owner,army.location.point.x,army.location.point.z,army.troops].join(':'),
  append:vertices=>addArmyCamp(vertices,army.location.point,army.troops,army.owner)
 });
 rebuildParcelSurfaces();
 return updateMeshBatch(buildingsBuffer,groups);
}
// Extend the same relief outside playable borders instead of a flat floor.
// The sea remains below water level, so the water surface covers the seabed.
const BOARD_SEA=[[-112,-176],[860,-176],[840,-140],[815,-110],[800,-65],[800,0],...BALTIC.slice(2),[-112,265]];
function backgroundHeight(x,z){return inRing(x,z,BOARD_SEA)?-2:surfaceHeight(x,z)}
function createBasemap(){
 const land=[],sea=[],table=[],step=16,x0=-112,x1=1200,z0=-176,z1=816,cache=new Map();
 const tableX=WORLD_WIDTH+900,tableZ=WORLD_HEIGHT+1098;
 quad(table,[-1200,-5,-1200],[tableX,-5,-1200],[tableX,-5,tableZ],[-1200,-5,tableZ],[.07,.09,.10]);
 function ground(x,z){let key=x+','+z,p=cache.get(key);if(!p){p={x,z,y:backgroundHeight(x,z),color:landscapeColor(x,z)};cache.set(key,p)}return p}
 function push(p){vertex(land,p.x,p.y,p.z,p.color)}
 if(!GAME_MAP){
  // The land backdrop is clipped to the world bounds: nothing pokes past the
  // map edge, so the painted geography can never smear outside the world.
  const gx0=Math.max(0,x0),gx1=Math.min(WORLD_WIDTH,x1),gz0=Math.max(0,z0),gz1=Math.min(WORLD_HEIGHT,z1);
  for(let z=gz0;z<gz1;z+=step)for(let x=gx0;x<gx1;x+=step){let a=ground(x,z),b=ground(x+step,z),c=ground(x+step,z+step),d=ground(x,z+step);push(a);push(b);push(c);push(a);push(c);push(d)}
 }
 const [xMin,zMin,xMax,zMax]=GAME_MAP?.bounds||[0,0,0,0],outer=GAME_MAP?[[xMin,zMin],[xMax,zMin],[xMax,zMax],[xMin,zMax]]:BOARD_SEA;
 if(GAME_MAP){
  // The study area ends across a continent. Keep the dry backdrop behind settlements near its edge.
  const spacing=2;
  const coast=[];
  for(let x=xMin;x<xMax+spacing;x+=spacing){
   const px=Math.min(x,xMax);
   coast.push({x:px,water:isSeaBackground(px,zMax-.15),reach:0});
  }
  // Round off each inlet across the campaign cut using its own mouth width.
  // The curved shoreline is a mesh row, so no fixed-width columns show through.
  for(let i=0;i<coast.length;){
   if(!coast[i].water){i++;continue}
   const start=i;
   while(i<coast.length&&coast[i].water)i++;
   const west=coast[start].x-spacing*.5,east=coast[i-1].x+spacing*.5;
   const radius=(east-west)*.5;
   for(let j=start;j<i;j++){
    const u=(coast[j].x-west)/radius-1;
    coast[j].reach=Math.min(39,radius*.81)*Math.sqrt(Math.max(0,1-u*u));
   }
  }
  let rim=null;
  for(const {x,water,reach} of coast){
   const bands=[0,Math.max(.08,reach*.51),Math.max(.16,reach),reach+2.1,reach+8,64,104];
   const column=bands.map((offset,row)=>{
    const p=ground(x,zMax+offset);
    if(!water||row>3)return p;
    return {...p,y:[-1.45,-1.38,-1.05,Math.max(-.4,p.y)][row]};
   });
   if(rim)for(let i=1;i<bands.length;i++){
    push(rim[i-1]);push(column[i-1]);push(column[i]);
    push(rim[i-1]);push(column[i]);push(rim[i]);
   }
   rim=column;
  }
 }
 // Continue the water underneath the coastal backdrop. Open estuaries at the
 // campaign edge should expose water between the banks, not the tabletop.
 if(GAME_MAP)quad(sea,[xMin,-1.05,zMax],[xMax,-1.05,zMax],[xMax,-1.05,zMax+104],[xMin,-1.05,zMax+104],[.12,.23,.27]);
 for(const triangle of triangulatePolygon(outer))tri(sea,[triangle[0][0],-1,triangle[0][1]],[triangle[1][0],-1,triangle[1][1]],[triangle[2][0],-1,triangle[2][1]],[.12,.23,.27]);
 return {land:makeBuffer(land),sea:makeBuffer(sea),table:makeBuffer(table)};
}

// Paint shadows in map coordinates, so the actual ground depth and slope never cut them.
function makeCanopyShadowTexture(stands){
 const width=2048,height=Math.round(width*WORLD_HEIGHT/WORLD_WIDTH);
 const scaleX=width/WORLD_WIDTH,scaleZ=height/WORLD_HEIGHT;
 const pixels=new Uint8Array(width*height*4);
 for(const {x,z,rx,rz,opacity} of stands){
  const centerX=x*scaleX-.5,centerZ=z*scaleZ-.5;
  const dx=Math.max(.9,rx*scaleX),dz=Math.max(.9,rz*scaleZ);
  for(let row=Math.max(0,Math.floor(centerZ-dz));row<=Math.min(height-1,Math.ceil(centerZ+dz));row++){
   const v=((row-centerZ)/dz)**2;
   for(let col=Math.max(0,Math.floor(centerX-dx));col<=Math.min(width-1,Math.ceil(centerX+dx));col++){
    const q=((col-centerX)/dx)**2+v;
    if(q>=1)continue;
    const at=(row*width+col)*4, shade=opacity*(1-q)*(1-q);
    pixels[at]=Math.min(100,Math.round(pixels[at]+shade*(255-pixels[at])));
   }
  }
 }
 const texture=gl.createTexture();
 gl.activeTexture(gl.TEXTURE0+15);
 gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.generateMipmap();
 return texture;
}
let buildingsBuffer,ghostBuffer=null;const basemap=createBasemap();createTerrain();const forestSpriteBuffer=forestSprites();const canopyShadowTexture=makeCanopyShadowTexture([...(coastalWoods?.shadows||[]),...forestSpriteBuffer.shadows]);buildingsBuffer=geometryForBuildings();
// Screen-space ribbons keep political boundaries legible at every zoom.
const borderProgram=gl.createMapProgram('border');
const borderLoc={position:gl.getAttribLocation(borderProgram,'aPosition'),direction:gl.getAttribLocation(borderProgram,'aDirection'),side:gl.getAttribLocation(borderProgram,'aSide'),center:gl.getUniformLocation(borderProgram,'uCenter'),viewport:gl.getUniformLocation(borderProgram,'uViewport'),scale:gl.getUniformLocation(borderProgram,'uScale'),orientation:gl.getUniformLocation(borderProgram,'uOrientation'),tilt:gl.getUniformLocation(borderProgram,'uTilt'),width:gl.getUniformLocation(borderProgram,'uWidth'),color:gl.getUniformLocation(borderProgram,'uColor')};
const borderNeighbors=new Map();
const borderRings=new Map();
function groundedBorderRings(region){
 if(borderRings.has(region.id))return borderRings.get(region.id);
 const size=landscapeGrid?4:GAME_MAP?10:4,rings=[];
 for(const poly of region.polys)for(const ring of poly){
  const points=[];
  for(let i=0;i<ring.length;i++){
   const [x,z]=ring[i],end=ring[(i+1)%ring.length],dx=end[0]-x,dz=end[1]-z,cuts=[0];
   for(const [from,to] of [[x,end[0]],[z,end[1]]]){
    for(let grid=(Math.floor(Math.min(from,to)/size)+1)*size;grid<Math.max(from,to);grid+=size){
     const t=(grid-from)/(to-from);
     if(t>1e-6&&t<1-1e-6)cuts.push(t);
    }
   }
   cuts.sort((a,b)=>a-b);
   for(const t of cuts){
    const px=x+dx*t,pz=z+dz*t,last=points.at(-1);
    if(last&&Math.hypot(px-last[0],pz-last[2])<1e-5)continue;
    points.push([px,surfaceHeight(px,pz),pz]);
   }
  }
  rings.push(points);
 }
 borderRings.set(region.id,rings);
 return rings;
}
function borderNeighbor(r,a,b){let key=r.id+':'+a[0]+','+a[2]+':'+b[0]+','+b[2];if(borderNeighbors.has(key))return borderNeighbors.get(key);let dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),mx=(a[0]+b[0])/2,mz=(a[2]+b[2])/2,neighbor=null;if(length){let nx=-dz/length,nz=dx/length;for(const id of r.adj||[]){let candidate=state.regions.find(q=>q.id===id);if(!candidate)continue;for(const offset of [.15,.45,1])if(insideRegion(candidate,mx+nx*offset,mz+nz*offset)||insideRegion(candidate,mx-nx*offset,mz-nz*offset)){neighbor=id;break}if(neighbor!==null)break}}borderNeighbors.set(key,neighbor);return neighbor}
function isInternalBorder(r,a,b){if(r.owner==='neutral')return false;const id=borderNeighbor(r,a,b),neighbor=state.regions.find(q=>q.id===id);return !!neighbor&&neighbor.owner===r.owner}
function borderVertices(r,outerOnly=true){let out=[];for(const pts of groundedBorderRings(r)){if(pts.length<3)continue;const direction=(a,b)=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]],push=(p,d,side)=>out.push(...p,...d,side);for(let i=0;i<pts.length;i++){let a=pts[i],b=pts[(i+1)%pts.length],prev=pts[(i+pts.length-1)%pts.length],d=direction(a,b),last=direction(prev,a);if(Math.hypot(...d)<.0001||outerOnly&&isInternalBorder(r,a,b))continue;
 push(a,d,-1);push(a,d,1);push(b,d,1);push(a,d,-1);push(b,d,1);push(b,d,-1);
 // Bevel joins connect adjacent ribbons without gaps at turns.
 if(Math.hypot(...last)>.0001&&(!outerOnly||!isInternalBorder(r,prev,a))){push(a,last,0);push(a,last,1);push(a,d,1);push(a,last,0);push(a,d,-1);push(a,last,-1)}
 }}return out}
function makeBorderBuffer(vertices){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return {buffer:b,count:vertices.length/7}}
const borderBuffers=new Map();for(const r of state.regions)borderBuffers.set(r.id,makeBorderBuffer(borderVertices(r)));
// Державы и вассальные владения используют SVG для ореолов и пунктирных линий.
function isVassalDivision(r,a,b){
 if(r.owner==='neutral'||r.vassalId==null)return false;
 const id=borderNeighbor(r,a,b),neighbor=state.regions.find(q=>q.id===id);
 // The dashed contour wraps the whole vassal domain: internal divisions,
 // the country outline (coast or foreign border) — everything except edges
 // shared with regions of the same vassal.
 if(!neighbor)return true;
 if(neighbor.owner!==r.owner)return r.id<neighbor.id;
 if(neighbor.vassalId===r.vassalId)return false;
 return neighbor.vassalId==null||r.vassalId<neighbor.vassalId;
}
// Any edge where this vassal region touches crown land, another vassal or the
// country outline — used for the inward fade, drawn from every vassal side.
function isDivisionEdge(r,a,b){
 if(r.owner==='neutral'||r.vassalId==null)return false;
 const id=borderNeighbor(r,a,b),neighbor=state.regions.find(q=>q.id===id);
 if(!neighbor)return true;
 if(neighbor.owner!==r.owner)return r.id<neighbor.id;
 if(neighbor.vassalId===r.vassalId)return false;
 return true;
}
const borderOverlayLayer=$('vassal-border-layer');
let borderOverlay=null;
function buildBorderOverlay(signature){
 const D=8,G=7;
 const smoothChain=points=>{
  if(points.length<3)return points;
  for(let pass=0;pass<2;pass++){
   const out=[];
   for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    out.push(a.map((value,j)=>value*.75+b[j]*.25),b.map((value,j)=>value*.75+a[j]*.25));
   }
   points=out;
  }
  return points;
 };
 const paths=[],clips=new Set();
 let definitions='',halo='',dashes='';
 const addPath=(id,chains,closed=false)=>{
  paths.push({id,chains,closed});
  return `<path id="${id}" ${closed?'clip-rule="evenodd"':'fill="none" vector-effect="non-scaling-stroke"'}/>`;
 };
 const chainsFor=(r,pred)=>{
  const chains=[];
  for(const pts of groundedBorderRings(r)){
   if(pts.length<3)continue;
   let chain=null;
   for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length];
    if(pred(a,b)){
     if(!chain)chain=[a];
     chain.push(b);
    }else if(chain){chains.push(chain);chain=null}
   }
   if(chain)chains.push(chain);
  }
  return chains.map(smoothChain);
 };
 const haloGroup=(prefix,r,chains,css,passes)=>{
  const clipId='border-clip-'+r.id,lineId=prefix+'-line-'+r.id;
  if(!clips.has(clipId)){
   clips.add(clipId);
   const rings=groundedBorderRings(r).filter(ring=>ring.length>=3);
   definitions+=`<clipPath id="${clipId}">${addPath(clipId+'-path',rings,true)}</clipPath>`;
  }
  definitions+=addPath(lineId,chains);
  return `<g clip-path="url(#${clipId})">`+
   passes.map(([w,a])=>`<use href="#${lineId}" stroke="${css}" stroke-width="${w}" stroke-opacity="${a}"/>`).join('')+'</g>';
 };
 // Country outline: a soft wash of the realm color hugging the outer border
 // from the inside (land borders and the coast), fading away from the edge.
 const REALM_HALO_PASSES=[[4,.4],[9,.22],[15,.12],[23,.06],[34,.03]];
 for(const owner of new Set(state.regions.filter(r=>r.owner!=='neutral').map(r=>r.owner))){
  const css='rgb('+mixColor(FACTION_COLORS[owner]||FACTION_COLORS.you,[.98,.95,.86],.45).map(v=>Math.round(v*255)).join(',')+')';
  for(const r of state.regions){
   if(r.owner!==owner)continue;
   const chains=chainsFor(r,(a,b)=>{
    const nid=borderNeighbor(r,a,b);
    return !(nid!=null&&(state.regions.find(q=>q.id===nid)||{}).owner===owner);
   });
   if(!chains.length)continue;
   halo+=haloGroup('rb',r,chains,css,REALM_HALO_PASSES);
  }
 }
 // Soft inward fade: every vassal region gets a halo of its own color that
 // falls off from the division border into its territory (clipped to the
 // region polygon so it never bleeds into the neighbour).
 const HALO_PASSES=[[4,.38],[8,.2],[13,.11],[19,.05],[27,.02]];
 for(const r of state.regions){
  if(r.owner==='neutral'||r.vassalId==null)continue;
  const vassal=vassalFor(state,r);
  if(!vassal)continue;
  const chains=chainsFor(r,(a,b)=>isDivisionEdge(r,a,b));
  if(!chains.length)continue;
  const vassalColor='rgb('+(vassal.color||[.9,.8,.5]).map(v=>Math.round(v*255)).join(',')+')';
  halo+=haloGroup('vb',r,chains,vassalColor,HALO_PASSES);
 }
 for(const r of state.regions){
  if(r.owner==='neutral'||r.vassalId==null)continue;
  const chains=chainsFor(r,(a,b)=>isVassalDivision(r,a,b));
  if(!chains.length)continue;
  const vassal=vassalFor(state,r);
  const realmColor='rgb('+mixColor(FACTION_COLORS[r.owner]||FACTION_COLORS.you,[.97,.94,.82],.55).map(v=>Math.round(v*255)).join(',')+')';
  const vassalColor='rgb('+(vassal?.color||[.9,.8,.5]).map(v=>Math.round(v*255)).join(',')+')';
  const lineId='border-dash-'+r.id;
  definitions+=addPath(lineId,chains);
  const dash=`${D},${G},${D},${G},${D},${G}`;
  dashes+=`<use href="#${lineId}" stroke="${realmColor}" stroke-width="2" stroke-dasharray="${dash}"/>`+
          `<use href="#${lineId}" stroke="${vassalColor}" stroke-width="2" stroke-dasharray="${dash}" stroke-dashoffset="${2*(D+G)}"/>`;
 }
 borderOverlayLayer.innerHTML='<g><defs>'+definitions+'</defs>'+halo+dashes+'</g>';
 for(const path of paths)path.element=borderOverlayLayer.querySelector('#'+path.id);
 return {signature,paths,group:borderOverlayLayer.firstElementChild};
}
function renderVassalBorders(){
 const signature=state.regions.map(r=>[
  r.id,r.owner,r.vassalId,FACTION_COLORS[r.owner],vassalFor(state,r)?.color
 ].join(':')).join('|');
 if(borderOverlay?.signature!==signature)borderOverlay=buildBorderOverlay(signature);
 const width=canvas.clientWidth,height=canvas.clientHeight;
 if(!width||!height)return;
 const yaw=cam.yaw||0,tilt=cam.tilt??DEFAULT_CAMERA_TILT;
 const c=Math.cos(yaw),s=Math.sin(yaw),norm=1/Math.hypot(1,tilt);
 if(borderOverlay.yaw!==yaw||borderOverlay.tilt!==tilt){
  // Проекция без смещения и масштаба камеры, с учётом высоты рельефа.
  for(const {element,chains,closed} of borderOverlay.paths){
   let d='';
   for(const chain of chains){
    for(let i=0;i<chain.length;i++){
     const [x,y,z]=chain[i];
     const px=c*x-s*z,py=((s*x+c*z)*tilt-y-.7)*norm;
     d+=(i?'L':'M')+px.toFixed(3)+' '+py.toFixed(3);
    }
    if(closed)d+='Z';
   }
   element.setAttribute('d',d);
  }
  borderOverlay.yaw=yaw;borderOverlay.tilt=tilt;
 }
 if(borderOverlay.width!==width||borderOverlay.height!==height){
  borderOverlayLayer.setAttribute('viewBox','0 0 '+width+' '+height);
  borderOverlay.width=width;borderOverlay.height=height;
 }
 const scale=height*cam.scale/2;
 const x=width/2-(c*cam.x-s*cam.z)*scale;
 const y=height/2-(s*cam.x+c*cam.z)*tilt*norm*scale;
 const transform=`translate(${x} ${y}) scale(${scale})`;
 if(borderOverlay.transform!==transform){
  borderOverlay.group.setAttribute('transform',transform);
  borderOverlay.transform=transform;
 }
}
function enqueueBorders(changed){
 const pending=state.regions.filter(r=>!changed||r.id===changed.id||(r.adj||[]).includes(changed.id)||(changed.adj||[]).includes(r.id));
 const next=()=>{
  const r=pending.shift();
  if(r){const old=borderBuffers.get(r.id);if(old)gl.deleteBuffer(old.buffer);borderBuffers.set(r.id,makeBorderBuffer(borderVertices(r)))}
  if(pending.length)state.visualJobs.push(next);
 };
 state.visualJobs.push(next);
}
function refreshBorders(changed=null){for(const r of state.regions){if(changed&&r.id!==changed.id&&!(r.adj||[]).includes(changed.id)&&!(changed.adj||[]).includes(r.id))continue;const old=borderBuffers.get(r.id);if(old)gl.deleteBuffer(old.buffer);borderBuffers.set(r.id,makeBorderBuffer(borderVertices(r)))}}
// Political shading is measured from the outer border of the whole realm.
const countryTintBuffers=new Map(),countryMeshes=new Map(surfaceMeshes.map(m=>[m.id,m]));
function clearCountryTints(){for(const entry of countryTintBuffers.values())gl.deleteBuffer(entry.buffer);countryTintBuffers.clear()}
function rebuildCountryTint(owner,changed=null){
 if(!owner||owner==='neutral')return;
 const areas=state.regions.filter(r=>r.owner===owner);
 if(!areas.length)return;
 // A small distance field is enough for a political wash that fades over tens of map units.
 const radius=48,step=3,diag=Math.SQRT2;
 const local=changed&&areas.every(r=>r===changed||countryTintBuffers.get(r.id)?.owner===owner);
 const ranges=(local?[changed]:areas).flatMap(region=>region.bounds),margin=local?radius*2:step*2;
 const box=[
  Math.min(...ranges.map(b=>b[0]))-margin,Math.min(...ranges.map(b=>b[1]))-margin,
  Math.max(...ranges.map(b=>b[2]))+margin,Math.max(...ranges.map(b=>b[3]))+margin
 ];
 const x0=Math.max(0,Math.floor(box[0]/step)),z0=Math.max(0,Math.floor(box[1]/step));
 const width=Math.ceil(Math.min(WORLD_WIDTH,box[2])/step)-x0+1;
 const height=Math.ceil(Math.min(WORLD_HEIGHT,box[3])/step)-z0+1;
 const field=new Float32Array(width*height);
 field.fill(radius/step);
 for(const r of areas)for(const poly of r.polys)for(const ring of poly)for(let i=0;i<ring.length;i++){
  const [x,z]=ring[i],[u,v]=ring[(i+1)%ring.length];
  if(isInternalBorder(r,[x,0,z],[u,0,v]))continue;
  if(Math.max(x,u)<box[0]||Math.min(x,u)>box[2]||Math.max(z,v)<box[1]||Math.min(z,v)>box[3])continue;
  const n=Math.max(1,Math.ceil(Math.hypot(u-x,v-z)/step));
  for(let j=0;j<=n;j++){
   const t=j/n,col=Math.round((x+(u-x)*t)/step)-x0,row=Math.round((z+(v-z)*t)/step)-z0;
   if(col>=0&&row>=0&&col<width&&row<height)field[row*width+col]=0;
  }
 }
 for(let z=1;z<height;z++)for(let x=1;x<width-1;x++){
  const i=z*width+x;
  field[i]=Math.min(field[i],field[i-1]+1,field[i-width]+1,field[i-width-1]+diag,field[i-width+1]+diag);
 }
 for(let z=height-2;z>=0;z--)for(let x=width-2;x>=1;x--){
  const i=z*width+x;
  field[i]=Math.min(field[i],field[i+1]+1,field[i+width]+1,field[i+width-1]+diag,field[i+width+1]+diag);
 }
 function weight(x,z){
  const u=Math.max(0,Math.min(width-1.001,x/step-x0)),v=Math.max(0,Math.min(height-1.001,z/step-z0));
  const col=Math.floor(u),row=Math.floor(v),i=row*width+col,tx=u-col,tz=v-row;
  const a=field[i]*(1-tx)+field[i+1]*tx,b=field[i+width]*(1-tx)+field[i+width+1]*tx;
  const distance=Math.max(0,(a*(1-tz)+b*tz)*step-step*.65);
  return .16+.84*Math.exp(-distance/13);
 }
 for(const r of areas){
  const old=countryTintBuffers.get(r.id);
  const touched=local?changed.bounds:null;
  const nearChange=!touched||r.bounds.some(([x,z,u,v])=>touched.some(([a,b,c,d])=>
   x<=c+radius&&u>=a-radius&&z<=d+radius&&v>=b-radius));
  if(!nearChange&&old?.owner===owner)continue;
  const mesh=countryMeshes.get(r.id),perVertex=new Float32Array(mesh.v.length/2);
  for(let i=0;i<perVertex.length;i++){
   const x=mesh.v[i*2],z=mesh.v[i*2+1];
   const reuse=old?.owner===owner&&touched&&!touched.some(([a,b,c,d])=>x>=a-radius&&x<=c+radius&&z>=b-radius&&z<=d+radius);
   perVertex[i]=reuse?old.perVertex[i]:weight(x,z);
  }
  const weights=new Float32Array(mesh.i.length);
  for(let i=0;i<weights.length;i++)weights[i]=perVertex[mesh.i[i]];
  if(old)gl.deleteBuffer(old.buffer);
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,weights,gl.STATIC_DRAW);
  countryTintBuffers.set(r.id,{buffer,count:weights.length,owner,perVertex});
 }
}
function drawBorderBuffer(buffer,width,color){if(!buffer?.count)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer.buffer);gl.vertexAttribPointer(borderLoc.position,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(borderLoc.direction,3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(borderLoc.side,1,gl.FLOAT,false,28,24);gl.uniform1f(borderLoc.width,width*canvas.width/canvas.clientWidth);gl.uniform3f(borderLoc.color,...color);gl.drawArrays(gl.TRIANGLES,0,buffer.count)}
let musterHoverId=null,musterFocusId=null,musterOutline=null,selectedOutline=null;
const steadyWarOutline=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function drawBorders(now=0){gl.useProgram(borderProgram);gl.enableVertexAttribArray(borderLoc.position);gl.enableVertexAttribArray(borderLoc.direction);gl.enableVertexAttribArray(borderLoc.side);gl.uniform2f(borderLoc.center,cam.x,cam.z);gl.uniform2f(borderLoc.viewport,canvas.width,canvas.height);gl.uniform1f(borderLoc.scale,cam.scale);cameraUniforms(borderLoc);
 // Terrain and roads have already rendered. Keep the surface geometry, but
 // draw these strokes in screen space without testing the terrain depth.
 gl.disable(gl.DEPTH_TEST);
 gl.depthMask(false);
 for(const r of state.regions)if(r.owner==='neutral'){let b=borderBuffers.get(r.id);drawBorderBuffer(b,1.6,[.15,.22,.20]);drawBorderBuffer(b,.50,[.68,.68,.55])}
 const ownerColors=FACTION_COLORS;
 for(const r of state.regions){if(!ownerColors[r.owner])continue;let b=borderBuffers.get(r.id);drawBorderBuffer(b,3.2,[.072,.13,.14]);drawBorderBuffer(b,1.91,ownerColors[r.owner]);drawBorderBuffer(b,.48,mixColor(ownerColors[r.owner],[.87,.81,.64],.57))}
 const pulse=steadyWarOutline?.85:(1+Math.cos(now/245))/2;
 for(const region of state.regions){
  if(!isAtWar(state,'you',region.owner))continue;
  const border=borderBuffers.get(region.id);
  drawBorderBuffer(border,4.2+pulse*2,[.28+pulse*.16,.05,.05]);
  drawBorderBuffer(border,1.4+pulse*1.8,[.68+pulse*.32,.09+pulse*.24,.10+pulse*.16]);
 }
 const musterId=musterHoverId??musterFocusId;
 if(musterId!==(musterOutline?.id??null)){
  if(musterOutline)gl.deleteBuffer(musterOutline.border.buffer);
  const region=state.regions.find(r=>r.id===musterId&&r.owner==='you');
  musterOutline=region?{id:region.id,border:makeBorderBuffer(borderVertices(region,false))}:null;
 }
 if(musterOutline){
  drawBorderBuffer(musterOutline.border,6,[.34,.24,.08]);
  drawBorderBuffer(musterOutline.border,3.3,[1,.78,.28]);
  drawBorderBuffer(musterOutline.border,1,[1,.96,.71]);
 }
 const selected=state.selected??null;
 if(selected!==(selectedOutline?.region??null)){
  if(selectedOutline)gl.deleteBuffer(selectedOutline.border.buffer);
  selectedOutline=selected?{region:selected,border:makeBorderBuffer(borderVertices(selected,false))}:null;
 }
 if(selectedOutline){
  drawBorderBuffer(selectedOutline.border,6,[.15,.12,.08]);
  drawBorderBuffer(selectedOutline.border,3.2,[.91,.68,.25]);
  drawBorderBuffer(selectedOutline.border,1.1,[1,.94,.68]);
 }
 drawSelectedArmyRoutes();
 gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);for(const i of [borderLoc.position,borderLoc.direction,borderLoc.side])if(i!==loc.p&&i!==loc.c)gl.disableVertexAttribArray(i);gl.enableVertexAttribArray(loc.p);gl.enableVertexAttribArray(loc.c);
 renderVassalBorders();
}
function resize(){let d=Math.min(2,devicePixelRatio||1),s=cachedScale;if(!(s>0.05&&s<=2))s=1;let w=Math.max(1,Math.floor(canvas.clientWidth*d*s)),h=Math.max(1,Math.floor(canvas.clientHeight*d*s));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);dirtyLabels=true}}
function cameraUniforms(u){const yaw=cam.yaw||0;gl.uniform2f(u.orientation,Math.cos(yaw),Math.sin(yaw));gl.uniform1f(u.tilt,cam.tilt??DEFAULT_CAMERA_TILT)}
function project(x,z,y=0){let a=canvas.clientWidth/canvas.clientHeight,yaw=cam.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=x-cam.x,dz=z-cam.z,rx=c*dx-s*dz,rz=s*dx+c*dz,tilt=cam.tilt??DEFAULT_CAMERA_TILT,norm=Math.hypot(1,tilt);return {x:canvas.clientWidth/2+rx*cam.scale/a*canvas.clientWidth/2,y:canvas.clientHeight/2-(-rz*tilt+y)/norm*cam.scale*canvas.clientHeight/2}}
function unproject(px,py){let yaw=cam.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),tilt=cam.tilt??DEFAULT_CAMERA_TILT,rx=(px-canvas.clientWidth/2)*2/(canvas.clientHeight*cam.scale),screenY=(canvas.clientHeight/2-py)*2/(canvas.clientHeight*cam.scale),base=-screenY*Math.hypot(1,tilt)/tilt;const point=rz=>({x:cam.x+c*rx+s*rz,z:cam.z-s*rx+c*rz});const f=rz=>{let p=point(rz);return rz-base-surfaceHeight(p.x,p.z)/tilt};let previous=base+170/tilt,prevF=f(previous);for(let rz=previous-2;rz>=base-3/tilt;rz-=2){let value=f(rz);if(value<=0&&prevF>=0){let low=rz,high=previous;for(let i=0;i<10;i++){let mid=(low+high)/2;if(f(mid)>0)high=mid;else low=mid}let hit=point((low+high)/2);if(regionAt(state.regions,hit.x,hit.z)||!isSeaBackground(hit.x,hit.z))return hit}previous=rz;prevF=value}return point(base)}
function placementGroundAtScreen(px,py){
 const yaw=cam.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),tilt=cam.tilt??DEFAULT_CAMERA_TILT;
 const unitsPerPixel=2/(canvas.clientHeight*cam.scale);
 const rayX=(px-canvas.clientWidth/2)*unitsPerPixel;
 const rayY=(canvas.clientHeight/2-py)*unitsPerPixel*Math.hypot(1,tilt);
 const point=depth=>({x:cam.x+c*rayX+s*depth,z:cam.z-s*rayX+c*depth});
 const near=point((terrainMaxHeight-rayY)/tilt),far=point((terrainMinHeight-rayY)/tilt);
 let nearestDepth=-Infinity,hit=null;
 // Test the rendered triangles. The procedural height and their interpolation can differ on slopes.
 for(const region of regionsAlongSegment(state.regions,near,far)){
  const mesh=placementMeshes.get(region.id);
  if(!mesh)continue;
  const {positions,indices}=mesh;
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,d=indices[i+2]*3;
   const ax=positions[a]-cam.x,az=positions[a+2]-cam.z;
   const bx=positions[b]-cam.x,bz=positions[b+2]-cam.z;
   const dx=positions[d]-cam.x,dz=positions[d+2]-cam.z;
   const u0=c*ax-s*az-rayX,u1=c*bx-s*bz-rayX,u2=c*dx-s*dz-rayX;
   if((u0>0&&u1>0&&u2>0)||(u0<0&&u1<0&&u2<0))continue;
   const depth0=s*ax+c*az,depth1=s*bx+c*bz,depth2=s*dx+c*dz;
   const v0=positions[a+1]-tilt*depth0-rayY;
   const v1=positions[b+1]-tilt*depth1-rayY;
   const v2=positions[d+1]-tilt*depth2-rayY;
   const w0=u1*v2-u2*v1,w1=u2*v0-u0*v2,w2=u0*v1-u1*v0;
   if(Math.min(w0,w1,w2)<0&&Math.max(w0,w1,w2)>0)continue;
   const area=w0+w1+w2;
   if(Math.abs(area)<1e-9)continue;
   const depth=(w0*depth0+w1*depth1+w2*depth2)/area;
   if(depth>nearestDepth){nearestDepth=depth;hit={...point(depth),region}}
  }
 }
 return hit;
}
function moveCameraScreen(dx,dy){let yaw=cam.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),sx=dx*2/(canvas.clientHeight*cam.scale),sz=dy*2*Math.hypot(1,cam.tilt??DEFAULT_CAMERA_TILT)/(canvas.clientHeight*cam.scale*(cam.tilt??DEFAULT_CAMERA_TILT));cam.x=Math.max(-300,Math.min(WORLD_WIDTH+300,cam.x-c*sx-s*sz));cam.z=Math.max(-200,Math.min(WORLD_HEIGHT+290,cam.z+s*sx-c*sz));dirtyLabels=true}
const cameraKeys=new Map();
function updateCamera(dt){
 if(!dt||!cameraKeys.size)return;
 const actions=new Set(cameraKeys.values());
 const axis=(positive,negative)=>Number(actions.has(positive))-Number(actions.has(negative));
 const speed=280*dt*preferences.panSpeed/100;
 const dx=axis('cameraRight','cameraLeft'),dy=axis('cameraDown','cameraUp');
 if(dx||dy)moveCameraScreen(-dx*speed,-dy*speed);
 const rotate=axis('turnRight','turnLeft'),tilt=axis('tiltUp','tiltDown');
 if(rotate||tilt){
  cam.yaw=(cam.yaw||0)+rotate*dt*.9;
  cam.tilt=Math.max(.4,Math.min(1.8,(cam.tilt??DEFAULT_CAMERA_TILT)+tilt*dt*.8));
  dirtyLabels=true;
 }
}

// Labels show a regional summary, not just the inhabitants of the capital city.
function duchyPopulation(r){return (r.buildings||[]).filter(b=>b.type==='city').reduce((n,b)=>n+Math.max(0,b.population||0),0)}
function populationArrows(region){
 const trend=(region.populationTrend||0)*100,size=Math.abs(trend);
 if(size<.15)return '';
 const count=size>=8?3:size>=3?2:1,sign=trend>0?'up':'down',arrow=trend>0?'▲':'▼';
 const label=(trend>0?'Рост':'Убыль')+' '+size.toFixed(1)+'% в минуту';
 return `<span class="population-trend ${sign}" title="${label}" aria-label="${label}">${arrow.repeat(count)}</span>`;
}
function duchyMapStats(r){
 if(!state.started||r.owner==='neutral')return '';
 const stability=duchyStability(r,cityDefenders.get(r.id)),population=Math.floor(duchyPopulation(r)),tier=stability<=50?'critical':stability<70?'warning':'stable';
 return `<span class="duchy-map-stats ${tier}"><span class="duchy-stability" title="${stabilityHint(r,stability)}">${stability}%</span><span class="duchy-population">${resourceGlyph('population')} ${population.toLocaleString(interfaceLocale)} ${populationArrows(r)}</span></span>`;
}
function rebelCrest(owner){
 const emblem=Number(owner.split('-').at(-1))%4;
 const marks=['M3 5h3m12 0h3','M3 14h3m12 0h3','M3 18l2 2 2-2m10 0 2 2 2-2','M3 9h3m12 0h3'];
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V4m-4 1v4a4 4 0 0 0 8 0V5"/><path class="crest-mark" d="${marks[emblem]}"/></svg>`;
}
// ── Procedural heraldry in the spirit of CK3 dynasty shields. Deterministic
// per key: shield shape, field division, tinctures and charges.
const HERALDRY_METALS={gold:'#c9a53f',silver:'#e2decc'};
const HERALDRY_COLORS={gules:'#8e2f2a',azure:'#31518e',vert:'#35684a',sable:'#23232e',purpure:'#5e3f80'};
const HERALDRY_SHIELD='M32 2 58 7v16c0 16-11 30-26 43C17 53 6 39 6 23V7Z';
function heraldrySeed(key){let h=2166136261;const s=String(key);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function heraldryRandom(seed){let t=seed+0x6D2B79F5;return()=>{t=(t+0x6D2B79F5)|0;let r=Math.imul(t^(t>>>15),1|t);r=(r+Math.imul(r^(r>>>7),61|r))^r;return((r^(r>>>14))>>>0)/4294967296}}
function heraldryCharge(name,x,y,s,color){
 const f=(d,extra='')=>`<path d="${d}" fill="${color}" ${extra}/>`;
 const st=(d,w=2.6)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
 switch(name){
  case 'cross':return st(`M${x} ${y-12*s}V${y+12*s}M${x-9*s} ${y-3*s}H${x+9*s}`,3*s);
  case 'saltire':return st(`M${x-9*s} ${y-9*s}L${x+9*s} ${y+9*s}M${x+9*s} ${y-9*s}L${x-9*s} ${y+9*s}`,3*s);
  case 'fleur':return f(`M${x} ${y-13*s}C${x-4*s} ${y-9*s} ${x-10*s} ${y-7*s} ${x-10*s} ${y-1*s}C${x-10*s} ${y+3*s} ${x-7*s} ${y+5*s} ${x-6*s} ${y+7*s}L${x} ${y+14*s}L${x+6*s} ${y+7*s}C${x+7*s} ${y+5*s} ${x+10*s} ${y+3*s} ${x+10*s} ${y-1*s}C${x+10*s} ${y-7*s} ${x+4*s} ${y-9*s} ${x} ${y-13*s}ZM${x} ${y-13*s}V${y-3*s}`);
  case 'crescent':return f(`M${x+5*s} ${y-12*s}A${13*s} ${13*s} 0 1 0 ${x+5*s} ${y+12*s}A${11.2*s} ${11.2*s} 0 0 1 ${x+5*s} ${y-12*s}Z`);
  case 'star':{let pts=[];for(let i=0;i<10;i++){const r=i%2?4.8*s:12*s,a=-Math.PI/2+i*Math.PI/5;pts.push((x+Math.cos(a)*r).toFixed(2)+' '+(y+Math.sin(a)*r).toFixed(2))}return f('M'+pts.join('L')+'Z')}
  case 'tower':return f(`M${x-9*s} ${y-8*s}V${y+12*s}H${x+9*s}V${y-8*s}H${x-9*s}ZM${x-9*s} ${y-8*s}V${y-12*s}h${3.6*s}v${4*s}h${3.6*s}v${-4*s}h${3.6*s}v${4*s}h${3.6*s}v${-4*s}h${3.6*s}V${y-8*s}ZM${x-3*s} ${y+12*s}V${y+7*s}h${6*s}v${5*s}Z`);
  case 'tree':return f(`M${x} ${y-15*s}L${x+10*s} ${y+4*s}H${x+4*s}L${x+15*s} ${y+15*s}H${x-15*s}L${x-4*s} ${y+4*s}H${x-10*s}ZM${x-2*s} ${y+15*s}H${x+2*s}v${4*s}H${x-2*s}Z`);
  case 'fish':return f(`M${x-13*s} ${y}C${x-4*s} ${y-10*s} ${x+5*s} ${y-11*s} ${x+15*s} ${y-3*s}C${x+9*s} ${y+3*s} ${x-2*s} ${y+7*s} ${x-9*s} ${y+5*s}Z`)+`<circle cx="${x+8*s}" cy="${y-2*s}" r="${1.1*s}" fill="#14120f"/>`;
  case 'sun':{let rays='';for(let i=0;i<8;i++){const a=i*Math.PI/4,x1=x+Math.cos(a)*10*s,y1=y+Math.sin(a)*10*s,x2=x+Math.cos(a)*13*s,y2=y+Math.sin(a)*13*s;rays+=`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`}return f(`M${x} ${y-7*s}A${7*s} ${7*s} 0 1 1 ${x} ${y-7.001*s}Z`)+st(rays,2.4*s)}
  case 'rose':return f(`M${x} ${y-6.5*s}A${6.5*s} ${6.5*s} 0 1 1 ${x} ${y-6.501*s}Z`)+st(`M${x-11*s} ${y-4*s}Q${x-6*s} ${y-11*s} ${x} ${y-4*s}M${x} ${y-4*s}Q${x+6*s} ${y-11*s} ${x+11*s} ${y-4*s}M${x-11*s} ${y+5*s}Q${x-6*s} ${y-2*s} ${x} ${y+5*s}M${x} ${y+5*s}Q${x+6*s} ${y-2*s} ${x+11*s} ${y+5*s}M${x} ${y+12*s}Q${x-5*s} ${y+7*s} ${x} ${y+1*s}`,2.2*s);
  default:return st(`M${x-8*s} ${y}H${x+8*s}`,3*s);
 }
}
function heraldryShield(key,size=42){
 const seed=heraldrySeed(key),rnd=heraldryRandom(seed);
 const metals=Object.keys(HERALDRY_METALS),colors=Object.keys(HERALDRY_COLORS);
 const M=HERALDRY_METALS[metals[Math.floor(rnd()*metals.length)]];
 const C=HERALDRY_COLORS[colors[Math.floor(rnd()*colors.length)]];
 const divisions=['solid','perFess','perPale','perBend','quarterly','perSaltire','chief','chevron'];
 const division=divisions[Math.floor(rnd()*divisions.length)];
 const chargeNames=['cross','saltire','fleur','crescent','star','tower','tree','fish','sun','rose'];
 const charge=chargeNames[Math.floor(rnd()*chargeNames.length)];
 const chargeColor=division==='solid'?C:rnd()<.5?M:C;
 const three=division==='quarterly'||rnd()<.55;
 const clip='hr-'+seed;
 const divisionSvg=(()=>{
  switch(division){
   case 'perFess':return `<rect x="2" y="2" width="60" height="35" fill="${C}"/>`;
   case 'perPale':return `<rect x="32" y="2" width="30" height="70" fill="${C}"/>`;
   case 'perBend':return `<rect x="-14" y="27" width="112" height="22" transform="rotate(45 32 37)" fill="${C}"/>`;
   case 'quarterly':return `<rect x="2" y="2" width="30" height="35" fill="${C}"/><rect x="32" y="37" width="30" height="35" fill="${C}"/>`;
   case 'perSaltire':return `<rect x="-14" y="27" width="112" height="20" transform="rotate(45 32 37)" fill="${C}"/><rect x="-14" y="27" width="112" height="20" transform="rotate(-45 32 37)" fill="${C}"/>`;
   case 'chief':return `<rect x="2" y="2" width="60" height="24" fill="${C}"/>`;
   case 'chevron':return `<path d="M0 18 32 52 64 18h-9L32 44 9 18Z" fill="${C}"/>`;
   default:return '';
  }
 })();
 const chargeSvg=three
  ?heraldryCharge(charge,22,28,.62,chargeColor)+heraldryCharge(charge,42,28,.62,chargeColor)+heraldryCharge(charge,32,49,.7,chargeColor)
  :heraldryCharge(charge,32,division==='chief'?44:36,division==='chief'?.9:1.05,chargeColor);
 return `<svg class="heraldry" viewBox="0 0 64 74" width="${size}" height="${Math.round(size*74/64)}" aria-hidden="true">`+
  `<defs><clipPath id="${clip}"><path d="${HERALDRY_SHIELD}"/></clipPath>`+
  `<linearGradient id="${clip}-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>`+
  `<path d="${HERALDRY_SHIELD}" fill="${M}"/>`+
  `<g clip-path="url(#${clip})">${divisionSvg}${chargeSvg}<path d="${HERALDRY_SHIELD}" fill="url(#${clip}-sheen)"/></g>`+
  `<path d="${HERALDRY_SHIELD}" fill="none" stroke="#191512" stroke-width="2" stroke-linejoin="round"/>`+
  `<path d="M11 21v5c0 13 9 24 21 33 12-9 21-20 21-33v-5" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".9"/>`+
  `</svg>`;
}
let mapStatsSignature='';
const CITY_ALERTS=[
 {id:'administration',label:'Выбрать управление',icon:()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4v6c0 4-4 7-8 9-4-2-8-5-8-9V7ZM12 8v5m0 3v1"/></svg>',
  when:({region})=>region.awaitingAdministration},
 {id:'food',label:'Не хватает зерна',icon:()=>resourceGlyph('grain'),
  when:({hungry,stock,need,harvest})=>hungry||need>0&&stock<need*.65&&harvest<need-.01},
 {id:'housing',label:'Не хватает жилья',icon:()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M6 10v10h12V10m-8 10v-5h4v5"/></svg>',
  when:({population,housing,region})=>population>=housing*.9||(region.displacedResidents||0)>0&&region.buildings.some(b=>b.housingClosed)},
 {id:'guard',label:'Нет войск в герцогстве',icon:()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z M12 7v5m0 4v.2"/></svg>',
  when:({guard})=>!guard},
 {id:'unrest',label:'Растёт риск бунта',icon:()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3l9-17Zm0 6v4m0 4v.2"/></svg>',
  when:({risk})=>risk?.risk&&risk.progress>=35}
];
let cityAlerts=new Map(),cityUnrest=new Map(),cityDefenders=new Map(),cityAdvisors=new Map();
function stabilityHint(region,stability){
 const bonus=stability-duchyStability(region),loss=Math.round(region.treasuryPenalty||0);
 return 'Стабильность'+(bonus>0?' · войска +'+bonus+' п. п.':'')+(loss>0?' · кризис казны −'+loss+' п. п.':'');
}
function alertsForCity(region,guards,risk){
 const g=granaryFor(state,region.id),population=regionalPopulation(region);
 const info={region,population,housing:region.buildings.reduce((n,b)=>n+cityHousing(b),0),
  stock:granaryStock(state,region.id),need:g?.need??regionGrainNeed(state,region),harvest:g?.harvestRate??0,
  hungry:(g?.fed??1)<.999,guard:(guards.get(region.id)||0)>0,risk};
 return CITY_ALERTS.filter(alert=>alert.when(info));
}
function syncMapStats(){
 const alerts=new Map(),unrest=new Map(),advisors=new Map(),signature=[],guards=defendingTroopsByRegion(state);
 for(const task of Object.values(state.council?.monthly||{})){
  const region=councilTaskRegion(state,task);
  if(!region||task.end<=state.economy.seconds)continue;
  if(!advisors.has(region.id))advisors.set(region.id,[]);
  advisors.get(region.id).push(task);
  signature.push('advisor',task.id,region.id);
 }
 for(const region of state.regions){
  if(region.owner==='neutral')continue;
  const risk=unrestReport(state,region,guards);
  const active=region.owner==='you'&&duchySeat(region)?alertsForCity(region,guards,risk):[];
  if(active.length)alerts.set(region.id,active);
  if(risk?.days!=null||risk?.protectedByArmy)unrest.set(region.id,risk);
  signature.push(region.id,region.owner,duchyStability(region,guards.get(region.id)),Math.floor(duchyPopulation(region)),(region.populationTrend||0).toFixed(3),
   risk?.days??(risk?.protectedByArmy?'guard':''),...active.map(a=>a.id));
 }
 cityAlerts=alerts;cityUnrest=unrest;cityDefenders=guards;cityAdvisors=advisors;
 const next=signature.join('|');
 if(next!==mapStatsSignature){mapStatsSignature=next;dirtyLabels=true;}
}
function cityAlertRow(region){
 const actions=cityAlerts.get(region.id)||[],risk=cityUnrest.get(region.id);
 if(!actions.length&&!risk)return null;
 const row=document.createElement('span');row.className='city-alerts';
 if(risk){
  const clock=document.createElement('span');clock.className='city-revolt-clock'+(risk.protectedByArmy?' protected':'');
  clock.textContent=risk.protectedByArmy?'Армия сдерживает бунт':'Бунт '+Math.round(risk.chance*100)+'% · проверка через '+risk.days+' дн.';
  row.appendChild(clock);
 }
 const icons=document.createElement('span');icons.className='city-alert-icons';row.appendChild(icons);
 for(const alert of actions){
  const button=document.createElement('button');button.type='button';button.className='city-alert city-alert-'+alert.id;
  button.title=alert.label;button.setAttribute('aria-label',region.city+' · '+alert.label);button.innerHTML=alert.icon();
  button.onclick=()=>openDuchyAlert(region,alert.id);icons.appendChild(button);
 }
 return row;
}
const majorSettlements=new Set(GAME_MAP?['lisbon','seville','malaga','barcelona','genoa','venice','palermo','tunis','algiers','athens','istanbul','alexandria','beirut']:['pomorskie','mazowieckie','poznańskie','wileńskie','Prusy Książęce','Księstwo Kurlandii i Semigalii','kijowskie','pinsk','zytomierz','cherkasy','pereiaslav','mozyrz']);
function recruitMapBadge(region){
 const count=(state.recruitments||[]).reduce((sum,order)=>sum+(order.regionId===region.id&&order.owner===region.owner?order.troops:0),0);
 return count?'<span class="garrison-badge">⌛ СБОР '+count+'</span>':'';
}
function capitalStar(type){
 const label=type==='original'?'Стартовая столица':'Перенесённая столица';
 return `<span class="capital-star capital-star-${type}" title="${label}" role="img" aria-label="${label}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 1.5 2.5 5.5 6 .6-4.5 4 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.5-4 6-.6z"/></svg></span>`;
}
function relocatedCapital(region){
 return !!state.campaign&&region.owner!=='neutral'&&!state.factions?.[region.owner]?.isRebel&&
  realmCapitalId(state,region.owner)===region.id&&state.campaign.startingCapitals?.get(region.id)!==region.owner;
}
function capitalStars(region){
 return (militaryCampaignTarget(state,region)?capitalStar('original'):'')+
  (relocatedCapital(region)?capitalStar('replacement'):'');
}
let labelsJob=null,labelEls=null,labelMeta=null,labelOverview=null;
function labelsSignature(){
 let sig='';
 for(const r of state.regions){
  sig+=r.owner+','+(r.vassalId??'')+','+(realmCapitalId(state,r.owner)===r.id?1:0)+','+(cityAlerts.has(r.id)?1:0)+','+(cityUnrest.has(r.id)?1:0)+','+(cityAdvisors.get(r.id)?1:0)+','+(state.garrisons?.[r.id]?.troops||0)+'|';
 }
 return sig+';'+(state.selected?.id??'')+';'+(campaignStartChoice?.id??'')+';'+(state.started?1:0);
}
function makeSettlementLabel(c,job){
 const {r,pos,frontier,available,advisors,capital,originalOwner}=c;
 const stars=capitalStars(r);
 const el=document.createElement('div'),fortified=state.fortifications?.get(r.id)?.gates.size>0;
 el.className='map-label settlement-label'+(frontier?' frontier':'')+(job.overview?' chart-settlement':'')+(capital?' capital-settlement':'')+(r===state.selected?' focused-settlement':'')+(!state.started&&r.id===campaignStartChoice?.id?' start-settlement':'')+(available?' council-target-available':'');
 if(frontier)el.title='Соседнее нейтральное герцогство · доступна просьба';
 else if(fortified)el.title='Пограничная крепость';
 el.style.left=pos.x+'px';
 el.style.top=pos.y+'px';
 const rebel=state.factions?.[r.owner]?.isRebel,crest=FACTION_COLORS[r.owner]&&r.owner!=='you'?' style="background:'+factionCss(r.owner)+';color:#f2e8ce"':'';
 el.innerHTML='<span class="map-label-line">'+(rebel
  ?`<span class="map-crest crest-${r.owner} rebel-crest"${crest}>${rebelCrest(r.owner)}</span>`
  :`<span class="map-crest-heraldry${r.owner==='neutral'?' crest-neutral':''}">${heraldryShield(r.owner+':'+r.id,17)}</span>`)+
  (job.picking?'':`<span class="map-body"><span class="map-ribbon">${stars}${r.city}</span>${duchyMapStats(r)}${state.garrisons?.[r.id]?.troops?`<span class="garrison-badge"${vassalFor(state,r)?' style="--unit-faction:'+paletteCss(vassalFor(state,r).color)+'"':''}>⚔ ${state.garrisons[r.id].troops}</span>`:''}${recruitMapBadge(r)}</span></span>`);
 if(job.picking){
  const ribbon=document.createElement(available?'button':'span');
  ribbon.className='map-ribbon'+(available?' council-target':'');
  ribbon.innerHTML=stars+r.city;
  if(available){
   ribbon.type='button';ribbon.dataset.councilTarget=String(r.id);
   ribbon.setAttribute('aria-label','Назначить советника · '+r.name);
   ribbon.onclick=()=>assignCouncilAdvisor(r);
  }
  (el.firstElementChild||el).appendChild(ribbon);
 }else{
  const alerts=cityAlertRow(r);if(alerts)el.appendChild(alerts);
  if(advisors?.length)el.appendChild(cityAdvisorRow(advisors));
 }
 return el;
}
function renderRealmLabels(layer,realms,markedCapitals,occupied){
 for(const {owner,holdings} of realms){
  const name=countryName(owner);
  const existing=[...layer.children].find(el=>el.dataset.owner===owner);
  const eligible=holdings.filter(r=>!markedCapitals.has(r.id));
  const retainedIndex=eligible.findIndex(r=>String(r.id)===existing?.dataset.region);
  if(retainedIndex>0)eligible.unshift(...eligible.splice(retainedIndex,1));
  let placed=false;
  const width=Math.min(192,name.length*6.8+14);
  for(const r of eligible){
   const site=r.slots[0],pos=project(site.x,site.z,surfaceHeight(site.x,site.z)+6);
   if(pos.x-width*.5<45||pos.x+width*.5>canvas.clientWidth-19||pos.y<95||pos.y>canvas.clientHeight-88)continue;
   const retained=String(r.id)===existing?.dataset.region;
   if(occupied.some(b=>Math.abs(pos.x-b.x)<(width+b.width)*.5+(retained?5:12)&&Math.abs(pos.y-b.y)<(retained?27:33)))continue;
   const label=existing||document.createElement('div');
   label.className='map-label chart-realm';
   label.textContent=name;label.style.left=pos.x+'px';label.style.top=pos.y+'px';
   label.dataset.owner=owner;label.dataset.region=r.id;
   if(!existing)layer.appendChild(label);
   occupied.push({...pos,width});placed=true;break;
  }
  if(!placed)existing?.remove();
 }
 const owners=new Set(realms.map(realm=>realm.owner));
 for(const el of [...layer.children])if(!owners.has(el.dataset.owner))el.remove();
}
function renderLabels(){
 const layer=$('labels'),scale=cam.scale*WORLD_SCALE,picking=!!councilMapOrder;
 const overview=labelOverview=scale<(labelOverview===null ? .007 : labelOverview ? .0072 : .0068);
 const signature=labelsSignature();
 const markedCapitals=new Set(state.campaign?.startingCapitals?.keys());
 const candidates=[];
 for(const r of state.regions){
  const originalOwner=state.campaign?.startingCapitals?.get(r.id);
  const current=realmCapitalId(state,r.owner)===r.id;
  if(current)markedCapitals.add(r.id);
  const capital=current||originalOwner!==undefined;
  const frontier=state.started&&r.owner==='neutral'&&adjacentToFaction(state,r,'you');
  const available=picking&&councilMapOrder.targets.has(r.id),advisors=cityAdvisors.get(r.id);
  const priority=r===state.selected||r.id===campaignStartChoice?.id?7:r.id===state.capitalId||originalOwner==='you'||!picking&&advisors?.length?6:available||capital?5:majorSettlements.has(r.key)?4:r.owner!=='neutral'?3:frontier?2:1;
  if(overview&&priority===1)continue;
  const point=r.slots[0]||{x:r.x,z:r.y};
  const pos=project(point.x,point.z,surfaceHeight(point.x,point.z)+(overview?5:6.5));
  if(pos.x<-40||pos.y<-35||pos.x>canvas.clientWidth+40||pos.y>canvas.clientHeight+35)continue;
  candidates.push({r,pos,frontier,priority,available,advisors,capital,current,originalOwner});
 }
 if(overview)candidates.sort((a,b)=>b.priority-a.priority||a.r.id-b.r.id);
 // Видимые метки с подавлением наложений (без создания DOM).
 const visible=new Map(),occupied=[];
 for(const c of candidates){
  const {r,pos,priority}=c;
  const width=Math.max(54,Math.min(191,r.city.length*8.4+22+(Number(c.originalOwner!==undefined)+Number(relocatedCapital(r)))*20));
  const previous=labelEls?.get(r.id),gap=previous&&previous.style.display!=='none'?-3:3;
  if(overview&&priority<6&&occupied.some(b=>Math.abs(b.x-pos.x)<(b.width+width)*.5+7+gap&&Math.abs(b.y-pos.y)<(cityUnrest.has(r.id)?64:cityAlerts.has(r.id)?47:35)+gap))continue;
  occupied.push({...pos,width});
  visible.set(r.id,c);
 }
 const realms=[];
 if(overview&&state.started){
  const byOwner=new Map();
  for(const r of state.regions){
   if(r.owner==='neutral')continue;
   if(!byOwner.has(r.owner))byOwner.set(r.owner,[]);
   byOwner.get(r.owner).push(r);
  }
  for(const [owner,holdings] of byOwner)if(holdings.length>=3)realms.push({owner,holdings});
 }
 if(labelEls&&labelMeta?.order===councilMapOrder&&labelMeta.signature===signature&&labelMeta.overview===overview){
  labelsJob=null;
  // Быстрый путь: камера движется, данные не менялись — просто двигаем
  // существующие метки, без пересоздания DOM.
  for(const [id,el] of labelEls){
   const c=visible.get(id);
   if(!c){el.style.display='none';continue}
   el.style.display='';
   el.style.left=c.pos.x+'px';
   el.style.top=c.pos.y+'px';
  }
  for(const [id,c] of visible){
   if(!labelEls.has(id)){
    const el=makeSettlementLabel(c,{picking,overview});
    layer.appendChild(el);
    labelEls.set(id,el);
   }
  }
  let realmWrapper=layer.querySelector('.label-realms');
  if(!realmWrapper){realmWrapper=document.createElement('div');realmWrapper.className='label-realms';layer.appendChild(realmWrapper)}
  renderRealmLabels(realmWrapper,realms,markedCapitals,occupied);
  let sea=layer.querySelector('.sea-label');
  if(cam.scale<=(sea?.style.display==='' ? .0082 : .0078)){
   const [x,z,name]=GAME_MAP?.label||[160,110,'БАЛТИЙСКОЕ МОРЕ'];
   const pos=project(x,z,-1);
   if(!sea){sea=document.createElement('div');sea.className='map-label sea-label';layer.appendChild(sea)}
   sea.style.left=pos.x+'px';sea.style.top=pos.y+'px';sea.textContent=name;sea.style.display='';
  }else if(sea)sea.style.display='none';
 }else{
  // Полный путь: набор данных изменился — строим в офскрин-контейнере
  // порциями по labelStep, затем атомарно подменяем содержимое слоя.
  for(const c of candidates){
   const el=labelEls?.get(c.r.id);
   if(el){el.style.left=c.pos.x+'px';el.style.top=c.pos.y+'px'}
  }
  if(labelsJob?.signature!==signature||labelsJob?.overview!==overview||labelsJob?.order!==councilMapOrder){
   labelsJob={layer,overview,picking,signature,order:councilMapOrder,els:new Map()};
  }
  Object.assign(labelsJob,{visible,realms,markedCapitals,occupied,pending:[...visible.values()].filter(c=>!labelsJob.els.has(c.r.id)),i:0});
 }
 $('atlas-needle').style.transform='rotate('+((cam.yaw||0)*180/Math.PI)+'deg)';
 $('atlas-scale').textContent=overview?'Обзор держав':cam.scale>.029?'Местность':'Герцогства';
 dirtyLabels=false;
}
function labelStep(budget=6){
 const job=labelsJob;
 if(!job)return true;
 const start=performance.now();
 const note=d=>{const w=state._phaseTimings?.worst;if(w&&d>(w['f:labels']||0))w['f:labels']=d;if(w){w['f:labels:s']=(w['f:labels:s']||0)+d;w['f:labels:n']=(w['f:labels:n']||0)+1}};
 while(job.i<job.pending.length){
  const c=job.pending[job.i++];
  job.els.set(c.r.id,makeSettlementLabel(c,job));
  if(performance.now()-start>budget){note(performance.now()-start);return false}
 }
 const staging=document.createDocumentFragment();
 const realmWrapper=job.layer.querySelector('.label-realms')||document.createElement('div');
 realmWrapper.className='label-realms';
 renderRealmLabels(realmWrapper,job.realms,job.markedCapitals,job.occupied);
 const sea=job.layer.querySelector('.sea-label');
 if(cam.scale<=(sea?.style.display==='' ? .0082 : .0078)){
  const [x,z,name]=GAME_MAP?.label||[160,110,'БАЛТИЙСКОЕ МОРЕ'];
  const pos=project(x,z,-1),el=document.createElement('div');
  el.className='map-label sea-label';
  el.style.left=pos.x+'px';el.style.top=pos.y+'px';el.textContent=name;
  staging.appendChild(el);
 }
 // Атомарная подмена: метки появляются все сразу, без промежуточных кадров.
 const focusedTarget=document.activeElement?.dataset?.councilTarget;
 const committed=new Map();
 for(const [id,c] of job.visible){
  const el=job.els.get(id);
  el.style.left=c.pos.x+'px';el.style.top=c.pos.y+'px';
  staging.appendChild(el);committed.set(id,el);
 }
 staging.appendChild(realmWrapper);
 job.layer.replaceChildren(staging);
 if(focusedTarget)job.layer.querySelector('[data-council-target="'+focusedTarget+'"]')?.focus({preventScroll:true});
 labelEls=committed;labelMeta={signature:job.signature,overview:job.overview,order:job.order};
 note(performance.now()-start);
 return true;
}
let roadBuffer=null,trailBuffer=null,trafficBuffer=null,trafficRebuildAt=0,cartBuffer=null,selectedRouteBuffer=null,selectedRoutePath=null,simClock=0,lastFrame=null;
function roadGround(x,z){return regionAt(state.regions,x,z)?surfaceHeight(x,z):-1.5}
let roadMeshGraph=null,roadMeshEdges=0,roadExtensions=[];
function rebuildRoads(){
 const graph=state.network;
 if(roadMeshGraph!==graph||graph&&graph.edges.size<roadMeshEdges){
  if(roadBuffer)gl.deleteBuffer(roadBuffer.buffer);
  for(const chunk of roadExtensions)gl.deleteBuffer(chunk.buffer);
  roadBuffer=null;roadExtensions=[];roadMeshGraph=graph;roadMeshEdges=0;
 }
 const roads=[];
 function strip(out,segments,width,col){for(const [a,c] of segments){let d=Math.hypot(c.x-a.x,c.z-a.z);if(!d)continue;let nx=-(c.z-a.z)/d*width,nz=(c.x-a.x)/d*width,steps=Math.max(1,Math.ceil(d/3));for(let j=0;j<steps;j++){let t=j/steps,u=(j+1)/steps,x1=a.x+(c.x-a.x)*t,z1=a.z+(c.z-a.z)*t,x2=a.x+(c.x-a.x)*u,z2=a.z+(c.z-a.z)*u;const corners=[[x1+nx,roadGround(x1+nx,z1+nz)+.30,z1+nz],[x2+nx,roadGround(x2+nx,z2+nz)+.30,z2+nz],[x2-nx,roadGround(x2-nx,z2-nz)+.30,z2-nz],[x1-nx,roadGround(x1-nx,z1-nz)+.30,z1-nz]];
    for(const n of [0,1,2,0,2,3])vertex(out,...corners[n],[col[0],n<2?2:4,col[2]]);
   }}}
 if(graph&&roadMeshEdges!==graph.edges.size){
  // One continuous, smoothed ribbon per road: degree-2 runs are walked end to
  // end, corners rounded with corner-cutting smoothing, and the width breathes
  // along the way so no two stretches look stamped out. Every edge is emitted
  // exactly once, cut into maximal runs of still-uncovered edges.
  const hashString=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};
  const smoothOpenChain=(points,passes=2)=>{
   let p=points;
   if(p.length<3)return p;
   for(let it=0;it<passes;it++){
    const out=[p[0]];
    for(let i=0;i<p.length-1;i++){
     const a=p[i],b=p[i+1];
     out.push({x:a.x*.75+b.x*.25,z:a.z*.75+b.z*.25});
     out.push({x:a.x*.25+b.x*.75,z:a.z*.25+b.z*.75});
    }
    out.push(p[p.length-1]);
    p=out;
   }
   return p;
  };
  const degree2=new Set();
  for(const [key,node] of graph.nodes)if(node.edges.size===2)degree2.add(key);
  const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  const usedEdges=new Set(),ribbons=[];
  const walk=(startKey,firstKey)=>{
   const keys=[startKey];
   let prev=startKey,cur=firstKey;
   while(cur!=null&&degree2.has(cur)&&!keys.includes(cur)){
    keys.push(cur);
    const node=graph.nodes.get(cur);
    let next=null;
    for(const nk of node.edges.keys())if(nk!==prev){next=nk;break}
    prev=cur;cur=next;
   }
   if(cur!=null&&!keys.includes(cur))keys.push(cur);
   return keys;
  };
  const emitRuns=keys=>{
   let run=null;
   const flush=()=>{if(run&&run.length>=2)ribbons.push(run);run=null};
   for(let i=1;i<keys.length;i++){
    const k=pairKey(keys[i-1],keys[i]);
    if(!usedEdges.has(k)){
     usedEdges.add(k);
     if(!run)run=[keys[i-1]];
     run.push(keys[i]);
    }else flush();
   }
   flush();
  };
  for(const [key,node] of graph.nodes)for(const nk of node.edges.keys()){
   if(usedEdges.has(pairKey(key,nk)))continue;
   emitRuns(walk(key,nk));
  }
  const roadCol=[.62,.50,.35];
  const ribbon=(out,chain)=>{
   const pts=chain.map(k=>{const n=graph.nodes.get(k);return {x:n.x,z:n.z}});
   const smooth=smoothOpenChain(pts,2);
   if(smooth.length<2)return;
   const sig=chain[0]+'|'+chain[chain.length-1];
   const base=.55+hashString('w'+sig)*.23,phase=hashString('p'+sig)*6.283;
   const samples=[smooth[0]];
   for(let i=1;i<smooth.length;i++){
    const from=smooth[i-1],to=smooth[i],steps=Math.max(1,Math.ceil(distance(from,to)/2.4));
    for(let step=1;step<=steps;step++){
     const t=step/steps;samples.push({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t});
    }
   }
   let along=0,previous=null;
   for(let i=0;i<samples.length;i++){
    const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
    if(i)along+=distance(a,p);
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
    const width=base*(1+.08*Math.sin(along*.55+phase)),nx=-dz/len*width,nz=dx/len*width;
    const section=[[p.x+nx,roadGround(p.x+nx,p.z+nz)+.304,p.z+nz],
     [p.x-nx,roadGround(p.x-nx,p.z-nz)+.304,p.z-nz]];
    if(previous){
     const corners=[previous[0],section[0],section[1],previous[1]];
     for(const n of [0,1,2,0,2,3])vertex(out,...corners[n],[roadCol[0],n<2?2:4,roadCol[2]]);
    }
    previous=section;
   }
  };
  // Worn patches under junctions hide the wedge gaps where ribbons meet.
  for(const [key,node] of graph.nodes){
   if(node.edges.size===2)continue;
   const y=roadGround(node.x,node.z)+.295,r=.56;
   for(let i=0;i<6;i++){
    const a0=i/6*Math.PI*2,a1=(i+1)/6*Math.PI*2;
    vertex(roads,node.x,y,node.z,[.58,.50,.36]);
    vertex(roads,node.x+Math.cos(a0)*r,y,node.z+Math.sin(a0)*r,[.58,.50,.36]);
    vertex(roads,node.x+Math.cos(a1)*r,y,node.z+Math.sin(a1)*r,[.58,.50,.36]);
   }
  }
  for(const chain of ribbons)ribbon(roads,chain);
  roadMeshEdges=graph.edges.size;
  const chunk=makeBuffer(roads);
  if(roadBuffer)roadExtensions.push(chunk);
  else roadBuffer=chunk;
 }
 const groups=new Map();
 for(const r of state.regions)if(r.owner==='you'||state.factions?.[r.owner]){
  for(const b of r.buildings){
   const route=b.route;
   if(!route?.length)continue;
   const branch=route.slice(0,route.branchLength??route.length);
   addMeshItem(groups,Math.floor(r.id/8),{
    signature:branch.map(p=>p.x+','+p.z).join(':'),
    append:vertices=>strip(vertices,branch.slice(1).map((p,i)=>[branch[i],p]),.23,[.50,.45,.28])
   });
  }
 }
 trailBuffer=updateMeshBatch(trailBuffer,groups);
}

// Only the selected convoy gets a subtle line; reuse geometry until its path changes.
function drawSelectedRoute(){let ship=selectedCargo,path=ship?.path;if(!path?.length||!state.economy?.shipments.includes(ship)){if(selectedRouteBuffer)gl.deleteBuffer(selectedRouteBuffer.buffer);selectedRouteBuffer=null;selectedRoutePath=null;return}if(path!==selectedRoutePath){if(selectedRouteBuffer)gl.deleteBuffer(selectedRouteBuffer.buffer);let out=[],along=0;for(let i=1;i<path.length;i++){let a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(!len)continue;let nx=-dz/len*.30,nz=dx/len*.30,steps=Math.max(1,Math.ceil(len/5));for(let j=0;j<steps;j++){let t=j/steps,u=(j+1)/steps,x=a.x+dx*t,z=a.z+dz*t,x2=a.x+dx*u,z2=a.z+dz*u,at=along+len*(t+u)/2,atSea=ship.mode==='sea'&&at>=ship.seaStart&&at<=ship.seaEnd,y=atSea?-.65:roadGround(x,z)+1.1,y2=atSea?-.65:roadGround(x2,z2)+1.1;quad(out,[x+nx,y,z+nz],[x2+nx,y2,z2+nz],[x2-nx,y2,z2-nz],[x-nx,y,z-nz],[.94,.74,.34])}along+=len}selectedRouteBuffer=makeBuffer(out);selectedRoutePath=path}drawBuffer(selectedRouteBuffer)}
function rebuildTrafficRoads(){let out=[],traffic=state.economy?.roadTraffic,now=state.economy?.seconds||0;if(traffic&&state.network)for(const edge of state.network.edges.values()){let [a,b]=edge,flow=roadTrafficValue(traffic.get(roadEdgeKey(a,b)),now);if(flow<.28)continue;let dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(!len)continue;let width=.28+Math.min(.22,flow*.025),nx=-dz/len*width,nz=dx/len*width,strength=Math.min(1,flow/5),col=[.65+.12*strength,.55+.12*strength,.38+.09*strength],steps=Math.max(1,Math.ceil(len/3));for(let j=0;j<steps;j++){let t=j/steps,u=(j+1)/steps,x1=a.x+dx*t,z1=a.z+dz*t,x2=a.x+dx*u,z2=a.z+dz*u;quad(out,[x1+nx,roadGround(x1+nx,z1+nz)+.303,z1+nz],[x2+nx,roadGround(x2+nx,z2+nz)+.303,z2+nz],[x2-nx,roadGround(x2-nx,z2-nz)+.303,z2-nz],[x1-nx,roadGround(x1-nx,z1-nz)+.303,z1-nz],col)}}if(trafficBuffer)gl.deleteBuffer(trafficBuffer.buffer);trafficBuffer=makeBuffer(out);trafficRebuildAt=now+8;if(state.economy)state.economy.trafficDirty=false}
function wheel(out,x,y,z,r,phase){
 const metal=[.32,.31,.27],wood=[.63,.43,.24];
 const point=(a,scale)=>[x+Math.cos(a)*r*scale,y+Math.sin(a)*r*scale,z];
 for(let i=0;i<10;i++){
  const a=i*Math.PI/5+phase,b=a+Math.PI/5;
  quad(out,point(a,1),point(b,1),point(b,.77),point(a,.77),metal);
 }
 for(let i=0;i<7;i++){
  const a=i*Math.PI*2/7+phase;
  quad(out,point(a-.18,.16),point(a-.052,.85),point(a+.052,.85),point(a+.18,.16),wood);
 }
 cube(out,x,y-r*.17,z,r*.32,r*.34,r*.24,wood);
}

let selectedWarship=null;
let fleetBuffer=null;
const fleetMarkers=new Map();

function inMapViewport(x,z,height=0,margin=85){
 const p=project(x,z,height);
 return p.x>=-margin&&p.x<=canvas.clientWidth+margin&&p.y>=-margin&&p.y<=canvas.clientHeight+margin;
}

const shipModels=new Map();
function shipModel(color,war=false,detailed=true,moored=false){
 const key=[color.join(','),war,detailed,moored].join(':');
 if(shipModels.has(key))return shipModels.get(key);
 const out=[],wood=[.42,.28,.17],rail=[.64,.43,.25],cloth=[.86,.78,.59];
 const length=war?3.2:2.35,beam=war?1.05:.81;
 const stations=detailed?[[-1,.06],[-.83,.41],[-.53,.78],[-.21,1],[.22,.99],[.52,.83],[.80,.44],[1,.02]]:
  [[-1,.06],[-.58,.79],[-.05,1],[.48,.81],[1,.02]];
 const sheer=(t)=>.97+.27*t*t;
 for(let i=1;i<stations.length;i++){
  const [a,aw]=stations[i-1],[b,bw]=stations[i];
  const p=(t,w,y,f)=>[t*length,y,w*beam*f];
  quad(out,p(a,aw,sheer(a),-1),p(b,bw,sheer(b),-1),p(b,bw,sheer(b),1),p(a,aw,sheer(a),1),tint(wood,1.22));
  for(const side of [-1,1]){
   const strips=[[.26,.48],[.42,.80],[.61,.95],[0,1]];
   for(let j=1;j<strips.length;j++){
    const [low,lw]=strips[j-1],[high,hw]=strips[j];
    const top=high||sheer(a),topB=high||sheer(b);
    quad(out,p(a,aw,low,lw*side),p(b,bw,low,lw*side),p(b,bw,topB,hw*side),p(a,aw,top,hw*side),
     j===3?tint(rail,side===1?.82:1.02):tint(wood,(side===1?.83:1.04)+j*.04));
   }
   if(detailed&&aw>.76)cube(out,a*length,sheer(a),aw*beam*side,.072,.31,.072,rail);
  }
 }
 cube(out,-length*.63,1.12,0,.88,.50,beam*1.3,tint(wood,1.08));
 if(war)cube(out,-length*.64,1.58,0,.87,.11,beam*1.4,color);
 else if(detailed){
  cube(out,-.68,1.04,-.34,.63,.47,.53,[.62,.47,.29]);
  cube(out,.34,1.04,.32,.51,.40,.42,[.54,.42,.28]);
 }
 if(detailed&&!war){
  // A bowsprit and triangular headsail give freighters a readable bow in profile.
  timberBeam(out,[length*.63,1.12,0],[length+.50,1.72,0],.07,rail);
  timberBeam(out,[.33,3.80,0],[length+.48,1.73,0],.032,wood);
  const a=[.60,3.44,.01],b=[length+.15,1.84,0],c=[1.08,1.78,.04],belly=[1.43,2.25,.20];
  if(!moored){tri(out,a,b,belly,tint(cloth,.95));tri(out,b,c,belly,tint(cloth,.86));tri(out,c,a,belly,cloth);}
  for(const z of [-.57,.57])harborCargo(out,-1.11,1.12,z,.51,true);
  for(const sign of [-1,1])for(let i=1;i<stations.length;i++){
   const [a,aw]=stations[i-1],[b,bw]=stations[i],plank=[.55,.36,.20];
   quad(out,[a*length,.72,sign*aw*beam*.98],[b*length,.72,sign*bw*beam*.98],
    [b*length,.79,sign*bw*beam*.99],[a*length,.79,sign*aw*beam*.99],plank);
  }
 }
 const masts=war?[-.95,1.04]:[.33];
 for(const [index,mast] of masts.entries()){
  const top=war?(index?3.65:4.25):3.5,span=(war?1.12:.92)*(index?.83:1),bottom=top-(moored?.43:1.65);
  timberBeam(out,[mast,.95,0],[mast,top+.35,0],war?.10:.085,wood);
  timberBeam(out,[mast-.07,top,span],[mast-.07,top,-span],.067,rail);
  const rows=detailed?3:1,columns=detailed?6:2;
  const sail=(u,v)=>{
   const spread=span*(1-v*.18);
   return [mast+.12+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.46,top-(top-bottom)*v,spread*(u*2-1)];
  };
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
   const u=col/columns,v=row/rows,w=(col+1)/columns,t=(row+1)/rows;
   const shade=.86+Math.sin((col+.5)/columns*Math.PI)*.18-row*.036;
   const canvas=war&&row===rows-1?tint(color,.87):tint(cloth,shade);
   quad(out,sail(u,v),sail(w,v),sail(w,t),sail(u,t),canvas);
  }
  if(detailed)for(const side of [-1,1]){
   timberBeam(out,[mast,top+.18,0],[-length*.63,1.41,side*beam*.51],.031,[.37,.30,.22]);
   timberBeam(out,[mast-.06,top,side*span],[mast-1.05,1.06,side*beam*.72],.025,[.53,.44,.33]);
  }
  if(index===0)tri(out,[mast,top+.38,0],[mast,top+.02,0],[mast-.65,top+.16,.12],color);
 }
 shipModels.set(key,out);
 return out;
}
function placeShip(out,model,x,y,z,angle,scale=1){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 for(let i=0;i<model.length;i+=6){
  const dx=model[i],dz=model[i+2];
  out.push(x+(dx*cos-dz*sin)*scale,y+model[i+1],z+(dx*sin+dz*cos)*scale,
   model[i+3],model[i+4],model[i+5]);
 }
}
function shipWake(out,x,z,heading,war,phase){
 if(cam.scale<.0057)return;
 const dx=Math.cos(heading),dz=Math.sin(heading),length=war?2.9:1.94;
 const at=(step,side)=>{
  const distance=length+step*1.29,wing=side*(.30+step*.29+Math.sin(step+phase)*.07);
  return [x-dx*distance-dz*wing,-.92,z-dz*distance+dx*wing];
 };
 for(let i=0;i<4;i++){
  const p=at(i,0),q=at(i+1,0);
  if(!navigableWater({x:q[0],z:q[2]}))break;
  for(const side of [-1,1]){
   const inner=at(i,side*.75),outer=at(i+1,side);
   const far=at(i+1,side*.67);
   if(!navigableWater({x:outer[0],z:outer[2]}))continue;
   quad(out,inner,at(i,side),outer,far,tint([.48,.66,.62],1-i*.14));
   if(i===0)tri(out,p,inner,q,[.36,.56,.56]);
  }
 }
}
function drawFleet(){
 if(!state.warships?.length) return;
 const vertices=[];
 for(const ship of state.warships){
  const point=navalPosition(ship,ship.pinned?0:simClock);
  if(!inMapViewport(point.x,point.z,4)||!navigableWater(point)) continue;
  const heading=ship.path?routeHeading(ship.path,Math.min(1,(ship.elapsed+simClock)/ship.duration)):ship.heading||0;
  ship.heading=heading;
  const color=FACTION_COLORS[ship.owner]||FACTION_COLORS.you;
  if(ship.path&&!ship.pinned)shipWake(vertices,point.x,point.z,heading,true,(ship.elapsed+simClock)*5);
  placeShip(vertices,shipModel(color,true,cam.scale>=.006||ship===selectedWarship),point.x,-1.15,point.z,heading,.88);
  const effects=[];
  if(ship.prize)cube(effects,-.65,1.24,-.45,.63,.45,.57,[.82,.65,.39]);
  if(ship.firing&&Math.floor(simClock*7)%3===0){
   cube(effects,0,1.15,-1.5,.55,.26,.55,[.96,.62,.25]);
   cube(effects,0,1.15,1.5,.55,.26,.55,[.96,.62,.25]);
  }
  placeShip(vertices,effects,point.x,-1.15,point.z,heading,.88);
 }
 if(!fleetBuffer) fleetBuffer={buffer:gl.createBuffer(),count:0};
 gl.bindBuffer(gl.ARRAY_BUFFER,fleetBuffer.buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
 fleetBuffer.count=vertices.length/6;
 drawBuffer(fleetBuffer);
}

function renderFleet(){
 const ships=state.warships||[];
 if(selectedWarship&&!ships.includes(selectedWarship)){
  selectedWarship=null;
  $('placement').hidden=true;
 }
 for(const [ship,marker] of fleetMarkers) if(!ships.includes(ship)){marker.remove();fleetMarkers.delete(ship)}
 for(const ship of ships){
  let marker=fleetMarkers.get(ship);
  if(!marker){
   marker=document.createElement('button');
   marker.type='button';
   marker.addEventListener('pointerdown',e=>e.stopPropagation());
   marker.onclick=()=>{
    if(ship.owner==='you') selectWarship(ship);
    else if(selectedWarship) issueNavalOrder(navalPosition(ship));
    else flash('Корабль соперника · корпус '+Math.ceil(ship.hull??100)+'%');
   };
   $('fleet-layer').appendChild(marker);
   fleetMarkers.set(ship,marker);
  }
  const point=navalPosition(ship,simClock),screen=project(point.x,point.z,4.5);
  marker.style.left=screen.x+'px';marker.style.top=screen.y+'px';
  marker.className='fleet-marker'+(ship===selectedWarship?' selected':'')+(ship.firing?' fighting':'')+(ship.owner!=='you'?' enemy':'');
  colorUnitMarker(marker,ship.owner);
  const label=localizedLabel((ship.firing?'⚔ ':ship.prize?'⚓ Добыча · ':'⚓ ')+Math.ceil(ship.hull??100)+'%');
  if(marker.textContent!==label) marker.textContent=label;
  marker.title=ship.firing?'Морской бой':ship.prize?'Везёт добычу в свой порт':'Военный корабль';
 }
 const ring=$('patrol-range'), center=selectedWarship?.patrol?.center;
 ring.hidden=!center;
 if(center){
  const screen=project(center.x,center.z,0);
  const horizontal=project(center.x+PATROL_RADIUS,center.z,0),vertical=project(center.x,center.z+PATROL_RADIUS,0);
  ring.style.left=screen.x+'px';ring.style.top=screen.y+'px';
  ring.style.width=2*Math.hypot(horizontal.x-screen.x,vertical.x-screen.x)+'px';
  ring.style.height=2*Math.hypot(horizontal.y-screen.y,vertical.y-screen.y)+'px';
 }
 const repair=$('fleet-repair');
 $('fleet-actions').hidden=!selectedWarship;
 if(selectedWarship){
  repair.disabled=!!selectedWarship.prize||!!selectedWarship.repair||(selectedWarship.hull??100)>=100;
  repair.textContent=selectedWarship.repair?'Ремонт заказан':'Ремонт в порту';
  repair.title='1 древесина за каждые 10% корпуса';
  const order=selectedWarship.repair;
  $('placement').textContent=order
   ?(selectedWarship.path?'КОРАБЛЬ · идёт на ремонт':order.remaining==null?'КОРАБЛЬ · ждёт древесину или завершения боя':'РЕМОНТ · '+Math.ceil(order.remaining)+' с')
   :selectedWarship.escort?'ЭСКОРТ · корабль сопровождает выбранный груз'
   :selectedWarship.prize
   ?'КОРАБЛЬ · '+(selectedWarship.path?'везёт добычу в свой порт':'ожидает доступный порт')+' · Esc — снять выделение'
   :selectedWarship.firing?'МОРСКОЙ БОЙ · выберите другой район, чтобы отойти'
   :'ПАТРУЛЬ · нажмите на море или выберите свой морской груз для охраны';
 }
}

function selectWarship(ship){
 if(ship.owner!=='you') return;
 if(mode) selectMode(mode);
 closeBuilding();
 selectedWarship=ship;
 selectedArmy=null;selectedGroup=[];selectedCargo=null;selectedCargoGroup=[];
 playSelectionSound('ship');
 $('cargo-inspector').hidden=true;
 $('placement').hidden=false;
 renderFleet();
}

function issueNavalOrder(point){
 const result=orderWarship(state,selectedWarship,point);
 if(!result.ok){flash(result.reason);return}
 orderPing={point:result.point,started:lastFrame??0,atSea:true};
 renderOrderPing(lastFrame??0);
}

$('fleet-repair').onclick=()=>{
 const result=orderRepair(state,selectedWarship);
 if(!result.ok) flash(result.reason);
 else {flash('Корабль идёт в ближайший свой порт');renderFleet()}
};

function describeNavalLoss(loss){
 const cargo=Object.entries(loss.cargo).map(([good,amount])=>(GOODS_LABELS[good]||good)+' '+amount).join(', ');
 return cargo+' · стоимость груза '+loss.value+' зл.';
}

function onNavalEvent(kind,ship,victim,loss){
 if(kind==='repaired'){
  if(ship.owner==='you') flash('Корпус отремонтирован');
  return;
 }
 if(kind==='sunk'){
  const label=ship.owner==='you'?'Ваш корабль затонул':'Корабль соперника затонул';
  flash(label);
  addNotice('war',label,loss?describeNavalLoss(loss):'',ship.homeId,loss?.point||navalPosition(ship));
  return;
 }
 if(ship.owner!=='you'){
  if(kind==='capture'&&victim==='you'){
   flash('Потерян груз · '+loss.value+' зл.');
   addNotice('war','Морской перехват',describeNavalLoss(loss),null,loss.point);
  }
  return;
 }
 if(kind==='capture'){
  const port=state.regions.find(r=>r.id===ship.prize.portId);
  flash('Груз захвачен · корабль идёт в '+port.city);
  addNotice('war','Морской перехват',describeNavalLoss(loss)+' · доставка в '+port.city,null,loss.point);
 }else{
  flash(ship.patrol?'Добыча доставлена · корабль возвращается на патруль':'Добыча доставлена');
  addNotice('economy','Добыча доставлена','Захваченные товары пополнили запасы державы.');
 }
}

function merchantDockHeading(ship,along,heading){
 if(!state._harborFrames?.size)return heading;
 const start=along-ship.seaStart,end=ship.seaEnd-along,gap=Math.min(start,end);
 if(gap>=4.5)return heading;
 const endpoint=pointAtRouteDistance(ship.path,start<end?ship.seaStart:ship.seaEnd);
 const f=state._harborFrames.get(berthKey(endpoint));
 if(!f)return heading;
 // Turn parallel to the quay along the last hull length, retaining the nearest heading.
 const difference=f.angle-heading;
 const turn=Math.atan2(Math.sin(2*difference),Math.cos(2*difference))*.5;
 const weight=Math.max(0,1-gap/4.5);
 return heading+turn*weight*weight*(3-2*weight);
}
function recordHarborDelivery(ship){
 if(ship.mode!=='sea'||!state._harborFrames?.size)return;
 const key=berthKey(ship.path.at(-1)),f=state._harborFrames.get(key);
 if(!f)return;
 const heading=merchantDockHeading(ship,ship.seaEnd,routeHeading(ship.path,1));
 (state._harborUnloading??=new Map()).set(key,{frame:f,heading,owner:shipmentOwner(ship),start:state.economy.seconds});
}
function drawHarborUnloading(out){
 const active=state._harborUnloading;
 if(!active?.size)return;
 const now=state.economy.seconds+simClock;
 for(const [key,event] of active){
  const t=(now-event.start)/2.8,f=event.frame;
  if(t>=1){active.delete(key);continue}
  if(t<0||!inMapViewport(f.berth.x,f.berth.z,2))continue;
  const paint=FACTION_COLORS[event.owner]||FACTION_COLORS.you;
  placeShip(out,shipModel(paint,false,cam.scale>=.006,true),f.berth.x,-1.15,f.berth.z,event.heading);
  const parts=[],rise=Math.sin(t*Math.PI);
  const loadY=-.32+1.31*rise,swing=.28*Math.sin(t*2*Math.PI);
  timberBeam(parts,[-.67,2.33,1.16],[-.67+swing,loadY+.40,1.16],.037,[.59,.47,.32]);
  harborCargo(parts,-.67+swing,loadY,1.16,.55,false);
  for(let i=0;i<parts.length;i+=6){
   const u=parts[i],v=parts[i+2];
   out.push(f.berth.x+u*f.nz-v*f.nx,parts[i+1],f.berth.z-u*f.nx-v*f.nz,parts[i+3],parts[i+4],parts[i+5]);
  }
 }
}
const timberCartLoad=[];
for(const [z,h] of [[-.26,1.02],[.26,1.02],[0,1.39]])millLog(timberCartLoad,-.18,h,z,2.20,.24);
const oreCartLoad=[];
for(const [x,z,r,h] of [[-.47,.16,.36,.37],[-.17,-.17,.39,.45],[.21,.15,.31,.37],[.39,-.18,.28,.34]])
 oreRock(oreCartLoad,x,.83,z,r,h,x*6,[.43,.37,.34]);
const clothCartLoad=[];
clothRoll(clothCartLoad,-.13,1.01,-.25,1.47,.24,loomMadder);
clothRoll(clothCartLoad,-.13,1.01,.26,1.52,.24,loomIndigo);
clothRoll(clothCartLoad,-.16,1.40,0,1.41,.22,loomLinen);
// Baked low-poly forms, with the same soft upper-left light as the terrain.
function paintedOval(out,x,y,z,rx,ry,rz,color,sides=8){
 const rings=[-.72,0,.72],light=[-.47,.78,-.36];
 const point=(angle,ring)=>{
  const width=Math.sqrt(1-ring*ring);
  return [x+rx*Math.cos(angle)*width,y+ry*ring,z+rz*Math.sin(angle)*width];
 };
 for(let i=0;i<sides;i++){
  const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides,mid=(a+b)*.5;
  const lightAt=h=>tint(color,.82+.32*Math.max(0,Math.cos(mid)*light[0]+h*light[1]+Math.sin(mid)*light[2]));
  for(let j=0;j<rings.length-1;j++){
   const t=rings[j],u=rings[j+1];
   quad(out,point(a,t),point(b,t),point(b,u),point(a,u),lightAt((t+u)*.5));
  }
  tri(out,point(a,rings[0]),[x,y-ry,z],point(b,rings[0]),lightAt(-1));
  tri(out,point(a,rings[2]),point(b,rings[2]),[x,y+ry,z],lightAt(1));
 }
}
function appendPaintedModel(out,mesh,x,y,z,angle){
 const c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<mesh.length;i+=6){
  const u=mesh[i],v=mesh[i+2];
  out.push(x+u*c-v*s,y+mesh[i+1],z+u*s+v*c,mesh[i+3],mesh[i+4],mesh[i+5]);
 }
}
const wagonPlanks=[],wagonSacks=[],wagonHorse=[];
const oakCart=[.49,.33,.20],oakTrim=[.62,.45,.27],chestnut=[.53,.31,.20],horseLeather=[.22,.15,.11];
cube(wagonPlanks,0,.38,0,1.86,.13,1.05,oakCart);
for(const side of [-1,1]){
 for(let board=0;board<3;board++)cube(wagonPlanks,0,.49+board*.113,side*.49,1.94,.103,.10,board%2?oakTrim:oakCart);
 for(const x of [-.67,.63])cube(wagonPlanks,x,.43,side*.565,.09,.44,.09,[.36,.24,.15]);
 for(const x of [-.94,.94])for(let board=0;board<2;board++)
  cube(wagonPlanks,x,.49+board*.14,0,.11,.13,.98,board?oakTrim:oakCart);
 timberBeam(wagonPlanks,[.70,.47,side*.39],[1.85,.52,side*.22],.04,[.34,.23,.14]);
}
for(const [x,y,z,shift] of [[-.53,.75,-.24,0],[-.04,.78,.24,.06],[.48,.75,-.21,0],[-.34,.95,.19,.04]]){
 paintedOval(wagonSacks,x,y,z,.30,.135,.235,[.72+shift,.62+shift,.43+shift],6);
 timberBeam(wagonSacks,[x-.12,y+.126,z-.09],[x+.17,y+.126,z+.06],.026,[.51,.43,.31]);
}
paintedOval(wagonHorse,1.55,.83,0,.59,.35,.235,chestnut,8);
paintedOval(wagonHorse,1.91,1.06,0,.27,.34,.19,[.56,.33,.21],6);
paintedOval(wagonHorse,2.16,1.25,0,.28,.165,.135,[.56,.34,.23],6);
paintedOval(wagonHorse,2.34,1.155,0,.14,.105,.11,[.36,.24,.19],6);
timberBeam(wagonHorse,[1.77,1.12,0],[2.06,1.43,0],.11,[.25,.16,.12]);
timberBeam(wagonHorse,[1.07,.93,0],[.93,.52,-.055],.067,[.28,.17,.11]);
for(const z of [-.072,.072]){
 timberBeam(wagonHorse,[2.13,1.33,z],[2.15,1.51,z],.042,chestnut);
 timberBeam(wagonHorse,[2.18,1.23,z],[1.78,.88,Math.sign(z)*.20],.022,horseLeather);
}
function addWagonHorse(parts,phase,stopped,offset=0){
 if(offset)appendPaintedModel(parts,wagonHorse,offset,0,0,0);
 else parts.push(...wagonHorse);
 for(let leg=0;leg<4;leg++){
  const x=offset+(leg%2?1.87:1.20),z=leg<2?-.16:.16;
  const stride=stopped?0:Math.sin(phase+(leg===0||leg===3?0:Math.PI))*.125;
  timberBeam(parts,[x,.68,z],[x+stride,.37,z],.092,chestnut);
  timberBeam(parts,[x+stride,.37,z],[x+stride*1.32,.083,z],.070,horseLeather);
  cube(parts,x+stride*1.32,.038,z,.095,.076,.084,horseLeather);
 }
}
function drawCarts(){
 if(!state.economy||(!state.economy.shipments.length&&!state._harborUnloading?.size))return;
 const v=[],visible=[];
 if(campaignCargoMode!=='hidden')drawHarborUnloading(v);
 for(const ship of state.economy.shipments){
  if(!campaignCargoVisible(ship))continue;
  const progress=cargoProgress(ship);
  const point=pointOnRoute(ship.path,progress);
  if(!inMapViewport(point.x,point.z,3,145))continue;
  const strategic=ship===selectedCargo||ship.kind==='petition'||ship.kind==='export'||ship.kind==='botSeaTrade';
  visible.push({ship,progress,point,strategic});
 }
 // Merchants and diplomatic columns keep their silhouette in a busy view.
 let localDetail=Math.max(8,32-visible.length);
 for(const {ship,progress,point:p,strategic} of visible){
 const along=routeDistanceAt(ship.path,progress),phase=along/.35;
 const y=roadGround(p.x,p.z)+.34+Math.sin(phase*2)*.055;
 if(!inMapViewport(p.x,p.z,y))continue;
 const angle=routeHeading(ship.path,progress);
 const color={grain:[.8,.69,.38],wood:[.48,.34,.23],iron:[.55,.56,.56],cloth:[.68,.44,.47],equipment:[.72,.52,.27]}[ship.good],parts=[];
 const factionColor=FACTION_COLORS[shipmentOwner(ship)]||FACTION_COLORS.you;
 const close=cam.scale>=WAGON_DETAIL_ZOOM;
 const tiers=cargoTiers(ship.amount||0);
 const atSea=ship.mode==='sea'&&along>=ship.seaStart&&along<=ship.seaEnd;
 if(atSea){
  if(navigableWater(p)){
   const heading=merchantDockHeading(ship,along,angle);
   if(!ship.supplyBlocked&&along-ship.seaStart>3)shipWake(v,p.x,p.z,heading,false,phase);
   const detailedShip=ship===selectedCargo||ship.kind==='petition'||cam.scale>=.006&&(strategic||localDetail-- > 0);
   placeShip(v,shipModel(factionColor,false,detailedShip),p.x,-1.15,p.z,heading);
  }
  continue;
 }
 // The last water gap is handled by the quay crew. Road wagons stop at the shore.
 if(GAME_MAP&&ship.mode==='sea'&&isSeaBackground(p.x,p.z))continue;
 if(cam.scale>=.006)addActorShadow(p.x+.24,p.z+.24,2.18,1.01);
 if(!close){
  cube(parts,0,.42,0,1.9,.42,1.08,oakCart);
  if(ship.amount>0)cube(parts,-.13,.90,0,1.5,.23+tiers*.16,.90,color);
  cube(parts,1.43,.47,0,1.14,.56,.49,chestnut);
  cube(parts,2.06,.84,0,.41,.30,.27,[.52,.34,.24]);
 }
 else{
  parts.push(...wagonPlanks);
  cube(parts,-.08,.55,-.56,.31,.26,.045,factionColor);
  const supplyCargo=(ship.kind==='supply'||ship.kind==='botSupply'||ship.kind==='industry')?ship.cargo:null;
  const mainCargo=supplyCargo?Math.max(...Object.values(supplyCargo)):0;
  if(mainCargo>0&&supplyCargo.wood===mainCargo)parts.push(...timberCartLoad);
  else if(mainCargo>0&&supplyCargo.iron===mainCargo)parts.push(...oreCartLoad);
  else if(mainCargo>0&&supplyCargo.cloth===mainCargo)parts.push(...clothCartLoad);
  else if(ship.amount>0){
   if(ship.good==='grain'||mainCargo>0&&supplyCargo.grain===mainCargo)parts.push(...wagonSacks);
   else cube(parts,-.10,.77,0,1.30,.42,.85,color);
  }
  if(ship.amount>0)for(let tier=1;tier<tiers;tier++){
   const height=1.23+(tier-1)*.28;
   if(ship.good==='wood')millLog(parts,-.15,height,(tier%2?1:-1)*.21,1.43,.13);
   else if(ship.good==='grain')paintedOval(parts,-.31+(tier%2)*.52,height-.17,0,.27,.104,.21,[.74,.63,.44],6);
   else cube(parts,-.31+(tier%2)*.52,height,0,.54,.27,.67,color);
  }
  for(const x of [-.58,.57])for(const z of [-.61,.61])wheel(parts,x,.4,z,.36,phase);
  addWagonHorse(parts,phase,ship.supplyBlocked);
 if(ship.kind==='export'||ship.kind==='tradeReturn'){const x=-3.9;cube(parts,x,.42,0,1.6,.4,1,[.38,.28,.18]);cube(parts,x,.85,0,1.2,.65,.8,[.70,.58,.40]);for(const dx of [-.4,.4])for(const z of [-.54,.54])wheel(parts,x+dx,.35,z,.3,phase);addWagonHorse(parts,phase,ship.supplyBlocked,x);cube(parts,-.3,1.6,-.35,.08,2.2,.08,[.33,.24,.14]);cube(parts,-.3,2.35,-.06,.07,.6,.58,factionColor)}
 if(ship.kind==='petition'){// A diplomatic column: baggage, standard and armed escort, with no combat effect.
 for(let wagon=1;wagon<=2;wagon++){let x=-wagon*3.9;cube(parts,x,.42,0,1.5,.35,.9,[.38,.28,.18]);cube(parts,x,.85,0,1.1,.65,.75,wagon===1?[.71,.57,.31]:[.59,.55,.44]);for(const dx of [-.42,.42])for(const z of [-.48,.48])wheel(parts,x+dx,.35,z,.28,phase);addWagonHorse(parts,phase,ship.supplyBlocked,x)}
 cube(parts,-.15,1.3,-.36,.09,2.0,.09,[.33,.24,.14]);cube(parts,-.15,2.05,-.1,.07,.7,.55,factionColor);cube(parts,-.17,2.13,-.1,.12,.18,.18,[.96,.81,.43]);
 for(let i=0;i<4;i++){let x=-1.2-(i>>1)*2.7,z=(i%2?1:-1)*1.15,bob=Math.sin(phase+i)*.07;cube(parts,x,.52+bob,z,.32,.74,.27,factionColor);cube(parts,x,1.02+bob,z,.27,.27,.27,[.79,.68,.50]);cube(parts,x+.18,.75+bob,z,.08,1.55,.08,[.40,.33,.22]);cube(parts,x,1.18+bob,z,.35,.1,.33,[.55,.56,.50])}}
 }appendPaintedModel(v,parts,p.x,y,p.z,angle);
 }if(!cartBuffer)cartBuffer={buffer:gl.createBuffer(),count:0};gl.bindBuffer(gl.ARRAY_BUFFER,cartBuffer.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.DYNAMIC_DRAW);cartBuffer.count=v.length/6;drawBuffer(cartBuffer)}
let marchBuffer=null,selectedArmy=null,selectedGroup=[],selectedCargoGroup=[];const marchElements=new Map();
const armyRouteBuffers=new Map();
function buildArmyRouteRibbon(unit){
 armyPathSample(unit,0);
 const {path}=unit,lengths=unit._lengths;
 const travelled=routeDistanceAt(path,Math.min(1,unit.elapsed/unit.duration));
 const first=lengths.findIndex(length=>length>travelled);
 if(first<0)return null;
 const head=armyPathSample(unit,travelled);
 const lift=(point,ground,distance)=>{
  const atSea=path.landingId!=null&&distance>=path.seaStart&&distance<=path.seaEnd;
  return [point.x,atSea?-.6:ground+1.1,point.z];
 };
 const points=[lift(head,head.y,travelled),...path.slice(first).map((point,index)=>
  lift(point,unit._heights[first+index],lengths[first+index]))];
 const vertices=[];
 const push=(point,direction,side)=>vertices.push(...point,...direction,side);
 let previous=null;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],direction=b.map((value,axis)=>value-a[axis]);
  if(Math.hypot(...direction)<1e-5)continue;
  push(a,direction,-1);push(a,direction,1);push(b,direction,1);
  push(a,direction,-1);push(b,direction,1);push(b,direction,-1);
  if(previous){
   push(a,previous,0);push(a,previous,1);push(a,direction,1);
   push(a,previous,0);push(a,direction,-1);push(a,previous,-1);
  }
  previous=direction;
 }
 return vertices.length?makeBorderBuffer(vertices):null;
}
function drawSelectedArmyRoutes(){
 const selections=selectedArmy?[selectedArmy]:selectedGroup;
 if(!selections.length&&!armyRouteBuffers.size)return;
 const moving=new Set(selections.map(item=>item.unit).filter(unit=>unit&&state.armyMoves?.includes(unit)));
 for(const [unit,route] of armyRouteBuffers){
  if(moving.has(unit)&&unit.path===route.path&&unit.elapsed===route.elapsed)continue;
  if(route.ribbon)gl.deleteBuffer(route.ribbon.buffer);
  armyRouteBuffers.delete(unit);
 }
 for(const unit of moving){
  let route=armyRouteBuffers.get(unit);
  if(!route){
   route={path:unit.path,elapsed:unit.elapsed,ribbon:buildArmyRouteRibbon(unit)};
   armyRouteBuffers.set(unit,route);
  }
  drawBorderBuffer(route.ribbon,3,[.08,.24,.12]);
  drawBorderBuffer(route.ribbon,1.65,[.44,.96,.42]);
 }
}
function armyPathSample(m,at){if(m._lengthPath!==m.path){m._lengthPath=m.path;m._heights=m.path.map(p=>roadGround(p.x,p.z));m._lengths=[0];for(let i=1;i<m.path.length;i++)m._lengths.push(m._lengths[i-1]+distance(m.path[i-1],m.path[i]));m._length=m._lengths.at(-1)}let d=Math.max(0,Math.min(m._length,at)),lo=1,hi=m._lengths.length-1;while(lo<hi){let mid=(lo+hi)>>1;if(m._lengths[mid]<d)lo=mid+1;else hi=mid}let a=m.path[lo-1],b=m.path[lo],length=m._lengths[lo]-m._lengths[lo-1],t=length?(d-m._lengths[lo-1])/length:0;return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:m._heights[lo-1]+(m._heights[lo]-m._heights[lo-1])*t,angle:Math.atan2(b.z-a.z,b.x-a.x)}}
const infantryModels=new WeakMap(),armyPaintHeading=new WeakMap();
function infantryModel(livery,detail){
 let models=infantryModels.get(livery);
 if(!models){models=[];infantryModels.set(livery,models)}
 if(models[detail])return models[detail];
 const mesh=[];
 const steel=[.68,.75,.78],leather=[.24,.17,.13],skin=[.72,.54,.38];
 const coat=tint(livery,.96);
 cube(mesh,0,.24,0,.31,.45,.29,coat);
 if(!detail){
  cube(mesh,.015,.69,0,.24,.20,.25,steel);
  cube(mesh,.18,.38,.096,.045,.29,.17,[.80,.59,.26]);
 }else{
  cube(mesh,0,.60,0,.188,.19,.19,skin);
  paintedOval(mesh,-.023,.835,0,.143,.15,.137,steel,detail===2?7:5);
  cube(mesh,.003,.77,0,.29,.043,.283,[.53,.59,.64]);
  cube(mesh,0,.32,0,.316,.065,.302,leather);
  for(const side of [-1,1]){
   cube(mesh,.01,.028,side*.071,.132,.19,.104,leather);
   if(detail===2){
    cube(mesh,.068,.020,side*.071,.148,.059,.109,[.31,.22,.15]);
    timberBeam(mesh,[-.01,.58,side*.137],[.137,.425,side*.164],.086,tint(coat,.89));
   }
  }
  const cx=.168,cy=.488,cz=.10;
  const rim=[[.175,-.123],[.175,.123],[-.036,.113],[-.18,0],[-.036,-.113]];
  const boss=[cx+.042,cy,cz];
  for(let i=0;i<rim.length;i++){
   const a=rim[i],b=rim[(i+1)%rim.length];
   const from=[cx,cy+a[0],cz+a[1]],to=[cx,cy+b[0],cz+b[1]];
   const innerA=[cx+.013,cy+a[0]*.87,cz+a[1]*.86],innerB=[cx+.013,cy+b[0]*.87,cz+b[1]*.86];
   quad(mesh,from,to,innerB,innerA,[.39,.27,.14]);
   tri(mesh,innerA,innerB,boss,tint([.86,.61,.28],i<2?1.06:.89));
  }
  if(detail===2)cube(mesh,cx+.034,cy-.028,cz,.041,.057,.058,[.68,.67,.54]);
 }
 models[detail]=mesh;
 return mesh;
}
function drawMarches(){
 const visible=[],transports=[],out=[];
 const close=cam.scale>=.011,medium=cam.scale>=.006;
 for(const march of state.armyMoves||[]){
  const elapsed=armyMarchElapsed(march,simClock),travel=routeDistanceAt(march.path,elapsed/march.duration);
  const lead=armyPathSample(march,travel);
  armyPaintHeading.set(march,lead.angle);
  if(march.path.landingId!=null&&travel>=march.path.seaStart&&travel<=march.path.seaEnd){
   if(inMapViewport(lead.x,lead.z,4)&&navigableWater(lead))transports.push({...lead,color:FACTION_COLORS[march.owner]||FACTION_COLORS.you});
   continue;
  }
  if(!march.inBattle&&inMapViewport(lead.x,lead.z,lead.y,170))visible.push({march,travel,lead,elapsed});
 }
 for(const march of state.fieldArmies||[]){
  if(!march.generalSlot||march.inBattle||march.troops<=0||!march.location?.point)continue;
  const {x,z}=march.location.point,y=roadGround(x,z);
  if(inMapViewport(x,z,y,120))visible.push({march,lead:{x,y,z,angle:armyPaintHeading.get(march)??-.76},elapsed:0});
 }
 if(!visible.length&&!transports.length)return;
 for(const {x,z,angle,color} of transports)placeShip(out,shipModel(color,false,medium),x,-1.15,z,angle);
 const allotment=Math.min(close?104:medium?42:12,Math.max(4,Math.floor((close?184:medium?152:112)/visible.length)));
 for(const {march,travel,lead,elapsed} of visible){
  const color=vassalById(state,march.vassalId,march.owner)?.color||FACTION_COLORS[march.owner]||FACTION_COLORS.you;
  const mesh=infantryModel(color,close?2:medium?1:0),count=Math.min(allotment,march.troops);
  const phase=elapsed*6,walking=travel!=null&&!march.waiting&&!motionReduced();
  for(let i=0;i<count;i++){
   const back=Math.floor(i/4)*.62,side=(i%4-1.5)*.37;
   const distanceAt=travel==null?0:travel-back;
   const p=travel==null?lead:armyPathSample(march,distanceAt);
   const behind=travel==null?back:Math.max(0,-distanceAt);
   const x=p.x-Math.cos(p.angle)*behind-Math.sin(p.angle)*side;
   const z=p.z-Math.sin(p.angle)*behind+Math.cos(p.angle)*side;
   const ground=behind>0?roadGround(x,z):p.y;
   const cadence=phase+i*.71,bob=walking?Math.sin(cadence)*.039:0;
   appendPaintedModel(out,mesh,x,ground+.38+bob,z,p.angle+(walking?Math.sin(cadence)*.034:0));
   if(medium)addActorShadow(x+.085,z+.065,.26,.189,ground);
   if(close&&i%9===0)timberBeam(out,[x,ground+.9,z],[x,ground+1.80,z-.08],.027,[.43,.34,.22]);
  }
  const dx=Math.cos(lead.angle),dz=Math.sin(lead.angle);
  const x=lead.x-dz*.68,z=lead.z+dx*.68,y=lead.y+1.12;
  const top=[x,y+1.80,z],tip=[x-dx*.91,y+1.39+Math.sin(phase)*.06,z-dz*.91];
  timberBeam(out,[x,y-.62,z],top,.065,[.39,.29,.20]);
  const lower=[x,y+1.06,z],fold=[x-dx*.44-dz*.07,y+1.38,z-dz*.44+dx*.07];
  tri(out,top,tip,fold,tint(color,1.15));
  tri(out,top,fold,lower,color);
  tri(out,fold,tip,lower,tint(color,.78));
 }
 if(!marchBuffer) marchBuffer={buffer:gl.createBuffer(),count:0};
 gl.bindBuffer(gl.ARRAY_BUFFER,marchBuffer.buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);
 marchBuffer.count=out.length/6;drawBuffer(marchBuffer);
}
let battleBuffer=null;
function drawBattles(now){
 const battles=state.battlePairs||[],out=[],phase=now*.004;
 for(const battle of battles){
  const p=battle.point,ground=roadGround(p.x,p.z)+1;
  if(!inMapViewport(p.x,p.z,ground))continue;
  const detail=cam.scale>=.006;
  for(const side of [-1,1]){
   const owner=side===1?battle.ownerB:battle.ownerA,total=side===1?battle.totalB:battle.totalA;
   const color=FACTION_COLORS[owner]||FACTION_COLORS.you;
   const count=Math.min(detail?18:6,Math.ceil(total/8));
   for(let i=0;i<count;i++){
    const advance=Math.sin(phase+i*.77)*.20;
    const x=p.x+side*(1.35+(i%3)*.36-advance),z=p.z+(Math.floor(i/3)-2.3)*.41;
    const y=ground+Math.abs(Math.sin(phase+i))*.10;
    const mesh=infantryModel(color,detail?2:0),angle=side===1?Math.PI:0;
    appendPaintedModel(out,mesh,x,y-.62,z,angle);
    if(detail)addActorShadow(x+.09,z+.06,.28,.21,ground-1);
    if(detail&&i%6===0)timberBeam(out,[x,y+.10,z],[x-side*.31,y+.66+advance,z],.03,[.58,.61,.61]);
   }
   const x=p.x+side*2.42,z=p.z+.62,y=ground+.5;
   timberBeam(out,[x,y,z],[x,y+1.7,z],.075,[.32,.27,.19]);
   tri(out,[x,y+1.65,z],[x,y+1.12,z],[x+side*.83,y+1.32,z+.14],color);
  }
 }
 if(!out.length)return;
 if(!battleBuffer)battleBuffer={buffer:gl.createBuffer(),count:0};
 gl.bindBuffer(gl.ARRAY_BUFFER,battleBuffer.buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);
 battleBuffer.count=out.length/6;
 drawBuffer(battleBuffer);
}
let pendingBorderOrder=null;
function countryName(id){
 if(id==='you')return realmCountryName('you');
 const faction=state.factions?.[id],region=state.regions.find(r=>r.id===faction?.regionId);
 if(faction?.isRebel)return 'Крестьянская фракция · '+(region?.city||'герцогство');
 return realmCountryName(id)||faction?.name||region?.name||'Соперник';
}
// The realm's title grows with its rank: a duchy is named by its seat, while
// kingdom and empire take the historical titles of the founding polity.
function realmCountryName(owner){
 const titles=owner==='you'?state.civilizationTitles:state.factions?.[owner]?.titles;
 if(!titles?.length)return owner==='you'?(state.civilizationName||'Ваша держава'):null;
 const rank=realmRank(state,owner);
 let name;
 if(rank.id==='kingdom')name=titles[1];
 else if(rank.id==='empire')name=titles[2];
 else{
  const capitalId=owner==='you'?state.capitalId:state.factions?.[owner]?.regionId;
  const capital=state.regions.find(r=>r.id===capitalId);
  name=capital?.name||titles[0];
 }
 if(owner!=='you'){
  const base=state.factions[owner].name;
  if(base&&base!==titles[0]&&base.includes(' · '))name+=' · '+base.slice(base.indexOf(' · ')+3);
 }
 return name;
}
function closeBorderModal(){pendingBorderOrder=null;$('border-modal').hidden=true}
let orderPing = null;

function confirmArmyOrder(result, onSuccess) {
 const march = result.march || result.marches?.[0];
 const point = march?.path?.at(-1);
 if (point) {
  orderPing = {point, started: lastFrame ?? 0};
  renderOrderPing(lastFrame ?? 0);
 }
 playFeedbackSound('march');
 onSuccess(result);
}

function renderOrderPing(now) {
 if (!orderPing) return;
 const el = $('order-ping');
 const progress = (now - orderPing.started) / 1050;
 if (progress >= 1) {
  el.hidden = true;
  orderPing = null;
  return;
 }
 const {x, z} = orderPing.point;
 const screen = project(x, z, orderPing.atSea?0:roadGround(x, z)+1);
 el.hidden = false;
 el.style.left = screen.x + 'px';
 el.style.top = screen.y + 'px';
 el.style.opacity = String(Math.min(1, (1 - progress) * 3));
 el.style.transform = 'translate(-50%, -50%) scale(' + (1.5 - progress * .7) + ')';
}

function requestArmyAction(execute,onSuccess){
 const result=execute();
 if(result.ok){confirmArmyOrder(result,onSuccess);return}
 if(!result.owners?.length){flash(result.reason||'Приказ недоступен');return}
 pendingBorderOrder={execute,onSuccess,owners:result.owners};
 const names=result.owners.map(countryName).join(', '),cost=result.owners.length*TRANSIT_COST;
 const truce=result.owners.find(owner=>truceDays(state,'you',owner));
 $('border-description').textContent='Путь пересекает владения: '+names+'. '+(truce?
  'Для прохода нужен договор. С державой «'+countryName(truce)+'» действует перемирие ещё '+truceDays(state,'you',truce)+' дн.':
  'Для прохода заключите договор или объявите войну. Без разрешения армия не выступит.');
 $('border-transit').textContent='ДОГОВОР О ПРОХОДЕ · '+cost+' ЗЛ.';
 $('border-transit').disabled=state.gold<cost;
 $('border-war').textContent=result.owners.length>1?'ОБЪЯВИТЬ ВОЙНУ СТРАНАМ':'ОБЪЯВИТЬ ВОЙНУ';
 $('border-war').disabled=!!truce;
 $('border-modal').hidden=false;
 $('border-cancel').focus?.();
}
function resolveBorderOrder(choice){let pending=pendingBorderOrder;if(!pending)return;closeBorderModal();let check=pending.execute();if(check.ok){confirmArmyOrder(check,pending.onSuccess);return}if(!check.owners?.length){flash(check.reason||'Приказ больше недоступен');return}if(choice==='transit'){let cost=check.owners.length*TRANSIT_COST;if(state.gold<cost){requestArmyAction(pending.execute,pending.onSuccess);flash('Не хватает золота на договор');return}for(const id of check.owners){let result=grantTransit(state,id);if(!result.ok){flash(result.reason);return}}flash('Договор о проходе заключён')}else{const truce=check.owners.find(owner=>truceDays(state,'you',owner));if(truce){requestArmyAction(pending.execute,pending.onSuccess);return}for(const id of check.owners){let result=declareWar(state,id);if(!result.ok&&!isAtWar(state,'you',id)){flash(result.reason);return}}flash('Война объявлена: торговля с противником остановлена')}updateUI();requestArmyAction(pending.execute,pending.onSuccess)}
$('border-cancel').onclick=closeBorderModal;$('border-war').onclick=()=>resolveBorderOrder('war');$('border-transit').onclick=()=>resolveBorderOrder('transit');
function selectArmy(selection){
 if(armySelectionVassal(state,selection))return;
 selectedGroup=[];selectedCargoGroup=[];selectedCargo=null;
 $('cargo-inspector').hidden=true;$('object-chooser').hidden=true;
 if(mode)selectMode(mode);
 closeBuilding();selectedArmy=selection;$('placement').hidden=true;
 playSelectionSound('unit');
 renderMarches();
}
function issueSingleArmyOrder(location,targetOwner=null){
 const selection=selectedArmy;
 requestArmyAction(()=>{
  selection.offset=simClock;
  return orderArmy(state,selection,location,'you',targetOwner);
 },({march})=>{
  selectedArmy={kind:'unit',unit:march};
  flash('Армия выступила · '+Math.ceil(march.duration)+' сек.');
  renderMarches();
 });
}
function clickArmyBadge(item,event){
 if(selectedWarship){selectedWarship=null;$('placement').hidden=true}
 if(item.house&&item.owner==='you'){
  selectedCargo=null;selectedCargoGroup=[];selectedArmy=null;selectedGroup=[];
  $('object-title').textContent='ВОЙСКО ФЕОДАЛА';
  $('cargo-info').textContent=vassalDisplayName(state,item.house)+' · '+item.troops+' солдат · '+(item.key.vassalOrder||item.label);
  $('cargo-inspector').hidden=false;
  playSelectionSound('unit');renderMarches();
  return;
 }
 if(item.owner!=='you'){
  if(!selectedArmy&&!selectedGroup.length){
   selectedCargo=null;
   $('object-title').textContent='АРМИЯ СОПЕРНИКА';
   $('cargo-info').textContent=item.label+' · '+item.troops+' солдат';
   $('cargo-inspector').hidden=false;
   playSelectionSound('unit');
   return;
  }
  const destination=state.network&&nearestRoadLocation(state.network,item.point.x,item.point.z);
  if(!destination){flash('Нет пути к противнику');return}
  if(selectedGroup.length)issueGroupOrder(destination,item.owner);
  else issueSingleArmyOrder(destination,item.owner);
  return;
 }
 if(event.shiftKey&&selectedArmy){
  const target=armyForSelection(state,item.selection);
  if(!target){flash('Целевая армия должна остановиться');return}
  const merged=mergeArmies(state,selectedArmy,item.selection);
  if(merged.ok){selectedArmy=item.selection;return}
  const selection=selectedArmy;
  requestArmyAction(()=>{
   selection.offset=simClock;
   return orderArmy(state,selection,target.location);
  },({march})=>{
   selectedArmy={kind:'unit',unit:march};
   flash(march.generalSlot?'Армия идёт к другому командиру':'Армия идёт на соединение');
  });
  return;
 }
 selectArmy(item.selection);
}
function armySelectionKey(selection){
 return selection?.kind==='garrison'?state.garrisons?.[selection.regionId]:selection?.unit;
}
let armySelectionRows=[];
function renderArmySelection(byKey){
 const panel=$('army-selection'),list=$('army-selection-list'),total=$('army-selection-total');
 const selections=selectedArmy?[selectedArmy]:selectedGroup;
 panel.hidden=!selections.length;
 if(panel.hidden){
  if(armySelectionRows.length){list.replaceChildren();armySelectionRows=[]}
  return;
 }
 const items=selections.map(selection=>byKey.get(armySelectionKey(selection)));
 if(items.length===armySelectionRows.length&&items.every((item,i)=>{
  const previous=armySelectionRows[i];
  return item.key===previous.key&&item.troops===previous.troops&&item.label===previous.label&&item.icon===previous.icon;
 }))return;
 const toNumber=n=>n.toLocaleString(interfaceLocale);
 const sum=items.reduce((value,item)=>value+item.troops,0);
 const summary=globalThis.gameI18n?.text('Отряды {0} · Солдаты {1}',toNumber(items.length),toNumber(sum))??
  ('Отряды '+toNumber(items.length)+' · Солдаты '+toNumber(sum));
 if(total.textContent!==summary)total.textContent=summary;
 const fragment=document.createDocumentFragment();
 let focusIndex=-1;
 for(const [i,row] of Array.from(list.children).entries()){
  if(row.contains(document.activeElement))focusIndex=i;
 }
 for(const item of items){
  const row=document.createElement('li'),button=document.createElement('button');
  button.type='button';button.className='army-selection-row';
  const icon=document.createElement('span'),name=document.createElement('span'),count=document.createElement('b');
  icon.className='army-selection-icon';icon.setAttribute('aria-hidden','true');
  if(item.general)icon.innerHTML=generalArmySwords;
  else icon.textContent=item.icon;
  name.textContent=item.label;count.textContent=toNumber(item.troops);
  button.append(icon,name,count);button.onclick=()=>{
   const point=marchElements.get(item.key)?.armyItem.point;
   if(point){cam.x=point.x;cam.z=point.z;dirtyLabels=true}
   if(!selectedArmy)selectArmy(item.selection);
  };
  row.appendChild(button);fragment.appendChild(row);
 }
 list.replaceChildren(fragment);
 if(focusIndex>=0)list.children[Math.min(focusIndex,items.length-1)]?.firstElementChild.focus({preventScroll:true});
 armySelectionRows=items;
}
$('army-selection-close').onclick=()=>{
 selectedArmy=null;selectedGroup=[];
 selectedCargoGroup=[];
 renderMarches();renderCargo();
};
const armyBadgeShield='<span class="army-unit-emblem" aria-hidden="true"><svg viewBox="0 0 24 27"><path d="M2 2h20v12c0 5-5 9-10 11C7 23 2 19 2 14Z" fill="currentColor" fill-opacity=".2" stroke="currentColor"/><path d="M7 7l11 11m-11 0L18 7m-5 11 4-4M6 14l4 4" stroke="currentColor" stroke-width="1.5"/></svg></span>';
const generalArmySwords='<svg class="general-army-swords" viewBox="0 0 32 32" aria-hidden="true"><use href="#ui-general-swords"/></svg>';
function renderMarches(){
 const layer=$('army-layer'),items=[];
 for(const region of state.regions){
  const g=state.garrisons?.[region.id];
  if(g&&g.troops>0&&g.owner===region.owner){
   items.push({key:g,owner:g.owner,house:vassalFor(state,region),troops:g.troops,point:region.slots[0],
    selection:{kind:'garrison',regionId:region.id},label:'Гарнизон · '+region.city,icon:'♜'});
  }
 }
 for(const unit of state.fieldArmies||[]){
  items.push({key:unit,owner:unit.owner,house:vassalById(state,unit.vassalId,unit.owner),troops:unit.troops,point:unit.location.point,
   selection:{kind:'unit',unit},label:unit.inBattle?'Идёт бой':unit.rebellion?'Повстанцы':'Армия на привале',icon:'⚔'});
 }
 for(const unit of state.armyMoves||[]){
  const elapsed=armyMarchElapsed(unit,simClock),progress=elapsed/unit.duration;
  const label=unit.inBattle?'Идёт бой':unit.gateId?'Осада ворот':unit.waiting?'Ожидает':
   'В пути · '+Math.ceil(unit.duration-elapsed)+' сек.';
  items.push({key:unit,owner:unit.owner,house:vassalById(state,unit.vassalId,unit.owner),troops:unit.troops,point:pointOnRoute(unit.path,progress),
   selection:{kind:'unit',unit},moving:true,label,icon:unit.gateId?'♜':'⚑'});
 }
 const byKey=new Map(items.map(item=>[item.key,item])),stacks=new Map();
 for(const item of items){
  item.count=item.troops.toLocaleString(interfaceLocale);
  item.general=item.key.generalSlot!=null&&item.key.vassalId==null;
  const point=item.point,key=Math.round(point.x)+':'+Math.round(point.z);
  if(!stacks.has(key))stacks.set(key,{size:0,spacing:65});
  const stack=stacks.get(key);
  item.stack=stack;item.stackIndex=stack.size++;
  if(item.general)stack.spacing=Math.max(stack.spacing,48+item.count.length*10);
 }
 const canSelect=selection=>{const item=byKey.get(armySelectionKey(selection));return item?.owner==='you'&&!item.house};
 if(selectedArmy&&!canSelect(selectedArmy))selectedArmy=null;
 selectedGroup=selectedGroup.filter(canSelect);
 const selectedKeys=new Set((selectedArmy?[selectedArmy]:selectedGroup).map(armySelectionKey));
 for(const [key,element] of marchElements){
  if(!byKey.has(key)){element.remove();marchElements.delete(key)}
 }
 for(const item of items){
  const {point,key,count,general,stack,stackIndex}=item;
  const screen=project(point.x,point.z,roadGround(point.x,point.z)+6);
  item.position={...screen};
  const nearSeat=!item.moving&&state.regions.find(r=>r.slots?.[0]&&Math.hypot(r.slots[0].x-point.x,r.slots[0].z-point.z)<=18);
  if(nearSeat){
   const seat=nearSeat.slots[0],label=project(seat.x,seat.z,roadGround(seat.x,seat.z));
   if(Math.hypot(screen.x-label.x,screen.y-label.y)<34){screen.x=label.x;screen.y=label.y+24}
  }
  screen.x+=(stackIndex-(stack.size-1)*.5)*stack.spacing;
  item.badge=screen;
  let element=marchElements.get(key);
  if(!element){
   element=document.createElement('button');
   element.type='button';
   element.innerHTML=general?generalArmySwords+'<b></b>':armyBadgeShield+'<span class="army-unit-values"><small></small><b></b></span>';
   element.addEventListener('pointerdown',event=>event.stopPropagation());
   element.addEventListener('click',event=>{event.stopPropagation();clickArmyBadge(element.armyItem,event)});
   layer.appendChild(element);marchElements.set(key,element);
  }
  element.armyItem=item;
  element.className='march-badge'+(general?' general-army-badge':'')+(general&&item.owner!=='you'?' foreign-army':'')+
   (selectedKeys.has(key)?' selected':'')+(key.inBattle?' fighting':'');
  colorUnitMarker(element,item.owner,item.house);
  const headcount=element.querySelector('b');
  const name=item.house?'Феодал':key.generalSlot?generalName(key.generalSlot):item.icon;
  if(!general){
   const commander=element.querySelector('small');
   if(commander.textContent!==name)commander.textContent=name;
  }
  if(headcount.textContent!==count)headcount.textContent=count;
  const title=name+' · '+(key.inBattle?'Идёт бой':item.label)+' · '+item.troops+' солдат'+(item.house?' · '+vassalDisplayName(state,item.house)+(key.vassalOrder?' · '+key.vassalOrder:''):item.owner==='you'?' · нажмите, чтобы выбрать':'');
  if(element.title!==title){element.title=title;element.setAttribute('aria-label',title)}
  element.style.left=screen.x+'px';element.style.top=screen.y+'px';
  element.hidden=!!key.inBattle||screen.x<0||screen.y<0||screen.x>canvas.clientWidth||screen.y>canvas.clientHeight;
 }
 renderArmySelection(byKey);
}
function roadLocationAtScreen(x,y){let best=null,min=26;for(const [id,edge] of state.network?.edges||[]){let [a,b]=edge,pa=project(a.x,a.z,roadGround(a.x,a.z)+.8),pb=project(b.x,b.z,roadGround(b.x,b.z)+.8),dx=pb.x-pa.x,dy=pb.y-pa.y,len=dx*dx+dy*dy;if(!len)continue;let t=Math.max(0,Math.min(1,((x-pa.x)*dx+(y-pa.y)*dy)/len)),d=Math.hypot(x-pa.x-t*dx,y-pa.y-t*dy);if(d<min){min=d;best={point:{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},links:id.split('|'),edge:id}}}return best}
let activityBuffer=null;
function drawWorkshopActivity(now){
 const distant=cam.scale<.006,time=now/1000,v=[];
 if(!state.started||(distant&&!pilotLand))return;
 for(const r of state.regions){
  if(distant&&r.id!==pilotLand.region)continue;
  if(r.owner!=='you'&&!state.factions?.[r.owner])continue;
  for(const b of r.buildings){
   if(b.type==='iron'){
    if(distant)continue;
    const ground=surfaceHeight(b.x,b.z);
    if(!inMapViewport(b.x,b.z,ground))continue;
    const s=b.scale??.34,y=ground+.35+farmFooting(b,2.7,-1.2)*s;
    const phase=b.route?.length?time*1.42+b.x*.18:0;
    mineHoist(v,b.x+2.7*s,y,b.z-1.2*s,s,Math.sin(phase)*2.5,1.35+(1-Math.cos(phase))*1.28);
    continue;
   }
   if(b.type==='wood'){
    if(distant||!inMapViewport(b.x,b.z,b.groundY??surfaceHeight(b.x,b.z)))continue;
    const s=b.scale??.34,y=(b.groundY??surfaceHeight(b.x,b.z))+.35;
    const moving=b.route?.length;
    sawFrame(v,b.x+1.5*s,y,b.z+1.17*s,s,moving?.36+.36*Math.sin(time*3.1+b.x):.3);
    if(r.owner==='you')sawmillStock(v,b,state.economy.seconds+simClock);
    continue;
   }
   if(b.type==='cloth'){
    if(distant)continue;
    const ground=surfaceHeight(b.x,b.z);
    if(!inMapViewport(b.x,b.z,ground))continue;
    const s=b.scale??.34,y=ground+.35+farmFooting(b,-2.12,2.20)*s;
    loomActivity(v,b.x-2.12*s,y,b.z+2.20*s,s,b.route?.length?time*3.4+b.z*.083:0);
    continue;
   }
   if(!b.product||b.type!=='grain')continue;
   if(GAME_MAP&&farmFormFor(r,b.slotId)!==0)continue;
   if(distant&&r.id!==pilotLand?.region)continue;
   const ground=surfaceHeight(b.x,b.z),s=b.scale??.34;
   if(!inMapViewport(b.x,b.z,ground))continue;
   const offset=GAME_MAP?-.8:-1.10,hub=GAME_MAP?7.15:5.05,face=GAME_MAP?1.66:.62;
   const y=ground+.35+(farmFooting(b,-4,offset)+hub)*s;
   millSails(v,b.x-4*s,y,b.z+face*s,GAME_MAP?s:s*.76,.42+(b.route?.length?time*.8:0));
  }
 }

 if(!v.length)return;if(!activityBuffer)activityBuffer={buffer:gl.createBuffer(),count:0};gl.bindBuffer(gl.ARRAY_BUFFER,activityBuffer.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.DYNAMIC_DRAW);activityBuffer.count=v.length/6;drawBuffer(activityBuffer)}
const GOODS_LABELS={grain:'зерно',wood:'древесина',iron:'железо',cloth:'ткани',equipment:'снаряжение'};function resourceGlyph(g){
 if(g==='equipment')return '<span class="cargo-equipment-icon" aria-hidden="true">⚒</span>';
 return '<svg class="resource-art" aria-hidden="true" viewBox="0 0 32 32"><use href="#resource-'+g+'"></use></svg>'}
let selectedBuilding=null,selectedCargo=null,lastSlotAffordability='';const cargoElements=new Map();
const slotMarkerNodes=new Map();
let slotMarkerRevision=0,slotMarkerContent='',slotMarkerView='';
function inspectMapBuilding(region,building){
 setSelected(region);
 if(region.awaitingAdministration)return;
 playSelectionSound(building.type);
 if(building===duchySeat(region)){closeBuilding();selectDuchyTab('overview');return}
 buildingDetails(region,building);
}
function buildingDetails(region,building){selectedBuilding={region,building};if(mode)selectMode(mode);updateBuildingDetails();showGain({x:building.x,z:building.z},'ВЫБРАНО','select')}
function closeBuilding(){selectedBuilding=null;$('building-detail').hidden=true}
function updateBuildingDetails(){let view=$('building-detail');if(!selectedBuilding){view.hidden=true;return}let {region,building:b}=selectedBuilding;if(region.owner!=='you'||!region.buildings.includes(b)){closeBuilding();return}view.hidden=false;let level=b.level||1;const workforce=workforceReport(region),job=workforce.byBuilding.get(b);$('building-kicker').textContent=(b.product||b.type==='city')?'ПОСТРОЙКА · УРОВЕНЬ '+level+' / 3':'ПОСТРОЙКА';$('building-name').textContent=TYPES[b.type].name;$('building-output').textContent=b.product?'Производство: '+(job?.rate||0).toFixed(1)+' ед./мин · работники '+(job?.workers||0)+' / '+buildingJobs(b)+' · '+LAND_NAMES[b.terrain]:(b.type==='city'?'Жители: '+Math.floor(b.population||0).toLocaleString(interfaceLocale)+' / '+cityHousing(b).toLocaleString(interfaceLocale)+' мест':'Морская торговля · рейсов: '+(state.economy?.tradeStats?.ports?.[region.id+':'+b.slotId]?.count||0)+' · выручка: '+(state.economy?.tradeStats?.ports?.[region.id+':'+b.slotId]?.revenue||0).toFixed(1)+' зл.');
 const staff=$('building-workforce');staff.hidden=!job||job.workers>=job.capacity;
 if(!staff.hidden)staff.textContent='Вакансий '+(job.capacity-job.workers)+' · в других постройках занято '+(workforce.employed-job.workers)+
  ' · свободно '+workforce.free+' · вне рабочей силы '+workforce.outsideWorkforce;
 if(b.type==='wood'){
 const load=producerLoads.get(b);
 $('building-output').textContent+=' · В графстве '+Math.max(0,b.produced||0).toFixed(1)+(load?' · Последний груз '+load.amount:'');
}
const launch=$('commission-warship');
 launch.hidden=b.type!=='port';
 if(b.type==='port'){
  const built=state.warships?.find(ship=>ship.owner==='you'&&ship.homeId===region.id);
  launch.textContent=built?'ВЫБРАТЬ КОРАБЛЬ':'ПОСТРОИТЬ КОРАБЛЬ · 90 ЗЛ. · 20 ДЕР. · 8 ЖЕЛ.';
  launch.disabled=!built&&(state.gold<WARSHIP_COST.gold||state.economy.stocks.wood<WARSHIP_COST.wood||state.economy.stocks.iron<WARSHIP_COST.iron||!portWaterCell(b));
 }
 const lane=b.route?.seaSupply;
 if(lane){
  const port=state.regions.find(r=>r.id===lane.departureId);
  $('building-output').textContent+=' · морем через '+port.city;
 }
 if(b.type==='port'){
  let usingPort=0;
  for(const area of state.regions){
   if(area.owner!=='you') continue;
   usingPort+=area.buildings.filter(building=>[building.route?.seaSupply?.departureId,building.route?.seaSupply?.arrivalId].includes(region.id)).length;
  }
  $('building-output').textContent+=' · снабжение: '+usingPort+' постр.';
 }
 const remove=$('building-demolish');remove.hidden=b===duchySeat(region)||!!b.capital;
 let q=upgradeCheck(state,region,b),button=$('building-upgrade');button.disabled=!q.ok;button.textContent=q.ok?'УЛУЧШИТЬ · '+q.cost+' ЗЛ.':q.cost?q.reason+' · '+q.cost+' ЗЛ.':q.reason;button.title=q.reason||'';$('building-note').textContent=q.nextHousing?'Жильё '+cityHousing(b)+' → '+q.nextHousing+' · рабочих мест '+buildingJobs(b)+' → '+q.nextJobs+' · довольство +2 к цели'+(b.capital?' · караваны '+level+' → '+(level+1):''):q.nextRate?'Рабочие места: '+buildingJobs(b)+' → '+buildingJobs({...b,level:level+1})+' · до '+q.nextRate+' ед./мин при полном штате и контроле':(b.type==='port'?'Портов соперников в мире: '+state.regions.filter(r=>r.coast&&state.factions?.[r.owner]&&!isAtWar(state,'you',r.owner)&&r.buildings.some(b=>b.type==='port')).length+'. Стоимость порта: '+TYPES.port.cost+' зл. Рейсы и выручка учитываются после доставки; цена морем выше на 50% до надбавки за расстояние. Путь и спрос нужны; местные купцы покупают груз, государство получает пошлину 15%. Караван выходит из столицы, затем грузит корабль.':b.product||b.type==='city'?'Постройка полностью улучшена':'Улучшение этого типа появится позже');
 if(q.reason&&q.cost)button.title=q.reason+' · '+$('building-note').textContent;
 if(b.type==='city')$('building-output').textContent+=' · услуги '+(job?.workers||0)+' / '+buildingJobs(b)+' рабочих мест · развитие +'+(1+2*(level-1))+(b.capital?' · сухопутные караваны '+level:'');
 for(const id of ['building-output','building-note','building-workforce'])setGameStatText($(id),$(id).textContent);
 useActionTitles([
  ['building-upgrade','Улучшение постройки',$('building-note').textContent],
  ['building-demolish','Снос постройки','Место освободится для новой постройки.'],
  ['commission-warship','Военный корабль',launch.disabled?
   (costShortfalls(state.gold,state.economy.stocks,WARSHIP_COST.gold,{wood:WARSHIP_COST.wood,iron:WARSHIP_COST.iron}).join(' · ')||'Нужен причал, доступный с воды.'):
   'Цена · 90 зл., 20 древесины, 8 железа.']]);
}
$('building-demolish').onclick=()=>{
 if(!selectedBuilding)return;
 const {region,building}=selectedBuilding,result=demolishBuilding(state,region,building);
 if(!result.ok){flash(result.reason);return;}
 closeBuilding();
 if(building.type==='port'){
  const affected=new Set(['you']);
  refreshCapitalRoutes(false,affected);refreshSupplyShipments(affected);
 }else rebuildRoads();
 buildingsBuffer=geometryForBuildings();
 dirtyLabels=true;rebuildParcelSurfaces();setSelected(region);updateUI();
 flash(TYPES[building.type].name+' · графство освобождено');
};
$('building-close').onclick=closeBuilding;
$('commission-warship').onclick=()=>{
 if(!selectedBuilding) return;
 const {region,building}=selectedBuilding;
 const existing=state.warships?.find(ship=>ship.owner==='you'&&ship.homeId===region.id);
 if(existing){selectWarship(existing);return}
 const result=commissionWarship(state,region,building);
 if(!result.ok){flash(result.reason);return}
 const point=navalPosition(result.ship);
 cam.x=point.x;cam.z=point.z;dirtyLabels=true;
 selectWarship(result.ship);
 flash('Военный корабль спущен на воду');
 updateUI();
};

$('building-upgrade').onclick=()=>{if(!selectedBuilding)return;let {region,building}=selectedBuilding,result=upgradeBuilding(state,region,building);if(!result.ok){flash(result.reason);return}buildingsBuffer=geometryForBuildings();updateUI();updateBuildingDetails();showGain({x:building.x,z:building.z},building.type==='city'?'↑ '+cityHousing(building)+' мест':'↑ '+building.product.rate+' / мин','upgrade');flash(TYPES[building.type].name+' · уровень '+building.level)};
function cargoDescription(ship){let realm=shipmentOwner(ship),capital=state.regions.find(r=>r.id===realmCapitalId(state,realm)),home=capital?.city||'столица',tradeHome=tradeCenter(state,ship.marketId,realm)?.city||home,owner=state.factions?.[ship.owner],buyer=state.factions?.[ship.buyer],seller=state.factions?.[ship.seller],regionCity=f=>state.regions.find(r=>r.id===f?.regionId)?.city||'соперник';let label,origin,destination;
 if(ship.kind==='industry'){
  label=({materials:'Сырьё для оружейной мастерской',equipment:'Снаряжение в столицу',return:'Возврат сырья'})[ship.industryPurpose];
  origin=state.regions.find(r=>r.id===ship.originRegion)?.city||'склад';
  destination=state.regions.find(r=>r.id===ship.industryDestination)?.city||home;
 }else if(isGranaryShipment(ship)){
  label=({harvest:'Урожай',provision:'Подвоз зерна',market:'Зерно к рынку',return:'Возврат зерна',relief:'Помощь герцогству'})[ship.grainPurpose]||'Подвоз зерна';
  origin=state.regions.find(r=>r.id===ship.originRegion)?.city||'место отправки';
  destination=state.regions.find(r=>r.id===ship.grainDestination)?.city||'город';
 }else if(ship.kind==='petitionReturn'){
  label='Поселенцы возвращаются';
  origin=state.regions.find(r=>r.id===ship.targetId)?.city||'поворот на маршруте';
  destination=state.regions.find(r=>r.id===(ship.returnCapitalId??ship.originRegionId))?.city||home;
 }else if(ship.kind==='petition'){label=ship.mode==='sea'?'Морское посольство':'Обоз поселенцев';origin=state.regions.find(r=>r.id===ship.originRegionId)?.city||(ship.owner==='you'?home:regionCity(owner));destination=state.regions.find(r=>r.id===ship.targetId)?.city||'герцогство'}else if(ship.kind==='tradeReturn'){label='Торговец возвращается';origin='рынок';destination=tradeHome}else if(ship.kind==='returnTrade'){label='Возврат груза';origin='прерванный маршрут';destination=tradeHome}else if(ship.kind==='loot'){label='Захваченная добыча';origin='место перехвата';destination=ship.owner==='you'?home:regionCity(owner)}else if(ship.kind==='botSeaTrade'){label=ship.mode==='sea'?'Морской купец':'Купеческий караван';origin=regionCity(owner);destination=ship.mode==='sea'?(state.regions.find(r=>r.id===ship.destinationPortRegionId)?.city||'порт')+' · порт':ship.buyer==='you'?home:regionCity(buyer)}else if(ship.kind==='export'){label=ship.mode==='sea'?'Морской торговый караван':'Торговый караван · Продажа';origin=tradeHome;destination=ship.mode==='sea'?(state.regions.find(r=>r.id===ship.destinationPortRegionId)?.city||'порт')+' · порт':state.regions.find(r=>r.id===(ship.destinationRegionId??realmCapitalId(state,ship.buyer)))?.city||regionCity(buyer)}else if(ship.kind==='import'){label=ship.domesticPurchase?'Закупка феодала · '+ship.value+' зл.':'Покупка';origin=state.regions.find(r=>r.id===ship.sourceTradeRegionId)?.city||regionCity(seller);destination=state.regions.find(r=>r.id===ship.departureRegionId)?.city||home}else if(ship.kind==='botSupply'){label=ship.seaSupply?'Морское снабжение соперника':'Сборный обоз соперника';origin=state.regions.find(r=>r.id===ship.originRegion)?.city||'герцогство';destination=regionCity(owner)}else{const market=tradeCenter(state,ship.supplyMarketId);label=market?'Поставка на торговый склад':ship.marketTransfer!=null?'Запасы в столицу':ship.seaSupply?'Морское снабжение':'Сборная поставка в столицу';origin=state.regions.find(r=>r.id===ship.originRegion)?.city||'герцогство';destination=market?.city||home}let left=Math.max(0,Math.ceil(ship.duration-ship.elapsed-simClock));let factionId=shipmentOwner(ship),whose=factionId==='you'?(ship.seaSupply?'Ваш груз':'Ваш обоз'):'Обоз: '+regionCity(state.factions?.[factionId]);return whose+' · '+label+' · '+(ship.kind==='tradeReturn'?'без груза':(ship.cargo?Object.entries(ship.cargo).map(([g,n])=>GOODS_LABELS[g]+' '+n).join(', '):GOODS_LABELS[ship.good]+' '+ship.amount)+' ед.')+' · '+origin+' → '+destination+(ship.kind==='export'?' · путь '+Math.round(ship.tradeDistance||routeLength(ship.path))+(ship.mode==='sea'?' ед.':' / '+Math.round(ship.tradeRange||tradeRange(state))+' ед.')+' · выручка '+ship.value.toFixed(1)+' зл. после доставки · пошлина страны покупателя '+(ship.value*.15).toFixed(1)+' зл.':'')+(ship.seaSupply?' · через '+state.regions.find(r=>r.id===ship.seaSupply.departureId)?.city+' и '+state.regions.find(r=>r.id===ship.seaSupply.arrivalId)?.city:'')+(ship.kind==='petitionReturn'?' · возвращает '+ship.fee+' зл.':'')+(ship.supplyBlocked?' · пункт назначения недоступен':(ship.routeRisk?' · риск перехвата':ship.warDetour?' · маршрут в обход':'')+' · '+left+' сек.')}
function visibleCargoBadges(){
 const visible=[];
 const limit=cam.scale<.005?26:48;
 for(const ship of state.economy?.shipments||[]){
  if(!campaignCargoVisible(ship))continue;
  const progress=cargoProgress(ship);
  const p=pointOnRoute(ship.path,progress);
  if(!inMapViewport(p.x,p.z,3,160))continue;
  const screen=project(p.x,p.z,roadGround(p.x,p.z)+4);
  if(screen.x<-30||screen.y<-30||screen.x>canvas.clientWidth+30||screen.y>canvas.clientHeight+30)continue;
  const priority=ship===selectedCargo||selectedCargoGroup.includes(ship)?3:
   ['export','petition','petitionReturn','loot','botSeaTrade'].includes(ship.kind)?2:shipmentOwner(ship)==='you'?1:0;
  visible.push({ship,screen,priority});
 }
 visible.sort((a,b)=>b.priority-a.priority);
 // Preserve a distinct marker at busy intersections. A selection always takes priority.
 const cells=new Set(),out=[];
 const spacing=cam.scale<.005?25:16;
 for(const entry of visible){
  const {screen,priority}=entry,key=Math.floor(screen.x/spacing)+':'+Math.floor(screen.y/spacing);
  if(priority<3&&cells.has(key))continue;
  cells.add(key);out.push(entry);
  if(out.length===limit)break;
 }
 return out;
}
function renderCargo(){const layer=$('cargo-layer'),shipments=visibleCargoBadges(),live=new Set(shipments.map(e=>e.ship));for(const [ship,el] of cargoElements)if(!live.has(ship)){el.remove();cargoElements.delete(ship)}let previousCargoGroup=selectedCargoGroup.length;selectedCargoGroup=selectedCargoGroup.filter(ship=>state.economy?.shipments.includes(ship));if(previousCargoGroup&&!selectedCargoGroup.length&&!selectedCargo)$('cargo-inspector').hidden=true;else if(selectedCargoGroup.length&&!selectedGroup.length){$('object-title').textContent='ВЫБРАНО ОБОЗОВ: '+selectedCargoGroup.length;$('cargo-info').textContent='Обозы выполняют свои маршруты автоматически.'}if(selectedCargo&&!state.economy?.shipments.includes(selectedCargo)){selectedCargo=null;$('cargo-inspector').hidden=true}if(selectedCargo){let desc=cargoDescription(selectedCargo);const label=localizedLabel(desc);if($('cargo-info').textContent!==label)$('cargo-info').textContent=label}for(const {ship,screen} of shipments){let el=cargoElements.get(ship);if(!el){el=document.createElement('button');el.className='cargo-badge cargo-'+ship.good+(ship.kind==='petition'||ship.kind==='petitionReturn'?' cargo-petition':'');el.addEventListener('pointerdown',e=>e.stopPropagation());el.addEventListener('click',e=>{e.stopPropagation();if(selectedWarship&&ship.mode==='sea'){
 if(shipmentOwner(ship)==='you'){
  const result=orderEscort(state,selectedWarship,ship);
  if(result.ok) {flash('Назначено сопровождение');renderFleet()} else flash(result.reason);
 }else issueNavalOrder(pointOnRoute(ship.path,Math.min(1,(ship.elapsed+(ship.supplyBlocked?0:simClock))/ship.duration)));
 return;
}selectedWarship=null;selectedCargo=ship;selectedCargoGroup=[];selectedArmy=null;selectedGroup=[];$('placement').hidden=true;$('object-title').textContent='ВЫБРАННЫЙ ОБОЗ';$('cargo-inspector').hidden=false;$('cargo-info').textContent=cargoDescription(ship);renderMarches()});layer.appendChild(el);cargoElements.set(ship,el)}el.className='cargo-badge cargo-'+ship.good+(ship.kind==='petition'?' cargo-petition':'')+(ship.kind==='loot'?' cargo-loot':'')+(['export','tradeReturn','botSeaTrade'].includes(ship.kind)?' cargo-trade':'')+(ship===selectedCargo||selectedCargoGroup.includes(ship)?' selected':'');colorUnitMarker(el,shipmentOwner(ship));let desc=cargoDescription(ship);if(el.dataset.desc!==desc){el.dataset.desc=desc;el.setAttribute('aria-label',desc);el.innerHTML='<span>'+(ship.kind==='petitionReturn'?'↩':ship.kind==='petition'?'♛':ship.kind==='loot'?'⚔':ship.kind==='tradeReturn'?'↩':ship.kind==='botSeaTrade'?(ship.mode==='sea'?'⚓':'♞'):ship.kind==='export'?(ship.mode==='sea'?'⚓':'♞'):(ship.seaSupply?'⚓':resourceGlyph(ship.good)))+'</span>'+
   (ship.kind==='supply'&&ship.amount>=6?'<small class="cargo-count">'+ship.amount+'</small>':'')+'<span class="cargo-tip">'+desc+'</span>'}el.style.left=screen.x+'px';el.style.top=screen.y+'px'}}
const feedbackPalette={grain:[.77,.64,.37],wood:[.61,.43,.24],iron:[.61,.64,.66],cloth:[.73,.49,.48],equipment:[.73,.57,.31]};
const gameAudio=globalThis.gameAudio;
const playFeedbackSound=gameAudio.play,playSelectionSound=gameAudio.select;
const mapFeedback=new Map(),captureWaves=new Map();
let producerLoads=new WeakMap(),loadedConvoys=new WeakSet(),deliveryBatch=null;
let unloadingWagons=[],musterFeedback=[],mapFeedbackBuffer=null;
const feedbackMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const motionReduced=()=>!!feedbackMotion?.matches;
function positionMapFeedback(el,{point,offset}){
 const p=project(point.x,point.z,roadGround(point.x,point.z)+offset);
 el.hidden=p.x<-40||p.y<-40||p.x>canvas.clientWidth+40||p.y>canvas.clientHeight+40;
 el.style.left=p.x+'px';el.style.top=p.y+'px';
}
function addMapFeedback(point,el,duration,offset=7){
 if(!point)return;
 if(mapFeedback.size>=20){
  const first=mapFeedback.keys().next().value;
  first.remove();mapFeedback.delete(first);
 }
 const data={point,offset};
 mapFeedback.set(el,data);positionMapFeedback(el,data);
 $('effects-layer').appendChild(el);
 setTimeout(()=>{mapFeedback.delete(el);el.remove()},duration);
}
function showGain(point,label,kind='resource'){
 const el=document.createElement('div');
 el.className='gain-effect gain-'+kind;el.textContent=label;
 addMapFeedback(point,el,1450);
}
function showConstructionFeedback(point,label,owner){
 const details=document.createElement('div');
 details.className='construction-bloom';
 for(let i=0;i<5;i++)details.appendChild(document.createElement('i'));
 addMapFeedback(point,details,1050,1);
 showGain(point,label,'construction');
 if(owner==='you'&&inMapViewport(point.x,point.z,6))playFeedbackSound('build');
}
function showCounterGain(id,amount,suffix=''){
 if(!amount)return;
 const target=$(id);
 if(!target||target.hidden)return;
 const box=target.getBoundingClientRect(),el=document.createElement('div');
 el.className='stock-gain'+(amount<0?' stock-loss':'');
 el.style.left=(box.left+(box.width||0)/2)+'px';el.style.top=(box.bottom??box.top??0)+'px';
 el.textContent=(amount>0?'+':'−')+Number(Math.abs(amount).toFixed(2))+suffix;
 $('effects-layer').appendChild(el);setTimeout(()=>el.remove(),1500);
}
function drainEconomyEffects(){
 const economy=state.economy;
 if(!economy)return;
 const now=economy.seconds,events=economy.events.splice(0),totals=economy.deliveryTotals;
 economy.deliveryTotals=null;
 let immediate=false;
 if(events.length||totals){
  deliveryBatch??={start:now,groups:new Map(),stock:{},gold:0};
  for(const [good,amount] of Object.entries(totals?.stocks||{}))deliveryBatch.stock[good]=(deliveryBatch.stock[good]||0)+amount;
  deliveryBatch.gold+=totals?.gold||0;
  for(const event of events){
   const key=event.regionId+':'+(event.kind==='export'?'export':'local');
   const group=deliveryBatch.groups.get(key)||{...event,cargo:{},count:0,amount:0,value:0};
   for(const [good,amount] of Object.entries(event.cargo))group.cargo[good]=(group.cargo[good]||0)+amount;
   group.value+=event.value;group.amount+=event.amount;group.count++;
   deliveryBatch.groups.set(key,group);
   immediate||=event.amount>=24||event.value>=95;
   if(event.mode==='land'){
    if(inMapViewport(event.point.x,event.point.z,4)){
     const same=unloadingWagons.find(entry=>entry.regionId===event.regionId&&entry.start===now&&distance(entry.point,event.point)<2.5);
     if(same)same.amount+=event.amount;
     else{
      if(unloadingWagons.length>=8)unloadingWagons.shift();
      unloadingWagons.push({...event,start:now});
     }
    }
   }else if(state._harborFrames?.size){
    const key=berthKey(event.point),frame=state._harborFrames.get(key);
    if(frame&&!(state._harborUnloading?.has(key)))
     (state._harborUnloading??=new Map()).set(key,{frame,owner:event.owner,heading:event.heading,start:now});
   }
  }
 }
 if(!deliveryBatch||!immediate&&now-deliveryBatch.start<2)return;
 const {groups,stock,gold}=deliveryBatch;
 deliveryBatch=null;
 for(const [good,amount] of Object.entries(stock))showCounterGain('stock-'+good,amount);
 showCounterGain('money',gold,' зл.');
 if(gold>=95){playFeedbackSound('trade')}
 else if(gold||Object.values(stock).some(amount=>amount>=5))playFeedbackSound('delivery');
 const visible=[...groups.values()].filter(e=>inMapViewport(e.point.x,e.point.z,7));
 visible.sort((a,b)=>b.value-a.value||b.amount-a.amount);
 for(const e of visible.slice(0,4)){
  const parts=Object.entries(e.cargo).sort((a,b)=>b[1]-a[1]);
  const name=good=>GOODS_LABELS[good]||'снаряж.';
  const text=e.kind==='export'?'+'+Number(e.value.toFixed(2))+' зл.':
   parts.slice(0,2).map(([g,n])=>'+'+n+' '+name(g)).join(' · ')+(parts.length>2?' · ещё '+(parts.length-2):'');
  const kind=e.value>=95||e.amount>=24?'receipt-major':e.kind==='export'?'gold':'receipt';
  showGain(e.point,text,kind);
 }
}
function onSupplyDispatched(ship,pickups){
 loadedConvoys.add(ship);
 for(const {building,amount} of pickups)producerLoads.set(building,{start:state.economy.seconds,amount});
 if(pickups.some(({building,amount})=>building.type==='wood'&&amount>=3&&cam.scale>=.009&&inMapViewport(building.x,building.z,5)))
  playFeedbackSound('load');
}
function cargoProgress(ship){
 let fraction=ship.supplyBlocked?0:simClock;
 if(!motionReduced()&&!ship.elapsed&&loadedConvoys.has(ship))fraction=Math.max(0,(fraction-.28)/.72);
 return Math.min(1,(ship.elapsed+fraction)/ship.duration);
}
function sawmillStock(out,b,time){
 const s=b.scale??.34,pickup=producerLoads.get(b),age=pickup?time-pickup.start:Infinity;
 const boards=Math.max(0,b.produced||0),rows=Math.min(6,Math.ceil(boards/1.6));
 const x=b.x+6.5*s,z=b.z+6.3*s,y=surfaceHeight(x,z)+.2;
 for(let i=0;i<rows;i++){
  const h=y+s*(.28+Math.floor(i/2)*.42),side=(i%2?1:-1)*s*.59;
  cube(out,x,h,z+side,4.2*s,.37*s,1.09*s,tint(millCut,.88+(i%3)*.09));
 }
 if(age>=0&&age<1&&!motionReduced()){
  const t=age,xx=x+(b.x-x)*t,zz=z+(b.z-z)*t;
  const yy=surfaceHeight(xx,zz)+.4+.8*Math.sin(Math.PI*t);
  cube(out,xx,yy,zz,(3.3+Math.min(2,pickup.amount*.35))*s,.48*s,1.3*s,millCut);
 }
}
function startCaptureWave(region,owner,previous){
 if(motionReduced())return;
 const point=region.slots[0];
 let range=1;
 for(const [x,z,u,v] of region.bounds){
  range=Math.max(range,Math.hypot(Math.max(Math.abs(point.x-x),Math.abs(point.x-u)),Math.max(Math.abs(point.z-z),Math.abs(point.z-v))));
 }
 captureWaves.set(region.id,{point,range,owner,previous,start:null});
 if(captureWaves.size>5)captureWaves.delete(captureWaves.keys().next().value);
}
function applyCaptureWave(region,now){
 const wave=captureWaves.get(region.id);
 if(!wave)return;
 wave.start??=now;
 const t=(now-wave.start)/1580;
 if(t>=1||wave.owner!==region.owner){captureWaves.delete(region.id);return}
 gl.uniform2f(loc.captureOrigin,wave.point.x,wave.point.z);
 gl.uniform1f(loc.captureRadius,1.12*wave.range*(1-(1-Math.min(1,t/.87))**1.32));
 gl.uniform1f(loc.captureStrength,Math.min(1,(1-t)*8));
 const old=FACTION_COLORS[wave.previous];
 gl.uniform3f(loc.captureOld,...(old||[0,0,0]));
 gl.uniform1f(loc.captureOldMix,old?.length ? .28 : 0);
}
function cargoTiers(amount){return amount>=25?4:amount>=13?3:amount>=6?2:1}
function paintReceivingWagon(out,event,t){
 const {point,heading,good,amount,owner}=event;
 const c=Math.cos(heading),s=Math.sin(heading),x=point.x-c*1.85,z=point.z-s*1.85;
 const base=roadGround(x,z)+.92,parts=[],wood=[.44,.31,.22],paint=FACTION_COLORS[owner]||FACTION_COLORS.you;
 cube(parts,0,.37,0,1.84,.34,1.08,paint);
 for(const dx of [-.59,.59])for(const dz of [-.57,.57])wheel(parts,dx,.35,dz,.30,0);
 cube(parts,1.14,.58,0,1.04,.66,.52,[.47,.35,.27]);
 cube(parts,1.65,.88,0,.46,.43,.47,[.47,.35,.27]);
 const tiers=cargoTiers(amount),moving=motionReduced()?.68:t;
 const remaining=Math.max(0,tiers-Math.floor(moving*tiers*1.8));
 const cargo=feedbackPalette[good]||wood;
 for(let i=0;i<remaining;i++)cube(parts,-.34+(i%2)*.58,.71+Math.floor(i/2)*.25,0,.53,.24,.68,cargo);
 for(let i=0;i<parts.length;i+=6){
  const px=parts[i],pz=parts[i+2];
  out.push(x+px*c-pz*s,base+parts[i+1],z+px*s+pz*c,parts[i+3],parts[i+4],parts[i+5]);
 }
 for(let i=0;i<Math.min(tiers,3);i++){
  const slide=Math.max(0,Math.min(1,(moving-i*.12)/.53));
  if(!slide||slide===1)continue;
  const cx=x+c*2.85*slide-s*.38,cz=z+s*2.85*slide+c*.38;
  const cy=roadGround(cx,cz)+.82+Math.sin(Math.PI*slide)*.48;
  cube(out,cx,cy,cz,.60,.29,.55,cargo);
 }
}
function drawCouncilMuster(out,entry,t){
 const {point,owner,troops}=entry,color=FACTION_COLORS[owner]||FACTION_COLORS.you;
 const count=Math.min(cam.scale>=.012?24:12,Math.max(4,Math.ceil(troops/5)));
 for(let i=0;i<count;i++){
  const row=Math.floor(i/4),advance=Math.max(0,Math.min(1,(t-row*.06)/.71));
  if(advance<=0)continue;
  const x=point.x+2.1+advance*3.7-row*.58,z=point.z+2.72+(i%4)*.35;
  const y=roadGround(x,z)+.78,step=Math.sin(t*34+i)*.08*(1-advance);
  cube(out,x,y+.18+step,z,.24,.55,.22,color);
  cube(out,x,y+.73+step,z,.19,.19,.17,[.64,.69,.65]);
  if(i%4===0)timberBeam(out,[x+.09,y+.18,z],[x+.09,y+1.01,z],.032,[.46,.39,.29]);
 }
}
function drawMapFeedbackGeometry(){
 if(!state.economy||(!unloadingWagons.length&&!musterFeedback.length))return;
 const time=state.economy.seconds+simClock,verts=[];
 unloadingWagons=unloadingWagons.filter(entry=>time-entry.start<1.55);
 musterFeedback=musterFeedback.filter(entry=>time-entry.start<1.6);
 if(cam.scale<.0054)return;
 if(campaignCargoMode!=='hidden')for(const entry of unloadingWagons){
  if(inMapViewport(entry.point.x,entry.point.z,4))paintReceivingWagon(verts,entry,Math.max(0,time-entry.start)/1.55);
 }
 if(!motionReduced())for(const entry of musterFeedback){
  if(inMapViewport(entry.point.x,entry.point.z,4))drawCouncilMuster(verts,entry,Math.max(0,time-entry.start)/1.6);
 }
 if(!verts.length)return;
 mapFeedbackBuffer??={buffer:gl.createBuffer(),count:0};
 gl.bindBuffer(gl.ARRAY_BUFFER,mapFeedbackBuffer.buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
 mapFeedbackBuffer.count=verts.length/6;drawBuffer(mapFeedbackBuffer);
}
function onRecruitmentFinished({region,order,army}){
 if(order.owner!=='you')return;
 const point=army.location?.point||pointOnRoute(army.path,army.elapsed/army.duration);
 {
  if(musterFeedback.length>=5)musterFeedback.shift();
  musterFeedback.push({point,owner:order.owner,troops:order.troops,start:state.economy.seconds});
 }
 showGain(point,'+'+order.troops+' солдат','recruit');
 if(inMapViewport(point.x,point.z,7))playFeedbackSound('recruit');
}
function resetGameFeedback(){
 for(const el of mapFeedback.keys())el.remove();
 mapFeedback.clear();captureWaves.clear();
 producerLoads=new WeakMap();loadedConvoys=new WeakSet();
 unloadingWagons=[];musterFeedback=[];deliveryBatch=null;gameAudio.stop();
}

function updateResources(){
 const e=state.economy;
 if(!e)return;
 const rates=productionTotals(state,true),pop=populationTotal(state);
 const capital=state.regions.find(r=>r.id===state.capitalId);
 const granary=granaryFor(state,state.capitalId),need=granary?.need??(pop*GRAIN_PER_RESIDENT+garrisonGrainNeed(state));
 const spoilage=granary?.spoilage||0,storage=capital?grainStorageCapacity(state,capital,need):0;
 const loss=Math.round((1-(capital?.domainYield??1))*100);
 const info={
  grain:['ЗЕРНО','Кормит жителей и войска. Привозное зерно покрывает нехватку еды. Бонус роста даёт только излишек местного урожая.'],
  wood:['ДРЕВЕСИНА','Нужна для строительства, кораблей и комплектов вооружения.'],
  iron:['ЖЕЛЕЗО','Идёт на вооружение, военные корабли и обустройство рынков.'],
  cloth:['ТКАНИ','Нужны для комплектов вооружения и набора войск.']
 };
 for(const good of GOODS){
  const item=$('stock-'+good),isGrain=good==='grain',[name,purpose]=info[good];
  const delta=rates[good]-(isGrain?need+spoilage:0),reserve=tradeReserve(state,good);
  const hold=isGrain?e.grainPolicy!=='trade':e.exportPolicy?.[good]==='hold';
  const policy=isGrain&&e.grainPolicy==='army'?'ДЛЯ ВОЙСК':hold?(isGrain?'СНАБЖЕНИЕ':'КОПИТЬ'):'ЭКСПОРТ';
  item.innerHTML='<span class="resource-icon" aria-hidden="true">'+resourceGlyph(good)+'</span><span class="resource-values"><span class="resource-name">'+name+
   '</span><b>'+e.stocks[good].toFixed(1)+'</b><em class="'+(delta<-.05?'negative':'')+'">'+(delta>=0?'+':'')+delta.toFixed(1)+
   ' / мин</em><span class="resource-policy">'+policy+'</span></span>';
  const details='Запас столицы '+e.stocks[good].toFixed(1)+' ед. · ожидаемое поступление '+rates[good].toFixed(1)+' ед./мин.';
  const food=isGrain?' Расход столицы '+need.toFixed(1)+'/мин. Без порчи хранится '+storage+' ед. Сверх этого порча 20% в минуту'+
   (spoilage>.05?' (сейчас −'+spoilage.toFixed(1)+' ед./мин)':'')+'. Склад добавляет 30 ед. на уровень.':' Прогноз учитывает выпуск, который можно доставить по действующим путям.';
  const trade=hold?' Автоматический экспорт отключён.':' Резерв '+reserve+' ед. Экспортируется до половины запаса за рейс при наличии спроса.';
  item.title=[purpose,details+food,loss?'Перегрузка домена уменьшает выпуск на '+loss+'%.':'',trade.trim()].filter(Boolean).join(' ');
  item.setAttribute('aria-pressed',String(hold));
  item.setAttribute('aria-label',name+' · '+Math.floor(e.stocks[good])+' · '+policy+'. Нажмите, чтобы изменить политику.');
  explainAction(item,name,item.title);
 }
 const fleet=tradeFleet(state),fleetEl=$('trade-fleet');
 fleetEl.innerHTML='<svg class="ui-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#ui-cart"/></svg><span class="metric-values"><small>ТОРГОВЫЙ ТРАНСПОРТ</small><b>'+fleet.landUsed+'/'+fleet.land+' · '+fleet.seaUsed+'/'+fleet.sea+'</b></span>';
 fleetEl.title='Обозы '+fleet.landUsed+'/'+fleet.land+' · корабли '+fleet.seaUsed+'/'+fleet.sea+'. Занято / всего. Уровень столицы даёт сухопутные караваны, каждый порт даёт один торговый корабль. Транспорт освобождается после возвращения.';
 const p=$('population'),housing=housingTotal(state).toLocaleString(interfaceLocale),growth=(e.actualGrowthRate??.01)*100;
 const prefix=e.hungry?(growth<0?'ГОЛОД':'НЕХВАТКА'):e.housingFull?'НЕТ ЖИЛЬЯ':e.housingLimited?'ЖИЛЬЁ':growth<0?'УБЫЛЬ':'РОСТ';
 p.innerHTML='<span class="resource-icon" aria-hidden="true">'+resourceGlyph('population')+'</span><span class="resource-values"><span class="resource-name">НАСЕЛЕНИЕ</span><b>'+
  Math.floor(pop).toLocaleString(interfaceLocale)+'<span class="housing-cap"> / '+housing+'</span></b><em class="'+(e.hungry?'negative':'')+'">'+
  prefix+' '+(growth>=0?'+':'−')+Math.abs(growth).toFixed(1)+'% / мин</em></span>';
 p.title='Жителей '+Math.floor(pop).toLocaleString(interfaceLocale)+' · жилья '+housing+' мест. Для роста нужны еда, работа и жильё. Излишек своего урожая даёт до +0,3 п. п. к базовому росту за минуту. Привозное зерно помогает пережить нехватку. Голод ведёт к убыли.';
 explainAction(p,'Население и жильё',p.title);explainAction(fleetEl,'Торговый транспорт',fleetEl.title);
}
function runQueuedBotActions(){
 const actions=state.botActions;
 if(!actions?.size||state.defeated||(state.campaign?.result&&!state.campaign.exploring))return;
 const deadline=Date.now()+4;
 for(let i=0;i<3&&actions.size;i++){
  const [key,{action,owner}]=actions.entries().next().value;
  actions.delete(key);
  const faction=state.factions[owner];
  const s0=performance.now();
  if(faction&&!faction.defeated&&!faction.isRebel)state[action]?.(owner);
  const d=performance.now()-s0,w=state._phaseTimings?.worst;
  if(w&&d>(w['b:'+action]||0))w['b:'+action]=d;
  if(warAlerts.length||Date.now()>=deadline)break;
 }
}
// Визуальные перестроения (границы, тинт держав, здания, дороги) выполняются
// вне тика симуляции, порциями по 4 мс на кадр — иначе события вроде прибытия
// поселенцев замораживают игру на десятки миллисекунд.
function runVisualJobs(){
 const jobs=state.visualJobs;
 if(!jobs?.length)return;
 const deadline=performance.now()+4;
 const s0=performance.now();
 while(jobs.length&&performance.now()<deadline)jobs.shift()();
 const d=performance.now()-s0,w=state._phaseTimings?.worst;
 if(w&&d>(w['f:visual']||0))w['f:visual']=d;w&&(w['f:visual:s']=(w['f:visual:s']||0)+d,w['f:visual:n']=(w['f:visual:n']||0)+1);
}
// Показываем адаптер карты в подсказке при низкой частоте кадров.
const adapterInfo=gl.adapterInfo;
const gpuAdapterLine=adapterInfo?.description||[adapterInfo?.vendor,adapterInfo?.architecture].filter(Boolean).join(' · ');
if(gpuAdapterLine)console.info('GPU: '+gpuAdapterLine);
// Сторож низкой частоты кадров: если рендер долго держится ниже 30 FPS,
// включаем счётчик и подсказываем, где настройки.
let lowFpsStreak=0,fpsWarned=false;
const fpsWatchdog=fps=>{
 if(!state.started||globalThis.gameShell?.paused)return;
 if(fps<29){if(++lowFpsStreak>=12&&!fpsWarned){fpsWarned=true;flash('Низкая частота кадров: '+fps+' FPS'+(gpuAdapterLine?' · '+gpuAdapterLine:'')+'. В настройках графики можно выключить сглаживание или уменьшить масштаб рендера.')}}
 else lowFpsStreak=0;
};
const gameSettings=globalThis.BALTIC_SETTINGS;
let preferences=gameSettings.current,nextFrameAt=0;
let fpsFrames=0,fpsSampleAt=0,fpsMeter=$('fps-meter'),cachedScale=preferences.renderScale;
gameSettings.onChange(settings=>{
 // Масштаб рендера подхватится в resize() на следующем кадре.
 cachedScale=settings.renderScale;
 preferences=settings;nextFrameAt=0;
 const msaa=settings.msaa===false?1:4;
 if(gl.setSampleCount&&msaa!==gl.sampleCount)gl.setSampleCount(msaa);
});
// Диагностика симуляции: последние и худшие длительности фаз игровой секунды
// (stepEconomy → parcel-поверхности → дорожный трафик → эффекты → UI).
// Доступно из консоли как __simTimings.
const simTimings={economy:0,surfaces:0,traffic:0,effects:0,ui:0,count:0,worstEconomy:0,worstSurfaces:0,worstTraffic:0,worstEffects:0,worstUi:0};
globalThis.__simTimings=simTimings;
function draw(now=0){
 if(preferences.fpsLimit){
  if(now+.5<nextFrameAt){requestAnimationFrame(draw);return;}
  const interval=1000/preferences.fpsLimit;
  nextFrameAt=!nextFrameAt||now-nextFrameAt>=interval?now+interval:nextFrameAt+interval;
 }
 fpsFrames++;const fpsNow=performance.now();if(fpsNow-fpsSampleAt>=500){const fps=Math.round(fpsFrames*1000/(fpsNow-fpsSampleAt||1));fpsFrames=0;fpsSampleAt=fpsNow;if(fpsMeter){fpsMeter.textContent=fps+' FPS';fpsMeter.dataset.rate=fps<30?'low':fps<55?'mid':'ok';fpsMeter.hidden=!preferences.fpsCounter}fpsWatchdog(fps)}
 if(globalThis.gameShell?.paused){lastFrame=now;requestAnimationFrame(draw);return}
 if(recapPlayback){drawCampaignReplay(now);requestAnimationFrame(draw);return}
 runVisualJobs();
 if(gl.stopped===true)return;resize();if(lastFrame!==null&&!document.hidden)updateCamera(Math.max(0,Math.min(.05,(now-lastFrame)/1000)));if(lastFrame!==null&&!document.hidden&&!warAlerts.length&&state.started&&globalThis.gameShell?.playing!==false&&!(state.campaign?.result&&!state.campaign.exploring)){simClock+=Math.max(0,Math.min(.25,(now-lastFrame)/1000));while(simClock>=1){const t0=performance.now();stepEconomy(state,1);const t1=performance.now();rebuildParcelSurfaces();const t2=performance.now();if(state.economy.roadTraffic?.size&&state.economy.seconds>=trafficRebuildAt)rebuildTrafficRoads();const t3=performance.now();drainEconomyEffects();const t4=performance.now();simClock-=1;updateUI();const t5=performance.now();simTimings.economy=t1-t0;simTimings.surfaces=t2-t1;simTimings.traffic=t3-t2;simTimings.effects=t4-t3;simTimings.ui=t5-t4;simTimings.count++;if(t1-t0>simTimings.worstEconomy)simTimings.worstEconomy=t1-t0;if(t2-t1>simTimings.worstSurfaces)simTimings.worstSurfaces=t2-t1;if(t3-t2>simTimings.worstTraffic)simTimings.worstTraffic=t3-t2;if(t4-t3>simTimings.worstEffects)simTimings.worstEffects=t4-t3;if(t5-t4>simTimings.worstUi)simTimings.worstUi=t5-t4}}lastFrame=now;if(!document.hidden&&!warAlerts.length&&globalThis.gameShell?.playing!==false)runQueuedBotActions();const rs=performance.now();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform2f(loc.center,cam.x,cam.z);gl.uniform2f(loc.size,canvas.width,canvas.height);gl.uniform1f(loc.scale,cam.scale);cameraUniforms(loc);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,groundAsset.texture);gl.activeTexture(gl.TEXTURE0+1);gl.bindTexture(gl.TEXTURE_2D,waterAsset.texture);gl.uniform1i(loc.ground,0);gl.uniform1i(loc.waterMap,1);
 gl.activeTexture(gl.TEXTURE0+12);gl.bindTexture(gl.TEXTURE_2D,paintedMaterials.texture);
 gl.activeTexture(gl.TEXTURE0+14);gl.bindTexture(gl.TEXTURE_2D,habitatAsset.texture);
 gl.activeTexture(gl.TEXTURE0+13);gl.bindTexture(gl.TEXTURE_2D,parcelAnchorTexture);
 gl.activeTexture(gl.TEXTURE0+15);gl.bindTexture(gl.TEXTURE_2D,canopyShadowTexture);
 gl.activeTexture(gl.TEXTURE0+16);gl.bindTexture(gl.TEXTURE_2D,meadowBrushAsset.texture);
 gl.uniform1f(loc.andalusiaReady,andalusiaAsset?.ready?1:0);
 gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,closeGroundAsset.texture);
 if(urbanPaint){gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,urbanPaint.texture)}
 if(andalusiaAsset){gl.activeTexture(gl.TEXTURE0+3);gl.bindTexture(gl.TEXTURE_2D,andalusiaAsset.texture)}
 gl.activeTexture(gl.TEXTURE0+4);gl.bindTexture(gl.TEXTURE_2D,materialsAsset.texture);gl.uniform1i(loc.materialMap,4);gl.uniform1f(loc.materialsReady,materialsAsset.ready?(closeGroundAsset.ready?(paintedMaterials.ready&&habitatAsset.ready&&meadowBrushAsset.ready?3:2):1):0);
 gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,shoreAsset.texture);gl.uniform1i(loc.shoreMap,5);gl.uniform1f(loc.shoreReady,shoreAsset.ready?1:0);gl.uniform1f(loc.textureReady,groundAsset.ready?1:0);gl.uniform1f(loc.waterReady,waterAsset.ready?1:0);gl.uniform1f(loc.time,now/1000);gl.uniform1f(loc.tintAmount,0);gl.uniform1f(loc.water,0);gl.uniform1f(loc.terrainDetail,1);const politicalColors=FACTION_COLORS,chartWeight=Math.max(0,Math.min(1,(.0065-cam.scale*WORLD_SCALE)/.004)),hasStencil=gl.getContextAttributes?.()?.stencil!==false;gl.uniform1f(loc.terrainDetail,-1);drawBuffer(basemap.table);gl.uniform1f(loc.terrainDetail,1);
 if(hasStencil){gl.clearStencil(0);gl.stencilMask(255);gl.clear(gl.STENCIL_BUFFER_BIT);gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE)}else{drawBuffer(basemap.land);gl.uniform1f(loc.terrainDetail,0);gl.uniform1f(loc.water,1);drawBuffer(basemap.sea);gl.uniform1f(loc.water,0);gl.uniform1f(loc.terrainDetail,1)}
 gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,parcelIndexAsset.texture);gl.uniform1i(loc.parcelIndex,6);gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,parcelStyleTexture);gl.uniform1i(loc.parcelStyle,7);gl.uniform2f(loc.parcelIndexSize,parcelIndexAsset.width,parcelIndexAsset.height);gl.uniform1f(loc.parcelIndexReady,parcelIndexAsset.ready?1:0);gl.uniform1f(loc.showPlotBorders,mode?1:0);
 const focus=ghostPlot||(!mode&&selectedBuilding?{slot:selectedBuilding.building.slotId,region:selectedBuilding.region.id}:null);
 gl.uniform2f(loc.hoverPlot,focus?focus.slot+1:0,focus?focus.region+1:0);
 gl.uniform1f(loc.hoverValid,ghostPlot?(ghostPlot.valid?1:0):2);gl.uniform1f(loc.paintPlots,1);
 for(const r of state.regions){const color=politicalColors[r.owner];gl.uniform1f(loc.tintAmount,color ? .30+chartWeight*.34 : 0);if(color)gl.uniform3f(loc.tint,...color);const hasWave=captureWaves.has(r.id);
  if(hasWave)applyCaptureWave(r,now);
  drawBuffer(regionMeshes.get(r.id),gl.TRIANGLES,color?countryTintBuffers.get(r.id):null,color ? .16 : 0);
  if(hasWave)gl.uniform1f(loc.captureStrength,0);
 }gl.uniform1f(loc.tintAmount,0);gl.uniform1f(loc.paintPlots,0);
 if(hasStencil){gl.stencilMask(0);gl.stencilFunc(gl.EQUAL,0,255);drawBuffer(basemap.land);gl.uniform1f(loc.terrainDetail,0);gl.uniform1f(loc.water,1);drawBuffer(basemap.sea);gl.uniform1f(loc.water,0);gl.disable(gl.STENCIL_TEST);gl.stencilMask(255)}
 gl.uniform1f(loc.terrainDetail,0);gl.activeTexture(gl.TEXTURE0+4);gl.bindTexture(gl.TEXTURE_2D,roadTexture);gl.uniform1i(loc.roadMap,4);gl.uniform1f(loc.roadDetail,1);gl.enable(gl.BLEND);gl.depthMask(false);drawBuffer(roadBuffer);for(const chunk of roadExtensions)drawBuffer(chunk);drawMeshBatch(trailBuffer);drawBuffer(trafficBuffer);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(loc.roadDetail,0);drawSelectedRoute();drawBorders(now);if(preferences.trees)drawForest();gl.uniform1f(loc.modelDetail,1);drawMeshBatch(parcelDecorBuffer);drawMeshBatch(buildingsBuffer);drawFortifications();drawWorkshopActivity(now);actorShadowVertices.length=0;drawCarts();drawFleet();drawMarches();drawBattles(now);if(actorShadowVertices.length)drawForest(true);drawMapFeedbackGeometry();gl.uniform1f(loc.modelDetail,0);if(!councilMapOrder)drawBuffer(ghostBuffer);renderSlotMarkers();renderCargo();renderMarches();renderFleet();const ds=performance.now();updateBattlePanel();renderSieges();renderGateMarkers();renderOrderPing(now);const dd=performance.now()-ds,w5=state._phaseTimings?.worst;if(w5&&dd>(w5['f:dom']||0))w5['f:dom']=dd;w5&&(w5['f:dom:s']=(w5['f:dom:s']||0)+dd,w5['f:dom:n']=(w5['f:dom:n']||0)+1);for(const [el,data] of mapFeedback)positionMapFeedback(el,data);if(dirtyLabels){const ls=performance.now();renderLabels();const ld=performance.now()-ls,w4=state._phaseTimings?.worst;if(w4&&ld>(w4['f:labels']||0))w4['f:labels']=ld;w4&&(w4['f:labels:s']=(w4['f:labels:s']||0)+ld,w4['f:labels:n']=(w4['f:labels:n']||0)+1)}if(labelsJob&&labelStep(6))labelsJob=null;gl.present();const rd=performance.now()-rs,w3=state._phaseTimings?.worst;if(w3&&rd>(w3['f:render']||0))w3['f:render']=rd;w3&&(w3['f:render:s']=(w3['f:render:s']||0)+rd,w3['f:render:n']=(w3['f:render:n']||0)+1);globalThis.gameShell?.frame(gl,state.started);requestAnimationFrame(draw)}
function flash(msg){const t=$('toast');t.textContent=msg;t.classList.add('visible');clearTimeout(flash.t);flash.t=setTimeout(()=>t.classList.remove('visible'),2600)}
function setSelected(region,tab){
 if(state.selected!==region)hideActionExplanation();
 if(selectedBuilding&&selectedBuilding.region!==region)closeBuilding();
 const changed=state.selected!==region;
 state.selected=region;
 if(changed){
  duchyTab=duchyDefaultTab(region);
  $('duchy-pages').scrollTop=0;
  for(const id of ['duchy-control-details','duchy-war-details'])$(id).open=false;
 }
 if(tab&&duchyAvailableTabs(region).includes(tab)){
  duchyTab=tab;
  $('duchy-pages').scrollTop=0;
 }
 dirtyLabels=true;updateUI();
 if(region?.awaitingAdministration)openOccupationChoice(region);
}
function campaignCrossing(owner,from,region,destination,onlySource=null){
 if(!GAME_MAP||!region?.coast||!destination||!from) return null;
 const graph=state.network,roads=ownSupplyRoads(owner);
 const landing=region.buildings.find(b=>b.type==='port'&&portWaterCell(b))||region.slots[0];
 const landingHub=roadNodeLocation(graph,graph.hubKeys.get(region.id));
 if(!landingHub)return null;
 const localLanding=landing===region.slots[0]?[]:attachBuilding(graph,region,landing,region.id);
 if(!localLanding)return null;
 const toDestination=distance(landingHub.point,destination.point)<.01?[landingHub.point]:
  roadRouteBetween(graph,landingHub,destination,armyEdgeFilter(state,owner))||
  roadRouteBetween(graph,landingHub,destination);
 if(!toDestination)return null;
 const afterLanding=[...localLanding.slice(0,-1),...toDestination];
 let best=null,gap=Infinity;
 for(const source of state.regions){
  if(source.owner!==owner||source.id===region.id||onlySource!=null&&onlySource!==source.id) continue;
  const port=source.buildings.find(b=>b.type==='port');
  if(!port) continue;
  const hub=roadNodeLocation(graph,graph.hubKeys.get(source.id));
  const toHub=distance(from.point,hub.point)<.01?[hub.point]:roadRouteBetween(graph,from,hub,roads);
  if(!toHub) continue;
  const toPort=attachBuilding(graph,source,port,source.id,roads);
  if(!toPort) continue;
  const water=waterRoute(port,landing);
  if(!water||water.length<2) continue;
  const embark=[...toHub,...toPort.slice(0,-1).reverse(),water[0]];
  const path=[...embark,...water.slice(1),...afterLanding];
  const length=routeLength(path);
  if(length>=gap) continue;
  path.seaStart=routeLength(embark);
  path.seaEnd=routeLength([...embark,...water.slice(1)]);
  path.originRegionId=source.id;
  path.landingId=region.id;
  best=path;gap=length;
 }
 return best;
}

function campaignPetition(owner,region){
 if(!region.coast) return null;
 const cache=state._seaPetitionCache??=new Map(),key=owner+':'+region.id;
 if(cache.has(key))return cache.get(key);
 const graph=state.network,destination=roadNodeLocation(graph,graph.hubKeys.get(region.id));
 let best=null,length=Infinity;
 for(const source of state.regions){
  if(source.owner!==owner||!source.buildings.some(b=>b.type==='port')) continue;
  const origin=roadNodeLocation(graph,graph.hubKeys.get(source.id));
  const path=campaignCrossing(owner,origin,region,destination,source.id);
  if(path&&routeLength(path)<length){best=path;length=routeLength(path)}
 }
 cache.set(key,best);
 return best;
}

function start(r,preset=null,match=null){
 $('app').classList.remove('campaign-setup');hideActionExplanation();
 state.started=true;r.owner='you';r.buildings.push({type:'city',x:r.slots[0].x,z:r.slots[0].z,slotId:0,scale:r.slots[0].scale,terrain:r.slots[0].terrain,capital:true,population:1000});
 initializeEconomy(state,r);state.civilizationTitles=historicalPolityTitles(r,!!GAME_MAP);state.civilizationName=state.civilizationTitles[0];state.economy.granaries=new Map();state.network=makeTransport(state.regions);state.grainRoute=granaryRoute;state.attachRoute=(region,building)=>attachSupplyRoute(region,building);state.factions={};
 const origin=state.network.hubKeys.get(r.id),candidates=state.regions.filter(other=>other!==r);
 const connected=pathsToHub(state.network,origin);
 const preferred=new Set(candidates.filter(other=>GAME_MAP
  ?other.coast&&!['lisbon','algarve','cadiz','rabat'].includes(other.key)
  :connected?.has(state.network.hubKeys.get(other.id))).map(other=>other.id));
 const rematch=match?.rivalIds?.map(id=>candidates.find(other=>other.id===id));
 if(rematch?.length)$('bot-count').value=String(rematch.length);
 const count=updateBotSetup();
 const startingRivals=rematch?.length?rematch:historicalRivals(r,candidates,count,!!GAME_MAP,preset?.rivals,preferred);
 const polityCounts=new Map();
 for(const land of [r,...startingRivals]){
  const name=historicalPolity(land,!!GAME_MAP);
  polityCounts.set(name,(polityCounts.get(name)||0)+1);
 }
 // Очередь действий ботов: их «мысли» (поиск путей, планы) выполняются
 // порциями по кадрам, а не в тике симуляции — иначе каждая игровая секунда
 // может приносить заметный фриз.
 state.botActions=new Map();
 for(const [i,other] of startingRivals.entries()){
  const id=i?'bot'+(i+1):'bot';
  FACTION_COLORS[id]??=rivalColor(i);
  other.owner=id;other.control=100;other.mood=20;
  const q=other.slots[0],w=other.slots[1],good=['wood','iron','cloth'][i%3];
  other.buildings.push({type:'city',x:q.x,z:q.z,slotId:0,scale:q.scale,terrain:q.terrain,capital:true,population:1000});
  if(w){
   const workshop={type:good,x:w.x,z:w.z,slotId:1,scale:w.scale,terrain:w.terrain,product:productivity(good,w.terrain)};
   workshop.route=attachBuilding(state.network,other,workshop,other.id);
   other.buildings.push(workshop);
  }
  const hub=state.network.hubKeys.get(other.id),path=routeToHub(state.network,hub,origin)?.reverse()||null;
  const phase=count>3?(i*.618034)%1:0;
  const polity=historicalPolity(other,!!GAME_MAP),titles=historicalPolityTitles(other,!!GAME_MAP);
  state.factions[id]={name:polity+(polityCounts.get(polity)>1?' · '+other.city:''),titles,regionId:other.id,gold:250,council:createRealmCouncil(other.id),stocks:{grain:31,wood:5,iron:8,cloth:8,equipment:0},
   good,strategyPace:[.88,1,1.14][i%3],path,_pathHubs:[origin,hub],
   buildClock:phase*16,petitionClock:phase*34,recruitClock:phase*44,diplomacyClock:phase*38};
  if((GAME_MAP||preset)&&other.coast){
   const plots=other.slots.slice(2).sort((a,b)=>coastDistance(a.x,a.z)-coastDistance(b.x,b.z));
   for(const site of plots){
    const port={type:'port',x:site.x,z:site.z,slotId:site.id,scale:site.scale,terrain:site.terrain,level:1};
    if(!portWaterCell(port))continue;
    port.route=attachBuilding(state.network,other,port,other.id);
    if(!port.route)continue;
    other.buildings.push(port);
    state.factions[id].gold-=TYPES.port.cost;
    break;
   }
  }
 }
 if(GAME_MAP){
  state.seaPetitionPath=campaignPetition;
  state.navalArmyRoute=(owner,from,to)=>to&&campaignCrossing(owner,from,regionAt(state.regions,to.point.x,to.point.z),to);
 }
 initializeCampaign(state,GAME_MAP?'mediterranean':'baltic');
 state.onCampaignPact=onCampaignPact;
 state.rankBotExpansion=owner=>rankBotExpansion(state,owner);
 state.onCampaignEnd=onCampaignEnd;
 state.onCampaignCountdown=onCampaignCountdown;
 if(preset)applyCampaignStart(r,preset);
 state.onSeaDelivery=recordHarborDelivery;state.onSupplyDispatched=onSupplyDispatched;state.onRecruitmentFinished=onRecruitmentFinished;state.navalBerth=portWaterCell;state.navalPath=navalCourse;state.navalLine=waterSegment;state.planNavalDefense=planNavalDefense;state.onNavalEvent=onNavalEvent;state.dispatchBotSeaTrade=dispatchBotSeaTrade;state.armyTerritoryAt=p=>regionAt(state.regions,p.x,p.z);state.roadNodeLocation=roadNodeLocation;state.nearestRoadLocation=nearestRoadLocation;state.roadRouteBetween=roadRouteBetween;state.armyRoadRouteBetween=(g,from,to,owner)=>roadRouteBetween(g,from,to,armyEdgeFilter(state,owner));state.armyPath=(from,to,owner)=>{let a=state.network.hubKeys.get(from.id),b=state.network.hubKeys.get(to.id);return networkPath(state.network,a,b,armyEdgeFilter(state,owner))||networkPath(state.network,a,b)};state.onNotification=renderNotifications;state.onWarDeclared=onWarDeclared;state.onPeaceSigned=onPeaceSigned;state.onFoodWarning=onFoodWarning;state.onArmyChanged=onArmyChanged;state.onBattleChanged=onBattleChanged;state.onDuchyCaptured=onDuchyCaptured;state.onPlayerDefeated=onPlayerDefeated;state.onRebellion=onRebellion;state.planRevoltDefense=planRevoltDefense;state.onSiegeChanged=onSiegeChanged;state.onGateEvent=onGateEvent;state.onMarketsReady=onMarketsReady;state.onArmoriesReady=onArmoriesReady;state.councilPortSite=site=>!!portWaterCell(site);state.councilMarketOutlook=councilMarketOutlook;state.councilPortOutlook=councilPortOutlook;state.onCouncilProject=onCouncilProject;state.onCouncilUpgrade=onCouncilUpgrade;state.onCouncilRelief=onCouncilRelief;state.onShipmentRaided=onShipmentRaided;state.onTradeDispatched=onTradeDispatched;state.planMerchantReturn=ship=>refreshMerchantConvoy(ship,shipmentOwner(ship));state.retargetLandExport=retargetLandExport;state.planConvoyDestination=planConvoyDestination;state.onTradeReturned=()=>flash('Сделка отменена · караван возвращает груз');state.raidPath=routeToFactionCapital;state.dispatchTrade=dispatchTrade;state.developBot=developBot;const botCadenceCache=new Map();state.botCadence=id=>{let tick=Math.floor((state.economy?.seconds||0)/2),cached=botCadenceCache.get(id);if(!cached||cached.tick!==tick){cached={tick,value:strategyCadence(state,id)};botCadenceCache.set(id,cached)}return cached.value};const petitionPaths=new Map();state.petitionPath=(owner,region)=>{let best=null,bestLength=Infinity;for(const source of state.regions){if(source.owner!==owner||!(source.adj.includes(region.id)||region.adj.includes(source.id)))continue;let key=source.id+':'+region.id;if(!petitionPaths.has(key))petitionPaths.set(key,networkPath(state.network,state.network.hubKeys.get(source.id),state.network.hubKeys.get(region.id)));let path=petitionPaths.get(key);if(path&&routeLength(path)<bestLength){best=path;bestLength=routeLength(path);best.originRegionId=source.id}}return best};state.evacuateSettledDuchy=evacuateSettledDuchy;state.onPetitionResult=onPetitionResult;state.planBotPetition=planBotPetition;state.onGarrisonChanged=onGarrisonChanged;state.onRecruitmentInterrupted=(order,region)=>{if(order.owner==='you')addNotice('danger','Набор прерван',(region?.name||'Герцогство')+' потеряно; жители вернулись в города.',region?.id)};state.recruitBot=recruitBot;state.planBotWar=planBotWar;state.planBotDiplomacy=planBotDiplomacy;state.planBotCouncil=planBotCouncil;
 state.councilDiplomacyRoute=(owner,other)=>routeToHub(state.network,state.network.hubKeys.get(realmCapitalId(state,owner)),state.network.hubKeys.get(realmCapitalId(state,other)),supplyFilterFor(owner));if(match?.malagaView!=null)applyMalagaStart(r,match.malagaView);
 state.dispatchVassalTrade=(vassal,lands)=>dispatchTrade(vassal.owner,vassal,lands);
 state.onVassalGranted=region=>refreshCapitalRoutes(false,new Set([region.owner]));
 initializeCampaignRecap(state,{capitalId:r.id,rivalIds:startingRivals.map(region=>region.id),preset,malagaView:match?.malagaView});
 for(const owner of ['you',...Object.keys(state.factions)])rebuildCountryTint(owner);$('resource-bar').hidden=false;renderNotifications();cam.x=r.slots[0].x;cam.z=r.slots[0].z;cam.scale=GAME_MAP?.01:.012;$('intro').hidden=true;buildingsBuffer=geometryForBuildings();rebuildRoads();setSelected(r);flash('Столица основана: '+r.city+' · соперников '+startingRivals.length);
}
function addNotice(kind,title,body,regionId=null,point=null){pushNotification(state,{kind,title,body,regionId,point})}
const warAlerts=[];
let warAlertReturnFocus=null;
$('war-alert').hidden=true;
function showWarAlert(){
 while(warAlerts.length&&!isAtWar(state,'you',warAlerts[0].owner))warAlerts.shift();
 const alert=warAlerts[0],panel=$('war-alert');
 panel.hidden=!alert;
 if(!alert){
  warAlertReturnFocus?.focus?.();
  warAlertReturnFocus=null;
  return;
 }
 hideActionExplanation();
 cameraKeys.clear();
 $('war-alert-title').textContent=alert.defensive?'Вы вступили в войну':'Вам объявили войну';
 $('war-alert-body').textContent=alert.defensive?
  'Ваша держава пришла на помощь союзнику в войне с державой «'+countryName(alert.owner)+'».':
  'Держава «'+countryName(alert.owner)+'» объявила вам войну. Её границы мигают красным, а торговля с ней приостановлена.';
 $('war-alert-focus').textContent='Показать державу';
 $('war-alert-dismiss').focus?.();
}
function dismissWarAlert(focusMap=false){
 const alert=warAlerts.shift();
 if(focusMap&&alert){
  const region=state.regions.find(r=>r.id===realmCapitalId(state,alert.owner));
  if(region){
   warAlertReturnFocus=null;
   cam.x=region.slots[0].x;cam.z=region.slots[0].z;dirtyLabels=true;
   setSelected(region,'relations');
  }
 }
 showWarAlert();
 if(focusMap&&$('war-alert').hidden)$('duchy-tab-relations').focus?.();
}
$('war-alert-dismiss').onclick=()=>dismissWarAlert();
$('war-alert-focus').onclick=()=>dismissWarAlert(true);
function onWarDeclared(event){
 if(event.attacker==='you'||event.defender==='you'){
  const incoming=event.defender==='you',other=incoming?event.attacker:event.defender;
  recordRecapMoment(state,'war',{regionId:state.factions[other]?.regionId,
   title:incoming?'Вам объявили войну':'Вы начали войну',detail:countryName(other),weight:incoming?78:64});
 }
 const affected=new Set([event.attacker,event.defender]);
 refreshCapitalRoutes(true,affected);refreshSupplyShipments(affected);
 if(event.attacker!=='you'&&event.defender!=='you'){
  if(state.regions.some(r=>r.owner==='you'&&r.adj.some(id=>affected.has(state.regions.find(region=>region.id===id)?.owner))))
   addNotice('info','Война соседних держав',countryName(event.attacker)+' объявляет войну державе «'+countryName(event.defender)+'».');
  return;
 }
 const incoming=event.defender==='you',other=incoming?event.attacker:event.defender,name=countryName(other);
 const regionId=realmCapitalId(state,other);
 if(event.defensive)
  addNotice('war','Союз вступил в войну',incoming?'Ваша держава пришла на помощь союзнику.':name+' поддерживает союзника.',regionId);
 else if(!incoming)addNotice('war','Вы объявили войну',name+' · торговля приостановлена, грузы меняют маршрут',regionId);
 else addNotice('war','Вам объявили войну',name+' начинает войну против вас',regionId);
 if(incoming){
  if(!warAlerts.length)warAlertReturnFocus=document.activeElement;
  warAlerts.push({owner:other,defensive:event.defensive});
  if(warAlerts.length===1)showWarAlert();
 }
}
function onPeaceSigned(treaty){
 const {owner,other,rate,gold}=treaty,affected=new Set([owner,other]);
 for(const region of state.regions){
  if(affected.has(region.owner))evacuateSettledDuchy(region,region.owner===owner?other:owner);
 }
 refreshCapitalRoutes(true,affected);refreshSupplyShipments(affected);
 if(!affected.has('you'))return;
 const rival=owner==='you'?other:owner,regionId=realmCapitalId(state,rival),name=countryName(rival);
 const terms=peacePaymentLabel({gold,rate,payer:treaty.payer});
 addNotice('diplomacy','Заключён мир',name+' · '+terms+' · перемирие на 180 дней.',regionId);
 recordRecapMoment(state,'war',{regionId,title:'Заключён мир',detail:name,weight:65});
 updateUI();
}
function onFoodWarning(event){let r=event.region||state.regions.find(x=>x.id===state.capitalId);addNotice(event.hungry?'danger':'economy',event.hungry?'Нехватка зерна':'Голод отступил',event.hungry?(r?r.name+' · ':'')+'местный запас не покрывает потребности жителей и войск.':'Зерна снова хватает для текущего потребления.',r?.id)}
const NOTICE_ICONS={war:'⚔',danger:'!',land:'♜',economy:'♟',diplomacy:'✉',council:'▤',info:'✦'};
function openCouncilMonthReport(report){
 showCouncil(false);showCampaignPanel(false);
 $('realm-overview').hidden=true;$('realm-overview-toggle').setAttribute('aria-expanded','false');
 const places=new Map();
 for(const entry of report.entries){
  if(!places.has(entry.regionId))places.set(entry.regionId,{city:entry.city,texts:[]});
  places.get(entry.regionId).texts.push(entry.text);
 }
 const list=$('council-month-places');
 list.textContent='';$('council-month-heading').textContent=report.title;
 let first=null;
 for(const [id,{city,texts}] of places){
  const row=document.createElement('li'),button=document.createElement('button'),name=document.createElement('strong');
  button.type='button';name.textContent=city;button.appendChild(name);
  for(const text of texts){
   const line=document.createElement('span');line.textContent=text;button.appendChild(line);
  }
  button.onclick=()=>{
   const region=state.regions.find(r=>r.id===id);
   if(!region)return;
   cam.scale=Math.max(cam.scale,GAME_MAP?.010:.012);
   councilFocus(region);
  };
  row.appendChild(button);list.appendChild(row);first??=button;
 }
 $('council-month-report').hidden=false;
 first?.onclick();first?.focus?.();
}
$('council-month-report').hidden=true;
$('council-month-close').onclick=()=>{$('council-month-report').hidden=true;$('notifications-toggle').focus?.()};
function openNotice(note){
 markNotification(state,note.id);
 if(note.report){
  $('notifications-panel').hidden=true;$('notifications-toggle').setAttribute('aria-expanded','false');
  renderNotifications();openCouncilMonthReport(note.report);return;
 }
 let r=state.regions.find(x=>x.id===note.regionId),point=note.point||r?.slots?.[0];if(point){cam.x=point.x;cam.z=point.z;dirtyLabels=true}if(r)setSelected(r,note.title==='Предложение о мире'?'relations':undefined);$('notifications-panel').hidden=true;$('notifications-toggle').setAttribute('aria-expanded','false');renderNotifications()}
function showNoticeTooltip(note){let tip=$('notice-tooltip');tip.textContent='';let title=document.createElement('strong'),body=document.createElement('span'),when=document.createElement('small'),hint=document.createElement('em'),d=gameDate(note.time);title.textContent=note.title;body.textContent=note.body;when.textContent=globalThis.gameI18n?.date(d)??(d.day+' '+MONTHS_RU[d.month]+' '+d.year);hint.textContent='ЛКМ — открыть · ПКМ — закрыть';tip.appendChild(title);tip.appendChild(body);tip.appendChild(when);tip.appendChild(hint);tip.hidden=false}
function renderNotifications(){let list=$('notifications-list'),notes=state.notifications||[],pending=notes.filter(n=>!n.read&&(['war','danger','diplomacy','council'].includes(n.kind))),unread=notes.filter(n=>!n.read).length,alerts=pending.length,icons=$('notice-icons'),strip=$('notice-strip');list.textContent='';icons.textContent='';$('notice-tooltip').hidden=true;strip.hidden=alerts===0;$('notifications-count').textContent=String(unread);$('notifications-count').hidden=unread===0;$('notifications-empty').hidden=notes.length>0;for(const note of pending.slice(0,5)){let button=document.createElement('button'),symbol=document.createElement('span');button.type='button';button.className='notice-icon notice-'+note.kind;button.setAttribute('aria-label',note.title+': '+note.body);button.setAttribute('aria-describedby','notice-tooltip');symbol.textContent=NOTICE_ICONS[note.kind]||NOTICE_ICONS.info;symbol.setAttribute('aria-hidden','true');button.appendChild(symbol);button.onmouseenter=()=>showNoticeTooltip(note);button.onmouseleave=()=>$('notice-tooltip').hidden=true;button.onfocus=()=>showNoticeTooltip(note);button.onblur=()=>$('notice-tooltip').hidden=true;button.onclick=()=>openNotice(note);button.oncontextmenu=e=>{e.preventDefault();markNotification(state,note.id);renderNotifications()};icons.appendChild(button)}if(alerts>5){let more=document.createElement('button');more.type='button';more.className='notice-more';more.textContent='+'+(alerts-5);more.setAttribute('aria-label','Ещё уведомления: '+(alerts-5));more.onclick=()=>{$('notifications-panel').hidden=false;$('notifications-toggle').setAttribute('aria-expanded','true')};icons.appendChild(more)}for(const note of notes){let button=document.createElement('button');button.type='button';button.className='notification-card notification-'+note.kind+(note.read?' read':' unread');let title=document.createElement('strong');title.textContent=note.title;let body=document.createElement('span');body.textContent=note.body;let when=document.createElement('small'),d=gameDate(note.time);when.textContent=globalThis.gameI18n?.date(d)??(d.day+' '+MONTHS_RU[d.month]+' '+d.year);button.appendChild(title);button.appendChild(body);button.appendChild(when);button.onclick=()=>openNotice(note);list.appendChild(button)}}
$('notifications-toggle').onclick=()=>{let panel=$('notifications-panel');panel.hidden=!panel.hidden;$('notifications-toggle').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){showCouncil(false);$('realm-overview').hidden=true;$('realm-overview-toggle').setAttribute('aria-expanded','false');renderNotifications()}};
$('notifications-read').onclick=()=>{for(const note of state.notifications||[])note.read=true;renderNotifications()};
function evacuateSettledDuchy(region,onlyOwner=null){
 if(!state.network)return;
 const moves=state.armyMoves||[],field=state.fieldArmies||[];
 for(const unit of [...moves,...field]){
  if(onlyOwner&&unit.owner!==onlyOwner||hasArmyAccess(state,unit.owner,region.owner)||unit.exitRegion)continue;
  const enRoute=moves.includes(unit);
  const point=enRoute?pointOnRoute(unit.path,unit.elapsed/unit.duration):unit.location?.point;
  if(!point||!insideRegion(region,point.x,point.z))continue;
  const graph=state.network,near=nearestRoadLocation(graph,point.x,point.z);
  const position=near&&{...near,point};
  const allowed=armyEdgeFilter(state,unit.owner,region);
  const outside=p=>!insideRegion(region,p.x,p.z)&&hasArmyAccess(state,unit.owner,regionAt(state.regions,p.x,p.z)?.owner);
  const escape=nearestRoadExit(graph,position,outside,allowed);
  const source=enRoute?moves:field;
  if(escape?.path.length>1){
   source.splice(source.indexOf(unit),1);
   delete unit.gateId;
   const path=escape.path;
   Object.assign(unit,{path,destination:escape.destination,elapsed:0,duration:journeyDuration(path),
    kind:'field',inBattle:false,waiting:false,landingId:null,exitRegion:region});
   moves.push(unit);
  }else{
   // Isolated pockets have no legal footpath. Return their men to a friendly town.
   const cities=state.regions.filter(r=>r.owner===unit.owner&&r.slots?.[0])
    .sort((a,b)=>distance(a.slots[0],point)-distance(b.slots[0],point));
   const home=cities[0];
   const safe=escape?.destination||home&&roadNodeLocation(graph,graph.hubKeys.get(home.id));
   if(!safe)continue;
   source.splice(source.indexOf(unit),1);
   delete unit.gateId;
   Object.assign(unit,{location:safe,destination:safe,inBattle:false,waiting:false,landingId:null,kind:'field'});
   field.push(unit);
  }
  state.onArmyChanged?.({kind:'evacuate',march:unit,region});
 }
}

function onPetitionResult(result){let {ship,target}=result;if(result.ok){
 recordRecapTerritory(state,target,'neutral');
 if(target.owner==='you'){startCaptureWave(target,target.owner,'neutral');if(inMapViewport(target.slots[0].x,target.slots[0].z,7))playFeedbackSound('capture')}
 const affected=ownersAffectedByTransfer(target.owner,'neutral');state.visualJobs.push(()=>{refreshCapitalRoutes(true,affected);refreshSupplyShipments(affected)});enqueueBorders(target);state.visualJobs.push(()=>rebuildCountryTint(target.owner,target));state.visualJobs.push(()=>{buildingsBuffer=geometryForBuildings()});dirtyLabels=true;if(ship.owner==='you'){addNotice('land','Герцогство присоединено',target.name,target.id);flash('Присоединено: '+target.name+' · награда +'+ship.reward+' зл.');showGain(target.slots[0],'+ ГЕРЦОГСТВО','upgrade')}else if(adjacentToFaction(state,target,'you'))addNotice('land','Соперник расширяется',target.name+' присоединено соперником',target.id)}else if(result.returning){
 ship.routeRisk=convoyRoadRisk(ship);
 if(ship.owner==='you'){
  addNotice('info','Поселенцы возвращаются',(target?.name||'Герцогство')+' недоступно. Поселенцы везут обратно припасы и '+ship.fee+' зл.',target?.id);
  flash('Герцогство недоступно · обоз развернулся');
 }
}else if(result.returned&&ship.owner==='you'){
 addNotice('land','Обоз вернулся','Возвращено '+ship.amount+' ед. '+PETITION_GOOD_NAMES[ship.good]+' и '+ship.fee+' зл.',
  ship.returnCapitalId??ship.originRegionId??state.capitalId);
 flash('Поселенцы вернулись с припасами и золотом');
}
updateUI()}

function routeToFactionCapital(owner,point,destinationId){let id=destinationId??realmCapitalId(state,owner);if(id==null||!state.network)return null;let from=nearestRoadLocation(state.network,point.x,point.z),to=roadNodeLocation(state.network,state.network.hubKeys.get(id));if(!from||!to)return null;let path=merchantLandLeg(point,to,owner,from)||supplyPathFromPoint(point,from,to,null);if(!path){if(distance(point,to.point)<.1)return [{x:point.x,z:point.z},{x:to.point.x+.001,z:to.point.z}];return null}if(distance(point,path[0])>.001)path.unshift({x:point.x,z:point.z});return path}
function supplyFilterFor(owner){
 const cache=state._supplyFilters??=new Map();
 if(!cache.has(owner))cache.set(owner,state.regions.some(r=>r.owner&&isAtWar(state,owner,r.owner))?supplyEdgeFilter(state,owner):null);
 return cache.get(owner);
}
function supplyCapital(owner) {
 return owner==='you' ? state.capitalId : state.factions?.[owner]?.regionId;
}

function ownSupplyRoads(owner) {
 const cache=state._ownSupplyFilters??=new Map();
 if(!cache.has(owner))cache.set(owner,supplyEdgeFilter(state,owner,true));
 return cache.get(owner);
}

function seaSupplyRoute(owner, pathToHub, ownRoads, destination=supplyCapital(owner)) {
 const ports=state.regions.filter(r=>r.owner===owner)
  .flatMap(region=>region.buildings.filter(b=>b.type==='port').map(building=>({region,building})));
 if(ports.length<2) return null;
 const portToCapital=new Map();
 let best=null, bestLength=Infinity;
 for(const departure of ports) {
  const toHub=pathToHub(departure.region.id);
  if(!toHub) continue;
  const branch=attachBuilding(state.network,departure.region,departure.building,departure.region.id,ownRoads);
  if(!branch) continue;
  const toDock=[...toHub,...branch.slice(0,-1).reverse()];
  for(const arrival of ports) {
   if(arrival===departure) continue;
   if(!portToCapital.has(arrival)) portToCapital.set(arrival,attachBuilding(state.network,arrival.region,arrival.building,destination,ownRoads));
   const inland=portToCapital.get(arrival);
   if(!inland) continue;
   const water=waterRoute(departure.building,arrival.building);
   if(!water) continue;
   const path=[...toDock,...water,...inland];
   const length=routeLength(path);
   if(length>=bestLength) continue;
   bestLength=length;
   path.branchLength=toHub.branchLength;
   path.seaStart=routeLength([...toDock,water[0]]);
   path.seaEnd=routeLength([...toDock,...water]);
   path.seaSupply={departureId:departure.region.id,arrivalId:arrival.region.id,dockIndex:toDock.length+water.length, departureIndex:toDock.length-1,
    embarkAt:routeLength(toDock), disembarkAt:routeLength([...toDock,...water,inland[0]])};
   best=path;
  }
 }
 return best;
}

function regionalTradeCenter(region,filter){
 const cache=state.marketAssignments??=new Map();
 if(cache.has(region.id))return cache.get(region.id);
 const owner=region.owner,capitalId=realmCapitalId(state,owner),graph=state.network,from=graph.hubKeys.get(region.id),capital=graph.hubKeys.get(capitalId);
 const candidates=[region,...(region.adj||[]).map(id=>state.regions.find(r=>r.id===id))]
  .filter(r=>r?.owner===owner&&r.id!==capitalId&&!vassalFor(state,r)&&r.market?.ready&&r.market.policy!=='capital');
 let chosen=null;
 if(candidates.length){
  const home=routeToHub(graph,from,capital,filter);
  let closest=home?routeLength(home):Infinity;
  for(const other of candidates){
   const path=routeToHub(graph,from,graph.hubKeys.get(other.id),filter);
   if(!path||routeLength(path)>=closest)continue;
   chosen=other;closest=routeLength(path);
  }
 }
 cache.set(region.id,chosen);
 return chosen;
}
function attachSupplyRoute(region,building,owner=region.owner,filter=supplyFilterFor(owner),ownRoads=null) {
 const capital=supplyCapital(owner);
 if(capital==null||!state.network)return null;
 // Маршрут кэшируется: фильтр пересоздаётся только при войне/мире, так что
 // ключ по идентичности фильтра инвалидируется сам собой.
 const cache=state._attachRouteCache??(state._attachRouteCache=new Map());
 const key=(filter??'open')+':'+region.id+':'+(building.slotId??Math.round(building.x*10)+','+Math.round(building.z*10))+':'+capital;
 if(cache.has(key))return cache.get(key);
 const road=attachBuilding(state.network,region,building,capital,filter);
 if(road||!building.product){cache.set(key,road??null);return road}
 ownRoads ??= ownSupplyRoads(owner);
 const result=seaSupplyRoute(owner,id=>attachBuilding(state.network,region,building,id,ownRoads),ownRoads);
 cache.set(key,result);
 return result;
}

function granaryRoute(source,destination){
 const graph=state.network;
 if(!graph||source===destination||source.owner!==destination.owner||source.owner==='neutral')return null;
 if(state.grainRouteRevision!==graph.edges.size){
  state.grainRouteRevision=graph.edges.size;
  state.grainRoutes=new Map();
 }
 const cache=state.grainRoutes??=new Map(),key=source.id+':'+destination.id;
 if(cache.has(key))return cache.get(key);
 const owner=source.owner,hub=graph.hubKeys.get(source.id),target=graph.hubKeys.get(destination.id);
 let path=routeToHub(graph,hub,target,supplyFilterFor(owner));
 if(!path){
  const roads=ownSupplyRoads(owner);
  path=seaSupplyRoute(owner,id=>routeToHub(graph,hub,graph.hubKeys.get(id),roads),roads,destination.id);
 }
 cache.set(key,path?.length>=2?path:null);
 return cache.get(key);
}

function ownersAffectedByTransfer(attacker,defender){
 if(state.factions?.[attacker]?.isRebel||state.factions?.[defender]?.isRebel)
  return new Set(['you',...Object.keys(state.factions)]);
 return new Set(['you',...Object.keys(state.factions||{})].filter(owner=>owner===attacker||owner===defender||
  isAtWar(state,owner,attacker)!==isAtWar(state,owner,defender)));
}
function refreshCapitalRoutes(accessChanged=true,affected=null){
 if(!state.network)return;
 state.marketAssignments?.clear();
 if(accessChanged){
  state._attachRouteCache?.clear();
  for(const filters of [state._supplyFilters,state._ownSupplyFilters]){
   if(affected){for(const owner of affected)filters?.delete(owner)}
   else filters?.clear();
  }
 }
 const playerHub=state.network.hubKeys.get(state.capitalId),marketRoads=supplyFilterFor('you');
 state._seaRouteCache?.clear();
 state._seaPetitionCache?.clear();
 for(const [id,f] of Object.entries(state.factions||{})){
  if(affected&&!affected.has('you')&&!affected.has(id))continue;
  const hub=state.network.hubKeys.get(f.regionId);
  if(f.defeated||!playerHub||!hub){f.path=null;f._pathHubs=null;continue}
  if(f._pathHubs?.[0]!==playerHub||f._pathHubs?.[1]!==hub||f._marketRoads!==marketRoads){
   f.path=routeToHub(state.network,hub,playerHub,marketRoads)?.reverse()||null;
   f._pathHubs=[playerHub,hub];
   f._marketRoads=marketRoads;
  }
 }
 let cut=0,reconnected=0,connectedBySea=0;
 for(const r of state.regions){
  if(affected&&!affected.has(r.owner)||r.owner!=='you'&&!state.factions?.[r.owner])continue;
  const filter=supplyFilterFor(r.owner);
  for(const b of r.buildings){
   if(!b.product&&b.type!=='port')continue;
   const hadRoute=!!b.route?.length,wasBySea=!!b.route?.seaSupply;
   b.route=attachSupplyRoute(r,b,r.owner,filter);
   if(r.owner!=='you'||!b.product)continue;
   if(hadRoute&&!b.route?.length)cut++;
   if(b.route?.seaSupply&&!wasBySea)connectedBySea++;
   else if(!hadRoute&&b.route?.length)reconnected++;
  }
 }
 state.visualJobs.push(rebuildRoads);
 if(cut)addNotice('danger','Производства отрезаны',cut+' постр. потеряли связь со столицей. Товары остаются на месте.');
 if(reconnected)addNotice('economy','Снабжение восстановлено',reconnected+' постр. снова могут отправлять товары.');
 if(connectedBySea)addNotice('economy','Снабжение переведено на море','Построек на новом морском маршруте: '+connectedBySea+'.');
}
function portOwned(regionId,owner) {
 return state.regions.find(r=>r.id===regionId && r.owner===owner && r.buildings.some(b=>b.type==='port'));
}

function supplyPathFromPoint(point, location, to, filter) {
 if(!to||!point) return null;
 if(distance(point,to.point)<.01) return [point,to.point];
 if(!location||filter&&!filter(point,location.point)) return null;
 const path=roadRouteBetween(state.network,location,to,filter);
 if(path&&distance(point,path[0])>.001) path.unshift(point);
 return path;
}

function replanSupplyShipment(ship, capital, filter, ownRoads, allowRisk=false) {
 const graph=state.network, remaining=remainingSupplyPath(ship), point=remaining[0];
 const traveled=routeDistanceAt(ship.path,ship.elapsed/ship.duration);
 const lane=ship.seaSupply;
 const capitalNode=roadNodeLocation(graph,graph.hubKeys.get(capital));
 if(!point||!capitalNode) return false;
 const destination=ship.supplyCapitalId??ship.returnCapitalId;
 const changed=destination!=null?destination!==capital:distance(ship.path.at(-1),capitalNode.point)>.1;
 const safe=(path,edge)=>!edge||path.every((p,i)=>!i||edge(path[i-1],p));
 let path, newElapsed=0;
 if(lane&&traveled>=lane.embarkAt&&traveled<lane.disembarkAt){
  // Keep the voyage to its receiving dock. Reconnect only the inland stretch.
  const arrival=allowRisk?state.regions.find(r=>r.id===lane.arrivalId&&r.buildings.some(b=>b.type==='port')):
   portOwned(lane.arrivalId,ship.owner);
  if(!arrival) return false;
  if(!changed&&safe(ship.path.slice(lane.dockIndex),ownRoads)) return true;
  const port=arrival.buildings.find(b=>b.type==='port');
  const inland=attachBuilding(graph,arrival,port,capital,ownRoads);
  if(!inland) return false;
  path=[...ship.path.slice(0,lane.dockIndex),...inland];
  Object.assign(path,{seaStart:ship.seaStart,seaEnd:ship.seaEnd,seaSupply:lane});
  newElapsed=travelTimeAtDistance(path,traveled);
 }else{
  const beforeEmbark=lane&&traveled<lane.embarkAt;
  if(beforeEmbark&&!changed&&portOwned(lane.departureId,ship.owner)&&portOwned(lane.arrivalId,ship.owner)){
   const toEmbark=ship.path.slice(0,lane.departureIndex+1);
   const roadAhead=remainingSupplyPath({path:toEmbark,elapsed:traveled/CART_SPEED,duration:journeyDuration(toEmbark)});
   if(safe(roadAhead,ownRoads)&&safe(ship.path.slice(lane.dockIndex),ownRoads)) return true;
  }
  if(!beforeEmbark&&!changed&&safe(remaining,filter)) return true;
  const location=nearestRoadLocation(graph,point.x,point.z);
  path=allowRisk?supplyPathFromPoint(point,location,capitalNode,null):merchantLandLeg(point,capitalNode,ship.owner,location);
  if(!path) path=seaSupplyRoute(ship.owner,id=>supplyPathFromPoint(point,location,roadNodeLocation(graph,graph.hubKeys.get(id)),ownRoads),ownRoads,capital);
 }
 if(!path) return false;
 Object.assign(ship,{path,elapsed:newElapsed,duration:journeyDuration(path),mode:path.seaSupply?'sea':'land',
  seaStart:path.seaStart,seaEnd:path.seaEnd,seaSupply:path.seaSupply});
 return true;
}

function planConvoyDestination(ship,target){
 if(target==null||!state.network)return false;
 const owner=shipmentOwner(ship);
 const safe=replanSupplyShipment(ship,target,supplyFilterFor(owner),ownSupplyRoads(owner));
 if(!safe&&!replanSupplyShipment(ship,target,null,null,true))return false;
 ship.supplyBlocked=false;
 ship.routeRisk=!safe;
 return true;
}

function merchantLandLeg(point,destination,owner,near=nearestRoadLocation(state.network,point.x,point.z)){
 const normal=supplyFilterFor(owner);
 const territory=regionAt(state.regions,point.x,point.z);
 let filter=normal;
 if(territory&&isAtWar(state,owner,territory.owner)){
  // A convoy caught inside may leave this duchy. Once outside it may not enter again.
  const exit=supplyEdgeFilter(state,owner,false,territory);
  filter=(a,b)=>insideRegion(territory,a.x,a.z)?exit(a,b):normal(a,b);
 }
 return supplyPathFromPoint(point,near,destination,filter);
}
function merchantCityLocation(owner){
 const graph=state.network,capital=supplyCapital(owner);
 return capital==null?null:roadNodeLocation(graph,graph.hubKeys.get(capital));
}
function retargetLandExport(ship){
 const owner=shipmentOwner(ship),graph=state.network;
 if(!graph)return false;
 const point=pointOnRoute(ship.path,ship.elapsed/ship.duration),near=nearestRoadLocation(graph,point.x,point.z);
 const target=region=>roadNodeLocation(graph,graph.hubKeys.get(region.id));
 const safe=shortestTownRoute(state,ship.buyer,region=>merchantLandLeg(point,target(region),owner,near));
 const next=safe||shortestTownRoute(state,ship.buyer,region=>supplyPathFromPoint(point,near,target(region),null));
 if(!next)return false;
 const traveled=retraceRoute(ship);
 if(owner==='you'&&routeLength(traveled)>.01)(ship.recapTraveled??=[]).push(traveled.reverse());
 Object.assign(ship,{...next,elapsed:0,duration:journeyDuration(next.path),routeRisk:!safe,
  warDetour:!!safe,supplyBlocked:false});
 return true;
}
function safeMerchantLeg(path,filter){
 return !filter||path.every((p,i)=>!i||filter(path[i-1],p));
}
function replanMerchantShipment(ship,owner,allowRisk=false){
 const filter=allowRisk?null:supplyFilterFor(owner);
 const landLeg=(point,to)=>allowRisk?supplyPathFromPoint(point,nearestRoadLocation(state.network,point.x,point.z),to,null):
  merchantLandLeg(point,to,owner);
 const traveled=routeDistanceAt(ship.path,ship.elapsed/ship.duration);
 const point=pointOnRoute(ship.path,ship.elapsed/ship.duration);
 const returning=ship.kind==='tradeReturn'||ship.kind==='returnTrade';
 const cityId=returning||ship.kind==='import'&&ship.vassalId?merchantHomeId(state,ship):
  ship.kind==='export'&&ship.mode!=='sea'?ship.destinationRegionId:null;
 const destination=cityId!=null?roadNodeLocation(state.network,state.network.hubKeys.get(cityId)):
  merchantCityLocation(ship.kind==='export'||ship.kind==='botSeaTrade'?ship.buyer:owner);
 let path,newElapsed=0;
 if(ship.mode==='sea'&&Number.isFinite(ship.seaStart)&&ship.seaEnd>ship.seaStart&&traveled<=ship.seaEnd){
  const distances=routeMetrics(ship.path).distances;
  const embark=distances.findIndex(d=>d>=ship.seaStart-.00001);
  const disembark=distances.findIndex(d=>d>=ship.seaEnd-.00001);
  if(embark<0||disembark<0)return false;
  if(traveled>=ship.seaStart){
   // Leave a vessel already on the water at its current position and keep its crossing.
   if(disembark===ship.path.length-1)return true;
   const shore=ship.path[disembark+1];
   if(!destination)return false;
   const same=distance(ship.path.at(-1),destination.point)<.1;
   if(same&&safeMerchantLeg(ship.path.slice(disembark),filter))return true;
   const inland=landLeg(shore,destination);
   if(!inland||filter&&!filter(ship.path[disembark],shore))return false;
   path=markSeaLeg([...ship.path.slice(0,disembark+1),...inland],ship.seaStart,ship.seaEnd);
   newElapsed=travelTimeAtDistance(path,traveled);
  }else{
   // Reroute the road to the existing berth without inserting a land shortcut through the sea.
   const land=ship.path.slice(0,embark+1);
   const ahead=remainingSupplyPath({path:land,elapsed:traveled/CART_SPEED,duration:journeyDuration(land)});
   if(safeMerchantLeg(ahead,filter))return true;
   const shore=ship.path[embark-1],water=ship.path[embark];
   if(!shore||filter&&!filter(shore,water))return false;
   const toShore=nearestRoadLocation(state.network,shore.x,shore.z);
   const toBerth=toShore&&landLeg(point,{...toShore,point:shore});
   if(!toBerth)return false;
   const toWater=[...toBerth,water];
   const start=routeLength(toWater);
   path=markSeaLeg([...toWater,...ship.path.slice(embark+1)],start,start+ship.seaEnd-ship.seaStart);
  }
 }else{
  if(!destination)return false;
  if(distance(ship.path.at(-1),destination.point)<.1&&safeMerchantLeg(remainingSupplyPath(ship),filter))return true;
  path=landLeg(point,destination);
 }
 if(!path)return false;
 if(!allowRisk&&ship.kind==='export'&&owner==='you'&&state.campaign?.recap&&!state.campaign.recap.outcome){
  if(!newElapsed&&traveled>.01){
   const distances=routeMetrics(ship.path).distances;
   const next=distances.findIndex(d=>d>=traveled);
   if(next>0)(ship.recapTraveled??=[]).push([...ship.path.slice(0,next),point]);
  }
  recordRecapMoment(state,'detour',{point,title:'Торговля нашла обход',detail:countryName(ship.buyer),weight:81});
 }
 Object.assign(ship,{path,elapsed:newElapsed,duration:journeyDuration(path),mode:path.seaStart!=null?'sea':'land',
  seaStart:path.seaStart,seaEnd:path.seaEnd,warDetour:!allowRisk});
 if(returning)ship.returnCapitalId=merchantHomeId(state,ship);
 return true;
}
function refreshMerchantConvoy(ship,owner){
 const safe=replanMerchantShipment(ship,owner);
 if(!safe)replanMerchantShipment(ship,owner,true);
 ship.routeRisk=!safe;
 ship.supplyBlocked=false;
}
function convoyRoadRisk(ship){
 const filter=supplyFilterFor(ship.owner);
 if(!filter)return false;
 const path=ship.path,{distances}=routeMetrics(path);
 const traveled=routeDistanceAt(path,ship.elapsed/ship.duration);
 for(let i=1;i<path.length;i++){
  if(distances[i]<=traveled||ship.seaStart!=null&&distances[i-1]>=ship.seaStart&&distances[i]<=ship.seaEnd)continue;
  const start=distances[i-1]<traveled?pointAtRouteDistance(path,traveled):path[i-1];
  if(!filter(start,path[i]))return true;
 }
 return false;
}
function refreshTradeShipments(affected){
 const kinds=new Set(['export','import','returnTrade','tradeReturn','botSeaTrade']);
 let detours=0,risky=0;
 for(const ship of state.economy.shipments){
  if(!kinds.has(ship.kind))continue;
  const owner=shipmentOwner(ship);
  if(affected&&!affected.has(owner)&&!affected.has(ship.buyer))continue;
  const wasRisky=ship.routeRisk;
  const previous=ship.path;
  if(ship.kind==='export'&&!ensureExportDestination(state,ship)){
   returnTradeShipment(state,ship);
   if(!state.planMerchantReturn)refreshMerchantConvoy(ship,owner);
  }else if(ship.path===previous)refreshMerchantConvoy(ship,owner);
  if(owner!=='you')continue;
  if(ship.routeRisk&&!wasRisky){
   risky++;
   if(ship.kind==='export')recordRecapMoment(state,'blockade',{point:pointOnRoute(ship.path,ship.elapsed/ship.duration),
    title:'Торговый обоз идёт через опасный участок',detail:countryName(ship.buyer),weight:83});
  }
  if(!ship.routeRisk&&ship.path!==previous&&ship.warDetour)detours++;
 }
 if(detours)addNotice('economy','Торговые маршруты перестроены','Обход вражеских земель найден для рейсов: '+detours+'.');
 if(risky)addNotice('danger','Торговые обозы продолжают путь','Без безопасного обхода: '+risky+'. Вражеские войска могут перехватить груз.');
}

function refreshSupplyShipments(affected=null){
 if(!state.network||!state.economy) return;
 if(!affected){state._supplyFilters?.clear();state._ownSupplyFilters?.clear()}
 let risky=0,safer=0;
 state.grainRoutes?.clear();
 for(const ship of state.economy.shipments){
  if(affected&&!affected.has(ship.owner))continue;
  if(ship.kind==='petition'||ship.kind==='petitionReturn'||ship.kind==='loot'){
   ship.routeRisk=convoyRoadRisk(ship);
   continue;
  }
  const grain=state.economy.granaries&&isGranaryShipment(ship);
  const supplies=ship.kind==='supply'||ship.kind==='botSupply';
  if(!grain&&!supplies&&ship.kind!=='industry')continue;
  const owner=ship.owner,wasRisky=ship.routeRisk,capital=realmCapitalId(state,owner);
  let targets,returning;
  const market=tradeCenter(state,ship.supplyMarketId,owner);
  if(grain){
   const own=id=>!!councilRegion(state,id,owner);
   returning=!own(ship.grainDestination);
   targets=returning?[...new Set([ship.originRegion,capital].filter(own))]:[ship.grainDestination];
  }else if(ship.kind==='industry'){
   const purpose=ship.industryPurpose;
   returning=purpose==='return'||purpose==='materials'&&!armoryReady(state,ship.industryDestination,owner);
   targets=returning?[...new Set([ship.originRegion,capital].filter(id=>armoryWarehouse(state,id,owner)))]:
    [purpose==='equipment'?capital:ship.industryDestination];
  }else targets=[market?.id??capital];
  const target=targets.find(id=>planConvoyDestination(ship,id));
  if(target!=null){
   if(grain){
    ship.grainDestination=target;
    if(returning){ship.grainPurpose='return';ship.kind='granary'}
   }else if(ship.kind==='industry'){
    ship.industryDestination=target;
    if(returning)ship.industryPurpose='return';
   }else ship.supplyMarketId=market?.id;
   ship.supplyCapitalId=target;
  }else{
   ship.supplyBlocked=false;
   ship.routeRisk=true;
  }
  if(owner==='you'){
   if(ship.routeRisk&&!wasRisky)risky++;
   if(!ship.routeRisk&&wasRisky)safer++;
  }
 }
 if(risky)addNotice('danger','Снабжение под угрозой','Обозов без безопасного обхода: '+risky+'. Они продолжают путь, но груз могут разграбить.');
 if(safer)addNotice('economy','Путь снабжения восстановлен','Безопасная дорога найдена для обозов: '+safer+'.');
 refreshTradeShipments(affected);
}
function retargetCapitalShipments(owner){
 for(const ship of state.economy?.shipments||[]){
  if(ship.kind!=='loot'||ship.owner!==owner)continue;
  const point=pointOnRoute(ship.path,ship.elapsed/ship.duration);
  const path=routeToFactionCapital(owner,point);
  if(path)Object.assign(ship,{path,elapsed:0,duration:journeyDuration(path)});
  ship.supplyBlocked=false;
  ship.routeRisk=!path||convoyRoadRisk(ship);
 }
}
const REBEL_COLOR=[.12,.13,.15];
function onRebellion(event){
 if(event.kind==='start')FACTION_COLORS[event.rebel]=REBEL_COLOR;
 dirtyLabels=true;
}
function onDuchyCaptured(event){
 const {region,attacker,defender,wasCapital,rebellion}=event;
 recordRecapTerritory(state,region,defender);
 if(attacker==='you'||defender==='you'){
  startCaptureWave(region,attacker,defender);
  const site=region.slots[0];
  if(inMapViewport(site.x,site.z,7))playFeedbackSound(attacker==='you'?'capture':'defeat');
 }
 if(attacker==='you'&&defender!=='neutral')
  recordRecapMoment(state,'capture',{regionId:region.id,title:wasCapital?'Взята столица соперника':'Город взят осадой',detail:region.city,weight:wasCapital?96:75});
 if(defender==='you'&&wasCapital)
  recordRecapMoment(state,'capital-loss',{regionId:region.id,title:'Столица потеряна',detail:region.city,weight:99});
 enqueueBorders(region);state.visualJobs.push(()=>{rebuildCountryTint(attacker,region);rebuildCountryTint(defender,region);buildingsBuffer=geometryForBuildings()});
 const affected=ownersAffectedByTransfer(attacker,defender);
 refreshCapitalRoutes(true,affected);
 if(wasCapital)retargetCapitalShipments(defender);
 refreshSupplyShipments(affected);
 dirtyLabels=true;
 if(attacker==='you'){
  addNotice('land','Герцогство захвачено',region.name+' · выберите, кто будет управлять герцогством',region.id);
  flash('Герцогство захвачено: '+region.name);
  showGain(region.slots[0],'+ ГЕРЦОГСТВО','upgrade');
 }else if(defender==='you'){
  if(rebellion)flash('Восстание: '+region.name+' отделилось');
  else {
   addNotice('danger',wasCapital?'Столица потеряна':'Герцогство потеряно',region.name+(wasCapital?' · запасы утрачены':''),region.id);
   flash(wasCapital?'Столица потеряна: запасы утрачены':'Герцогство потеряно: '+region.name);
  }
 }
 updateUI();
}
function onPlayerDefeated({owner,regionId}){
 if(state.campaign?.recap&&!state.campaign.recap.outcome)
  onCampaignEnd({owner,path:'military',time:state.economy.seconds,regionId,defeat:true});
 else if(!recapPlayback&&$('campaign-finale').hidden)$('defeat').hidden=false;
}
function onSiegeChanged(event){if(event.siege.attacker==='you'||event.siege.defender==='you'){let mine=event.siege.defender==='you';addNotice(mine?'danger':'war',event.kind==='start'?(mine?'Ваша земля в осаде':'Началась осада'):'Осада снята',event.region?.name||'Герцогство',event.region?.id);if(event.siege.attacker==='you')flash(event.kind==='start'?'Началась осада: '+event.region.city:'Осада снята')}}
function onTradeDispatched(ship){
 const market=tradeCenter(state,ship.marketId),home=market||state.regions.find(r=>r.id===state.capitalId);
 const cargo=ship.cargo||{[ship.good]:ship.amount};
 if(!market)for(const [good,amount] of Object.entries(cargo))showCounterGain('stock-'+good,-amount);
 if(home&&ship.amount>=18&&inMapViewport(home.slots[0].x,home.slots[0].z,7))
  showGain(home.slots[0],'Торговый рейс · '+ship.amount+' ед.','trade');
}
function onMarketsReady(regions){
 refreshCapitalRoutes(false,new Set(regions.map(region=>region.owner)));
 for(const region of regions){
  showConstructionFeedback(region.slots[0],'Открыт торговый центр',region.owner);
  if(region.owner==='you'&&!region.market.commissionedByCouncil)addNotice('economy','Торговый центр открыт',region.city,region.id);
 }
 dirtyLabels=true;
}
function onArmoriesReady(regions){
 buildingsBuffer=geometryForBuildings();dirtyLabels=true;
 for(const region of regions){
  showConstructionFeedback(region.slots[0],'Открыта оружейная мастерская',region.owner);
  if(region.owner==='you'&&!region.armory.commissionedByCouncil)addNotice('economy','Оружейная мастерская открыта',region.city,region.id);
 }
}
function onShipmentRaided(event){if(event.attacker==='you'){addNotice('war','Обоз захвачен','Добыча направлена в столицу',null,event.point);flash('Обоз захвачен: добыча направлена в столицу');showGain(event.point,'ОБОЗ ЗАХВАЧЕН','upgrade')}else if(event.victim==='you'){addNotice('danger','Обоз потерян','Вражеская армия захватила груз',null,event.point);flash('Вражеская армия захватила ваш обоз')}}
const siegePanels=new Map();
let fortificationBuffer=null, fortificationDrawState=null, fortificationDrawRevision=-1;
const gateMarkers=new Map(), gateRows=new Map();

function gateStatus(gate){
 return !gate.ready?'build':gate.attacker?'siege':gate.breached?'breach':gate.health<1?'repair':'ready';
}
function gateTitle(gate){
 return gate.neighbor?.city?'Дорога на '+gate.neighbor.city:'Край карты';
}
function gateStatusText(gate){
 const percent=Math.round(gate.health*100);
 switch(gateStatus(gate)){
  case 'build':return 'Строятся · '+Math.max(1,Math.ceil((gate.readyAt-state.economy.seconds)/SECONDS_PER_GAME_DAY))+' дн.';
  case 'siege':return 'Осада ворот · '+percent+'% прочности';
  case 'breach':return 'Пролом · '+percent+'% восстановления';
  case 'repair':return 'Ремонт · '+percent+'% прочности';
  default:return 'Ворота готовы';
 }
}
function onGateEvent(kind,gate,attacker){
 const {fort,point}=gate;
 if(fort.owner!=='you'&&attacker!=='you')return;
 const title=kind==='breach'?'Ворота пробиты':'Осада пограничных ворот';
 addNotice(fort.owner==='you'?'danger':'war',title,fort.region.name+' · '+gateTitle(gate),fort.region.id,point);
}

function addGateGeometry(out,gate){
 const {point,nx,nz,ready,breached}=gate;
 const p=(across,along,height)=>{
  const x=point.x+nz*across+nx*along,z=point.z-nx*across+nz*along;
  return [x,roadGround(x,z)+.24+height,z];
 };
 const stone=ready?[.48,.46,.39]:[.40,.34,.25],trim=tint(stone,1.22);
 function block(left,right,back,front,base,height,color){
  const a=p(left,back,base),b=p(right,back,base),c=p(right,front,base),d=p(left,front,base);
  const A=p(left,back,height),B=p(right,back,height),C=p(right,front,height),D=p(left,front,height);
  quad(out,A,B,C,D,tint(color,1.15));
  quad(out,a,b,B,A,tint(color,.83));quad(out,b,c,C,B,tint(color,.68));
  quad(out,c,d,D,C,tint(color,.91));quad(out,d,a,A,D,tint(color,.77));
 }
 for(const sign of [-1,1]){
  const part=(inner,outer,...args)=>block(sign===1?inner:-outer,sign===1?outer:-inner,...args);
  for(let i=0;i<4;i++){
   const inner=1.77+i*.66,outer=inner+.66,top=ready?1.34-i*.13:.44;
   part(inner,outer,-.38,.38,0,top,stone);
   if(ready&&i%2===0)part(inner+.13,outer-.11,-.42,.42,top,top+.29,trim);
  }
  part(.85,1.79,-.62,.62,0,ready?2.3:.68,stone);
  if(!ready)continue;
  part(.78,1.86,-.69,.69,2.19,2.43,trim);
  part(.83,1.23,-.64,.64,2.43,2.69,stone);
  part(1.47,1.80,-.64,.64,2.43,2.69,stone);
  if(breached)continue;
  const color=FACTION_COLORS[gate.fort.owner]||FACTION_COLORS.you;
  part(1.28,1.34,-.03,.03,2.43,3.20,[.34,.27,.19]);
  part(1.34,1.77,-.015,.015,2.91,3.19,color);
 }
 if(!ready||breached)return;
 block(-.88,.88,-.39,.39,1.65,2.12,trim);
 if(gate.attacker){
  for(let across=-.66;across<=.70;across+=.22)block(across-.026,across+.026,-.14,-.06,0,1.72,[.28,.23,.18]);
  block(-.80,.80,-.18,-.05,.72,.83,[.30,.24,.18]);
 }
}
function drawFortifications(){
 const revision=state.fortificationRevision||0;
 if(fortificationDrawState!==state||fortificationDrawRevision!==revision){
  if(fortificationBuffer)gl.deleteBuffer(fortificationBuffer.buffer);
  const vertices=[];
  for(const gate of state.fortificationGates?.values()||[])addGateGeometry(vertices,gate);
  fortificationBuffer=vertices.length?makeBuffer(vertices):null;
  fortificationDrawState=state;fortificationDrawRevision=revision;
  dirtyLabels=true;
 }
 drawBuffer(fortificationBuffer);
}
function renderGateMarkers(){
 const layer=$('battle-layer'),live=new Set();
 for(const gate of state.fortificationGates?.values()||[]){
  const status=gateStatus(gate);
  if(status!=='siege'&&status!=='breach'&&state.selected!==gate.fort.region)continue;
  const {x,z}=gate.point,height=roadGround(x,z)+3.2;
  if(!inMapViewport(x,z,height))continue;
  live.add(gate);
  let el=gateMarkers.get(gate);
  if(!el){
   el=document.createElement('div');el.className='siege-marker fortification-gate-marker';
   layer.appendChild(el);gateMarkers.set(gate,el);
  }
  const label=gateStatusText(gate);
  if(el.dataset.label!==label||el.dataset.status!==status){
   el.dataset.label=label;el.dataset.status=status;
   const color=FACTION_COLORS[gate.attacker||gate.fort.owner]||FACTION_COLORS.you;
   el.innerHTML='<span>'+label+'</span>'+((status==='siege'||status==='breach')?
    '<i><b style="width:'+Math.round(gate.health*100)+'%;background:rgb('+color.map(v=>Math.round(v*255)).join(',')+')"></b></i>':'');
  }
  const pos=project(x,z,height);
  el.style.left=pos.x+'px';el.style.top=pos.y+'px';
 }
 for(const [gate,el] of gateMarkers)if(!live.has(gate)){el.remove();gateMarkers.delete(gate)}
}
function renderSieges(){let layer=$('battle-layer'),sieges=state.sieges||new Map(),live=new Set(sieges.keys());for(const [id,el] of siegePanels)if(!live.has(id)){el.remove();siegePanels.delete(id)}for(const [id,siege] of sieges){let r=state.regions.find(x=>x.id===id);if(!r)continue;let el=siegePanels.get(id);if(!el){el=document.createElement('div');el.className='siege-marker';layer.appendChild(el);siegePanels.set(id,el)}let percent=Math.min(100,Math.floor(siege.progress*100)),status=siege.status==='contested'?'ОСАДА ПРИОСТАНОВЛЕНА':siege.status==='abandoned'?'ОСАДА СНЯТА':'ОСАДА',color=FACTION_COLORS[siege.attacker]||FACTION_COLORS.you,rgb='rgb('+color.map(v=>Math.round(v*255)).join(',')+')';let content='<span>'+status+' · '+percent+'%</span><i><b style="width:'+percent+'%;background:'+rgb+'"></b></i>';if(el.dataset.content!==content){el.dataset.content=content;el.innerHTML=content}let point=project(r.slots[0].x,r.slots[0].z,surfaceHeight(r.slots[0].x,r.slots[0].z)+12);el.style.left=point.x+'px';el.style.top=point.y+'px';el.hidden=point.x<0||point.y<0||point.x>canvas.clientWidth||point.y>canvas.clientHeight}}
function onBattleChanged(event){
 buildingsBuffer=geometryForBuildings();dirtyLabels=true;
 const {battle,winner}=event;
 if(event.a.owner!=='you'&&event.b.owner!=='you')return;
 const area=regionAt(state.regions,battle.point.x,battle.point.z),place=area?.city||'';
 if(event.kind==='start'){
  if(inMapViewport(battle.point.x,battle.point.z,8))playFeedbackSound('battle');
  addNotice('war','Началось сражение',place,area?.id,battle.point);return;
 }
 const a=battle.ownerA==='you',lost=a?battle.lossA:battle.lossB,enemyLost=a?battle.lossB:battle.lossA;
 const alive=(a?battle.totalA:battle.totalB)??0;
 const title=winner==='you'?'Победа':winner?'Поражение':'Бой завершён';
 const summary=title+(place?' · '+place:'');
 const details='В строю '+alive+' · наши потери '+lost+' · потери противника '+enemyLost;
 const card=document.createElement('div'),heading=document.createElement('strong'),body=document.createElement('small');
 card.className='battle-outcome '+(winner==='you'?'battle-won':winner?'battle-lost':'battle-ended');
 heading.textContent=summary;body.textContent=details;card.appendChild(heading);card.appendChild(body);
 addMapFeedback(battle.point,card,3200,12);
 addNotice('war',summary,details,area?.id,battle.point);
 if(winner&&inMapViewport(battle.point.x,battle.point.z,8))playFeedbackSound(winner==='you'?'victory':'defeat');
}
function onArmyChanged(event){if(event.kind==='merge'&&event.selection&&event.march.owner==='you')selectedArmy=event.selection;buildingsBuffer=geometryForBuildings();dirtyLabels=true;if(event.march.owner==='you'){if(event.kind==='arrive')flash('Войско прибыло: '+event.region.city+' · '+event.march.troops+' солдат');else if(event.kind==='waiting')flash('Войско ждёт: пункт назначения больше не принадлежит вам');else if(event.kind==='field-arrive')flash('Армия прибыла к выбранной точке');else if(event.kind==='evacuate')flash('Армия покидает герцогство · '+event.region.city);else if(event.kind==='border')flash('Армия остановлена у чужой границы: нужен договор или война');else if(event.kind==='merge')flash('Армии объединились · '+event.march.troops+' солдат')}updateUI()}
function onGarrisonChanged(region){
 buildingsBuffer=geometryForBuildings();dirtyLabels=true;
 if(state.selected===region)updateUI();
}
function recruitBot(id){let f=state.factions?.[id];if(!f)return;let signal=strategySignals(state,id),enemies=new Set(activeWarEnemies(state,id)),reserve=signal.urgency>.5||enemies.size?65:80;if(f.gold<reserve||!(f.stocks.equipment>0)&&(f.stocks.iron<RECRUIT_IRON||f.stocks.cloth<RECRUIT_CLOTH))return;let undeveloped=state.regions.some(r=>r.owner===id&&r.buildings.length<2),peace=!enemies.size,holdingForLand=armyTroops(state,id)>=100&&peace&&!undeveloped&&!state.economy.shipments.some(s=>s.kind==='petition'&&s.owner===id)&&state.regions.some(r=>r.owner==='neutral'&&adjacentToFaction(state,r,id)&&(f.stocks[petitionFor(r).good]||0)>=petitionFor(r).amount);if((holdingForLand&&f.gold<170)||(peace&&undeveloped&&f.gold<140))return;let regions=state.regions.filter(x=>x.owner===id).sort((a,b)=>{let threat=r=>r.adj.filter(n=>{let owner=state.regions.find(x=>x.id===n)?.owner;return enemies.has(owner)||!enemies.size&&owner==='you'}).length;return threat(b)-threat(a)||(a.id===f.regionId?-1:0)});for(const r of regions)if(recruitGarrison(state,r,id).ok)return}
// Bots make imperfect, resource-bound military decisions using existing armies.
// Responses use existing ports, real stock and paid garrisons.
function respondCampaignPressure(id){
 const c=state.campaign,f=state.factions[id],now=state.economy.seconds;
 if(!c||c.result||!f||(f.nextCampaignResponse||0)>now)return;
 f.nextCampaignResponse=now+12;
 const frontiers=campaignFrontiers(state),rival=regionalBotRival(state,id,frontiers);
 const trade=c.progress.get(rival)?.trade;
 const contender=trade?.eligible&&trade.remaining<=90&&trade.buyers.includes(id)&&!isAtWar(state,id,rival)&&
  !campaignEmbargoStatus(state,id,rival).cooldown&&now>=(c.counterEmbargoes.get(rival)??0)?rival:null;
 if(contender&&setCampaignEmbargo(state,id,contender)?.active){
  c.counterEmbargoes.set(contender,now+EMBARGO_COOLDOWN);
  if(contender==='you')addNotice('economy','Соперник ввёл эмбарго',countryName(id)+' закрыл взаимную торговлю на '+campaignTime(EMBARGO_DURATION)+'.',f.regionId);
  updateCampaign(state,0);
 }
 const threat=c.pressure?.owner===rival?c.pressure:null;
 if(f.commerceTarget!==rival)f.commerceTarget=null;
 if(!threat)return;
 const owned=state.regions.filter(r=>r.owner===id);
 const frontrunner=state.regions.filter(r=>r.owner===threat.owner);
 if(threat.path==='trade'&&!isAtWar(state,id,threat.owner)){
  const markets=c.progress.get(threat.owner)?.trade.buyers||[];
  const nearMarkets=markets.filter(market=>frontiers.get(id)?.has(market)&&market!==threat.owner&&!isAtWar(state,id,market));
  if(nearMarkets.length){
   f.commerceTarget=threat.owner;
   if(!f.warnedCompetition&&threat.owner==='you'){
    f.warnedCompetition=true;
    addNotice('economy','Соперники оспаривают рынки',countryName(id)+' ищет покупателей на ваших маршрутах.',f.regionId);
   }
  }
 }
 if(threat.path!=='military')return;
 const frontier=owned.filter(r=>frontrunner.some(o=>o.adj.includes(r.id)||r.adj.includes(o.id)));
 if(!frontier.length)return;
 const target=frontier.sort((a,b)=>Number(militaryCampaignTarget(state,b))-Number(militaryCampaignTarget(state,a)))[0];
 const waiting=(state.recruitments||[]).filter(order=>order.owner===id&&order.vassalId==null).reduce((sum,order)=>sum+order.troops,0);
 if(armyTroops(state,id)+waiting<200*realmGeneralLimit(state,id)&&!recruitQueue(state,target).length&&
    f.gold>=RECRUIT_GOLD+35&&recruitGarrison(state,target,id).ok&&threat.owner==='you'){
  addNotice('war','Соперник пополняет армию',target.city+' собирает подкрепление для генерала.',target.id);
 }
}

function chooseBotWarTarget(id,rival=regionalBotRival(state,id)){
 const f=state.factions?.[id],now=state.economy?.seconds||0;
 if(!f||!rival||f.defeated||f.isRebel||now<240||f.gold<65||activeWarEnemies(state,id).length)return null;
 const strength=armyTroops(state,id);
 if(strength<100)return null;
 // Free land first: while unclaimed duchies remain within reach, rivals keep
 // expanding peacefully instead of fighting when everyone has room.
 const coalitionPartner=campaignAllies(state,id).find(ally=>state.campaign?.pacts.get(warKey(id,ally))?.against===rival&&isAtWar(state,ally,rival));
 if(!coalitionPartner&&rankBotExpansion(state,id).some(candidate=>candidate.byLand))return null;
 const owned=state.regions.filter(r=>r.owner===id),byId=new Map(state.regions.map(r=>[r.id,r]));
 const fronts=new Map();
 function addFront(source,target){
  const opponent=target?.owner;
  if(opponent!==rival||state.transit?.[id+'>'+opponent]||state.transit?.[opponent+'>'+id]||truceDays(state,id,opponent))return;
  const defenders=state.garrisons?.[target.id]?.troops||0;
  const advance=militaryCampaignTarget(state,target)?38:0;
  const score=100+advance-defenders*.25-distance(source.slots[0],target.slots[0])*.25;
  if(!fronts.has(opponent)||fronts.get(opponent).score<score)fronts.set(opponent,{source,target,score});
 }
 for(const source of owned){
  for(const id of source.adj||[]){
   addFront(source,byId.get(id));
  }
 }
 for(const [opponent,front] of [...fronts].sort((a,b)=>b[1].score-a[1].score)){
  const opposing=armyTroops(state,opponent);
  // Early game restraint: rivals keep the peace against the player unless
  // his army and strength are clearly neglected.
  if(now<300&&opponent==='you'){
   const neglected=opposing<60||strength>opposing*2.2;
   if(!neglected)continue;
  }
  const caution=1+(72-warReadiness(state,id))*.007;
  const minimum=opponent==='you'?Math.max(200,opposing*1.35*caution):Math.max(100,opposing*.84*caution);
  const support=coalitionPartner?armyTroops(state,coalitionPartner)*.55:0;
  if(strength+support<minimum||activeWarEnemies(state,opponent).length>=2)continue;
  const roads=armyEdgeFilter(state,id,null,opponent),graph=state.network;
  const from=graph?.hubKeys.get(front.source.id),to=graph?.hubKeys.get(front.target.id);
  if(from&&to&&networkPath(graph,from,to,roads))return opponent;
 }
 if(!state.navalArmyRoute||now<330||f.gold<95)return null;
 const graph=state.network;
 const ports=owned.filter(r=>r.buildings.some(b=>b.type==='port'));
 const armies=state.fieldArmies.filter(unit=>unit.owner===id&&unit.vassalId==null&&unit.troops>=100&&!unit.inBattle);
 if(!ports.length||!armies.length)return null;
 const coasts=state.regions.filter(r=>r.coast&&r.owner===rival&&rival!=='you'&&adjacentToFaction(state,r,id)&&
  (r.buildings.some(b=>b.type==='port')||militaryCampaignTarget(state,r)));
 const lanes=[];
 for(const port of ports)for(const target of coasts){
  const gap=distance(port.slots[0],target.slots[0]);
  if(gap<=1240)lanes.push({port,target,gap});
 }
 lanes.sort((a,b)=>a.gap-b.gap);
 for(const {port,target} of lanes.slice(0,4)){
  const opponent=target.owner,defenders=state.garrisons?.[target.id]?.troops||0;
  if(truceDays(state,id,opponent)||strength<armyTroops(state,opponent)*.84||activeWarEnemies(state,opponent).length>=2||
     state.transit?.[id+'>'+opponent]||state.transit?.[opponent+'>'+id])continue;
  const source=armies.filter(unit=>unit.troops>=Math.max(100,defenders)).sort((a,b)=>distance(a.location.point,port.slots[0])-distance(b.location.point,port.slots[0]))[0];
  if(!source)continue;
  const origin=source.location,landing=roadNodeLocation(graph,graph.hubKeys.get(target.id));
  if(campaignCrossing(id,origin,target,landing,port.id))return opponent;
 }
 return null;
}

function planBotCouncil(owner){
 const faction=state.factions?.[owner],council=getRealmCouncil(state,owner);
 if(!council||faction.defeated||faction.isRebel)return;
 const owned=state.regions.filter(region=>region.owner===owner&&duchySeat(region));
 const capital=owned.find(r=>r.id===faction.regionId);
 if(!capital)return;
 const enemies=new Set(activeWarEnemies(state,owner));
 const guards=defendingTroopsByRegion(state);
 const weakest=owned.reduce((best,r)=>duchyStability(r,guards.get(r.id))<duchyStability(best,guards.get(best.id))?r:best,capital);
 const assign=(role,region,action,rate=0)=>{
  const active=council.monthly[role];
  if(!region||active&&(Number.isFinite(active.end)||active.regionId===region.id&&active.action===action))return false;
  return startCouncilTask(state,role,region,rate,action,owner).ok;
 };
 const income=councilBudgetLimit(state,'steward',owner);
 const project=owned.find(r=>!vassalFor(state,r)&&r.buildings.length<r.slots.length&&regionalPopulation(r)>200);
 if(!(project&&income>=TYPES.grain.cost&&faction.gold>=120&&faction.financePenalty<1&&
    assign('steward',project,'build',Math.floor(income*.84))))assign('steward',capital,'tax');
 const front=owned.find(r=>r.adj.some(id=>enemies.has(state.regions.find(land=>land.id===id)?.owner)))||weakest;
 const militaryBudget=councilBudgetLimit(state,'marshal',owner);
 if(!(enemies.size&&duchyStability(weakest,guards.get(weakest.id))>=65&&militaryBudget>=marshalMarketPrice(MARSHAL_RECRUIT_STEP).total&&
    faction.gold>=120&&recruitSiteCheck(state,front,owner,MARSHAL_RECRUIT_STEP).ok&&assign('marshal',front,'recruit',militaryBudget)))
  assign('marshal',weakest,'stabilize');
 const frontiers=campaignFrontiers(state),rival=regionalBotRival(state,owner,frontiers);
 const regionalPartners=[...(frontiers.get(owner)||[])].filter(partner=>partner!=='you'&&rival&&
  campaignAllianceCheck(state,owner,partner,rival,frontiers).ok);
 const diplomaticTarget=regionalPartners.sort((a,b)=>campaignRelation(state,b,owner).trust-campaignRelation(state,a,owner).trust)[0]||rival;
 const neighbor=state.regions.find(r=>r.owner===diplomaticTarget&&r.id===realmCapitalId(state,r.owner)&&
  campaignRelation(state,r.owner,owner).trust<ALLIANCE_TRUST&&councilTargetAllowed(state,'chancellor',r,'relations',owner));
 if(neighbor){
  const trust=campaignRelation(state,neighbor.owner,owner).trust;
  if(!(trust>=30&&!campaignEmbassy(state,neighbor.owner,owner)&&assign('chancellor',neighbor,'embassy')))
   assign('chancellor',neighbor,'relations');
 }
 const intrigue=councilBudgetLimit(state,'spymaster',owner);
 if(intrigue>=20&&faction.gold>=110&&enemies.size){
  const target=state.regions.find(r=>enemies.has(r.owner)&&duchySeat(r)&&adjacentToFaction(state,r,owner));
  assign('spymaster',target,'disrupt',Math.min(intrigue,25));
 }
 faction.grainPolicy=faction.stocks.grain>grainMarketLimit(state,owner,Infinity)&&!owned.some(r=>granaryFor(state,r.id)?.fed<.999)?'trade':'growth';
 faction.exportPolicy={wood:'trade',iron:enemies.size&&faction.stocks.iron<24?'hold':'trade',cloth:enemies.size&&faction.stocks.cloth<16?'hold':'trade'};
 const seat=duchySeat(capital);
 if((seat.level||1)<2&&faction.gold>=190&&(enemies.size||regionalPopulation(capital)>cityHousing(seat)*.78)){
  if(upgradeBuilding(state,capital,seat,null,owner).ok)onCouncilUpgrade(seat,owner);
 }
 if(enemies.size&&faction.gold>=ARMORY_COST.gold+75){
  const workshop=owned.find(r=>!vassalFor(state,r)&&armoryCheck(state,r,null,owner).ok);
  if(workshop)commissionArmory(state,workshop,null,owner);
 }
 if(faction.gold>=MARKET_COST.gold+90){
  const market=owned.find(r=>!vassalFor(state,r)&&marketCheck(state,r,null,owner).ok&&r.buildings.some(b=>MARKET_GOODS.includes(b.type)));
  if(market)commissionMarket(state,market,null,owner);
 }
 if(enemies.size&&faction.gold>=TRANSIT_COST+150){
  const corridor=state.regions.find(r=>r.owner!=='neutral'&&r.owner!==owner&&!enemies.has(r.owner)&&
   !hasArmyAccess(state,owner,r.owner)&&adjacentToFaction(state,r,owner)&&[...enemies].some(enemy=>adjacentToFaction(state,r,enemy)));
  if(corridor&&grantTransit(state,corridor.owner,owner).ok&&corridor.owner==='you')
   addNotice('diplomacy','Оплачен проход войск',countryName(owner)+' · '+TRANSIT_COST+' зл.',corridor.id);
 }
}
function planRegionalBotPact(id,rival,frontiers){
 if(!rival||!state.campaign||state.economy.seconds<120)return;
 const power=factionPower(state,rival).total,mine=factionPower(state,id).total;
 const candidates=[];
 for(const partner of frontiers.get(id)||[]){
  if(partner==='you'||!campaignAllianceCheck(state,id,partner,rival,frontiers).ok)continue;
  const trust=campaignRelation(state,partner,id).trust;
  const threatened=isAtWar(state,rival,id)||isAtWar(state,rival,partner);
  if(!threatened&&(trust<24||power<Math.max(mine,factionPower(state,partner).total)*.92))continue;
  candidates.push({partner,score:trust+(isAtWar(state,rival,partner)?30:0)});
 }
 candidates.sort((a,b)=>b.score-a.score||a.partner.localeCompare(b.partner));
 if(candidates.length)formCampaignAlliance(state,id,candidates[0].partner,rival);
}
function planBotDiplomacy(id){
 if(planBotPeace(id))return;
 respondCampaignPressure(id);
 const frontiers=campaignFrontiers(state),rival=regionalBotRival(state,id,frontiers);
 planRegionalBotPact(id,rival,frontiers);
 const faction=state.factions[id];
 faction.regionalRival=rival;
 if(faction.gold>=HARBOR_CHARTER_COST+100&&!tradeFleet(state,id).sea){
  for(const ally of campaignAllies(state,id))if(acceptHarborCharter(ally,id))break;
 }
 const opponent=chooseBotWarTarget(id,rival);
 if(opponent)declareWar(state,opponent,id);
}
function planBotPeace(owner){
 for(const other of activeWarEnemies(state,owner)){
  const record=state.warRecords?.[warKey(owner,other)];
  if(!record||state.factions?.[other]?.isRebel)continue;
  const plain=peaceOptions(state,owner,other),installments=peaceOptions(state,owner,other,true);
  const yielding=plain.payment?.payer===owner;
  const payment=yielding&&(installments.payment?.ok?installments.payment:plain.payment?.ok?plain.payment:null);
  if(other==='you'){
   const offer=payment?'compensation':plain.white?'white':null;
   if(!offer||record.offers.has(offer))continue;
   record.offers.add(offer);
   const name=countryName(owner);
   addNotice('diplomacy','Предложение о мире',name+' · '+(payment?peacePaymentLabel(payment):'мир без выплат')+
    '. Условия доступны во вкладке «Отношения».',realmCapitalId(state,owner));
  }else{
   if(payment&&settleWar(state,owner,other,'payment',!!payment.rate).ok)return true;
   if(plain.white&&peaceOptions(state,other,owner).white&&settleWar(state,owner,other).ok)return true;
  }
 }
 return false;
}
// A nearby rebel city is an opportunity if the army can spare the troops.
function planRevoltDefense(id){
 if(!state.network)return;
 const owned=state.regions.filter(r=>r.owner===id),atWar=activeWarEnemies(state,id).some(owner=>!state.factions[owner]?.isRebel);
 const targets=state.regions.filter(r=>{
  const faction=state.factions[r.owner];
  return faction?.isRebel&&!faction.defeated&&(faction.rebelAgainst===id||!atWar&&
   owned.some(ours=>ours.adj.includes(r.id)||r.adj.includes(ours.id)));
 }).sort((a,b)=>Number(state.factions[b.owner].rebelAgainst===id)-Number(state.factions[a.owner].rebelAgainst===id));
 for(const region of targets){
  const point=region.slots[0],guard=state.garrisons[region.id]?.troops||0;
  if((state.armyMoves||[]).some(a=>a.owner===id&&a.destination?.point&&distance(a.destination.point,point)<=SIEGE_RADIUS)||
     (state.fieldArmies||[]).some(a=>a.owner===id&&distance(a.location.point,point)<=SIEGE_RADIUS))continue;
  const target=roadNodeLocation(state.network,state.network.hubKeys.get(region.id));
  if(!target)continue;
  const minimum=Math.max(60,Math.ceil(guard*1.3));
  const sources=state.fieldArmies.filter(unit=>unit.owner===id&&unit.vassalId==null&&!unit.inBattle&&unit.troops>=minimum)
   .sort((a,b)=>distance(a.location.point,point)-distance(b.location.point,point));
  for(const source of sources)if(orderArmy(state,{kind:'unit',unit:source},target,id).ok)return;
 }
}
function conquestTargetPriority(region){
 return (militaryCampaignTarget(state,region)?65:0)+(realmCapitalId(state,region.owner)===region.id?20:0);
}
function planBotWar(id){let f=state.factions?.[id];if(!f||f.defeated||!state.network)return;respondCampaignPressure(id);const enemies=new Set(activeWarEnemies(state,id));if(!enemies.size)return;let regions=state.regions.filter(r=>r.owner===id);defendBotFrontier(state,id,regions,enemies);let all=battleCombatants(state),foes=all.filter(a=>enemies.has(a.unit.owner)),friends=all.filter(a=>a.unit.owner===id),sieges=[...(state.sieges?.values()||[])],marches=(state.armyMoves||[]).filter(a=>a.owner===id),sources=[];for(const r of regions){let g=state.garrisons?.[r.id];if(g?.owner===id&&g.troops>=30&&!g.inBattle)sources.push({unit:g,point:r.slots[0],selection:{kind:'garrison',regionId:r.id}})}for(const u of state.fieldArmies||[])if(u.owner===id&&u.vassalId==null&&u.troops>=30&&!u.inBattle&&!sieges.some(q=>q.attacker===id&&distance(state.regions.find(r=>r.id===q.regionId)?.slots[0]||{x:1e6,z:1e6},u.location.point)<=SIEGE_RADIUS))sources.push({unit:u,point:u.location.point,selection:{kind:'unit',unit:u}});if(!sources.length)return;
 let threats=regions.map(r=>{let hostiles=foes.filter(a=>!a.garrison&&distance(a.point,r.slots[0])<=90&&(regionAt(state.regions,a.point.x,a.point.z)?.owner===id||a.unit.destination?.point&&distance(a.unit.destination.point,r.slots[0])<=SIEGE_RADIUS)),attack=hostiles.reduce((n,a)=>n+a.unit.troops,0),cover=friends.filter(a=>distance(a.point,r.slots[0])<=12).reduce((n,a)=>n+a.unit.troops,0),siege=sieges.some(q=>q.regionId===r.id&&q.defender===id);return {region:r,attack,cover,siege}}).filter(x=>x.attack>0&&(x.siege||x.cover<x.attack*1.15)).sort((a,b)=>(b.attack-b.cover+(b.siege?200:0))-(a.attack-a.cover+(a.siege?200:0)));
 function send(target,kind,minimum){if(marches.some(m=>m.botTargetId===target.id&&!m.inBattle))return false;let pool=sources.filter(x=>distance(x.point,target.slots[0])>SIEGE_RADIUS&&x.unit.troops>=minimum).sort((a,b)=>distance(a.point,target.slots[0])-distance(b.point,target.slots[0]));let destination=roadNodeLocation(state.network,state.network.hubKeys.get(target.id));for(const source of pool){let result=orderArmy(state,source.selection,destination,id);if(result.ok){result.march.botTargetId=target.id;result.march.botIntent=kind;return true}}return false}
 for(const threat of threats)if(send(threat.region,'defend',30))return;
 let targets=state.regions.filter(r=>enemies.has(r.owner)&&adjacentToFaction(state,r,id)).map(r=>{let defenders=foes.filter(a=>distance(a.point,r.slots[0])<=SIEGE_RADIUS).reduce((n,a)=>n+a.unit.troops,0),engaged=friends.some(a=>a.unit.inBattle&&distance(a.point,r.slots[0])<=SIEGE_RADIUS),already=friends.some(a=>!a.unit.inBattle&&distance(a.point,r.slots[0])<=SIEGE_RADIUS);return {region:r,defenders,engaged,already}}).filter(x=>!x.already||x.engaged).sort((a,b)=>(a.defenders-conquestTargetPriority(a.region))-(b.defenders-conquestTargetPriority(b.region))||distance(a.region.slots[0],sources[0].point)-distance(b.region.slots[0],sources[0].point));for(const target of targets.slice(0,12))if(send(target.region,'attack',Math.max(60,Math.ceil(target.defenders*(target.region.owner==='you'?1.15:1)))))return}
function planBotPetition(id){
 const f=state.factions?.[id];
 if(!f||f.defeated||f.isRebel)return;
 const candidates=rankBotExpansion(state,id);
 const possible=candidates.find(({region})=>neutralOccupationCheck(state,region,id).ok)?.region;
 if(possible&&occupyNeutralDuchy(state,possible,id).ok)return;
 if(!candidates.length||state.economy.shipments.some(s=>s.kind==='petition'&&s.owner===id))return;
 const {urgency}=strategySignals(state,id),minimum=urgency>.5?85:110;
 if(f.gold<minimum||(armyTroops(state,id)<100&&f.gold<190)||
  (urgency<.5&&f.gold<180&&state.regions.some(r=>r.owner===id&&r.buildings.length<2)))return;
 for(const candidate of candidates){
  if(!sendPetition(state,id,candidate.region).ok)continue;
  f.lastExpansion={regionId:candidate.region.id,contested:candidate.contested};
  return;
 }
}

// Plan a coastal investment from real free sites and navigable routes.
function botPortPlans(id){
 let f=state.factions?.[id];if(!f||f.defeated||f.isRebel||!state.network||isAtWar(state,'you',id))return [];
 let owned=state.regions.filter(r=>r.owner===id);if(owned.some(r=>r.buildings.some(b=>b.type==='port')))return [];
 let playerPorts=state.regions.filter(r=>r.owner==='you'&&r.coast&&r.buildings.some(b=>b.type==='port')),candidates=[];
 for(const r of owned.filter(r=>r.coast))for(const slot of r.slots){if(r.buildings.some(b=>b.slotId===slot.id))continue;let water=portWaterCell(slot);if(water)candidates.push({region:r,slot,water,shoreDistance:distance(slot,water)})}
 candidates.sort((a,b)=>a.shoreDistance-b.shoreDistance||a.region.id-b.region.id||a.slot.id-b.slot.id);let fallback=null;
 for(const candidate of candidates){let {region:r,slot,water,shoreDistance}=candidate,port={type:'port',x:slot.x,z:slot.z,slotId:slot.id,scale:slot.scale,terrain:slot.terrain,level:1};port.route=attachSupplyRoute(r,port,id);if(!port.route)continue;
  let plan={region:r,port,reachable:false,shoreDistance};fallback??=plan;
  for(const home of playerPorts){let route=maritimeRoute(state,home,r,f.regionId,port);if(route){plan.reachable=true;return [plan]}}
 }
 return fallback?[fallback]:[];
}
function developBot(id){let f=state.factions?.[id];if(!f||f.defeated||f.isRebel)return;const tx=(name,fn)=>{const s0=performance.now();const r=fn();const d=performance.now()-s0,w=state._phaseTimings?.worst;if(w&&d>(w['d:'+name]||0))w['d:'+name]=d;return r};let signal=tx('signals',()=>strategySignals(state,id)),reserve=signal.urgency>.5||isAtWar(state,'you',id)?75:85,owned=state.regions.filter(r=>r.owner===id&&!vassalFor(state,r)),legacyReady=owned.length>=2&&armyTroops(state,id)>=100&&owned.reduce((n,r)=>n+r.buildings.filter(b=>b.product).length,0)>=2,playerHasPort=state.regions.some(r=>r.owner==='you'&&r.buildings.some(b=>b.type==='port')),tradeRival=state.campaign?.pressure?.path==='trade'&&f.commerceTarget===state.campaign.pressure.owner,islandStart=!!state.seaPetitionPath&&owned.some(r=>r.id===f.regionId&&r.coast&&!r.adj.length),plans=f.gold>=65&&(playerHasPort||legacyReady||tradeRival||islandStart)?tx('portPlans',()=>botPortPlans(id).filter(p=>!vassalFor(state,p.region))):[],opportunity=plans.find(p=>p.reachable),plan=opportunity||(legacyReady||tradeRival||islandStart?plans[0]:null),portBudget=TYPES.port.cost+(opportunity||tradeRival||islandStart?15:70);
 if(owned.length>realmRank(state,id).capacity){
  const excessLands=realmAdministration(state,id).excessLands;
  const region=owned.filter(r=>excessLands.has(r.id)&&vassalGrantCheck(state,r,null,id).ok).sort((a,b)=>duchyStability(a)-duchyStability(b))[0];
  if(region){
   const incumbent=(region.adj||[]).map(landId=>vassalFor(state,councilRegion(state,landId,id)))
    .find(vassal=>vassal&&vassalGrantCheck(state,region,vassal.id,id).ok);
   const result=grantVassalDuchy(state,region,incumbent?.id,id);
   if(result.ok){if(f.gold>=reserve+60)giftVassalGold(state,result.vassal,60,id);return}
  }
 }
 if(plan&&f.gold>=portBudget){
  const result=build(state,'port',plan.port.x,plan.port.z,null,id);
  if(result.ok){finishConstruction(result);if(state.selected===plan.region)updateUI();return}
 }
 // An established bot can invest in its capital and raise its title using its own gold.
 if(f.gold>=TYPES.grain.cost+20){
  const hungry=owned.filter(r=>r.buildings.length<r.slots.length&&
   localHarvest(r)*localGrainShare(r)+.05<regionGrainNeed(state,r));
  hungry.sort((a,b)=>Number(granaryFor(state,b.id).fed<.999)-Number(granaryFor(state,a.id).fed<.999)||
   regionGrainNeed(state,b)-regionGrainNeed(state,a));
  for(const r of hungry){
   const workforce=workforceReport(r);
   const slots=r.slots.filter(q=>!r.buildings.some(b=>b.slotId===q.id)).sort((a,b)=>
    productivity('grain',b.terrain).rate-productivity('grain',a.terrain).rate);
   for(const q of slots){
    const farm={type:'grain',x:q.x,z:q.z,slotId:q.id,scale:q.scale,terrain:q.terrain,product:productivity('grain',q.terrain)};
    if(councilWorkforceGain(r,workforce,farm,null,true)<=0)continue;
    const result=build(state,'grain',q.x,q.z,null,id);
    if(result.ok){finishConstruction(result);if(state.selected===r)updateUI();return}
   }
  }
 }
 let promotion=realmPromotionCheck(state,id),nextRank=promotion.next,capital=state.regions.find(r=>r.id===f.regionId&&r.owner===id),capitalCity=capital?.buildings.find(b=>b.type==='city'&&b.capital),industry=owned.reduce((n,r)=>n+r.buildings.filter(b=>b.product&&b.route?.length).length,0);
 if(nextRank&&!isAtWar(state,'you',id)&&promotion.lands>=nextRank.requiredLands&&capitalCity&&industry>=2){let level=capitalCity.level||1,cityCost=level===1?120:200;if(level<nextRank.capitalLevel&&f.gold>=cityCost+reserve){const result=upgradeBuilding(state,capital,capitalCity,null,id);if(result.ok){onCouncilUpgrade(capitalCity,id);if(state.selected===capital)updateUI();return}}if(promotion.ok&&f.gold>=nextRank.cost+reserve){promoteRealm(state,id);if(state.selected===capital)updateUI();return}if(level>=nextRank.capitalLevel&&f.gold>=nextRank.cost*.6&&f.gold<nextRank.cost+reserve)return}
 // Save briefly for a viable trade connection; never reserve resources in wartime.
 if(opportunity&&f.gold>=65&&f.gold<portBudget)return;
 if(f.gold<reserve||(armyTroops(state,id)<100&&f.gold<150))return;
 let pending=state.economy.shipments.some(s=>s.kind==='petition'&&s.owner===id),canExpand=armyTroops(state,id)>=100&&!isAtWar(state,'you',id)&&!owned.some(r=>r.buildings.length<2)&&!pending&&state.regions.some(r=>r.owner==='neutral'&&adjacentToFaction(state,r,id)&&(f.stocks[petitionFor(r).good]||0)>=petitionFor(r).amount);if(canExpand&&f.gold<170)return;let workshops=owned.flatMap(r=>r.buildings.filter(b=>b.product&&b.route?.length&&((b.level||1)<3)).map(b=>({r,b}))).sort((a,b)=>b.b.product.rate-a.b.product.rate),built=owned.reduce((n,r)=>n+r.buildings.filter(b=>b.product).length,0);if(f.gold>=180&&built>=3&&workshops.length){let {r,b}=workshops[0],level=b.level||1,cost=level===1?80:130;if(f.gold-cost>=50){const result=upgradeBuilding(state,r,b,null,id);if(result.ok){onCouncilUpgrade(b,id);if(state.selected===r)updateUI();return}}}let regions=owned.filter(r=>r.buildings.length<r.slots.length).sort((a,b)=>a.buildings.length-b.buildings.length);for(const r of regions){let types=GOODS.slice().sort((a,b)=>f.stocks[a]-f.stocks[b]);let hasFarm=state.regions.some(x=>x.owner===id&&x.buildings.some(b=>b.type==='grain'&&b.product));if(f.stocks.grain<12&&!hasFarm)types=['grain',...types.filter(g=>g!=='grain')];else{let owned=state.regions.filter(x=>x.owner===id),military=['iron','cloth'].filter(g=>!owned.some(x=>x.buildings.some(b=>b.type===g&&b.product)));if(military.length)types=[...military,...types.filter(g=>!military.includes(g))]}for(const good of types){let slots=r.slots.filter(p=>!r.buildings.some(b=>b.slotId===p.id)).sort((a,b)=>productivity(good,b.terrain).rate-productivity(good,a.terrain).rate);for(const q of slots){let b={type:good,x:q.x,z:q.z,slotId:q.id,scale:q.scale,terrain:q.terrain,product:productivity(good,q.terrain),produced:0,dispatchClock:0};b.route=attachSupplyRoute(r,b,id);if(!b.route)continue;const result=build(state,good,q.x,q.z,null,id);if(result.ok){finishConstruction(result);if(state.selected===r)updateUI();return}}}}}

// Sea lanes use water cells, then join the existing roads at both ends.
function waterRoute(port, targetPort) {
 const cache = state._waterRoutes ??= new Map();
 const key = [port.x,port.z,targetPort.x,targetPort.z].join(':');
 const reverse = [targetPort.x,targetPort.z,port.x,port.z].join(':');
 if (!cache.has(key)){
  if(GAME_MAP){
   const start=portWaterCell(port),end=portWaterCell(targetPort);
   cache.set(key,start&&end?navalCourse(start,end):null);
  }else cache.set(key,findWaterRoute(port,targetPort));
  if(!cache.has(reverse))cache.set(reverse,cache.get(key)?.slice().reverse()||null);
 }
 return cache.get(key);
}

const campaignNavigators=new Map();
function navalNavigator(step=1.45*WORLD_SCALE){
 if(!campaignNavigators.has(step)) campaignNavigators.set(step,new SeaNavigator({size:[WORLD_WIDTH,WORLD_HEIGHT],gridKm:step,land:SCENARIO_LAND,gridBounds:GAME_MAP.bounds,heuristicWeight:1.08,clearance:SHIP_CLEARANCE}));
 return campaignNavigators.get(step);
}
function navigableWater(point){
 if(GAME_MAP)return isSeaBackground(point.x,point.z)&&navalNavigator().clearSegment([point.x,point.z],[point.x,point.z]);
 return point.x>=0&&point.x<=784&&point.z>=0&&point.z<=280&&isSeaBackground(point.x,point.z)&&!regionAt(state.regions,point.x,point.z)&&coastDistance(point.x,point.z)>=SHIP_CLEARANCE;
}

function waterSegment(from,to){
 if(GAME_MAP)return navigableWater(from)&&navigableWater(to)&&navalNavigator().clearSegment([from.x,from.z],[to.x,to.z]);
 const steps=Math.max(1,Math.ceil(distance(from,to)));
 for(let i=0;i<=steps;i++){
  const t=i/steps;
  const x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  if(!navigableWater({x,z})||(i>0&&i<steps&&coastDistance(x,z)<SHIP_CLEARANCE+.5)) return false;
 }
 return true;
}

function nearestNavalCell(point){
 const x0=Math.round(point.x/14)*14, z0=Math.round(point.z/14)*14;
 let best=null, shortest=Infinity;
 for(let dx=-28;dx<=28;dx+=14) for(let dz=-28;dz<=28;dz+=14){
  const cell={x:x0+dx,z:z0+dz};
  const length=distance(point,cell);
  if(length<shortest&&waterSegment(point,cell)){best=cell;shortest=length}
 }
 return best;
}

function navalCourse(from,to){
 if(GAME_MAP){
  if(!from||!to||!navigableWater(from)||!navigableWater(to))return null;
  const a=[from.x,from.z],b=[to.x,to.z];
  let result=navalNavigator().route(a,b);
  const direct=distance(from,to);
  if(!result||direct<85*WORLD_SCALE&&result.km>direct*1.6){
   const closeRoute=navalNavigator(.48*WORLD_SCALE).route(a,b);
   if(closeRoute&&(!result||closeRoute.km<result.km)) result=closeRoute;
  }
  return result?.points.map(([x,z])=>({x,z}))||null;
 }
 if(!from||!to||!navigableWater(from)||!navigableWater(to)) return null;
 if(waterSegment(from,to)) return [from,to];
 const start=nearestNavalCell(from), end=nearestNavalCell(to);
 if(!start||!end) return null;
 const water=distance(start,end)<1e-8?[start]:waterRoute(start,end);
 return water?[from,...water,to].filter((p,i,route)=>!i||distance(p,route[i-1])>1e-8):null;
}

function findWaterRoute(port, targetPort) {
 const start = portWaterCell(port), end = portWaterCell(targetPort);
 if (!start || !end) return null;
 const key = p => p.x + ',' + p.z;
 const cells = state._seaWaterCells ??= new Map();
 function water(x,z) {
  const id=x+','+z;
  if(!cells.has(id)) cells.set(id,navigableWater({x,z}));
  return cells.get(id);
 }
 const queue=[start], previous=new Map([[key(start),null]]);
 const neighbors = p => [[14,0],[-14,0],[0,14],[0,-14]]
  .map(([dx,dz])=>({x:p.x+dx,z:p.z+dz}))
  .filter(q=>water(q.x,q.z)&&waterSegment(p,q));
 if (key(start)===key(end)) {
  const neighbor=neighbors(start)[0];
  return neighbor?[start,neighbor,end]:null;
 }
 for(let i=0;i<queue.length&&!previous.has(key(end));i++) {
  const point=queue[i];
  for(const next of neighbors(point)) {
   if(previous.has(key(next))) continue;
   previous.set(key(next),point);
   queue.push(next);
  }
 }
 if(!previous.has(key(end))) return null;
 const path=[];
 for(let point=end;point;point=previous.get(key(point))) path.push(point);
 return path.reverse();
}

// Merchant sailings give coastal rivals real cargo on the map.
function planNavalDefense(){
 if(!state.warships.length)return;
 for(const [owner,faction] of Object.entries(state.factions||{})){
  if(faction.defeated||faction.isRebel)continue;
  const raiders=state.warships.filter(ship=>isAtWar(state,owner,ship.owner));
  if(!raiders.length)continue;
  const losses=(state.economy.navalLosses||[]).filter(loss=>loss.owner===owner&&isAtWar(state,owner,loss.attacker)
   &&state.economy.seconds-loss.time<=180);
  const latest=losses.at(-1);
  const hotspot=latest&&losses.filter(loss=>distance(latest.point,loss.point)<=PATROL_RADIUS*2).length>=2?latest.point:null;
  const merchant=hotspot&&state.economy.shipments.find(ship=>shipmentOwner(ship)===owner&&ship.amount&&ship.mode==='sea'
   &&ship.path.some(point=>distance(point,hotspot)<=PATROL_RADIUS));
  let guard=state.warships.find(ship=>ship.owner===owner&&!ship.vassalId);
  if(guard){
   if(guard.prize||guard.repair) continue;
   if(guard.hull<=40&&faction.stocks.wood>=6){orderRepair(state,guard);continue}
   if(merchant&&guard.escort!==merchant){orderEscort(state,guard,merchant);continue}
   if(hotspot&&!guard.escort&&(!guard.patrol||distance(guard.patrol.center,hotspot)>PATROL_RADIUS/2)) orderWarship(state,guard,hotspot,owner);
   continue;
  }
  if(faction.gold<WARSHIP_COST.gold+35) continue;
  const ports=state.regions.filter(r=>r.owner===owner&&!vassalFor(state,r)).flatMap(region=>region.buildings
   .filter(b=>b.type==='port').map(port=>({region,port,berth:portWaterCell(port)}))).filter(entry=>entry.berth);
  const threatened=ports.map(entry=>({...entry,gap:hotspot?distance(hotspot,entry.berth):Math.min(...raiders.map(ship=>distance(navalPosition(ship),entry.berth)))}))
   .filter(entry=>hotspot||entry.gap<=PATROL_RADIUS*3).sort((a,b)=>a.gap-b.gap)[0];
  if(!threatened) continue;
  const result=commissionWarship(state,threatened.region,threatened.port,owner);
  if(!result.ok) continue;
  if(merchant) orderEscort(state,result.ship,merchant);
  else orderWarship(state,result.ship,hotspot||threatened.berth,owner);
 }
}

function dispatchBotSeaTrade(owner){
 if(owner){
  if(tradePartnerAlive(state,owner))dispatchTrade(owner);
  return;
 }
 for(const id of Object.keys(state.factions||{})){
  if(!tradePartnerAlive(state,id))continue;
  runBotAction(state,'dispatchBotSeaTrade',id);
 }
}

function maritimeRoute(state,home,coast,destinationId,plannedPort=null,owner='you',local=false){
 if(!state.network)return null;
 const port=home.owner===owner?home.buildings.find(b=>b.type==='port'):campaignPortCharter(state,owner)?.port;
 const targetPort=plannedPort||coast.buildings.find(b=>b.type==='port');
 if(!port||!targetPort)return null;
 const capitalId=local?home.id:realmCapitalId(state,owner),key=[owner,home.id,port.slotId,coast.id,targetPort.slotId,destinationId,capitalId].join(':');
 const cache=state._seaRouteCache??=new Map();
 if(cache.has(key))return cache.get(key);
 const crossing=waterRoute(port,targetPort),road=crossing&&(local?routeWithin(home,port,duchySeat(home)):attachSupplyRoute(home,port,owner));
 if(!road){cache.set(key,null);return null}
 const from=road.slice().reverse();
 const path=[...from,...crossing],seaStart=routeLength([...from,crossing[0]]),seaEnd=routeLength(path);
 markSeaLeg(path,seaStart,seaEnd);
 const result={path,seaStart,seaEnd,destinationPortRegionId:coast.id,destinationPortSlotId:targetPort.slotId,berth:crossing.at(-1)};
 cache.set(key,result);return result;
}

function shortestTownRoute(state,buyer,pathForTown){
 let best=null,length=Infinity;
 for(const region of state.regions){
  if(region.owner!==buyer||!region.buildings.some(b=>b.type==='city'))continue;
  const path=pathForTown(region);
  if(!path||path.length<2)continue;
  const gap=routeLength(path);
  if(gap<length){best={destinationRegionId:region.id,path};length=gap;}
 }
 return best;
}
function nearestLandTradeRoute(state,owner,buyer,originId){
 const graph=state.network,origin=graph?.hubKeys.get(originId);
 if(origin==null)return null;
 const filter=supplyFilterFor(owner);
 return shortestTownRoute(state,buyer,region=>routeToHub(graph,graph.hubKeys.get(region.id),origin,filter)?.reverse());
}
function tradeOffersFor(state,id,owner='you',range=tradeRange(state,owner),vassal=null){
 const paths=[];
 if(id===owner||!campaignNationAlive(state,id))return {reason:'Страна больше не существует',paths,offers:[]};
 if(isAtWar(state,owner,id))return {reason:'Война: новые сделки приостановлены',paths,offers:[]};
 if(campaignTradeEmbargo(state,owner,id))return {reason:'Эмбарго: торговля приостановлена',paths,offers:[]};
 const buyer=factionLedger(state,id),capitalId=realmCapitalId(state,owner);
 const lands=state.regions.filter(r=>r.owner===owner&&!r.awaitingAdministration&&vassalFor(state,r)===vassal);
 const markets=lands.filter(r=>r.id!==capitalId&&r.market?.ready&&r.market.policy!=='capital');
 const origins=vassal?vassal.lands:[capitalId,...markets.map(r=>r.id)];
 for(const originId of origins){
  const land=nearestLandTradeRoute(state,owner,id,originId);
  if(land)paths.push({id,buyer,...land,mode:'land',premium:tradePremium(land.path),limit:300,
   marketId:markets.some(r=>r.id===originId)?originId:undefined,departureRegionId:originId});
 }
 const ports=lands.filter(r=>r.buildings.some(b=>b.type==='port'));
 const charter=!vassal&&campaignPortCharter(state,owner);
 if(charter)ports.push(charter.region);
 const destinations=state.regions.filter(r=>r.owner===id&&r.coast&&r.buildings.some(b=>b.type==='port'));
 for(const home of ports){
  let sea=null,shortest=Infinity;
  for(const coast of destinations){
   const route=maritimeRoute(state,home,coast,coast.id,null,owner,!!vassal);
   if(route&&route.seaEnd-route.seaStart<shortest){sea=route;shortest=route.seaEnd-route.seaStart;}
  }
  if(!sea)continue;
  const port=home.owner===owner?home.buildings.find(b=>b.type==='port'):charter.port;
  paths.push({id,buyer,...sea,destinationRegionId:sea.destinationPortRegionId,mode:'sea',
   premium:(home.owner===owner?1.5:1.2)*tradePremium(sea.path),limit:600,portKey:home.id+':'+port.slotId,departureRegionId:home.id});
 }
 const offers=paths.filter(offer=>offer.mode==='sea'||routeLength(offer.path)<=range);
 return {paths,offers,reason:!paths.length?'Нет сухопутного или морского пути':!offers.length?'Слишком далеко для текущей мощи':''};
}
function vassalTradeStocks(state,vassal,regionId){
 return {...vassal.stocks,grain:state.economy.granaries?granaryStock(state,regionId):vassal.stocks.grain};
}
function tradeQuote(state,offer,owner='you',reserves=null,vassal=null){
 const economy=state.economy,policies=owner==='you'?economy:state.factions[owner],cargo={},demand={};
 const market=!vassal&&tradeCenter(state,offer.marketId,owner);
 const stocks=vassal?vassalTradeStocks(state,vassal,offer.departureRegionId):market?.market.stocks||factionLedger(state,owner).stocks;
 const competition=marketCompetition(state,offer.id,owner);
 let total=0,value=0;
 for(const good of market?MARKET_GOODS:GOODS){
  const incoming=economy.shipments.filter(ship=>ship.kind==='export'&&ship.buyer===offer.id||
   good==='grain'&&ship.kind==='import'&&!ship.vassalId&&shipmentOwner(ship)===offer.id)
   .reduce((sum,ship)=>sum+(ship.cargo?.[good]??(ship.good===good?ship.amount:0)),0);
  const limit=good==='grain'?grainMarketLimit(state,offer.id,offer.limit):offer.limit;
  demand[good]=Math.max(0,Math.floor(limit-(offer.buyer.stocks[good]||0)-incoming));
  if(!vassal&&(good==='grain'?policies.grainPolicy!=='trade':policies.exportPolicy?.[good]==='hold'))continue;
  const stock=Math.max(0,stocks[good]||0),reserve=vassal?reserves.get(offer.departureRegionId)?.[good]??TRADE_RESERVE[good]:
   market?2:reserves?.[good]??tradeReserve(state,good,owner);
  const amount=Math.min(Math.floor(stock*.5),Math.max(0,Math.floor(stock-reserve)),demand[good]);
  if(amount<=0)continue;
  cargo[good]=amount;total+=amount;value+=amount*TRADE_PRICE[good]*offer.premium*competition;
 }
 return {...offer,cargo,demand,value,total,competition};
}
// A selling opportunity uses the same access, prices and buyer limits as a dispatched shipment.
function councilTradeBook(channels,goods,owner='you',local=false){
 const policies=local?{grainPolicy:'trade'}:owner==='you'?state.economy:state.factions[owner],booked=new Map();
 for(const ship of state.economy.shipments){
  if(ship.kind!=='export')continue;
  const amount=booked.get(ship.buyer)||{};
  for(const [good,n] of Object.entries(ship.cargo||{[ship.good]:ship.amount}))amount[good]=(amount[good]||0)+n;
  booked.set(ship.buyer,amount);
 }
 const bestByBuyer=new Map();
 for(const {id,limit,premium,seconds} of channels){
  const buyer=factionLedger(state,id),competition=marketCompetition(state,id,owner);
  if(!buyer)continue;
  const byGood=bestByBuyer.get(id)||{};
  for(const good of goods){
   if(good==='grain'?policies.grainPolicy!=='trade':policies.exportPolicy?.[good]==='hold')continue;
   const cap=good==='grain'?grainMarketLimit(state,id,limit):limit;
   const demand=Math.max(0,cap-(buyer.stocks[good]||0)-(booked.get(id)?.[good]||0));
   const units=Math.min(60,demand)*60/Math.max(42,seconds*2+12);
   const price=TRADE_PRICE[good]*premium*competition;
   const previous=byGood[good];
   if(units>0&&(!previous||units*price>previous.units*previous.price))byGood[good]={units,price};
  }
  bestByBuyer.set(id,byGood);
 }
 const book={};
 for(const entries of bestByBuyer.values())for(const [good,entry] of Object.entries(entries)){
  const previous=book[good]||{units:0,price:0};
  const units=entry.units+previous.units;
  book[good]={units,price:(entry.units*entry.price+previous.units*previous.price)/units};
 }
 return book;
}
function councilMarketOutlook(region,prospective=false,local=false){
 const owner=region.owner,capitalId=realmCapitalId(state,owner),capital=councilRegion(state,capitalId,owner),range=tradeRange(state,owner);
 const filter=supplyFilterFor(owner),channels=[],direct=[];
 const market=prospective?region:regionalTradeCenter(region,filter);
 for(const id of ['you',...Object.keys(state.factions||{})]){
  if(id===owner||!campaignNationAlive(state,id)||isAtWar(state,owner,id)||campaignTradeEmbargo(state,owner,id))continue;
  const path=!prospective&&nearestLandTradeRoute(state,owner,id,local?region.id:capitalId)?.path;
  if(!prospective&&path?.length>1&&routeLength(path)<=range)
   channels.push({id,limit:300,premium:tradePremium(path),seconds:journeyDuration(path)});
  if(market){
   const local=nearestLandTradeRoute(state,owner,id,market.id)?.path;
   if(local?.length>1&&routeLength(local)<=range)
    direct.push({id,limit:300,premium:tradePremium(local),seconds:journeyDuration(local)});
  }
 }
 if(!prospective){
  const ports=[...new Set(local?[region]:[region,capital])].filter(Boolean).flatMap(hub=>hub.buildings.filter(b=>b.type==='port').map(port=>({hub,port})));
  for(const {hub,port} of ports)channels.push(...councilSeaChannels(hub,port,local));
 }
 const books=new Map([[capitalId,councilTradeBook(channels,GOODS,owner,local)]]);
 if(market)books.set(market.id,councilTradeBook(direct,MARKET_GOODS,owner,local));
 return books;
}
function councilSeaChannels(region,port,local=false){
 const land=local?routeWithin(region,port,duchySeat(region)):attachSupplyRoute(region,{...port,type:'port'},region.owner);
 const berth=portWaterCell(port);
 if(!land||!berth)return [];
 const nearby=[];
 for(const rival of state.regions){
  if(rival.owner===region.owner||!campaignNationAlive(state,rival.owner)||isAtWar(state,region.owner,rival.owner))continue;
  for(const peer of rival.buildings){
   if(peer.type!=='port')continue;
   nearby.push({id:rival.owner,peer,distance:distance(berth,peer)});
  }
 }
 nearby.sort((a,b)=>a.distance-b.distance);
 const channels=new Map();
 for(const {id,peer} of nearby.slice(0,8)){
  const water=waterRoute(port,peer);
  if(!water?.length)continue;
  const seconds=journeyDuration(land)+routeLength(water)/SHIP_SPEED;
  if(seconds<(channels.get(id)?.seconds??Infinity))
   channels.set(id,{id,limit:600,premium:1.5*tradePremium(water),seconds});
 }
 return [...channels.values()];
}
function councilPortOutlook(region,slot,local=false){
 return councilTradeBook(councilSeaChannels(region,slot,local),GOODS,region.owner,local);
}

function chooseTradeOffer(state,quotes,owner='you',vassal=null,fleet=tradeFleet(state,owner,vassal)){
 const eligible=quotes.filter(offer=>offer.total>=MIN_TRADE_CARGO&&tradeFleetAvailable(state,offer,owner,vassal,fleet));
 const land=eligible.filter(offer=>offer.mode==='land');
 if(land.length)return land.reduce((best,offer)=>{
  const difference=routeLength(offer.path)-routeLength(best.path);
  return difference<0||difference===0&&offer.value>best.value?offer:best;
 });
 const mine=state.economy.shipments.filter(ship=>ship.kind==='export'&&shipmentOwner(ship)===owner);
 const activeBuyers=new Set(mine.filter(ship=>ship.mode==='sea').map(ship=>ship.buyer));
 const hasFreeDestination=eligible.some(offer=>offer.mode==='sea'&&!activeBuyers.has(offer.id));
 const progress=state.campaign?.progress.get(owner)?.trade;
 const served=new Set(progress?.repeatBuyers||[]);
 const score=offer=>offer.value*(progress&&served.size<progress.requiredPartners&&!served.has(offer.id)&&!mine.some(ship=>ship.buyer===offer.id)?1.48:1);
 let best=null;
 for(const offer of eligible){
  if(offer.mode==='sea'&&hasFreeDestination&&activeBuyers.has(offer.id))continue;
  if(!best||score(offer)>score(best))best=offer;
 }
 return best;
}
function dispatchTrade(owner='you',vassal=null,lands=[]){
 const economy=state.economy,ledger=factionLedger(state,owner,vassal);
 if(!economy||!ledger?.stocks||!state.factions)return;
 const fleet=tradeFleet(state,owner,vassal);
 if(!fleet.landFree&&!fleet.seaFree)return;
 const capitalId=realmCapitalId(state,owner),capital=councilRegion(state,capitalId,owner);
 if(!capital)return;
 const importTown=vassal?lands.slice().sort((a,b)=>granaryStock(state,a.id)/Math.max(1,regionGrainNeed(state,a))-
  granaryStock(state,b.id)/Math.max(1,regionGrainNeed(state,b)))[0]:capital;
 if(!importTown)return;
 const grainNeed=granaryFor(state,importTown.id)?.need??regionGrainNeed(state,importTown);
 const grainStock=vassal?vassalTradeStocks(state,vassal,importTown.id).grain:ledger.stocks.grain;
 const partners=['you',...Object.keys(state.factions)].filter(id=>id!==owner&&campaignNationAlive(state,id)&&!isAtWar(state,owner,id)&&!campaignTradeEmbargo(state,owner,id));
 const range=tradeRange(state,owner),goods=ledger.stocks;
 const incoming=economy.shipments.some(ship=>ship.kind==='import'&&shipmentOwner(ship)===owner&&(ship.vassalId??null)===(vassal?.id??null)&&ship.good==='grain');
 const urgent=vassal&&(granaryFor(state,importTown.id)?.fed<.999||importTown.occupation);
 if((!vassal||urgent)&&grainStock<Math.max(8,grainNeed*1.2)&&!incoming&&fleet.landFree>0&&ledger.gold>=TRADE_PRICE.grain){
  const candidates=partners.map(id=>({id,seller:factionLedger(state,id),reserve:grainReserve(state,id)}))
   .filter(({seller,reserve})=>seller.stocks.grain>=reserve+1)
   .map(candidate=>({...candidate,lane:nearestLandTradeRoute(state,owner,candidate.id,importTown.id)}))
   .filter(({lane})=>lane&&routeLength(lane.path)<=range)
   .sort((a,b)=>routeLength(a.lane.path)-routeLength(b.lane.path));
  for(const {id,seller,reserve,lane} of candidates){
   const wanted=Math.min(30,Math.max(3,Math.ceil(grainNeed*2-grainStock)));
   const amount=Math.min(wanted,Math.floor(seller.stocks.grain-reserve),Math.floor(ledger.gold/TRADE_PRICE.grain));
   if(amount<1)continue;
   const value=amount*TRADE_PRICE.grain,path=lane.path.slice().reverse();
   ledger.gold-=value;seller.stocks.grain-=amount;
   if(!vassal)recordCampaignIncome(state,owner,-value);
   economy.shipments.push({kind:'import',owner,vassalId:vassal?.id,departureRegionId:importTown.id,fleetClass:'land',seller:id,sourceTradeRegionId:lane.destinationRegionId,
    good:'grain',amount,value,path,elapsed:0,duration:journeyDuration(path)});
   if(owner==='you'&&!vassal){economy.tradeSpent+=value;flash('Куплено зерно: обоз направляется в столицу')}
   return;
  }
 }
 const policies=vassal||(owner==='you'?economy:state.factions[owner]);
 let reserves;
 if(vassal){
  reserves=new Map(lands.map(land=>[land.id,{...TRADE_RESERVE,wood:16,iron:10,grain:Math.max(18,regionGrainNeed(state,land)*3)}]));
  const canTrade=lands.some(land=>{
   const local=vassalTradeStocks(state,vassal,land.id),reserve=reserves.get(land.id);
   return GOODS.reduce((sum,good)=>sum+Math.max(0,Math.min(Math.floor(local[good]*.5),Math.floor(local[good]-reserve[good]))),0)>=MIN_TRADE_CARGO;
  });
  if(!canTrade)return;
 }else{
  const output=productionTotals(state,false,owner);
  reserves=Object.fromEntries(GOODS.map(good=>[good,tradeReserve(state,good,owner,output)]));
  const available=GOODS.reduce((sum,good)=>sum+(good==='grain'&&policies.grainPolicy!=='trade'||policies.exportPolicy?.[good]==='hold'?0:
   Math.min(Math.floor((goods[good]||0)*.5),Math.max(0,Math.floor((goods[good]||0)-reserves[good])))),0);
  if(available<MIN_TRADE_CARGO&&!state.regions.some(r=>r.owner===owner&&!vassalFor(state,r)&&r.market?.ready&&r.market.policy!=='capital'))return;
 }
 const quotes=partners.flatMap(id=>tradeOffersFor(state,id,owner,range,vassal).offers)
  .filter(offer=>offer.mode==='land'?fleet.landFree:fleet.seaFree)
  .map(offer=>tradeQuote(state,offer,owner,reserves,vassal));
 const land=chooseTradeOffer(state,quotes.filter(offer=>offer.mode==='land'),owner,vassal,fleet);
 const sea=chooseTradeOffer(state,quotes.filter(offer=>offer.mode==='sea'),owner,vassal,fleet);
 // The land convoy has the first slot. Alternate only when both fleets have a buyer.
 const best=policies.lastExportMode==='land'?sea||land:land||sea;
 if(!best)return;
 const {id,cargo,value,path,mode,seaStart,seaEnd,portKey,destinationRegionId,destinationPortRegionId,destinationPortSlotId,marketId,departureRegionId}=best;
 const stocks=vassal?goods:tradeCenter(state,marketId,owner)?.market.stocks||goods;
 for(const [good,amount] of Object.entries(cargo)){
  if(vassal&&good==='grain'&&economy.granaries)changeGranaryStock(state,departureRegionId,-amount);
  else stocks[good]-=amount;
  if(owner==='you'&&!vassal&&good==='grain')recordGrainFlow(state,-amount);
 }
 const ship={kind:'export',owner,vassalId:vassal?.id,departureRegionId,fleetClass:mode,departureCapitalId:capitalId,marketId,marketTrade:true,buyer:id,
  good:Object.keys(cargo)[0],amount:best.total,cargo,value,path,mode,seaStart,seaEnd,portKey,destinationRegionId,destinationPortRegionId,
  destinationPortSlotId,tradeDistance:routeLength(path),tradeRange:mode==='land'?range:null,elapsed:0,duration:journeyDuration(path)};
 economy.shipments.push(ship);
 policies.lastExportMode=mode;
 if(owner==='you')state.onTradeDispatched?.(ship);
}
for(const good of ['wood','iron','cloth'])$('stock-'+good).onclick=()=>{if(!state.economy)return;let policy=state.economy.exportPolicy??={};policy[good]=policy[good]==='hold'?'trade':'hold';updateResources();flash(({wood:'Древесина',iron:'Железо',cloth:'Ткани'}[good]||good)+': '+(policy[good]==='hold'?'накапливаем':'продаём излишки'))};
$('stock-grain').onclick=()=>{if(!state.economy)return;state.economy.grainPolicy=state.economy.grainPolicy==='growth'?'trade':'growth';updateResources();flash(state.economy.grainPolicy==='trade'?'Зерно: продавать излишки':'Зерно: местное снабжение')};
function showPlacementPrompt(){
 $('placement').hidden=false;
 $('placement').textContent='Выберите свободное графство в своём герцогстве · ПКМ — отмена';
}
function selectMode(type){
 closeCouncilMapPicker(false);
 selectedWarship=null;
 if(selectedArmy||selectedGroup.length){selectedArmy=null;selectedGroup=[];renderMarches()}
 selectedCargo=null;selectedCargoGroup=[];
 $('cargo-inspector').hidden=true;$('object-chooser').hidden=true;
 mode=mode===type?null:type;
 $('app').classList.toggle('placing-buildings',!!mode);
 $('army-layer').style.zIndex=mode?'1':'4';
 $('cargo-layer').style.zIndex=mode?'1':'3';
 dirtyLabels=true;hover=null;clearGhost();
 document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.type===mode));
 if(!mode){$('placement').hidden=true;return}
 closeBuilding();
 playSelectionSound(mode);
 if(!state.started)flash('Сначала выберите столицу');
 showPlacementPrompt();
}
function hoverPlacement(x,y){
 const hit=placementGroundAtScreen(x,y);
 hoverRegion=hit?.region??null;
 updateGhost(hit);
 if(!hit)showPlacementPrompt();
}
let ghostPlot=null;
function clearGhost(){ghostPlot=null;if(ghostBuffer)gl.deleteBuffer(ghostBuffer.buffer);ghostBuffer=null}
function updateGhost(p){hover=p;clearGhost();if(!mode||!p){$('placement').hidden=true;return}let region=p.region??regionAt(state.regions,p.x,p.z),parcel=slotAt(region,p.x,p.z),target=parcel||p;const c=buildCheck(state,mode,target.x,target.z);$('placement').hidden=false;if(c.ok){const label=c.product?`${LAND_NAMES[c.terrain]} · <strong>до ${c.product.rate} ед./мин</strong> · ${buildingJobs({type:mode})} рабочих мест (${Math.round((c.product.multiplier-1)*100)>=0?'+':''}${Math.round((c.product.multiplier-1)*100)}%)`:'1 графство под застройку';$('placement').innerHTML=`<strong>${TYPES[mode].name}</strong> · ${label} · ${c.cost} зл.`}else $('placement').innerHTML=`<strong>${TYPES[mode].name}</strong> · <span class="bad">${c.reason}</span>`;{let v=[],land=regionAt(state.regions,target.x,target.z);if(parcel&&land)ghostPlot={region:land.id,slot:parcel.id,valid:c.ok};if(parcel&&land.buildings.some(b=>b.slotId===parcel.id))return;addBuilding(v,{type:mode,x:target.x,z:target.z,scale:parcel?.scale,farmForm:farmFormFor(land,parcel?.id),groundY:land?surfaceHeight(target.x,target.z):0},c.ok?[.72,.83,.45]:[.85,.38,.32]);ghostBuffer=makeBuffer(v)}}
const battlePanels=new Map();
function updateBattlePanel(){const battles=state.battlePairs||[],layer=$('battle-layer'),live=new Set(battles);for(const [battle,el] of battlePanels)if(!live.has(battle)){el.remove();battlePanels.delete(battle)}for(const battle of battles){let el=battlePanels.get(battle);if(!el){el=document.createElement('section');el.className='battle-panel';el.setAttribute('aria-label','Ход сражения');layer.appendChild(el);battlePanels.set(battle,el)}let a=battle.totalA||0,b=battle.totalB||0,total=a+b,ratio=total?Math.max(3,Math.min(97,a/total*100)):50,nearest=state.regions.reduce((best,r)=>!best||distance(r.slots[0],battle.point)<distance(best.slots[0],battle.point)?r:best,null),color=owner=>'rgb('+(FACTION_COLORS[owner]||[.7,.7,.7]).map(v=>Math.round(v*255)).join(',')+')',label='Битва у '+(nearest?.city||'границы'),content=`<div class="battle-meter"><i style="width:${ratio}%;background-color:${color(battle.ownerA)}"></i><i style="width:${100-ratio}%;background-color:${color(battle.ownerB)}"></i></div><div class="battle-summary"><div class="battle-side"><b>⚔ ${Math.ceil(a).toLocaleString(interfaceLocale)}</b><small>Потери ${Math.floor(battle.lossA||0).toLocaleString(interfaceLocale)}</small></div><div class="battle-center"><b>${label}</b><small>${battle.sideA?.length||0} отр. · ${battle.sideB?.length||0} отр.</small></div><div class="battle-side right"><b>${Math.ceil(b).toLocaleString(interfaceLocale)} ⚔</b><small>Потери ${Math.floor(battle.lossB||0).toLocaleString(interfaceLocale)}</small></div></div>`;if(el.dataset.content!==content){el.dataset.content=content;el.innerHTML=content}let point=project(battle.point.x,battle.point.z,roadGround(battle.point.x,battle.point.z)+8);el.style.left=point.x+'px';el.style.top=point.y+'px';el.hidden=point.x<0||point.y<0||point.x>canvas.clientWidth||point.y>canvas.clientHeight}}
function updateToolAffordability(){
 document.querySelectorAll('.tool').forEach(button=>{
  const type=button.dataset.type,cost=TYPES[type]?.cost||0;
  const missing=state.started?costShortfalls(state.gold,null,cost):[];
  const unaffordable=missing.length>0;
  button.classList.toggle('unaffordable',unaffordable);
  button.classList.toggle('affordable',state.started&&!unaffordable);
  button.setAttribute('aria-disabled',String(unaffordable));
  const warning=button.querySelector('.tool-shortfall');
  warning.hidden=!unaffordable;
  if(unaffordable)setGameStatText(warning,'Не хватает '+missing.join(' · '));
 });
}
const MONTHS_RU=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const councilTabs=Object.keys(COUNCIL_DIRECTIONS);
const COUNCIL_ICONS={parley:'M4 5h16v10H9l-5 4z M8 9h8m-8 3h5',scroll:'M6 3h12v14H8a3 3 0 0 0 0 6h10m0-20a3 3 0 0 1 3 3v2h-3M9 8h5m-5 4h5',
 swords:'m4 4 15 15m-3 1 4-4M5 19 20 4m-1 1v4m-5-5h5M4 16l4 4',shield:'m12 3 7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zm-4 9 3 3 5-6',
 cart:'M3 8h14l-2 8H5zm14 2h4m-14 6v3m7-3v3M5 22h0m12 0h0',coins:'M4 8c0-3 12-3 12 0s-12 3-12 0v7c0 3 12 3 12 0V8m0 3c5 0 5 4 0 4m0 4c5 0 5-2 5-5',
 hammer:'m5 5 5-3 7 6-3 4-4-3-6 12-2-2 7-12Z',
 town:'m2 20 20 0M4 20v-8l4-3 4 3v8m0-2V8l4-4 4 4v12M7 16h2m6-6h2m-2 4h2',
 parcels:'M3 5h8v7H3zm8 0h10v4H11zm0 4h10v10H11zM3 12h8v7H3z',
 terrain:'m2 19 7-11 4 6 3-10 6 15H2Zm5-8 2 2 2-2m4-2 2 2 2-1',
 fort:'M3 18v-9h3V5h3v4h6V5h3v4h3v9l-9 3-9-3Zm7 2v-5a2 2 0 0 1 4 0v5',
 crown:'m3 8 5 5 4-7 4 7 5-5-2 10H5L3 8Zm3 13h12',
 eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z M15 12a3 3 0 1 0-6 0 3 3 0 1 0 6 0',flame:'M12 3c2 6 7 8 7 13a7 7 0 1 1-14 0c0-5 4-6 4-9 2 2 2 4 2 5 2-3 2-6 1-9Z',
 pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Zm-4 0a3 3 0 1 0-6 0 3 3 0 1 0 6 0Z',
 close:'m6 6 12 12M18 6 6 18',up:'m6 14 6-6 6 6',down:'m6 10 6 6 6-6'};
function councilIcon(id){return `<svg class="council-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="${COUNCIL_ICONS[id]}"/></svg>`;}
const ADVISOR_EMBLEMS={
 chancellor:`<path fill="#efdbab" d="M9 6h12v18H9a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z"/><path fill="#dabd79" d="M21 6a3 3 0 0 1 3 3v2h-3V6ZM6 21a3 3 0 0 1 3-3h10v3a3 3 0 0 0 3 3H9a3 3 0 0 1-3-3Z"/><path d="M10 10h7m-7 4h6"/><path fill="#d38366" d="m20 18 4 1 1 4-3 3-4-1-1-4Z"/><path d="m19.5 22 1 1 2-2"/>`,
 marshal:`<path fill="#d5e4e8" d="m8 6 4 2 13 14-3 3L9 11 8 6Z"/><path fill="#f4dda8" d="m25 6-1 5L11 25 8 22 21 8l4-2Z"/><path stroke-width="2.4" stroke="#fff0c6" d="m6.5 19 7.5 7m5-1 7-7"/><path d="m16 15 6-6m-7 6-3-3"/>`,
 steward:`<path fill="#d3c7a4" d="M6 8h17v15H6z"/><path fill="#f6e3ad" d="M8 6h17v15H8z"/><path d="M11 10h10m-10 4h10m-6-4v7m4-7v5"/><circle fill="#dfaf50" cx="22" cy="22" r="5"/><path stroke="#fff0a9" d="M21 20c-2 1-1 4 1 4"/>`,
 spymaster:`<path fill="#b2afce" d="m6 6 8 4 10-4-5 8-5 4-5-5-3-7Z"/><path fill="#ebddf2" d="M5 17c1-4 7-6 11-3 4-3 9-1 11 3-3 5-7 6-11 3-4 3-8 2-11-3Z"/><circle fill="#775c9d" cx="11" cy="17" r="1.6"/><circle fill="#775c9d" cx="21" cy="17" r="1.6"/><path fill="#ddb67d" d="m16 19 2 2-2 4-2-4Z"/>`,
 vassals:`<path fill="#cfc19b" d="M8 5h17v21H8z"/><path fill="#eee0b6" d="M11 5 16 1l5 4v21h-5v-9h-5v9h-5V5Z"/><path fill="#6f5740" d="M15 13v6h-3v-6zm5 0v6h-3v-6z"/>`
};
function advisorEmblem(role){
 return `<span class="advisor-emblem advisor-${role}" aria-hidden="true"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="advisor-shield" d="M3 4h26v13c0 6-5 10-13 13C8 27 3 23 3 17V4Z"/><g class="advisor-symbol">${ADVISOR_EMBLEMS[role]}</g></svg></span>`;
}
function cityAdvisorRow(tasks){
 const row=document.createElement('span');row.className='city-advisors';
 for(const task of tasks){
  const role=COUNCIL_DIRECTIONS[task.direction],button=document.createElement('button');
  button.type='button';button.title=role.name+' · '+role.tasks[task.action].label;
  button.setAttribute('aria-label',button.title);
  button.innerHTML=advisorEmblem(task.direction);
  button.onclick=()=>{showCouncil(true);showCouncilTab(task.direction);$('council-task-city').scrollIntoView?.({block:'nearest'});};
  row.appendChild(button);
 }
 return row;
}

let councilTab='steward';
const councilDrafts=new Map();
let councilMapOrder=null;

function showCouncil(open){
 const visible=!!open&&state.started&&!state.defeated;
 $('council-panel').hidden=!visible;
 $('council-toggle').setAttribute('aria-expanded',String(visible));
 if(!visible){closeCouncilMapPicker(false);return}
 $('council-month-report').hidden=true;
 showCampaignPanel(false);
 $('realm-overview-close').onclick();
 $('notifications-panel').hidden=true;$('notifications-toggle').setAttribute('aria-expanded','false');
 setMusterOpen(false);
 updateCouncil();
}
function showCouncilTab(tab){
 closeCouncilMapPicker(false);
 councilTab=tab;
 for(const key of [...councilTabs,'vassals'])$('council-tab-'+key).setAttribute('aria-pressed',String(tab===key));
 updateCouncil();
}
function councilMapTargets(direction,action){
 const targets=new Set(),allowedFactions=new Map();
 const role=COUNCIL_DIRECTIONS[direction];
 for(const region of state.regions){
  if(!duchySeat(region)||region.owner==='neutral'||(role.foreign?region.owner==='you':region.owner!=='you'))continue;
  if(!allowedFactions.has(region.owner))
   allowedFactions.set(region.owner,councilTargetAllowed(state,direction,region,action));
  if(allowedFactions.get(region.owner))targets.add(region.id);
 }
 return targets;
}
function closeCouncilMapPicker(restoreFocus){
 if(!councilMapOrder)return;
 councilMapOrder=null;dirtyLabels=true;
 $('app').classList.remove('picking-council-land');
 $('council-map-picker').hidden=true;
 $('council-panel').inert=false;
 if(restoreFocus)$('council-task-start').focus?.();
}
function openCouncilMapPicker(direction,action,rate){
 const role=COUNCIL_DIRECTIONS[direction],option=role.tasks[action],targets=councilMapTargets(direction,action);
 if(!targets.size){
  flash(action==='embassy'?'Нет доступных держав для нового посольства':
   role.foreign?'Нет доступных иностранных герцогств':'Нужен город в своём герцогстве');
  return;
 }
 councilMapOrder={direction,action,rate,targets};dirtyLabels=true;
 $('council-map-emblem').innerHTML=advisorEmblem(direction);
 const current=state.council.monthly[direction];
 $('council-map-heading').textContent=current?.end===Infinity?'Выберите герцогство для нового назначения':
  current?'Выберите герцогство для следующего поручения':'Выберите герцогство для поручения';
 const term=option.ongoing?'бессрочно, бесплатно':option.free?'30 дней, бесплатно':councilGold(rate)+' зл. / 30 дней';
 $('council-map-order').textContent=role.name+' · '+option.label+' · '+term;
 $('council-map-hint').textContent=role.foreign?'Нажмите доступное иностранное герцогство.':'Нажмите герцогство своей державы.';
 $('app').classList.add('picking-council-land');
 $('council-panel').inert=true;
 $('council-map-picker').hidden=false;
 $('council-map-cancel').focus?.();
}
function assignCouncilAdvisor(region){
 if(!councilMapOrder)return;
 const {direction,action,rate}=councilMapOrder;
 const result=startCouncilTask(state,direction,region,rate,action);
 if(!result.ok){$('council-map-hint').textContent=result.reason;return}
 closeCouncilMapPicker(true);
 updateUI();
 flash((result.queued?'Поручение в очереди':'Советник назначен')+' · '+region.city);
}
function councilDays(seconds){return Math.max(1,Math.ceil(seconds/SECONDS_PER_GAME_DAY))+' дн.'}
function councilFocus(region){
 if(!region?.slots?.[0])return;
 const site=region.slots[0];
 cam.x=site.x;cam.z=site.z;dirtyLabels=true;setSelected(region);
}
function materialStockText(stocks,targets=null){
 return MARKET_GOODS.map(good=>GOODS_LABELS[good]+' '+(stocks[good]||0)+(targets?'/'+targets[good]:'')).join(' · ');
}
function armorySummary(region){
 const a=region.armory;
 if(!a.ready)return 'Строится · осталось '+councilDays(a.readyAt-state.economy.seconds);
 if(a.policy==='paused')return 'Производство на паузе';
 if(a.output>=ARMORY_OUTPUT_CAP)return 'Склад готового снаряжения заполнен';
 const missing=armoryRequirements(a);
 if(missing.length)return 'Не хватает · '+missing.map(good=>{
  return GOODS_LABELS[good]+' '+(EQUIPMENT_RECIPE[good]-a.stocks[good]);
 }).join(', ');
 return 'Комплект будет готов через '+councilDays(ARMORY_CYCLE-a.progress);
}
function armoryDeliveryText(region){
 const trips=state.economy.shipments.filter(ship=>ship.kind==='industry'&&
  (ship.industryPurpose==='materials'&&ship.industryDestination===region.id||
   ship.industryPurpose==='equipment'&&ship.originRegion===region.id));
 const parts=trips.map(ship=>{
  const source=state.regions.find(r=>r.id===ship.originRegion)?.city||'склад';
  const label=ship.industryPurpose==='materials'?'Сырьё из '+source+' · '+materialStockText(ship.cargo):
   'В столицу · '+ship.amount+' компл.';
  return label+(ship.routeRisk?' · риск перехвата':'')+' · через '+councilDays(ship.duration-ship.elapsed);
 });
 if(region.armory.blocked)parts.push('Нет безопасного пути для одной из поставок');
 return parts.join(' • ')||'Поставок в пути нет';
}
function councilGold(amount){
 return (Math.round(amount*10)/10).toLocaleString(interfaceLocale);
}
function councilDeadline(seconds){
 const date=gameDate(seconds);
 return globalThis.gameI18n?.date(date,false)??(date.day+' '+MONTHS_RU[date.month]);
}
function treasuryIncomeReport(){return realmTreasuryReport(state)}
function updateTreasury({taxes,upkeep,committed,free,penalty,reparations}){
 const money=$('money'),rate=$('gold-rate');
 money.innerHTML=Math.floor(state.gold)+' <em>зл.</em>';
 const rounded=Number(free.toFixed(1));
 const signed=(rounded>=0?'+':'')+rounded.toFixed(1);
 const display=globalThis.gameI18n?.text('{0}/мин',signed)??(signed+'/мин');
 rate.textContent=state.started?display:'';
 rate.dataset.negative=String(rounded<0);
 rate.dataset.gameStat=rounded<0?'loss':'income';
 const details=[
  'Налоги в казну державы '+councilGold(taxes)+' зл./мин · содержание войск '+councilGold(upkeep)+' зл./мин',
  'Совету выделено до '+councilGold(committed)+' зл./мин из поступлений',
  reparations.outgoing?'Репарации к уплате −'+councilGold(reparations.outgoing)+' зл./мин':null,
  reparations.incoming?'Репарации к получению +'+councilGold(reparations.incoming)+' зл./мин при наличии средств у плательщика':null,
  'Поток после расходов '+display+(free<0?' · дефицит покрывает казна':''),
  penalty>=.5?'Кризис казны · стабильность −'+Math.round(penalty)+' п. п.':null,
  'Торговая выручка за партию '+Math.floor(state.economy?.tradeEarned||0)+' зл.'
 ];
 if(state.started)explainAction($('treasury-summary'),'Казна',details.filter(Boolean).join('\n'));
}
function renderCouncilTaskQueue(council,direction,firstStart){
 const queue=council.taskQueues[direction]||[],list=$('council-task-queue-list');
 $('council-task-queue').hidden=!queue.length;
 const key=direction+':'+firstStart+':'+queue.map(task=>task.id+(councilTaskRegion(state,task)?'':'x')).join(',');
 if(list.dataset.key===key)return;
 list.dataset.key=key;list.textContent='';
 let start=firstStart;
 for(const [index,task] of queue.entries()){
  const row=document.createElement('li'),info=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');
  const region=state.regions.find(r=>r.id===task.regionId);
  const option=COUNCIL_DIRECTIONS[direction].tasks[task.action];
  title.textContent=(region?.city||'Герцогство')+' · '+option.label;
  const available=!!councilTaskRegion(state,task);
  const term=option.ongoing?'Бессрочно · бесплатно':option.free?'30 дней · бесплатно':councilGold(task.rate)+' зл.';
  const timing=!available?'герцогство недоступно':start===Infinity?'после смены поручения':'с '+councilDeadline(start);
  detail.textContent=term+' · '+timing;
  if(available)start=option.ongoing?Infinity:councilMonthEnd(start);
  info.className='council-entry';info.appendChild(title);info.appendChild(detail);row.appendChild(info);
  for(const [icon,label,offset,disabled] of [['up','Выше в очереди',-1,index===0],['down','Ниже в очереди',1,index===queue.length-1],['close','Убрать из очереди',0,false]]){
   const button=document.createElement('button');
   button.type='button';button.className='council-icon-button';button.innerHTML=councilIcon(icon);
   button.title=label;button.disabled=disabled;
   button.setAttribute('aria-label',label+' · '+title.textContent);
   button.onclick=()=>{if(editCouncilTaskQueue(state,direction,task.id,offset))updateCouncil();else if(offset)flash('Такой порядок превышает доход Совета')};
   row.appendChild(button);
  }
  list.appendChild(row);
 }
}
function updateCouncilTask(council,income){
 const now=state.economy.seconds,{net,committed,free}=income;
 for(const [key,value] of [['net',net],['committed',committed],['free',free]]){
  const label=$('council-income-'+key);
  label.textContent=councilGold(value)+' зл./мин';
  label.classList.toggle('negative',value<0);
 }
 for(const tab of councilTabs){
  const button=$('council-tab-'+tab),active=!!council.monthly[tab];
  button.dataset.task=String(active);
  button.setAttribute('aria-label',COUNCIL_DIRECTIONS[tab].name+(active?', поручение выполняется':''));
 }
 const role=COUNCIL_DIRECTIONS[councilTab],draft=councilDrafts.get(councilTab)||{};
 const action=role.tasks[draft.action]?draft.action:Object.keys(role.tasks)[0];
 const actions=$('council-task-actions');
 if(actions.dataset.role!==councilTab){
  actions.dataset.role=councilTab;actions.dataset.action='';actions.textContent='';
  for(const [key,option] of Object.entries(role.tasks)){
   const button=document.createElement('button');button.type='button';button.className='advisor-action';
   button.dataset.action=key;button.title=option.description;
   button.innerHTML=councilIcon(option.icon)+'<span>'+option.label+'</span>';
   button.onclick=()=>{councilDrafts.set(councilTab,{...councilDrafts.get(councilTab),action:key});updateCouncil();};
   actions.appendChild(button);
  }
 }
 if(actions.dataset.action!==action){
  actions.dataset.action=action;
  for(const button of actions.children)button.setAttribute('aria-pressed',String(button.dataset.action===action));
 }
 const selectedOption=role.tasks[action];
 $('council-task-description').textContent=selectedOption.description;
 const task=council.monthly[councilTab],receipt=council.previousMonthly[councilTab];
 renderCouncilTaskQueue(council,councilTab,task?.end??now);
 $('council-task-active').hidden=!task;
 $('council-task-receipt').hidden=!!task||!receipt;
 if(task){
  const region=councilTaskRegion(state,task);
  const option=role.tasks[task.action],icon=$('council-active-icon');
  if(icon.dataset.action!==option.icon){icon.dataset.action=option.icon;icon.innerHTML=councilIcon(option.icon)}
  $('council-task-city').textContent=region?.city||'Герцогство недоступно';
  $('council-active-action').textContent=option.label;
  $('council-task-end').textContent=option.ongoing?'До смены':'До '+councilDeadline(task.end);
  $('council-task-progress-group').hidden=!!option.ongoing;
  if(!option.ongoing){
   const progress=$('council-task-progress'),funding=$('council-task-funding'),detail=$('council-funding-detail');
   if(option.free){
    progress.max=30;progress.value=Math.min(30,Math.floor((now-task.start)/SECONDS_PER_GAME_DAY));
    progress.setAttribute('aria-label','Открытие посольства');
    $('council-progress-caption').textContent='Открытие посольства';
    funding.textContent=progress.value+' / 30 дн.';
    detail.hidden=true;
   }else{
    progress.max=task.rate;progress.value=task.funded;
    progress.setAttribute('aria-label','Финансирование поручения');
    $('council-progress-caption').textContent='Получено';
    funding.textContent=councilGold(task.funded)+' / '+councilGold(task.rate)+' зл.';
    detail.textContent='Потрачено '+councilGold(task.funded-task.gold)+' · в запасе '+councilGold(task.gold)+' зл.';
    detail.hidden=false;
   }
  }
  $('council-task-status').textContent=task.status;
  $('council-task-work').hidden=!task.lastAction;
  $('council-task-work').textContent=task.lastAction?'Последнее действие · '+task.lastAction:'';
 }
 if(receipt){
  const outcome={finished:receipt.action==='embassy'?'Посольство открыто':'Месяц завершён',
   cancelled:'Поручение отменено',reassigned:'Поручение сменено',lost:'Поручение прервано'};
  const summary=receipt.lastAction||receipt.status;
  const budget=receipt.rate?' · потрачено '+councilGold(receipt.spent)+' зл. · возвращено '+councilGold(receipt.returned)+' зл.':'';
  $('council-task-receipt').textContent=outcome[receipt.reason]+' · '+receipt.city+budget+(summary?' · '+summary:'');
 }
 const rateInput=$('council-task-rate');
 if(document.activeElement!==rateInput)rateInput.value=draft.rate||'';
 const limit=selectedOption.free?0:councilBudgetLimit(state,councilTab);
 const rate=Number(rateInput.value),marketOrder=councilTab==='marshal'&&action==='recruit';
 const minimum=marketOrder?marshalMarketPrice(MARSHAL_RECRUIT_STEP).total:1;
 const valid=Number.isSafeInteger(rate)&&rate>=minimum&&rate<=limit;
 rateInput.min=String(minimum);rateInput.max=String(limit);
 $('council-task-budget').hidden=!!selectedOption.free;
 rateInput.disabled=!!selectedOption.free;
 $('council-task-start').disabled=!selectedOption.free&&!valid;
 $('council-budget-decrease').disabled=!valid||rate<=minimum;
 $('council-budget-increase').disabled=rate>=limit;
 const duration=selectedOption.ongoing?'Без бюджета, до смены поручения.':
  selectedOption.free?'Без бюджета, 30 игровых дней.':'Лимит поручения '+councilGold(limit)+' зл./мин после содержания войск. Остаток вернётся в казну.';
 const schedule=task?.end===Infinity?' Новое поручение сразу заменит текущее.':
  task?' Следующее поручение встанет в очередь.':'';
 const full=marketOrder?marshalMarketPrice(RECRUIT_BATCH):null;
 const possible=full&&rate>=minimum?Math.floor(rate/full.total)*RECRUIT_BATCH+marshalAffordableTroops(rate%full.total):0;
 const math=full?' Сто солдат стоят '+full.total+' зл., из них '+full.materials+' зл. на железо и ткани.'+
  (possible?' При таком бюджете — до '+possible+' солдат, если есть люди и места в очереди.':''):'';
 $('council-task-preview').textContent=duration+schedule+math;
 const blocker=!selectedOption.free&&!valid?(limit<minimum?'Свободный доход '+limit+' зл./мин. Нужно ещё '+(minimum-limit)+' зл./мин для поручения.':
  rate>limit?'Бюджет превышает лимит на '+(rate-limit)+' зл. Укажите до '+limit+' зл.':
  'Укажите бюджет от '+minimum+' до '+limit+' зл.'+(rate>0?' Не хватает '+(minimum-rate)+' зл. до минимума.':'')):'';
 explainAction($('council-task-start'),selectedOption.label,blocker||
  (marketOrder?'Мировой рынок · железо '+TRADE_PRICE.iron+' зл., ткани '+TRADE_PRICE.cloth+' зл. за ед. '+math.trim():duration));
 if(!selectedOption.free)explainAction(rateInput,'Месячный бюджет',blocker||duration+math);
}
function updateCouncil(income=null){
 const council=state.council,toggle=$('council-toggle');
 toggle.hidden=!state.started||!council||state.defeated;
 if(toggle.hidden){showCouncil(false);return}
 if($('council-panel').hidden)return;
 if(councilMapOrder){
  const targets=councilMapTargets(councilMapOrder.direction,councilMapOrder.action);
  if(targets.size!==councilMapOrder.targets.size||[...targets].some(id=>!councilMapOrder.targets.has(id))){
   councilMapOrder.targets=targets;dirtyLabels=true;
  }
  return;
 }
 if(councilTab==='vassals'){renderCouncilVassals();return}
 $('council-vassals').hidden=true;
 $('council-task-form').hidden=false;
 updateCouncilTask(council,income||treasuryIncomeReport());
}
function renderCouncilVassals(){
 $('council-vassals').hidden=false;
 $('council-task-form').hidden=true;
 $('council-task-active').hidden=true;
 $('council-task-queue').hidden=true;
 $('council-task-receipt').hidden=true;
 const vassals=[...(state.vassals?.values()||[])].filter(v=>v.owner==='you');
 $('council-vassals-empty').hidden=vassals.length>0;
 const list=$('council-vassals-list'),key=vassals.map(v=>v.id+':'+(v.tier||'fief')+':'+Math.round(v.gold)).join(',');
 if(list.dataset.key===key)return;
 list.dataset.key=key;
 list.replaceChildren(...vassals.map(vassal=>{
  const row=document.createElement('button');
  row.type='button';row.className='realm-overview-row';row.dataset.vassalId=vassal.id;
  row.style.borderLeftColor='rgb('+(vassal.color||[.9,.85,.6]).map(v=>Math.round(v*255)).join(',')+')';
  const strong=document.createElement('strong'),span=document.createElement('span'),small=document.createElement('small');
  row.append(strong,span,small);
  return row;
 }));
 for(const row of list.children){
  const vassal=state.vassals.get(Number(row.dataset.vassalId));
  if(!vassal)continue;
  const lands=vassal.lands.map(id=>councilRegion(state,id,'you')).filter(Boolean);
  const tier=vassalTierInfo(vassal),promotion=vassalPromotionCheck(state,vassal,'you');
  const troops=lands.reduce((n,r)=>n+(state.garrisons?.[r.id]?.owner==='you'?state.garrisons[r.id].troops||0:0),0);
  row.children[0].replaceChildren();
  row.children[0].insertAdjacentHTML('afterbegin',heraldryShield('vassal:'+vassal.id,16));
  row.children[0].append(vassalDisplayName(state,vassal)+' · '+vassalSpecializationLabel(vassal));
  row.children[1].textContent='Титул «'+tier.name+'» · земли '+lands.map(r=>r.name).join(', ')+' · гарнизоны '+troops+' · дружина '+(generalArmy(state,vassal.owner,1,vassal.id)?.troops||0);
  row.children[2].textContent='Казна '+councilGold(vassal.gold)+' зл. · '+(vassal.militaryStatus?vassal.militaryStatus+' · ':'')+(promotion.next?'до «'+promotion.next.name+'»: '+(promotion.ok?'повышение':promotion.reason.replace('Нужно: ','')):vassal.status);
  row.onclick=()=>{
   const region=councilRegion(state,vassal.seatId,'you');
   if(!region)return;
   showCouncil(false);
   setSelected(region,'overview');
   $('duchy-vassal').open=true;
   if(region.slots[0]){cam.x=region.slots[0].x;cam.z=region.slots[0].z;dirtyLabels=true}
  };
 }
}

for(const [id,icon] of [['council-title-icon','scroll'],['council-income-icon','coins'],['council-committed-icon','parley'],
 ['council-free-icon','coins'],['council-map-button-icon','pin'],['council-close','close'],['council-cancel-icon','close']])
 $(id).innerHTML=councilIcon(icon);
$('council-toggle').onclick=()=>showCouncil($('council-panel').hidden);
$('council-close').onclick=()=>showCouncil(false);
for(const role of councilTabs){
 const button=$('council-tab-'+role),advisor=COUNCIL_DIRECTIONS[role];
 button.innerHTML=advisorEmblem(role)+'<span><strong>'+advisor.name+'</strong><small>'+advisor.field+'</small></span>';
 button.onclick=()=>showCouncilTab(role);
}
$('council-tab-vassals').innerHTML=advisorEmblem('vassals')+'<span><strong>Вассалы</strong><small>Дома державы</small></span>';
$('council-tab-vassals').onclick=()=>showCouncilTab('vassals');
const councilBudgetInput=$('council-task-rate');
councilBudgetInput.oninput=()=>{
 councilDrafts.set(councilTab,{...councilDrafts.get(councilTab),rate:councilBudgetInput.value});
 updateCouncil();
};
for(const [id,step] of [['council-budget-decrease',-5],['council-budget-increase',5]]){
 $(id).onclick=()=>{
  const current=Number(councilBudgetInput.value);
  const limit=Number(councilBudgetInput.max);
  if(limit<1)return;
  const min=Number(councilBudgetInput.min)||1;
  councilBudgetInput.value=String(Math.min(limit,Math.max(min,(Number.isSafeInteger(current)?current:0)+step)));
  councilBudgetInput.oninput();
 };
}
$('council-task-form').onsubmit=event=>{
 event.preventDefault();
 const role=COUNCIL_DIRECTIONS[councilTab],action=councilDrafts.get(councilTab)?.action||Object.keys(role.tasks)[0];
 const rate=role.tasks[action].free?0:Number($('council-task-rate').value);
 const min=councilTab==='marshal'&&action==='recruit'?marshalMarketPrice(MARSHAL_RECRUIT_STEP).total:1;
 if(!role.tasks[action].free&&(!Number.isSafeInteger(rate)||rate<min||rate>councilBudgetLimit(state,councilTab)))return;
 openCouncilMapPicker(councilTab,action,rate);
};
$('council-map-cancel').onclick=()=>{closeCouncilMapPicker(true);updateCouncil();};
$('council-task-cancel').onclick=()=>{
 if(cancelCouncilTask(state,councilTab))updateUI();
};

const DUCHY_TABS=['overview','economy','counties','army','relations'];
let duchyTab='overview';
function duchyDefaultTab(region){
 return state.started&&region&&region.owner!=='you'?'relations':'overview';
}
function duchyAvailableTabs(region){
 if(!region)return [];
 const owned=state.started&&region.owner==='you',fort=state.fortifications?.has(region.id);
 return ['overview',...(owned?['economy']:[]),'counties',...(owned||fort?['army']:[]),
  ...(state.started&&!owned?['relations']:[])];
}
function duchyAlertTab(id){
 return {food:'economy',housing:'overview',guard:'army',unrest:'economy'}[id]||'overview';
}
function revealDuchyControl(){
 const details=$('duchy-control-details');
 details.open=true;
 details.scrollIntoView?.({block:'nearest'});
}
function openDuchyAlert(region,id){
 setSelected(region,duchyAlertTab(id));
 if(id==='unrest')revealDuchyControl();
}
function selectDuchyTab(key,focus=false){
 hideActionExplanation();
 if(!duchyAvailableTabs(state.selected).includes(key))return;
 if(duchyTab!==key)$('duchy-pages').scrollTop=0;
 duchyTab=key;
 updateDuchyCard(state.selected);
 if(focus)$('duchy-tab-'+key).focus?.();
}
function updateDuchyTabs(region){
 const available=duchyAvailableTabs(region);
 if(!available.includes(duchyTab)){
  duchyTab=duchyDefaultTab(region);
  $('duchy-pages').scrollTop=0;
 }
 for(const key of DUCHY_TABS){
  const button=$('duchy-tab-'+key),active=key===duchyTab;
  button.hidden=!available.includes(key);
  button.tabIndex=active?0:-1;
  button.setAttribute('aria-selected',String(active));
  $('duchy-pane-'+key).hidden=!active;
 }
}
for(const key of DUCHY_TABS){
 const tab=$('duchy-tab-'+key);
 tab.onclick=()=>selectDuchyTab(key);
 tab.onkeydown=event=>{
  const available=duchyAvailableTabs(state.selected),index=available.indexOf(key);
  if(index<0)return;
  const next={ArrowDown:(index+1)%available.length,ArrowUp:(index+available.length-1)%available.length,Home:0,End:available.length-1}[event.key];
  if(next==null)return;
  event.preventDefault();event.stopPropagation();
  selectDuchyTab(available[next],true);
 };
}
for(const element of document.querySelectorAll('[data-duchy-icon]')){
 const key=element.dataset.duchyIcon;
 element.innerHTML=['grain','population'].includes(key)?resourceGlyph(key):councilIcon(key);
}
$('card-quick').onclick=event=>{
 const button=event.target.closest?.('[data-duchy-open]');
 if(!button)return;
 selectDuchyTab(button.dataset.duchyOpen,true);
 if(button.hasAttribute('data-show-control'))revealDuchyControl();
};
$('duchy-public-counties-open').onclick=()=>selectDuchyTab('counties',true);
$('buildings-list').onclick=event=>{
 const id=event.target.closest?.('[data-duchy-building]')?.dataset.duchyBuilding;
 const region=state.selected,building=id==null?null:region?.buildings.find(item=>item.slotId===Number(id));
 if(region?.owner==='you'&&building)inspectMapBuilding(region,building);
};
function updateDuchyCardHeader(region){
 const own=region.owner==='you',rebel=state.factions?.[region.owner]?.isRebel;
 $('card').dataset.atlas=GAME_MAP?'mediterranean':'baltic';
 $('type').textContent=region.owner==='neutral'?'Нейтральное герцогство':countryName(region.owner);
 $('name').textContent=region.name;
 const shield=$('duchy-card-crest'),crestKey=region.owner+':'+(region.id===state.capitalId);
 if(shield.dataset.crest!==crestKey){
  shield.dataset.crest=crestKey;
  shield.style.setProperty('--faction-crest',FACTION_COLORS[region.owner]?factionCss(region.owner):'#607b77');
  shield.innerHTML=rebel?rebelCrest(region.owner):heraldryShield(region.owner+':'+region.id,40);
 }
 const tags=[region.city,own&&region.id===state.capitalId?'столица державы':null,region.coast?'побережье':null];
 const caption=capitalStars(region)+tags.filter(Boolean).join(' · '),desc=$('desc');
 if(desc.dataset.caption!==caption){desc.dataset.caption=caption;desc.innerHTML=caption;}
}
function updateVassalGift(vassal){
 const input=$('duchy-vassal-amount'),button=$('duchy-vassal-send');
 const check=vassalGiftCheck(state,vassal,input.valueAsNumber);
 button.disabled=!check.ok;
 const reason=input.value&&!check.ok?check.reason:'';
 button.title=reason||'Перевести золото из казны державы';
 $('duchy-vassal-gift-reason').textContent=reason;
}
function eligibleVassals(region){
 return [...(state.vassals?.values()||[])].filter(candidate=>vassalGrantCheck(state,region,candidate.id).ok);
}
function vassalAssignmentOption(vassal){
 return new Option(vassalDisplayName(state,vassal)+' · '+vassalSpecializationLabel(vassal)+' ('+vassal.lands.length+'/'+vassalTierInfo(vassal).capacity+')',String(vassal.id));
}
const occupationDialog=$('occupation-choice');
function updateOccupationChoice(region){
 if(state.defeated||region?.owner!=='you'||!region.awaitingAdministration){
  if(occupationDialog.open)occupationDialog.close();
  return false;
 }
 const select=$('occupation-vassal'),eligible=eligibleVassals(region);
 const key=eligible.map(vassal=>vassal.id+':'+vassal.tier+':'+vassal.lands.length).join(',');
 if(select.dataset.options!==key){
  const selected=select.value;
  const empty=eligible.length?'Выберите вассала':'Нет вассалов со свободным владением';
  select.replaceChildren(new Option(empty,''),...eligible.map(vassalAssignmentOption));
  select.value=eligible.some(vassal=>String(vassal.id)===selected)?selected:'';
  select.disabled=!eligible.length;
  select.dataset.options=key;
 }
 const {direct,capacity}=realmAdministration(state,'you');
 const impact=$('occupation-domain-impact');
 impact.textContent='Домен '+(direct+1)+' / '+capacity+(direct>=capacity?' · превысит лимит':' · займёт одно место');
 impact.classList.toggle('domain-overloaded',direct>=capacity);
 $('occupation-title').textContent=region.name;
 $('occupation-local').disabled=!vassalGrantCheck(state,region).ok;
 $('occupation-transfer').disabled=!select.value;
 return true;
}
function openOccupationChoice(region){
 if(!$('campaign-finale').hidden||recapPlayback||!updateOccupationChoice(region)||occupationDialog.open)return;
 $('occupation-vassal').value='';
 $('occupation-transfer').disabled=true;
 $('occupation-error').hidden=true;
 clearCameraInput();
 occupationDialog.showModal();
}
function confirmOccupationChoice(choice){
 const region=state.selected,id=$('occupation-vassal').value;
 const result=administerCapturedDuchy(state,region,choice,id?Number(id):null);
 if(!result.ok){
  $('occupation-error').textContent=result.reason;
  $('occupation-error').hidden=false;
  updateOccupationChoice(region);
  return;
 }
 occupationDialog.close();
 const name=result.vassal?vassalDisplayName(state,result.vassal):'прямое управление';
 flash(region.name+' · '+name);
 updateUI();
}
$('occupation-later').onclick=()=>occupationDialog.close();
$('occupation-domain').onclick=()=>confirmOccupationChoice('domain');
$('occupation-local').onclick=()=>confirmOccupationChoice('local');
$('occupation-transfer').onclick=()=>confirmOccupationChoice('vassal');
$('occupation-vassal').onchange=()=>{$('occupation-transfer').disabled=!$('occupation-vassal').value};
$('duchy-occupation-choice').onclick=()=>openOccupationChoice(state.selected);
function updateDuchyVassal(region){
 const panel=$('duchy-vassal'),vassal=vassalFor(state,region);
 const own=region.owner==='you';
 panel.hidden=!state.started||region.awaitingAdministration||!vassal&&(!own||!vassalGrantCheck(state,region).ok);
 if(panel.hidden)return;
 const select=$('duchy-vassal-select'),regionKey=String(region.id);
 if(panel.dataset.region!==regionKey){
  panel.dataset.region=regionKey;panel.open=!!vassal&&own;
  select.value='';$('duchy-vassal-amount').value='';
 }
 $('duchy-vassal-title').textContent=vassal?vassalDisplayName(state,vassal)+' · '+vassalSpecializationLabel(vassal):'Передать вассалу';
 $('duchy-vassal-grant').hidden=!!vassal;
 $('duchy-vassal-account').hidden=!vassal;
 $('duchy-vassal-gift').hidden=!own;
 $('duchy-vassal-finances').hidden=!own;
 if(vassal){
  const lands=vassal.lands.map(id=>councilRegion(state,id,region.owner)).filter(Boolean);
  const tier=vassalTierInfo(vassal),promotion=vassalPromotionCheck(state,vassal,region.owner);
  $('duchy-vassal-lands').textContent=lands.map(land=>land.name).join(' · ')+' ('+lands.length+'/'+tier.capacity+') · титул «'+tier.name+'»';
  if(!own)return;
  const income=lands.reduce((sum,land)=>sum+duchyTax(state,land)*VASSAL_SHARE,0);
  const upkeep=vassalArmyUpkeep(state,vassal);
  $('duchy-vassal-treasury').textContent='Казна '+councilGold(vassal.gold)+' зл. · налоги +'+councilGold(income)+' зл./мин'+
   (upkeep?' · содержание −'+councilGold(upkeep)+' зл./мин':'')+' · дружина '+(generalArmy(state,vassal.owner,1,vassal.id)?.troops||0)+
   (vassal.militaryStatus?' · '+vassal.militaryStatus:'');
  const grain=state.economy.granaries?lands.reduce((sum,land)=>sum+granaryStock(state,land.id),0):vassal.stocks.grain;
  $('duchy-vassal-stocks').innerHTML=[...GOODS,'equipment'].map(good=>{
   const value=councilGold(good==='grain'?grain:vassal.stocks[good]);
   return `<span title="${GOODS_LABELS[good]||'Снаряжение'}">${resourceGlyph(good)} ${value}</span>`;
  }).join('');
 $('duchy-vassal-status').textContent=[vassal.status,vassal.recruitmentStatus].filter(Boolean).join(' · ')+(promotion.next
   ?' · до титула «'+promotion.next.name+'»: '+(promotion.ok?'повышение':promotion.reason.replace('Нужно: ',''))
   :'');
  const last=vassal.lastAction;
  $('duchy-vassal-last-action').textContent=last?'Последние расходы · '+last.label.toLowerCase()+' · '+last.city+' · '+councilGold(last.cost)+' зл.':'';
  updateVassalGift(vassal);
  return;
 }
 const eligible=eligibleVassals(region);
 const key=eligible.map(candidate=>candidate.id).join(',');
 if(select.dataset.options!==key){
  const previous=select.value;
  select.replaceChildren(new Option('Назначить из местных', ''),...eligible.map(vassalAssignmentOption));
  select.value=eligible.some(candidate=>String(candidate.id)===previous)?previous:'';
  select.dataset.options=key;
 }
 $('duchy-vassal-appoint-label').textContent=select.value?'Передать второе герцогство':'Назначить вассала';
}
$('duchy-vassal-select').onchange=()=>updateDuchyVassal(state.selected);
$('duchy-vassal-appoint').onclick=()=>{
 const region=state.selected,id=$('duchy-vassal-select').value;
 const result=grantVassalDuchy(state,region,id?Number(id):null);
 if(!result.ok){flash(result.reason);return}
 flash(region.name+' · назначен вассал');updateUI();
};
$('duchy-vassal-amount').oninput=()=>updateVassalGift(vassalFor(state,state.selected));
$('duchy-vassal-gift').onsubmit=event=>{
 event.preventDefault();
 const input=$('duchy-vassal-amount'),amount=input.valueAsNumber;
 const result=giftVassalGold(state,vassalFor(state,state.selected),amount);
 if(!result.ok){flash(result.reason);return}
 input.value='';flash('Вассалу передано '+amount+' зл.');updateUI();
};
function updateDuchyOverview(region){
 const own=region.owner==='you';
 $('card-quick').hidden=!own;
 $('duchy-public-overview').hidden=own;
 if(!own)$('duchy-public-counties').textContent='Занятые графства · '+region.buildings.length+' / '+region.slots.length;
 if(own){
  const stability=duchyStability(region,cityDefenders.get(region.id));
  const residents=regionalPopulation(region),housing=region.buildings.reduce((sum,b)=>sum+cityHousing(b),0);
  const fmt=n=>Math.floor(n).toLocaleString(interfaceLocale);
  $('duchy-quick-population').innerHTML=fmt(residents)+' / '+fmt(housing)+' '+populationArrows(region);
  $('duchy-quick-stability').textContent=stability+'%';
  $('duchy-quick-stability').title=stabilityHint(region,stability);
  $('duchy-quick-counties').textContent=region.buildings.length+' / '+region.slots.length;
  $('duchy-quick-garrison').textContent=fmt(state.garrisons?.[region.id]?.troops||0);
 }
 const alerts=(cityAlerts.get(region.id)||[]).filter(alert=>alert.id!=='guard'),strip=$('duchy-quick-alerts');
 strip.hidden=!alerts.length;
 const key=alerts.map(alert=>alert.id).join(',');
 if(strip.dataset.alerts!==key){
  strip.dataset.alerts=key;strip.textContent='';
  for(const alert of alerts){
   const button=document.createElement('button');button.type='button';
   button.innerHTML=alert.icon()+'<span>'+alert.label+'</span>';
   button.onclick=()=>{
    selectDuchyTab(duchyAlertTab(alert.id),true);
    if(alert.id==='unrest')revealDuchyControl();
   };
   strip.appendChild(button);
  }
 }
 $('duchy-occupation-choice').hidden=!own||!region.awaitingAdministration;
 updateDuchyVassal(region);
 updateDuchyCity(region);
 $('realm-panel').hidden=!state.started||!own||region.id!==state.capitalId;
 updateRealmPanel(region);
}
function updateDuchyCounties(region){
 const own=region.owner==='you',workforce=workforceReport(region);
 $('card-slots').textContent=region.buildings.length+' / '+region.slots.length;
 const bar=$('slots-bar');bar.max=Math.max(1,region.slots.length);bar.value=region.buildings.length;
 const terrain=terrainSummary.get(region.id)||{},total=Object.values(terrain).reduce((sum,count)=>sum+count,0);
 $('terrain-list').innerHTML=Object.entries(terrain).filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
  const percent=Math.round(count/total*100);
  return `<div data-terrain="${type}"><span>${LAND_NAMES[type]}</span><b>${percent}%</b><progress aria-label="${LAND_NAMES[type]}" max="100" value="${percent}"></progress></div>`;
 }).join('');
 const list=$('buildings-list'),markup=region.buildings.map(building=>{
  const {type}=building,rate=productionRate(region,building,workforce).toFixed(1);
  const title=TYPES[type].name+(building.capital?' · столица':'');
  const detail=building.product?`Ур. ${building.level||1} · ${building.route?rate+' ед./мин':'нет пути'}`:
   type==='city'?Math.floor(building.population||0).toLocaleString(interfaceLocale)+' жителей':'';
  const tag=own?'button':'div',attr=own?` type="button" data-duchy-building="${building.slotId}"`:'';
  return `<li><${tag}${attr}><i><svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[type]}</svg></i><span><b>${title}</b><small>${detail}</small></span></${tag}></li>`;
 }).join('')||'<li class="duchy-empty">Построек пока нет.</li>';
 if(list.dataset.content!==markup){list.dataset.content=markup;list.innerHTML=markup}
}
function updateDuchyCard(region){
 updateDuchyTabs(region);
 updateDuchyCardHeader(region);
 if(duchyTab==='overview')updateDuchyOverview(region);
 else if(duchyTab==='economy'){updateDuchyStores(region);updateRegionalEconomy(region);}
 else if(duchyTab==='counties')updateDuchyCounties(region);
 else if(duchyTab==='army'){updateDuchyDefense(region);updateRecruitment(region);}
 else{updatePetition(region);updateWarPanel(region);}
 if(duchyTab==='overview')useActionTitles([
  ['duchy-city-repair','Восстановление города','Ремонт стоит '+SEAT_REPAIR_GOLD+' зл.'],
  ['duchy-city-aid','Помощь жителям','Отправляет зерно из столицы'],['realm-promote','Ранг державы',$('realm-requirements').textContent]]);
 if(duchyTab==='economy')useActionTitles([
  ['relief-send','Помощь жителям','Доставит 6 ед. зерна за 20 зл.'],['duchy-market-build','Торговый центр',$('duchy-market-stock').textContent]]);
 if(duchyTab==='army')useActionTitles([
  ['recruit-soldiers','Ручной набор',$('recruit-reason').textContent],['duchy-armory-build','Оружейная мастерская',$('duchy-armory-status').textContent],
  ['fortification-build','Укрепление границы',$('fortification-requirements').textContent]]);
 if(duchyTab==='relations')useActionTitles([
  ['petition-send','Поселение',$('petition-status').textContent],['occupy-neutral','Занятие герцогства',$('occupy-neutral-hint').textContent],
  ['diplomacy-envoy','Отправить посланника',$('diplomacy-hint').textContent],
  ['diplomacy-ally','Заключить союз',$('diplomacy-hint').textContent],['diplomacy-harbor','Портовая концессия',
   state.gold<HARBOR_CHARTER_COST?'Не хватает '+Math.ceil(HARBOR_CHARTER_COST-state.gold)+' зл.':$('diplomacy-hint').textContent],
  ['war-declare','Объявление войны',$('war-status').textContent]]);
}
function summaryDuchy(){
 return state.selected?.owner==='you'?state.selected:state.regions.find(region=>region.id===state.capitalId);
}
const seatSummaryButton=$('seat-summary-open');
seatSummaryButton.onclick=()=>{
 const region=summaryDuchy();
 if(region)setSelected(state.selected===region?null:region);
};
function updateSettlementDock(){
 const region=summaryDuchy(),dock=seatSummaryButton.closest('.settlement-dock');
 dock.hidden=!state.started||state.defeated||!region;
 if(dock.hidden)return;
 const crest=$('seat-summary-crest');
 if(crest.dataset.region!==String(region.id)){
  crest.dataset.region=String(region.id);
  crest.innerHTML=heraldryShield('realm:'+region.id,23);
  $('seat-summary-name').textContent=region.city;
 }
 seatSummaryButton.setAttribute('aria-expanded',String(state.selected===region));
 const stability=duchyStability(region,cityDefenders.get(region.id));
 const control=$('seat-summary-control');
 control.textContent=stability+'%';
 control.dataset.level=stability<=50?'critical':stability<70?'warning':'normal';
 $('seat-summary-population').textContent=Math.floor(duchyPopulation(region)).toLocaleString(interfaceLocale);
}
function updateUI(){slotMarkerRevision++;if(state.started&&!state.defeated)syncMapStats();const income=treasuryIncomeReport(),domain=realmAdministration(state,'you');renderCampaignPanel();updateMuster();updateSettlementDock();updateRealmOverview(domain);updateCouncil(income);if(selectedBuilding)updateBuildingDetails();let slotState=mode?mode+':'+(state.gold>=TYPES[mode].cost):'';if(slotState!==lastSlotAffordability){lastSlotAffordability=slotState;dirtyLabels=true;if(mode&&hover)updateGhost(hover)}updateBattlePanel();$('traffic-legend').hidden=!state.started||!state.economy?.roadTraffic?.size;updateToolAffordability();let d=gameDate(state.economy?.seconds||0);$('game-date').textContent=globalThis.gameI18n?.date(d)??(d.day+' '+MONTHS_RU[d.month]+' '+d.year+' г.');updateTreasury(income);
 $('realm-label').textContent='ДОМЕН';
 const domainCount=$('lands'),domainButton=$('domain-shortcut');
 domainCount.textContent=state.started?domain.direct+' / '+domain.capacity:'0';
 domainButton.classList.toggle('domain-overloaded',domain.excess>0);
 domainButton.title=domain.excess?'Сверх лимита '+domain.excess+' · выпуск и налоги прямого домена −'+Math.round((1-domain.yieldFactor)*100)+'%. Лишние земли теряют контроль. Нажмите, чтобы увидеть список.':'Прямое управление '+domain.direct+' из '+domain.capacity+' земель. Владения вассалов не занимают места в домене.';
 explainAction(domainButton,'Лимит домена',domainButton.title);
 renderRealmPower();let r=state.selected;$('card').hidden=!r;$('slots').textContent=r&&r.owner==='you'?r.buildings.length+' / '+r.slots.length:'—';
 updateResources();
 if(r)updateDuchyCard(r);
 if(occupationDialog.open)updateOccupationChoice(r);
}

// A compact, live ledger makes governance actionable without obscuring the map.
const realmOverviewRows=new Map();
const realmFilters=['all','vassals','grain','markets','food','cut','ports'];
let realmFilter='all';
for(const filter of realmFilters){
 $('realm-'+filter).onclick=()=>{
  realmFilter=filter;
  for(const key of realmFilters) $('realm-'+key).setAttribute('aria-pressed',String(key===filter));
  updateRealmOverview();
 };
}

function collectPortQueues(owned){
 const waiting=new Map();
 for(const region of owned){
  for(const building of region.buildings){
   const portId=building.route?.seaSupply?.departureId;
   const amount=Math.max(0,building.produced||0);
   if(portId!=null&&amount) waiting.set(portId,(waiting.get(portId)||0)+amount);
  }
 }
 return waiting;
}

function updateNavalLosses(){
 const list=$('naval-losses-list');
 const losses=(state.economy.navalLosses||[]).filter(loss=>loss.owner==='you'||loss.attacker==='you').slice(-10);
 const signature=losses.map(loss=>[loss.owner,loss.point.x,loss.point.z,loss.time,loss.value].join(':')).join('|');
 if(list.dataset.signature===signature) return;
 list.dataset.signature=signature;
 list.textContent='';
 if(!losses.length) list.textContent='Потерь и перехватов ещё нет';
 for(const loss of losses.reverse()){
  const button=document.createElement('button');
  button.type='button';
  button.className='naval-loss-row';
  button.textContent=(loss.owner==='you'?'Потеряно · ':'Перехвачено · ')+describeNavalLoss(loss);
  button.onclick=()=>{
   cam.x=loss.point.x;cam.z=loss.point.z;dirtyLabels=true;
   $('realm-overview').hidden=true;
   $('realm-overview-toggle').setAttribute('aria-expanded','false');
  };
  list.appendChild(button);
 }
}

const granaryRows=new Map();
const marketRows=new Map();
function marketStatus(region){
 const market=region.market;
 if(!market.ready)return 'Откроется через '+Math.max(1,Math.ceil((market.readyAt-state.economy.seconds)/SECONDS_PER_GAME_DAY))+' дн.';
 if(market.policy==='capital')return market.transferBlocked?'Дорога к столице перекрыта':'Пополняет запасы столицы';
 const latest=market.lastBuyer?' · последний покупатель: '+countryName(market.lastBuyer):'';
 return (market.transferBlocked?'Дорога из столицы перекрыта':'Получает товары из столицы для экспорта')+' · рейсов: '+market.sales+' · '+Math.floor(market.revenue)+' зл.'+latest;
}
function marketStockText(market){
 return 'Древесина '+Math.floor(market.stocks.wood)+' · железо '+Math.floor(market.stocks.iron)+' · ткани '+Math.floor(market.stocks.cloth);
}
function writeMarketPolicy(button,market){
 button.hidden=!market?.ready;
 if(button.hidden)return;
 const supplies=market.policy==='capital';
 button.textContent=supplies?'Режим: в столицу':'Режим: экспорт';
 button.setAttribute('aria-pressed',String(supplies));
 button.title=supplies?'Переключить на экспорт складских товаров':'Переключить на отправку складских товаров в столицу';
}
function toggleMarketPolicy(region){
 const market=tradeCenter(state,region?.id)?.market;
 if(!market)return;
 market.policy=market.policy==='capital'?'export':'capital';
 market.nextTransfer=0;
 refreshCapitalRoutes(false,new Set(['you']));
 updateUI();
}
function updateTradeCenters(owned){
 const list=$('realm-markets-list'),markets=owned.filter(r=>r.market);
 const ids=new Set(markets.map(region=>region.id));
 for(const [id,entry] of marketRows)if(!ids.has(id)){entry.row.remove();marketRows.delete(id)}
 for(const region of markets){
  let entry=marketRows.get(region.id);
  if(!entry){
   const row=document.createElement('article'),open=document.createElement('button'),name=document.createElement('strong');
   const stock=document.createElement('span'),info=document.createElement('small'),policy=document.createElement('button');
   row.className='granary-row';open.type=policy.type='button';
   open.appendChild(name);open.appendChild(stock);open.appendChild(info);row.appendChild(open);row.appendChild(policy);
   open.onclick=()=>{
    const land=state.regions.find(r=>r.id===region.id&&r.owner==='you');
    if(!land)return;
    $('realm-overview-close').onclick();setSelected(land,'economy');
    cam.x=land.slots[0].x;cam.z=land.slots[0].z;dirtyLabels=true;
   };
   policy.onclick=()=>toggleMarketPolicy(state.regions.find(r=>r.id===region.id));
   entry={row,name,stock,info,policy};marketRows.set(region.id,entry);list.appendChild(row);
  }
  entry.name.textContent=region.city;
  entry.stock.textContent=marketStockText(region.market);
  entry.info.textContent=marketStatus(region);
  writeMarketPolicy(entry.policy,region.market);
 }
 $('realm-empty').hidden=markets.length>0;
 $('realm-empty').textContent=markets.length?'':'Торговые центры открываются в главных городах второго уровня вне столицы.';
}
function grainDays(report){
 if(report.hungry)return 'Голод · население сокращается';
 if(report.days==null)return 'Расхода нет';
 if(!report.days)return report.stock>0?'Меньше дня запаса':'Запас исчерпан';
 return 'На '+report.days+' дн. при текущем расходе';
}
function grainDeliveryLabel(report){
 if(report.eta!=null)return 'Помощь в пути · '+report.amount+' ед. через '+report.eta+' дн.'+(report.risky?' · риск перехвата':'');
 if(report.blocked)return 'Дорога для помощи перекрыта';
 return report.capital?'Свой урожай полностью остаётся в столице':
  'Остаётся '+report.kept.toFixed(1)+' · в столицу '+report.shipped.toFixed(1)+' ед./мин'+
  (report.waiting>.01?' · без дороги '+report.waiting.toFixed(1)+' ед./мин':'');
}
function updateGrainOverview(owned){
 const list=$('realm-grain-list'),reports=owned.filter(duchySeat)
  .map(region=>({region,report:granaryReport(state,region)})).filter(item=>item.report);
 reports.sort((a,b)=>Number(b.report.hungry)-Number(a.report.hungry)||Number(b.report.blocked)-Number(a.report.blocked)||
  (a.report.days??Infinity)-(b.report.days??Infinity)||a.region.id-b.region.id);
 const ids=new Set(reports.map(({region})=>region.id));
 for(const [id,entry] of granaryRows)if(!ids.has(id)){entry.row.remove();granaryRows.delete(id);}
 for(const {region,report} of reports){
  let entry=granaryRows.get(region.id);
  if(!entry){
   const row=document.createElement('article'),open=document.createElement('button'),name=document.createElement('strong');
   const data=document.createElement('span'),route=document.createElement('small');
   row.className='granary-row';open.type='button';
   open.appendChild(name);open.appendChild(data);open.appendChild(route);row.appendChild(open);
   open.onclick=()=>{
    const land=state.regions.find(r=>r.id===region.id&&r.owner==='you');
    if(!land)return;
    $('realm-overview-close').onclick();setSelected(land,'economy');
    cam.x=land.slots[0].x;cam.z=land.slots[0].z;dirtyLabels=true;
   };
   entry={row,name,data,route};granaryRows.set(region.id,entry);
  }
  entry.row.className='granary-row'+(report.hungry||report.blocked?' urgent':'');
  entry.name.textContent=region.name+(region.id===state.capitalId?' · столица':'');
  entry.data.textContent=report.stock.toFixed(1)+' / '+report.storage+' ед. без порчи · '+grainDays(report);
  entry.route.textContent=grainDeliveryLabel(report)+(report.spoilage>.05?' · порча −'+report.spoilage.toFixed(1)+'/мин':'');
 }
 const order=reports.map(({region})=>region.id).join(',');
 if(list.dataset.order!==order){
  for(const {region} of reports)list.appendChild(granaryRows.get(region.id).row);
  list.dataset.order=order;
 }
 $('realm-empty').hidden=reports.length>0;
}

function updateVassalOverview(){
 const list=$('realm-vassals-list');
 const vassals=[...(state.vassals?.values()||[])].filter(vassal=>vassal.owner==='you');
 const key=vassals.map(vassal=>vassal.id).join(',');
 if(list.dataset.vassals!==key){
  list.dataset.vassals=key;
  list.replaceChildren(...vassals.map(vassal=>{
   const row=document.createElement('button');
   row.type='button';row.className='realm-overview-row';row.dataset.vassal=vassal.id;
   row.append(document.createElement('strong'),document.createElement('span'),document.createElement('small'));
   return row;
  }));
 }
 for(const [i,vassal] of vassals.entries()){
  const row=list.children[i],lands=vassal.lands.map(id=>councilRegion(state,id)).filter(Boolean);
  row.children[0].replaceChildren();row.children[0].insertAdjacentHTML('afterbegin',heraldryShield('vassal:'+vassal.id,16));row.children[0].append(vassalDisplayName(state,vassal)+' · '+vassalSpecializationLabel(vassal));
  row.children[1].textContent=lands.map(r=>r.name).join(' · ')+' · казна '+councilGold(vassal.gold)+' зл.';
  row.children[2].textContent=vassal.status;
 }
 $('realm-empty').hidden=vassals.length>0;
 $('realm-empty').textContent='Чтобы назначить вассала, откройте своё герцогство и выберите «Передать вассалу».';
}
$('realm-vassals-list').onclick=event=>{
 const id=Number(event.target.closest('[data-vassal]')?.dataset.vassal),vassal=state.vassals?.get(id);
 const region=vassal&&councilRegion(state,vassal.seatId);
 if(!region)return;
 $('realm-overview-close').onclick();setSelected(region,'overview');
 $('duchy-vassal').open=true;
 if(region.slots[0]){cam.x=region.slots[0].x;cam.z=region.slots[0].z;dirtyLabels=true}
};
function updateRealmOverview(administration=realmAdministration(state,'you')){
 let toggle=$('realm-overview-toggle'),panel=$('realm-overview');toggle.hidden=!state.started||state.defeated;
 $('domain-shortcut').setAttribute('aria-expanded',String(!panel.hidden&&!toggle.hidden));
 if(toggle.hidden){panel.hidden=true;toggle.setAttribute('aria-expanded','false');return}
 let owned=state.regions.filter(r=>r.owner==='you'),reports=owned.map(r=>{let c=controlReport(state,r,administration),m=moodReport(state,r),u=unrestReport(state,r,cityDefenders),priority=u?.active?4:u?.risk?3:(u?.progress||0)>0?2:c.value<65||m.value<=-20?1:0;return {r,c,m,u,priority}}).sort((a,b)=>b.priority-a.priority||(b.u?.progress||0)-(a.u?.progress||0)||a.c.value-b.c.value||a.r.id-b.r.id);
 let critical=reports.filter(x=>x.priority>=3).length,badge=$('realm-overview-count');badge.hidden=!critical;badge.textContent=critical?String(critical):'';
 if(panel.hidden)return;
 const rank=realmRank(state),{direct,excess,yieldFactor}=administration,delegated=owned.length-direct;
 $('realm-overview-summary').textContent=rank.name+' · домен '+direct+' / '+rank.capacity+(delegated?' · у вассалов '+delegated:'')+(excess?' · сверх лимита '+excess+' · выпуск и налоги −'+Math.round((1-yieldFactor)*100)+'%':'');
 const grainView=realmFilter==='grain',marketView=realmFilter==='markets',vassalView=realmFilter==='vassals';
 $('realm-grain-list').hidden=!grainView;$('realm-markets-list').hidden=!marketView;$('realm-vassals-list').hidden=!vassalView;
 $('realm-overview-list').hidden=grainView||marketView||vassalView;
 if(vassalView){updateVassalOverview();return}
 if(marketView){updateTradeCenters(owned);return}
 $('realm-empty').textContent='Нет герцогств по этому фильтру.';
 if(grainView){updateGrainOverview(owned);return}
 let logistics=logisticsReport(state),logisticsNames={grain:'Зерно',wood:'Древесина',iron:'Железо',cloth:'Ткани'};$('logistics-summary').innerHTML=GOODS.map(g=>{let x=logistics.goods[g],eta=x.nextArrival==null?'':` · ближайшая через ${Math.ceil(x.nextArrival)} с`;return `<div class="logistics-row"><strong>${resourceGlyph(g)} ${logisticsNames[g]}</strong><span>В столице ${x.stock.toFixed(1)} · выпуск ${x.production.toFixed(1)}/мин</span><small>В пути ${x.transit} (${x.shipments} ${x.seaTransit?'рейсов':'обозов'})${eta}${x.seaTransit?' · морем '+x.seaTransit:''}${x.blockedShipments?' · остановлено '+x.blockedShipments:''} · ждёт ${x.waiting.toFixed(1)}${x.blocked>0?' · без пути '+x.blocked.toFixed(1)+'/мин':''}</small></div>`}).join('')+(logistics.blockedBuildings?`<p class="logistics-warning">Нет пути до столицы: ${logistics.blockedBuildings} постр.</p>`:'');
 updateNavalLosses();
 const queues=collectPortQueues(owned);
 const reportsWithLogistics=reports.map(report=>{
  const {r,m}=report;
  return {...report, food:m.food&&r.buildings.some(b=>b.type==='city'&&(b.population||0)>0),
   cut:r.buildings.filter(b=>b.product&&!b.route?.length).length,
   port:r.buildings.some(b=>b.type==='port'),waiting:queues.get(r.id)||0};
 });
 const matches=reportsWithLogistics.filter(item=>realmFilter==='all'||item[realmFilter==='ports'?'port':realmFilter]);
 if(realmFilter==='ports') matches.sort((a,b)=>b.waiting-a.waiting||a.r.id-b.r.id);
 $('realm-empty').hidden=matches.length>0;
 let list=$('realm-overview-list'),ids=new Set(matches.map(x=>x.r.id));for(const [id,el] of realmOverviewRows)if(!ids.has(id)){el.remove();realmOverviewRows.delete(id)}
 for(const {r,c,m,u,priority,cut,port,waiting,food} of matches){let row=realmOverviewRows.get(r.id);if(!row){row=document.createElement('button');row.type='button';row.className='realm-overview-row';let title=document.createElement('strong'),stats=document.createElement('span'),reason=document.createElement('small');row.appendChild(title);row.appendChild(stats);row.appendChild(reason);row.onclick=()=>{let target=state.regions.find(x=>x.id===r.id&&x.owner==='you');if(!target)return;panel.hidden=true;toggle.setAttribute('aria-expanded','false');setSelected(target,'economy');let p=target.slots?.[0];if(p){cam.x=p.x;cam.z=p.z;dirtyLabels=true}};realmOverviewRows.set(r.id,row)}
 let cause=r.awaitingAdministration?'Ожидает назначения управления':u?.protectedByArmy?'Армия сдерживает бунт':u?.days!=null?'Проверка риска через '+u.days+' дн.':r.occupation?.repairAt!=null?'Восстанавливается столица':r.occupation&&duchySeat(r)?.damaged?'Столица требует ремонта':u?.progress>0?'Волнения снижаются':food?'Не хватает зерна в герцогстве':cut?'Отрезано построек: '+cut:m.besieged?'Осада':!vassalFor(state,r)&&c.dist==null?'Нет связи со столицей':c.burden?'Сверх лимита · контроль −'+c.burden+' п. п.':m.recent?'Недавний захват':m.crowded?'Не хватает жилья':'Порядок';let pop=(r.buildings||[]).filter(b=>b.type==='city').reduce((n,b)=>n+(b.population||0),0);
 row.className='realm-overview-row'+(priority>=3?' urgent':priority?' warning':'');row.children[0].replaceChildren();row.children[0].insertAdjacentHTML('afterbegin',heraldryShield(r.owner+':'+r.id,16));row.children[0].append(r.name+(r.id===state.capitalId?' · столица':c.burden?' · сверх лимита':''));row.children[1].textContent='Контроль '+Math.round(c.value)+'% → '+Math.round(c.target)+'% · жители '+Math.floor(pop).toLocaleString(interfaceLocale);row.children[2].textContent=cause+' · настроение '+Math.round(m.value)+' · волнения '+Math.floor(u?.progress||0)+'%'
  +(vassalFor(state,r)?' · вассал':'')+(port?' · ожидает морской отправки '+Math.floor(waiting)+' ед.':'')}let order=matches.map(x=>x.r.id).join(',');if(list.dataset.order!==order){for(const {r} of matches)list.appendChild(realmOverviewRows.get(r.id));list.dataset.order=order}
}
$('realm-overview-toggle').onclick=()=>{let panel=$('realm-overview');panel.hidden=!panel.hidden;if(!panel.hidden){showCampaignPanel(false);showCouncil(false);$('notifications-panel').hidden=true;$('notifications-toggle').setAttribute('aria-expanded','false')}$('realm-overview-toggle').setAttribute('aria-expanded',String(!panel.hidden));updateRealmOverview()};
$('realm-overview-close').onclick=()=>{$('realm-overview').hidden=true;$('realm-overview-toggle').setAttribute('aria-expanded','false');$('domain-shortcut').setAttribute('aria-expanded','false')};
$('domain-shortcut').onclick=$('realm-overview-toggle').onclick;

function updateRealmPanel(r){let panel=$('realm-panel');if(panel.hidden)return;let q=realmPromotionCheck(state),current=q.current;$('realm-info').textContent=current.name+' · домен '+realmAdministration(state,'you').direct+' / '+current.capacity;$('realm-info').title='Размер домена зависит от размера карты ('+state.regions.length+' герцогств). Превышение постепенно снижает контроль вне столицы.';let button=$('realm-promote');button.hidden=!q.next;button.disabled=!q.ok;button.textContent=q.next?'ОСНОВАТЬ '+q.next.name.toUpperCase()+' · '+q.next.cost+' ЗЛ.':'ВЫСШИЙ РАНГ';button.title=q.reason||'Повышение уменьшит управленческое давление';$('realm-requirements').textContent=q.next?(q.ok?'Размер домена после повышения: '+q.next.capacity:q.reason):'Управление до '+current.capacity+' земель без штрафа.'}
$('realm-promote').onclick=()=>{let q=promoteRealm(state);if(!q.ok){flash(q.reason);return}flash(q.next.name+' основано · держава «'+countryName('you')+'»');updateUI()};
function regionalWorkforceDetails(workforce){
 const number=value=>value.toLocaleString(interfaceLocale);
 const totals=new Map();
 for(const {type,workers,capacity} of workforce.byBuilding.values()){
  const current=totals.get(type)||{workers:0,capacity:0};
  current.workers+=workers;current.capacity+=capacity;
  totals.set(type,current);
 }
 const rows=[...GOODS,'armory'].filter(type=>totals.has(type)).map(type=>{
  const {workers,capacity}=totals.get(type),armory=type==='armory';
  return `<li>${armory?councilIcon('swords'):resourceGlyph(type)}<span>${armory?'Снаряжение':GOODS_LABELS[type]}</span><b>${number(workers)} / ${number(capacity)}</b></li>`;
 }).join('');
 return `<section class="regional-workforce" aria-label="Занятость в герцогстве">
  <h4>Занятость</h4>
  <dl>
   <div><dt>Могут работать</dt><dd>${number(workforce.available)}</dd></div>
   <div><dt>Вне рабочей силы</dt><dd>${number(workforce.outsideWorkforce)}</dd></div>
   <div><dt>Занято</dt><dd>${number(workforce.employed)}</dd></div>
   <div><dt>Свободно</dt><dd>${number(workforce.free)}</dd></div>
  </dl>
  ${rows?`<ul aria-label="Работники и рабочие места по производствам">${rows}</ul>`:''}
 </section>`;
}
function updateRegionalEconomy(region){
 const panel=$('regional-economy');
 panel.hidden=!state.started||region.owner!=='you';
 if(panel.hidden)return;
 const report=regionEconomy(state,region),fixed=value=>value.toFixed(1),vassal=vassalFor(state,region);
 const goods=GOODS.filter(type=>report.production[type]||report.blocked[type]||report.waiting[type]||
  report.delivered[type]||report.transit[type]||region.buildings.some(building=>building.type===type));
 const production=goods.map(type=>{
  const rate=report.production[type]?'+'+fixed(report.production[type])+' ед./мин':
   report.blocked[type]?'Нет пути':'0 ед./мин';
  const totals=[
   report.delivered[type]?'Доставлено '+Math.ceil(report.delivered[type]-1e-9):null,
   report.transit[type]?'в пути '+Math.ceil(report.transit[type]-1e-9):null,
   report.waiting[type]>=.05?'к отправке '+fixed(report.waiting[type]):null,
   report.blocked[type]?'без дороги '+fixed(report.blocked[type])+' ед./мин':null
  ].filter(Boolean);
  return `<li data-game-stat="${type}">${resourceGlyph(type)}<span><b>${GOODS_LABELS[type]}</b>${totals.length?`<small>${totals.join(' · ')}</small>`:''}</span><strong>${rate}</strong></li>`;
 }).join('');
 $('regional-stats').innerHTML=`<div class="duchy-income"><span>Местные налоги</span><b>+${fixed(report.tax)} зл./мин</b></div>
  ${vassal?`<p>Вассалу ${fixed(report.tax*VASSAL_SHARE)} · в казну державы ${fixed(report.tax*(1-VASSAL_SHARE))} зл./мин</p>`:''}
  ${regionalWorkforceDetails(report.workforce)}${production?`<ul class="duchy-production">${production}</ul>`:''}`;
 const control=controlReport(state,region),mood=moodReport(state,region),unrest=unrestReport(state,region,cityDefenders);
 const stability=duchyStability(region,cityDefenders.get(region.id)),guardBonus=stability-duchyStability(region);
 const priority=$('domain-priority'),pinned=(state.domainPriority||[]).includes(region.id);
 priority.hidden=control.isCapital||!!vassal||control.capacity<=1;
 priority.setAttribute('aria-pressed',String(pinned));
 priority.textContent=pinned?'Снять приоритет ядра':'Включить в ядро домена';
 priority.title='Приоритет защищает землю от дополнительного падения контроля. Мест вне столицы '+Math.max(0,control.capacity-1)+'. Общий штраф за превышение лимита сохраняется.';
 explainAction(priority,'Ядро домена',priority.title);
 const controlFactors=[control.isCapital?'Столица державы':vassal?'Управляет вассал':control.dist==null?'Нет сухопутной связи со столицей':'До столицы '+control.dist+' переходов'+(control.sea?' · по морю':''),
  control.burden?'земля сверх лимита −'+control.burden+' п. п.':!vassal&&!control.isCapital?'в ядре домена':null,control.infra?'развитие +'+control.infra:null,
  control.garrison?'гарнизон +'+Math.round(control.garrison):null,control.sabotage?'подрыв −'+Math.round(control.sabotage):null].filter(Boolean);
 const moodFactors=[mood.food?'голод −45':null,mood.besieged?'осада −35':null,mood.crowded?'мало жилья −12':null,
  mood.recent?'недавний захват −30':null,mood.domainPenalty?'перегрузка −'+mood.domainPenalty:null,mood.controlPenalty?'низкий контроль −'+Math.round(mood.controlPenalty):null,
  mood.development?'развитие +'+mood.development:null,mood.relief?'помощь +30':null].filter(Boolean);
 const unrestText=unrest?.protectedByArmy?'Армия сдерживает бунт':unrest?.days!=null?
  'Проверка через '+unrest.days+' дн. · шанс '+Math.round(unrest.chance*100)+'%'+(control.burden?' · войска '+unrest.troops+' / '+unrest.requiredTroops+' для сдерживания':''):
  unrest?.progress?'Волнения спадают':unrest?.cooldown?'Жители пока не бунтуют':'Спокойно';
 $('regional-control-stats').innerHTML=`<div class="regional-row"><span>Стабильность</span><b>${stability}%</b></div>
  ${guardBonus?`<p>Поддержка войск +${guardBonus} п. п.</p>`:''}
  ${region.treasuryPenalty>=.5?`<p>Кризис казны −${Math.round(region.treasuryPenalty)} п. п.</p>`:''}
  <div class="regional-row"><span>Контроль</span><b>${Math.round(control.value)}% → ${Math.round(control.target)}%</b></div>
  <p>${controlFactors.join(' · ')}${control.yieldFactor<1?' · выпуск и налоги −'+Math.round((1-control.yieldFactor)*100)+'%':''}</p>
  <div class="regional-row"><span>Довольство</span><b>${Math.round(mood.value)} → ${Math.round(mood.target)}</b></div>
  <p>${moodFactors.join(' · ')||'Спокойная жизнь'}. Отдача хозяйства ${Math.round(economicEfficiency(region)*100)}%.</p>
  ${unrest?`<div class="regional-row"><span>Волнения</span><b>${Math.floor(unrest.progress)}%</b></div><p>${unrestText}</p>`:''}`;
 const relief=reliefCheck(state,region),button=$('relief-send');
 button.disabled=!relief.ok;button.title=relief.reason||'Доставить 6 зерна жителям за 20 золота';
 $('relief-reason').textContent=relief.ok?'20 золота · 6 зерна · помощь на 120 сек.':relief.reason;
 const pac=pacifyCheck(state,region),pbtn=$('pacify-start');
 const pacLeft=Math.max(0,(region.pacifyUntil||0)-(state.economy?.seconds||0));
 pbtn.disabled=!pac.ok;pbtn.title=pac.reason||'Порядок восстановится быстрее, волнения утихнут';
 pbtn.textContent=pacLeft>0?'УМИРОТВОРЕНИЕ · '+Math.ceil(pacLeft)+' СЕК.':'Умиротворить землю';
 $('pacify-status').textContent=pacLeft>0?'Действует: контроль +12 к цели, довольство +15, волнения растут медленнее.':pac.ok?'80 золота · 12 зерна · действует 120 сек.':pac.reason;
}
$('domain-priority').onclick=()=>{toggleDomainPriority(state,state.selected);updateUI()};
function updateDuchyCity(region){
 const panel=$('duchy-seat'),seat=duchySeat(region),own=region.owner==='you';
 panel.hidden=!state.started||!seat;
 if(panel.hidden)return;
 function growthHint(r){
  const status=r.growthStatus,trend=r.populationTrend||0;
  if(status==='jobs')return ' · рост остановлен: нет рабочих мест';
  if(status==='underwork')return (seat.population||0)<1000?' · бурный рост поселения — скоро наберётся тысяча':' · рост замедлен: рабочих мест меньше, чем работников';
  if(status==='food')return ' · рост остановлен: не хватает еды';
  if(status==='housing')return ' · рост остановлен: нет жилья';
  return trend>.0004?' · рост +'+(trend*100).toFixed(1)+'%/мин':'';
 }
 $('duchy-seat-title').textContent=state.factions?.[region.owner]?.isRebel?'Крестьянская фракция · '+region.city:'Главный город · '+region.city;
 $('duchy-city-management').hidden=!own;
 if(own){
  const upgrade=upgradeCheck(state,region,seat),button=$('duchy-city-upgrade'),seatJobs=buildingJobs(seat);
  setGameStatText($('duchy-city-housing'),Math.floor(seat.population||0).toLocaleString(interfaceLocale)+' жителей · '+cityHousing(seat).toLocaleString(interfaceLocale)+' мест жилья · '+seatJobs+' рабочих мест · ур. '+(seat.level||1)+growthHint(region));
  button.hidden=!!seat.housingClosed;
  $('duchy-city-upgrade-label').textContent=upgrade.cost?'Улучшить город · '+upgrade.cost+' зл.':'Город полностью улучшен';
  button.disabled=!upgrade.ok;
  const benefits=upgrade.nextHousing?'Жильё '+cityHousing(seat)+' → '+upgrade.nextHousing+' · рабочие места '+seatJobs+' → '+upgrade.nextJobs+' · довольство +2 к цели'+(seat.capital?' · один дополнительный караван':''):'Достигнут максимальный уровень';
  button.title=[upgrade.ok?null:upgrade.reason,benefits].filter(Boolean).join(' · ');
  explainAction(button,'Улучшение города',button.title);
 }
 const recovery=own&&settlementReport(state,region),repair=$('duchy-city-repair');
 $('duchy-city-recovery').hidden=!recovery;
 if(recovery){
  const check=seatRepairCheck(state,region),unrest=unrestReport(state,region,cityDefenders);
  $('duchy-city-damage').textContent=recovery.repairing?'Ремонт · осталось '+councilDays(recovery.repairSeconds):
  recovery.damaged?'Главный город повреждён':'Ремонт завершён · требуется снабжение зерном';
  $('duchy-city-food').textContent=recovery.fed?'Люди обеспечены зерном':recovery.foodDays>0?
   'Питание налаживается · запас на '+recovery.foodDays+' дн.':'Не хватает зерна · нужен местный урожай или обоз';
  $('duchy-city-unrest').textContent=(unrest?.risk?'До бунта ≈ '+unrest.days+' дн. · ':'')+
   'Ждут возвращения: '+Math.floor(region.displacedResidents||0).toLocaleString(interfaceLocale);
  repair.hidden=!recovery.damaged||recovery.repairing;
  $('duchy-city-repair-label').textContent='Восстановить город · '+SEAT_REPAIR_GOLD+' зл.';
  repair.disabled=!check.ok;repair.title=check.reason||'';
  const aid=$('duchy-city-aid'),aidCheck=reliefCheck(state,region);
  aid.hidden=recovery.fed;aid.disabled=recovery.reliefPending||!aidCheck.ok;
  $('duchy-city-aid-label').textContent=recovery.reliefPending?'Помощь в пути':'Отправить помощь · 20 зл. и 6 зерна';
  aid.title=aidCheck.reason||'';
 }
}
function updateDuchyStores(region){
 const own=region.owner==='you',seat=duchySeat(region);
 const grain=own?granaryReport(state,region):null;
 $('duchy-granary').hidden=!grain;
 if(grain){
  const stock=$('duchy-granary-stock');
  stock.textContent=grain.stock.toFixed(1)+' ед. · '+grainDays(grain);
  stock.title='Расход '+grain.need.toFixed(1)+' ед./мин · запас без порчи '+grain.storage+' ед. · бонус своего урожая +'+(grain.harvestBonus*100).toFixed(1)+' п. п. базового роста';
  $('duchy-granary-route').textContent=grainDeliveryLabel(grain);
  setGameStatText($('duchy-granary-balance'),'Местный урожай '+grain.kept.toFixed(1)+' зерна · расход '+grain.need.toFixed(1)+' · порча '+grain.spoilage.toFixed(1)+' ед./мин');
  const storeCheckResult=storeCheck(state,region),storeButton=$('duchy-store-build');
  storeButton.disabled=!storeCheckResult.ok;storeButton.title=storeCheckResult.reason||'';
  storeButton.textContent=region.store&&region.store.level>=STORE_MAX_LEVEL?'Склад · уровень '+region.store.level:
   (region.store?'Улучшить склад · уровень '+(region.store.level+1)+' · '+STORE_COST.gold+' зл.':'Построить склад · '+STORE_COST.gold+' зл. · '+STORE_COST.wood+' дер.');
  $('duchy-store-status').textContent=region.store
   ?'Местная доля зерна +'+(STORE_SHARE*region.store.level*100)+'% · ёмкость без порчи +'+(30*region.store.level)+' ед. Склад продлевает выдержку при осаде.'
   :'Плюс 30 ед. зерна без порчи за уровень. Увеличивает долю местного урожая и продлевает выдержку при осаде.';
  const priorityButton=$('duchy-supply-priority'),priorityOn=!!region.supplyPriority;
  priorityButton.setAttribute('aria-pressed',String(priorityOn));
  priorityButton.textContent=priorityOn?'Снабжение: приоритетное':'Снабжение: обычное';
  priorityButton.title=priorityOn?'Доля местного зерна +'+SUPPLY_PRIORITY_SHARE*100+'%. При голоде столица сама отправляет обозы помощи.':'Приоритет оставляет герцогству больше зерна и включает автоподвоз при голоде.';
 }
 const marketPanel=$('duchy-market'),market=region.market;
 marketPanel.hidden=!own||!seat||region.id===state.capitalId;
 if(!marketPanel.hidden){
  const button=$('duchy-market-build'),check=marketCheck(state,region);
  button.hidden=!!market;button.disabled=!check.ok;button.title=check.reason||'';
  $('duchy-market-stock').textContent=market?marketStockText(market):
   MARKET_COST.gold+' зл. · '+MARKET_COST.wood+' дер. · '+MARKET_COST.iron+' жел. · '+MARKET_BUILD_SECONDS/SECONDS_PER_GAME_DAY+' дн.';
  $('duchy-market-status').textContent=market?marketStatus(region):
   (seat.level||1)<2?'Доступен после улучшения города до уровня 2':
   'Получает древесину, железо и ткани из столицы для торговли.';
  writeMarketPolicy($('duchy-market-policy'),market);
 }
}
function updateDuchyDefense(region){
 const own=region.owner==='you',seat=duchySeat(region),fort=state.fortifications?.get(region.id);
 const gates=[...(fort?.gates.values()||[])],ready=gates.filter(gate=>gate.ready&&!gate.breached);
 const armoryPanel=$('duchy-armory'),armory=region.armory;
 armoryPanel.hidden=!own||!seat;
 if(!armoryPanel.hidden){
  const check=armoryCheck(state,region),button=$('duchy-armory-build');
  button.hidden=!!armory;button.disabled=!check.ok;button.title=check.reason||'';
  const armoryJob=armory?.ready?workforceReport(region).byBuilding.get(armory):null;
  $('duchy-armory-status').textContent=armory?armorySummary(region)+(armoryJob?' · работники '+armoryJob.workers+' / '+armoryJob.capacity:''):
   (seat.level||1)<2?'Доступна после улучшения главного города до уровня 2':
   ARMORY_COST.gold+' зл. · '+ARMORY_COST.wood+' дер. · '+ARMORY_COST.iron+' жел. · стройка '+councilDays(ARMORY_BUILD_TIME);
  const goal=Object.fromEntries(MARKET_GOODS.map(good=>[good,EQUIPMENT_RECIPE[good]*ARMORY_BUFFER]));
  $('duchy-armory-stocks').textContent=armory?.ready?materialStockText(armory.stocks,goal)+
   ' · на складе '+armory.output+' компл.':'Комплект требует '+materialStockText(EQUIPMENT_RECIPE)+'.';
  $('duchy-armory-delivery').textContent=armory?.ready?armoryDeliveryText(region):'';
  $('duchy-armory-policy-label').hidden=!armory?.ready;
  $('duchy-armory-policy').value=armory?.policy||'normal';
 }
 $('fortification-panel').hidden=!fort&&(!own||!seat);
 const check=own&&seat&&!fort?fortificationCheck(state,region):null;
 const build=$('fortification-build'),requirements=$('fortification-requirements');
 build.hidden=!check?.passages;requirements.hidden=!check?.passages;
 if(check){
  build.disabled=!check.ok;
  requirements.textContent=(check.passages?FORT_COST.gold+' зл. · '+FORT_COST.wood+' дер. · '+FORT_COST.iron+' жел. · '+Math.ceil(FORT_BUILD_SECONDS/SECONDS_PER_GAME_DAY)+' дн.':'')+
   (check.ok?'':(check.passages?' · ':'')+check.reason);
 }
 $('fortification-status').textContent=fort?(gates.length?ready.length+' из '+gates.length+' ворот держат проход':'Внешних проходов сейчас нет'):
  (check?.passages?.length?check.passages.length+' проходов через внешнюю границу':'Границы для укрепления нет');
 const select=$('fortification-priority'),list=$('fortification-gates');
 $('fortification-priority-label').hidden=!own||ready.length<2;
 const ids=gates.map(gate=>gate.key).join('|'),readyIds=ready.map(gate=>gate.key).join('|');
 if(select.dataset.gates!==readyIds){
  select.dataset.gates=readyIds;select.textContent='';
  const balanced=document.createElement('option');balanced.value='';balanced.textContent='Равномерно';select.appendChild(balanced);
  for(const gate of ready){
   const option=document.createElement('option');option.value=gate.key;
   option.textContent=(gates.indexOf(gate)+1)+'. '+gateTitle(gate);select.appendChild(option);
  }
 }
 select.value=fort?.priority||'';
 if(list.dataset.gates!==ids){
  list.dataset.gates=ids;list.textContent='';gateRows.clear();
  for(const [i,gate] of gates.entries()){
   const li=document.createElement('li'),button=document.createElement('button');
   const title=document.createElement('b'),detail=document.createElement('span');
   button.type='button';title.textContent=(i+1)+'. '+gateTitle(gate);
   button.appendChild(title);button.appendChild(detail);li.appendChild(button);list.appendChild(li);
   button.onclick=()=>{cam.x=gate.point.x;cam.z=gate.point.z;cam.scale=Math.max(cam.scale,.023);dirtyLabels=true};
   gateRows.set(gate.key,detail);
  }
 }
 for(const gate of gates){
  const row=gateRows.get(gate.key),label=gateStatusText(gate);
  const troops=own&&gate.ready&&!gate.breached?' · '+gateDefenders(state,gate)+' солд.':'';
  const text=localizedLabel(label+troops);
  if(row&&row.textContent!==text)row.textContent=text;
 }
}
$('duchy-market-build').onclick=()=>{
 const result=commissionMarket(state,state.selected);
 if(!result.ok){flash(result.reason);return}
 flash('Заложен торговый центр в городе '+state.selected.city);
 updateUI();
};
$('duchy-market-policy').onclick=()=>toggleMarketPolicy(state.selected);
$('duchy-armory-build').onclick=()=>{
 const region=state.selected,result=commissionArmory(state,region);
 if(!result.ok){flash(result.reason);return}
 flash('Заложена оружейная мастерская · '+region.city);updateUI();
};
$('duchy-armory-policy').onchange=e=>{if(setArmoryPolicy(state,state.selected,e.target.value))updateUI()};
$('fortification-build').onclick=()=>{
 const region=state.selected,result=commissionFortification(state,region);
 if(!result.ok){flash(result.reason);return}
 flash('Начато строительство пограничных ворот: '+region.name);
 updateUI();
};
$('fortification-priority').onchange=e=>{
 const fort=state.fortifications?.get(state.selected?.id),value=e.target.value;
 if(!fort||fort.owner!=='you'||(value&&!fort.gates.get(value)?.ready))return;
 fort.priority=value||null;updateDuchyDefense(fort.region);
};
$('duchy-city-repair').onclick=()=>{
 const result=repairSeat(state,state.selected);
 if(!result.ok){flash(result.reason);return;}
 flash('Начат ремонт столицы');updateUI();
};
$('duchy-city-upgrade').onclick=()=>{
 const region=state.selected,seat=duchySeat(region),result=upgradeBuilding(state,region,seat);
 if(!result.ok){flash(result.reason);return}
 buildingsBuffer=geometryForBuildings();
 showGain(seat,'УРОВЕНЬ '+seat.level,'upgrade');
 dirtyLabels=true;updateUI();
};

function updateRecruitQueue(region,orders){
 const list=$('recruit-queue'),signature=region.id+':'+orders.map(order=>order.id).join(',');
 if(list.dataset.signature!==signature){
  list.dataset.signature=signature;
  list.textContent='';
  for(const [index,order] of orders.entries()){
   const button=document.createElement('button');
   button.type='button';
   button.textContent=generalNumerals[order.generalSlot??1]+' · '+order.troops;
   button.dataset.active=String(index===0);
   button.title=generalName(order.generalSlot??1)+' · отменить набор и вернуть ресурсы';
   button.setAttribute('aria-label','Отменить отряд '+(index+1)+' в очереди');
   button.onclick=()=>{
    const result=cancelRecruitment(state,region,order.id);
    if(result.ok){dirtyLabels=true;rebuildParcelSurfaces();updateUI()}
    else flash(result.reason);
   };
   list.appendChild(button);
  }
 }
 if(orders.length){
  const current=orders[0],progress=Math.floor(current.elapsed/current.duration*100);
  list.children[0]?.style?.setProperty?.('--recruit-progress',progress+'%');
 }
}
$('relief-send').onclick=$('duchy-city-aid').onclick=()=>{
 const home=state.regions.find(r=>r.id===state.capitalId&&r.owner==='you');
 const result=councilReliefDelivery(state,state.selected,home,state.economy.shipments,state);
 flash(result.status||result.reason);
 if(result.ok)updateUI();
};
$('pacify-start').onclick=()=>{
 const result=pacify(state,state.selected);
 if(!result.ok){flash(result.reason);return}
 flash('Умиротворение: '+state.selected.name+' · контроль и довольство восстанавливаются быстрее');
 updateUI();
};
$('duchy-store-build').onclick=()=>{
 const result=buildStore(state,state.selected);
 if(!result.ok){flash(result.reason);return}
 flash('Склад: '+state.selected.name+' · местная доля зерна выросла');
 updateUI();
};
$('duchy-supply-priority').onclick=()=>{
 const region=state.selected;
 const result=setSupplyPriority(state,region,!region.supplyPriority);
 if(!result.ok){flash(result.reason);return}
 updateUI();
};
const generalNumerals=['','I','II','III'];
let playerGeneralSlot=1;
const generalName=slot=>'Генерал '+generalNumerals[slot];
function updateGeneralPickers(){
 const limit=realmGeneralLimit(state);
 playerGeneralSlot=Math.min(limit,playerGeneralSlot);
 const labels=Array.from({length:limit},(_,i)=>{
  const slot=i+1,troops=generalArmy(state,'you',slot)?.troops||0;
  return generalName(slot)+' · '+troops.toLocaleString(interfaceLocale)+' солдат';
 });
 for(const id of ['muster-general','recruit-general']){
  const picker=$(id),selected=String(playerGeneralSlot);
  const signature=labels.join('|');
  if(picker.dataset.generals!==signature){
   picker.dataset.generals=signature;
   picker.replaceChildren(...labels.map((label,index)=>new Option(label,String(index+1))));
  }
  if(picker.value!==selected)picker.value=selected;
 }
}
for(const id of ['muster-general','recruit-general'])$(id).onchange=event=>{
 playerGeneralSlot=Number(event.target.value);updateUI();
};
function updateRecruitment(region){
 if(!state.started||region.owner!=='you')return;
 const generalSlot=playerGeneralSlot,house=vassalFor(state,region),army=generalArmy(state,'you',generalSlot);
 const check=recruitCheck(state,region,'you',null,{generalSlot});
 const queue=recruitQueue(state,region);
 const orders=queue.filter(order=>order.vassalId==null),order=queue[0],button=$('recruit-soldiers');
 updateRecruitQueue(region,orders);
 $('garrison-info').textContent=generalName(generalSlot)+' · '+(army?.troops||0)+' солдат'+
  (house?' · дружина '+vassalDisplayName(state,house)+' под отдельным командованием':'');
 button.disabled=!check.ok;
 const supplies=check.equipped?'1 комплект снаряжения':'6 железа · 4 ткани';
 button.title=check.reason||'100 жителей · '+supplies+' · 50 золота. После сбора солдаты сразу пополняют армию генерала.';
 $('recruit-reason').textContent=order?'Сейчас набор · '+Math.ceil(order.duration-order.elapsed)+' сек. · '+
  (order.vassalId!=null?'дружина феодала':generalName(order.generalSlot??1)):check.ok?'Сбор '+check.duration+' сек.':check.reason;
 $('recruit-soldiers-label').textContent='Нанять 100 солдат';
}
function startMuster(region){
 const result=recruitGarrison(state,region,'you',null,{generalSlot:playerGeneralSlot});
 if(!result.ok){flash(result.reason);return}
 dirtyLabels=true;rebuildParcelSurfaces();
 flash(region.city+' · набор в армию «'+generalName(result.order.generalSlot)+'» · '+result.order.duration+' сек.');
 updateUI();
}
function setMusterOpen(open) {
 $('muster-panel').hidden = !open;
 $('muster-toggle').setAttribute('aria-expanded', String(open));
 if (open) {showCouncil(false);updateMuster();}
 else musterHoverId=musterFocusId=null;
}

function updateMuster() {
 const active = state.started && !state.defeated;
 $('local-muster').hidden = !active || state.selected?.owner !== 'you';
 $('muster-toggle').hidden = !active;
 if (!active) { setMusterOpen(false); return; }
 updateGeneralPickers();
 if ($('muster-panel').hidden) return;
 const list = $('muster-list');
 const regions = state.regions.filter(r => r.owner === 'you');
 const signature = regions.map(r => r.id).join(',');
 if (list.dataset.regions !== signature) {
  list.dataset.regions = signature;
  musterHoverId=musterFocusId=null;
  list.textContent = '';
  for (const region of regions) {
   const button = document.createElement('button');
   button.type = 'button';
   button.onclick = () => startMuster(region);
   list.appendChild(button);
  }
 }
 regions.forEach((region, index) => {
  const row=list.children[index],button=row.className==='explain-frame'?row.firstElementChild:row;
  const orders=recruitQueue(state,region),order=orders[0];
  const check = recruitCheck(state,region,'you',null,{generalSlot:playerGeneralSlot});
  button.disabled = !check.ok;
  const status = order ? 'Сбор · '+Math.ceil(order.duration-order.elapsed)+' с · '+orders.length+'/'+RECRUIT_QUEUE_LIMIT+(check.ok?' · +100':'')
                     : check.ok ? '+100 · ' + check.duration + ' с'+(check.equipped?' · со снаряжением':'') : check.reason;
  button.replaceChildren();
  button.insertAdjacentHTML('afterbegin',heraldryShield(region.owner+':'+region.id,15));
  button.append(document.createTextNode(region.city+' — '+status));
  const target=explainAction(button,'Набор в городе '+region.city,check.reason||(order?
   'В очереди '+orders.length+' отр. · сейчас собирается '+order.troops+' солдат.':
   'Нанять 100 солдат за 50 зл. и снаряжение. После сбора они пополнят армию «'+generalName(playerGeneralSlot)+'».'));
  if(target.dataset.musterRegion) return;
  target.dataset.musterRegion=String(region.id);
  target.onpointerenter=()=>{musterHoverId=region.id};
  target.onpointerleave=()=>{if(musterHoverId===region.id)musterHoverId=null};
  target.onfocusin=()=>{musterFocusId=region.id};
  target.onfocusout=event=>{if(musterFocusId===region.id&&!target.contains?.(event.relatedTarget))musterFocusId=null};
 });
}

$('muster-toggle').onclick = () => setMusterOpen($('muster-panel').hidden);
$('muster-close').onclick = () => setMusterOpen(false);
$('recruit-soldiers').onclick = () => startMuster(state.selected);
$('card-close').onclick=()=>setSelected(null);
const PETITION_GOOD_NAMES={grain:'зерна',wood:'древесины',iron:'железа',cloth:'ткани'};
function updateTradePartner(id){let el=$('trade-partner-info'),e=state.economy;if(!e){el.textContent='';return}let analysis=tradeOffersFor(state,id),range=tradeRange(state);if(analysis.reason){let shortest=analysis.paths.length?Math.round(Math.min(...analysis.paths.map(o=>routeLength(o.path)))):null;el.textContent='ТОРГОВЛЯ · '+analysis.reason+(shortest!==null?'\nБлижайший путь: '+shortest+' / '+range+' ед.':'');return}let fleet=tradeFleet(state),quotes=analysis.offers.filter(o=>tradeFleetAvailable(state,o)).map(o=>tradeQuote(state,o)).sort((a,b)=>Number(b.total>=MIN_TRADE_CARGO)-Number(a.total>=MIN_TRADE_CARGO)||b.value-a.value||Object.values(b.demand).reduce((x,y)=>x+y,0)-Object.values(a.demand).reduce((x,y)=>x+y,0)||routeLength(a.path)-routeLength(b.path));if(!quotes.length){el.textContent='ТОРГОВЛЯ · Нет свободного транспорта. Караваны '+fleet.landUsed+'/'+fleet.land+', корабли '+fleet.seaUsed+'/'+fleet.sea+'.';return}let q=quotes[0],distance=Math.round(routeLength(q.path)),bonus=Math.round((q.premium-1)*100),demand=GOODS.map(g=>GOODS_LABELS[g]+' '+q.demand[g]).join(' · '),goods=Object.entries(q.cargo).map(([g,n])=>GOODS_LABELS[g]+' '+n).join(', '),eligible=GOODS.filter(g=>(g==='grain'?e.grainPolicy==='trade':e.exportPolicy?.[g]!=='hold')&&Math.floor(e.stocks[g]*.5)>0&&Math.floor(e.stocks[g]-tradeReserve(state,g))>0),reason=GOODS.every(g=>q.demand[g]===0)?'Спрос исчерпан':!goods&&eligible.length&&eligible.every(g=>q.demand[g]===0)?'На ваши доступные товары нет спроса':!goods?'Нет доступной партии: проверьте запасы, резерв и политику продажи':q.total<MIN_TRADE_CARGO?'Собираем партию: '+q.total+' / '+MIN_TRADE_CARGO+' ед. ('+goods+')':'Возможная партия: '+goods+' · '+q.value.toFixed(1)+' зл.';el.textContent='ТОРГОВЛЯ · '+(q.mode==='sea'?'морем':'по суше')+'\nПуть до '+(q.mode==='sea'?'порта':'города')+' «'+(state.regions.find(r=>r.id===q.destinationRegionId)?.city||'торговый рынок')+'» · '+distance+(q.mode==='sea'?'':' / '+range)+' ед. · цена +'+bonus+'%\nСпрос: '+demand+'\n'+reason+(q.mode==='sea'?'\nКорабли сначала идут в страны, куда ещё не направлен рейс.':'\nКараваны сначала едут к ближайшим покупателям с достаточным спросом.');const priceFactor=marketCompetition(state,id,'you');if(priceFactor<1)el.textContent+='\nКонкуренция на рынке · скидка покупателю '+Math.round((1-priceFactor)*100)+'%'}
// Featured openings apply only when the player selects a preset.
const CAMPAIGN_STARTS={
 baltic:[
  {key:'mazowieckie',title:'Зерновая равнина',rivals:['wileńskie','Prusy Książęce','Księstwo Kurlandii i Semigalii'],type:'grain',cost:60,stock:18,brief:'Ферма и запас зерна для развития столицы.'},
  {key:'wileńskie',title:'Лесное герцогство',rivals:['Księstwo Kurlandii i Semigalii','mazowieckie','Prusy Książęce'],type:'wood',cost:60,stock:12,brief:'Лесопилка и древесина для первых сделок.'},
  {key:'pomorskie',title:'Балтийская гавань',rivals:['Prusy Książęce','mazowieckie','wileńskie'],type:'port',cost:115,stock:0,brief:'Готовый порт и морская торговля.'}
 ],
 mediterranean:[
  {key:'genoa',title:'Морской узел',rivals:['venice','palermo','madrid'],type:'port',cost:115,stock:0,brief:'Причал и доступ к рынкам западного Средиземноморья.'},
  {key:'cordoba',title:'Плодородная долина',rivals:['lisbon','tunis','genoa'],type:'grain',cost:60,stock:18,brief:'Ферма и продовольственный запас в глубине Андалусии.'},
  {key:'madrid',title:'Внутренняя столица',rivals:['lisbon','genoa','tunis'],type:'cloth',cost:60,stock:12,brief:'Ткацкая мастерская. Союз с портовой державой открывает море.'}
 ]
};
let campaignStartChoice=null;
const CAMPAIGN_VICTORY_NAMES={trade:'Экономическая победа',military:'Военная победа',diplomacy:'Дипломатическая победа'};
const victoryRings=$('victory-rings'),victoryButtons=victoryRings.querySelectorAll('[data-victory-path]');
const CAMPAIGN_CARGO_MODES=['commerce','all','hidden'];
let campaignCargoMode='commerce';
function campaignCargoVisible(ship){
 return ship===selectedCargo||campaignCargoMode!=='hidden'&&(campaignCargoMode==='all'||
  shipmentOwner(ship)==='you'||['export','botSeaTrade','petition','petitionReturn','loot'].includes(ship.kind));
}

function renderCampaignStarts(){
 const container=$('campaign-starts');
 container.textContent='';
 for(const preset of CAMPAIGN_STARTS[GAME_MAP?'mediterranean':'baltic']){
  const region=state.regions.find(r=>r.key===preset.key);
  if(!region)continue;
  const btn=document.createElement('button');
  btn.type='button';
  btn.innerHTML='<strong>'+heraldryShield('start:'+region.id,18)+'<span>'+region.city+'</span></strong><em>'+preset.title+'</em><span>'+preset.brief+'</span>';
  btn.dataset.startRegion=region.id;
  btn.setAttribute('aria-pressed','false');
  const regionId=region.id;
  btn.onclick=()=>chooseCampaignStart(state.regions.find(land=>land.id===regionId),true);
  container.appendChild(btn);
 }
 const select=$('setup-all');
 select.textContent='';
 for(const region of [null,...state.regions.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))]){
  const option=document.createElement('option');
  option.value=region?.id??'';option.textContent=region?.name||'Выбрать из списка';
  select.appendChild(option);
 }
}
function campaignStartPreset(region){return CAMPAIGN_STARTS[GAME_MAP?'mediterranean':'baltic'].find(preset=>preset.key===region.key)}
function chooseCampaignStart(region,center=false){
 if(state.started||!region)return;
 if(!globalThis.gameShell){start(region,campaignStartPreset(region));return}
 campaignStartChoice=region;
 playSelectionSound('city');
 if(center){
  const site=region.slots[0];
  cam.x=site.x;cam.z=site.z;
  cam.scale=Math.max(cam.scale,.0065/WORLD_SCALE);
 }
 const action=$('setup-start');
 action.disabled=false;action.textContent='Начать партию';
 $('setup-all').value=String(region.id);
 $('scenario-intro').textContent='Столица · '+region.city;
 for(const button of $('campaign-starts').children)button.setAttribute('aria-pressed',String(button.dataset.startRegion===String(region.id)));
 dirtyLabels=true;
}
$('setup-all').onchange=event=>{
 if(event.target.value!=='')chooseCampaignStart(state.regions.find(r=>r.id===Number(event.target.value)),true);
};
$('setup-start').onclick=()=>{
 const region=campaignStartChoice;
 if(region&&!state.started)globalThis.gameShell?.startMatch(()=>start(region,campaignStartPreset(region)));
};
function applyCampaignStart(region,preset){
 const eligible=region.slots.filter(q=>q.id!==0);
 if(preset.type==='port')eligible.sort((a,b)=>coastDistance(a.x,a.z)-coastDistance(b.x,b.z));
 else eligible.sort((a,b)=>productivity(preset.type,b.terrain).rate-productivity(preset.type,a.terrain).rate);
 for(const plot of eligible){
  const work={type:preset.type,x:plot.x,z:plot.z,slotId:plot.id,scale:plot.scale,terrain:plot.terrain,level:1};
  if(work.type==='port'&&!portWaterCell(work))continue;
  work.route=attachSupplyRoute(region,work,region.owner);
  if(!work.route)continue;
  if(work.type!=='port'){
   work.product=productivity(preset.type,work.terrain);
   work.baseRate=work.product.rate;
   work.produced=0;
   work.dispatchClock=0;
   state.economy.stocks[preset.type]+=preset.stock;
  }
  region.buildings.push(work);
  state.gold-=preset.cost;
  return;
 }
}
function showCampaignPanel(show){
 const panel=$('campaign-panel');
 panel.hidden=!show;
 $('campaign-toggle').setAttribute('aria-expanded',String(show));
 for(const button of victoryButtons)button.setAttribute('aria-expanded',String(show));
 if(show){
  showCouncil(false);
  $('realm-overview').hidden=true;
  $('realm-overview-toggle').setAttribute('aria-expanded','false');
  $('notifications-panel').hidden=true;
  $('notifications-toggle').setAttribute('aria-expanded','false');
  renderCampaignPanel();
 }
}
function renderVictoryRings(campaign){
 victoryRings.hidden=!campaign||state.defeated;
 if(victoryRings.hidden)return;
 const text=globalThis.gameI18n?.text??(value=>value);
 for(const button of victoryButtons){
  const path=button.dataset.victoryPath,entry=campaign.pathLeaders?.[path];
  const score=Math.max(0,Math.min(1,entry?.score??0));
  const owners=score>0?entry.owners:[];
  const owner=owners.length===1?owners[0]:null;
  const name=text(CAMPAIGN_VICTORY_NAMES[path]);
  const detail=owners.length?owners.map(id=>text(countryName(id))).join(', '):text('Пока нет лидера');
  const threat=campaign.threats?.[path];
  const title=name+' · '+detail+' · '+Math.floor(score*100)+'%'+(threat&&!threat.blockedFor?' · '+countryName(threat.owner)+' победит через '+Math.ceil(threat.remaining)+' сек.':'');
  const edge=FACTION_COLORS[owner]?factionCss(owner):'';
  const fill=(score*100).toFixed(2)+'%';
  if(button.title!==title){
   button.title=title;
   button.setAttribute('aria-label',title);
  }
  if(button.style.getPropertyValue('--victory-progress')!==fill)button.style.setProperty('--victory-progress',fill);
  if(button.style.getPropertyValue('--victory-color')!==edge)button.style.setProperty('--victory-color',edge);
 }
}
let realmPowerState=null,realmPowerSecond=-1,realmPowerScores=new Map(),playerTradeReach=0;
function renderRealmPower(){
 const board=$('realm-power-board'),list=$('realm-power-list'),hud=$('power');
 board.hidden=!state.started||state.defeated;
 if(board.hidden){hud.textContent='—';hud.removeAttribute('title');return}
 const second=Math.floor(state.economy?.seconds||0);
 if(realmPowerState!==state.campaign||realmPowerSecond!==second){
  realmPowerState=state.campaign;realmPowerSecond=second;
  playerTradeReach=tradeRange(state);
  const owners=new Set(state.regions.filter(r=>r.owner!=='neutral').map(r=>r.owner));
  realmPowerScores=new Map([...owners].filter(owner=>!state.factions?.[owner]?.defeated).map(owner=>[owner,factionPower(state,owner)]));
 }
 const describe=power=>'Земли '+Math.round(power.territory)+' · Экономика '+Math.round(power.economy)+' · Войска и флот '+Math.round(power.military)+' · Союзы '+Math.round(power.diplomacy);
 const player=realmPowerScores.get('you');
 hud.textContent=player?Math.round(player.total):'—';
 if(player)hud.title=describe(player)+' · Дальность сухопутной торговли '+playerTradeReach+' ед.';
 const rows=[...realmPowerScores].sort((a,b)=>b[1].total-a[1].total||a[0].localeCompare(b[0]));
 const signature=JSON.stringify(rows.map(([owner,power])=>[owner,countryName(owner),Math.round(power.total),describe(power)]));
 if(list.dataset.content===signature)return;
 list.dataset.content=signature;
 const focused=document.activeElement?.dataset?.powerOwner;
 const previous=new Map([...list.children].map(li=>[li.firstElementChild.dataset.powerOwner,li]));
 for(const [index,[owner,power]] of rows.entries()){
  const row=previous.get(owner)||document.createElement('li');
  previous.delete(owner);
  if(!row.firstElementChild){
   const button=document.createElement('button');
   button.type='button';button.dataset.powerOwner=owner;
   button.onclick=()=>focusCampaignCapital(owner);
   button.append(document.createElement('i'),document.createElement('span'),document.createElement('b'));
   row.appendChild(button);
  }
  const button=row.firstElementChild,[dot,name,score]=button.children;
  dot.style.backgroundColor=FACTION_COLORS[owner]?factionCss(owner):'#a6a491';
  name.textContent=countryName(owner)+(owner==='you'?' · вы':'');
  score.textContent=Math.round(power.total);
  button.title=name.textContent+' · '+describe(power);
  button.setAttribute('aria-label',button.title);
  if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
 }
 for(const row of previous.values())row.remove();
 if(focused&&document.activeElement===document.body)[...list.querySelectorAll('button')].find(button=>button.dataset.powerOwner===focused)?.focus();
}
function focusCampaignCapital(owner){
 const r=state.regions.find(region=>region.id===realmCapitalId(state,owner)&&region.owner===owner);
 if(!r?.slots[0])return;
 cam.x=r.slots[0].x;cam.z=r.slots[0].z;dirtyLabels=true;setSelected(r);
}
const escapeCampaignText=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const campaignTime=seconds=>Math.ceil(seconds)+' сек.';
function onCampaignCountdown(threat){
 addNotice('danger',CAMPAIGN_VICTORY_NAMES[threat.path]+' соперника',countryName(threat.owner)+' · до победы '+campaignTime(threat.remaining),realmCapitalId(state,threat.owner));
}
function renderCampaignThreats(campaign){
 const panel=$('campaign-threats');
 const threats=campaign&&!campaign.result&&!state.defeated?Object.values(campaign.threats||{}):[];
 panel.hidden=!threats.length;
 const content=threats.map(threat=>{
  const status=threat.blockedFor?'Пауза · сброс через '+campaignTime(threat.blockedFor):'До победы '+campaignTime(threat.remaining);
  return '<button type="button" class="'+threat.path+'" data-threat-path="'+threat.path+'"><strong>'+CAMPAIGN_VICTORY_NAMES[threat.path]+'</strong><span>'+escapeCampaignText(countryName(threat.owner))+' · '+status+'</span></button>';
 }).join('');
 if(panel.dataset.content!==content){
  const focused=document.activeElement?.dataset?.threatPath;
  panel.dataset.content=content;panel.innerHTML=content;
  if(focused)panel.querySelector('[data-threat-path="'+focused+'"]')?.focus({preventScroll:true});
 }
}
$('campaign-threats').onclick=event=>{
 const path=event.target.closest('[data-threat-path]')?.dataset.threatPath;
 if(!path)return;
 showCampaignPanel(true);
 $('campaign-paths').querySelector('.'+path)?.scrollIntoView({block:'nearest'});
};
function tradeEmbargoControl(owner){
 const {by,remaining,cooldown}=campaignEmbargoStatus(state,'you',owner);
 if(isAtWar(state,'you',owner))return {label:'Торговля закрыта войной',disabled:true};
 if(remaining)return by==='you'?{label:'Снять эмбарго · '+campaignTime(remaining),disabled:false}:
  {label:'Эмбарго соперника · '+campaignTime(remaining),disabled:true};
 if(cooldown)return {label:'Эмбарго через '+campaignTime(cooldown),disabled:true};
 return {label:'Ввести эмбарго · '+campaignTime(EMBARGO_DURATION),disabled:false};
}
function togglePlayerEmbargo(owner){
 const result=setCampaignEmbargo(state,'you',owner);
 if(!result)return;
 flash((result.active?'Эмбарго введено · ':'Эмбарго снято · ')+countryName(owner));
 updateCampaign(state,0);updateUI();
}
function renderCampaignPanel(){
 const c=state.campaign;
 $('campaign-toggle').hidden=!c||state.defeated;
 renderVictoryRings(c);
 renderCampaignThreats(c);
 updateCampaignReplayButton();
 if(!c||$('campaign-panel').hidden)return;
 const p=c.progress.get('you');
 if(!p)return;
 const rules=c.rules,leader=c.leader,remaining=Math.max(0,Math.ceil(rules.minTime-(state.economy?.seconds||0)));
 const gold=n=>Math.floor(n+1e-8).toLocaleString(interfaceLocale);
 const lines={
  trade:[['Рынки с повторными поставками за 4 мин.',p.trade.repeatBuyers.length+' / '+p.trade.requiredPartners],
   ['Выручка за партию',Math.floor(p.trade.turnover)+' / '+rules.turnover+' зл.'],
   ['Торговая выручка в минуту',Math.floor(p.trade.income)+' / '+p.trade.requiredIncome+' зл.'],
   ['Золото в казне · порог 51%',gold(p.trade.gold)+' / '+gold(p.trade.requiredGold)+' зл.'],
   ['Доход за 30 дней · порог 51%',gold(p.trade.monthlyIncome)+' / '+gold(p.trade.requiredMonthlyIncome)+' зл.'],
   ['Условия удерживаются',Math.floor(p.trade.held)+' / '+rules.tradeHold+' сек.']],
  military:[['Стартовые столицы под контролем',p.military.held.length+' / '+p.military.requiredCapitals],
   ['Своя стартовая столица',p.military.holdsOwn?'Под контролем':'Потеряна']],
  diplomacy:[['Союзы старше '+rules.allianceAge+' сек.',p.diplomacy.allies.length+' / '+p.diplomacy.requiredAllies],
   ['Стабильность столицы',p.diplomacy.stability+' / '+rules.stability+(p.diplomacy.besieged?' · осада':'')],
   ['Уровень столицы',p.diplomacy.homeLevel+' / '+rules.diplomaticCapitalLevel],
   ['Союз удерживается',Math.floor(p.diplomacy.held)+' / '+rules.diplomaticHold+' сек.']]
 };
 $('campaign-race').textContent=c.result
  ?(c.result.owner==='you'?'Вы победили. ':'Соперник победил · '+countryName(c.result.owner)+'. ')+CAMPAIGN_VICTORY_NAMES[c.result.path]
  :leader?.score>=.62
   ?(leader.owner==='you'?'Вы лидируете':countryName(leader.owner)+' лидирует')+' · '+CAMPAIGN_VICTORY_NAMES[leader.path].toLowerCase()+' · '+Math.floor(leader.score*100)+'%'
   :remaining?'Торговая и дипломатическая победы доступны после первых '+rules.minTime/60+' минут. Осталось '+remaining+' сек.':'Побеждает первая держава, которая выполнит условия одного из путей.';
 const regions=new Map(state.regions.map(r=>[r.id,r]));
 const cities=[...c.startingCapitals].map(([id,founder])=>{
  const r=regions.get(id);
  if(!r)return '';
  const claim=r.owner==='you'?'held':'foreign';
  const owner=r.owner==='neutral'?'Нейтральное герцогство':countryName(r.owner);
  const tooltip=('Стартовая столица державы «'+countryName(founder)+'». Сейчас город контролирует '+owner)
   .replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  return '<button type="button" data-campaign-city="'+id+'" data-claim="'+claim+'" title="'+tooltip+'">'+
   capitalStar('original')+r.city+'</button>';
 }).join('');
 const allianceLegends=p.diplomacy.activeAlliances.map(pact=>countryName(pact.owner)+
  (pact.matureAt>state.economy.seconds?' ('+campaignTime(pact.matureAt-state.economy.seconds)+')':'')).join(' · ');
 const hints={
  trade:'Соберите 51% от общей казны остальных держав и получайте 51% от суммы их положительных доходов. Доход за 30 игровых дней учитывает налоги, торговлю и текущие расходы. Эмбарго временно закрывает взаимную торговлю.',
  diplomacy:'Заключайте союзы с соседними державами, развивайте столицу и держите её вне осады. Региональные союзы ботов направлены против общего соседа.'
 };
 const content=CAMPAIGN_PATHS.map(path=>{
  const percent=Math.floor(p[path].score*100);
  const details=lines[path].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('');
  const rival=c.threats?.[path]?.owner||c.pathLeaders?.[path]?.owners.find(owner=>owner!=='you')||
   (path==='trade'?[...c.progress].filter(([owner])=>owner!=='you').sort((a,b)=>b[1].trade.score-a[1].trade.score)[0]?.[0]:null);
  const rivalProgress=c.progress.get(rival)?.[path];
  const ownStatus=path!=='military'&&(p[path].eligible?'До победы '+campaignTime(p[path].remaining):p[path].blockedFor?'Отсчёт приостановлен · сброс через '+campaignTime(p[path].blockedFor):'Ожидаем выполнения условий');
  const rivalStatus=rivalProgress&&(path==='trade'?
   'казна '+gold(rivalProgress.gold)+' / '+gold(rivalProgress.requiredGold)+' зл. · доход за 30 дней '+gold(rivalProgress.monthlyIncome)+' / '+gold(rivalProgress.requiredMonthlyIncome)+' зл. · рынки '+rivalProgress.repeatBuyers.length+'/'+rivalProgress.requiredPartners:
   path==='diplomacy'?'союзы '+rivalProgress.allies.length+'/'+rivalProgress.requiredAllies+' · уровень столицы '+rivalProgress.homeLevel+'/'+rules.diplomaticCapitalLevel+' · стабильность '+rivalProgress.stability+'/'+rules.stability+(rivalProgress.besieged?' · осада':''):
   'столицы '+rivalProgress.held.length+'/'+rivalProgress.requiredCapitals);
  const rivalTimer=path!=='military'&&(rivalProgress?.eligible?'До победы '+campaignTime(rivalProgress.remaining):rivalProgress?.blockedFor?'Пауза · сброс через '+campaignTime(rivalProgress.blockedFor):'');
  const embargo=path==='trade'&&rivalProgress&&!c.result?tradeEmbargoControl(rival):null;
  const embargoButton=embargo?'<button type="button" data-campaign-embargo="'+escapeCampaignText(rival)+'"'+(embargo.disabled?' disabled':'')+'>'+embargo.label+'</button>':'';
  const rivalLine=rivalStatus?'<div class="campaign-rival"><button type="button" data-campaign-owner="'+escapeCampaignText(rival)+'">'+escapeCampaignText(countryName(rival))+' · '+Math.floor(rivalProgress.score*100)+'%</button><small>'+rivalStatus+(rivalTimer?'<br>'+rivalTimer:'')+'</small>'+embargoButton+'</div>':'';
  const rivalTotals=path==='trade'?'<small>У остальных держав · казна '+gold(p.trade.rivalGold)+' зл. · доход за 30 дней '+gold(p.trade.rivalIncome)+' зл.</small>':'';
  return '<section class="campaign-path '+path+'"><div class="campaign-path-title"><h3>'+CAMPAIGN_VICTORY_NAMES[path]+'</h3><b>'+percent+'%</b></div>'+
   '<progress aria-label="'+CAMPAIGN_VICTORY_NAMES[path]+'" value="'+percent+'" max="100"></progress><dl>'+details+'</dl>'+rivalTotals+
   (path==='military'?'<p class="campaign-capital-rule">Удержите все стартовые столицы одновременно.</p><div class="campaign-cities">'+cities+'</div>':
    '<p class="campaign-path-status">'+ownStatus+'</p>'+(path==='diplomacy'&&allianceLegends?'<small>'+escapeCampaignText(allianceLegends)+'</small>':'')+'<p>'+hints[path]+'</p>')+rivalLine+'</section>';
 }).join('');
 const list=$('campaign-paths'),active=document.activeElement;
 const focus=list.contains(active)?Object.entries(active.dataset).find(([key])=>['campaignCity','campaignOwner','campaignEmbargo'].includes(key)):null;
 if(content!==list.dataset.content){
  list.dataset.content=content;
  list.innerHTML=content;
  if(focus?.[1])[...list.querySelectorAll('button')].find(button=>button.dataset[focus[0]]===focus[1])?.focus({preventScroll:true});
 }
}
function onCampaignPact(a,b,against){
 const other=a==='you'?b:a;
 if(a==='you'||b==='you'){
  const regionId=state.factions[other]?.regionId;
  recordRecapMoment(state,'alliance',{regionId,title:'Заключён союз',detail:countryName(other),weight:77});
  addNotice('diplomacy','Союз заключён',countryName(other)+' · взаимный проход и оборона.',regionId);
 }
 else if(against==='you')addNotice('diplomacy','Региональный союз против вас',countryName(a)+' и '+countryName(b)+' договорились действовать вместе на вашей общей границе.',state.factions[a]?.regionId);
}
let recapPlayback=null;
$('campaign-recap').hidden=true;
$('campaign-finale').hidden=true;
function recapDate(time){
 const date=gameDate(time);
 return globalThis.gameI18n?.date(date)??(date.day+' '+MONTHS_RU[date.month]+' '+date.year+' г.');
}
function recapPolygons(polygons){
 const shape=new Path2D();
 for(const polygon of polygons)for(const ring of polygon){
  if(ring.length<3)continue;
  shape.moveTo(ring[0][0],ring[0][1]);
  for(let i=1;i<ring.length;i++)shape.lineTo(ring[i][0],ring[i][1]);
  shape.closePath();
 }
 return shape;
}
function openCampaignReplay(autoplay,from='finale'){
 const recap=state.campaign?.recap;
 const atlas=$('recap-map'),context=atlas.getContext('2d');
 if(!recap?.outcome||!context||typeof Path2D==='undefined')return false;
 const shapes=state.regions.map(region=>({id:region.id,path:recapPolygons(region.polys)}));
 const bounds=state.regions.flatMap(region=>region.bounds);
 const extent=[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),
  Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))];
 const background=GAME_MAP?recapPolygons(SCENARIO_LAND):
  recapPolygons([[[[-140,-185],[1270,-185],[1270,890],[-140,890]],BOARD_SEA]]);
 const home=state.regions.find(r=>r.id===recap.setup.capitalId).slots[0];
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 recapPlayback={recap,atlas,context,shapes,extent,background,home,from,reduce,elapsed:0,
  playing:autoplay&&!reduce&&recap.outcome.time>0,lastFrame:null,lastPaint:-Infinity,markers:[]};
 const momentList=$('recap-moments'),ticks=$('recap-ticks');
 momentList.textContent='';ticks.textContent='';
 for(const [i,moment] of recap.highlights.entries()){
  const row=document.createElement('li'),button=document.createElement('button'),date=document.createElement('time');
  const title=document.createElement('strong'),tick=document.createElement('option');
  date.textContent=recapDate(moment.time);title.textContent=moment.title;
  tick.value=String(recap.outcome.time?Math.round(10000*moment.time/recap.outcome.time):0);
  ticks.appendChild(tick);
  button.type='button';button.appendChild(date);button.appendChild(title);
  if(moment.detail){const detail=document.createElement('small');detail.textContent=moment.detail;button.appendChild(detail)}
  button.onclick=()=>seekCampaignReplay(moment.time,i);
  row.appendChild(button);momentList.appendChild(row);
  recapPlayback.markers.push(button);
 }
 $('recap-scenario').textContent=(GAME_MAP?.name||'Речь Посполитая')+' · Летопись партии';
 $('recap-title').textContent=recap.outcome.title;
 $('recap-title').dataset.path=recap.outcome.path;
 $('recap-winner').textContent=recap.outcome.owner==='you'?'Ваша держава · '+countryName('you'):'Победитель · '+countryName(recap.outcome.owner);
 $('recap-close').textContent=from==='goals'?'К целям':'К итогам';
 $('campaign-finale').hidden=true;
 $('campaign-recap').hidden=false;
 cameraKeys.clear();
 const first=campaignRecapFrame(recap,0);
 updateReplayReadout(recapPlayback,first,0,0);
 $(recap.outcome.time?'recap-play':'recap-close').focus?.();
 return true;
}
function closeCampaignReplay(restorePanel=true){
 if(!recapPlayback)return;
 const {from}=recapPlayback;
 recapPlayback=null;
 $('campaign-recap').hidden=true;
 lastFrame=null;
 if(!restorePanel)return;
 if(from==='goals')$('campaign-reopen-recap').focus?.();
 else{
  $('campaign-finale').hidden=false;
  $('campaign-watch-recap').focus?.();
 }
}
function replayTime(replay){
 return replay.recap.outcome.time*Math.min(1,replay.elapsed/CAMPAIGN_RECAP_SECONDS);
}
function seekCampaignReplay(time,highlight=null){
 const replay=recapPlayback,end=replay?.recap.outcome.time;
 if(!replay)return;
 replay.elapsed=end?CAMPAIGN_RECAP_SECONDS*time/end:CAMPAIGN_RECAP_SECONDS;
 replay.playing=false;replay.lastFrame=null;replay.lastPaint=-Infinity;replay.selected=highlight;
 const frame=campaignRecapFrame(replay.recap,time);
 const index=highlight??Math.max(0,replay.recap.highlights.findLastIndex(moment=>moment.time<=time+1e-7));
 updateReplayReadout(replay,frame,time,index);
}
function toggleCampaignReplay(){
 const replay=recapPlayback;
 if(!replay||!replay.recap.outcome.time)return;
 if(replay.elapsed>=CAMPAIGN_RECAP_SECONDS){replay.elapsed=0;replay.playing=true}
 else replay.playing=!replay.playing;
 replay.selected=null;replay.lastFrame=null;replay.lastPaint=-Infinity;
 $('recap-play').textContent=replay.playing?'Пауза':'Продолжить';
}
function updateReplayReadout(replay,frame,time,index){
 const value=recapDate(time),end=replay.recap.outcome.time;
 $('recap-date').textContent=value;
 $('recap-lands').textContent='Ваши земли · '+frame.lands;
 $('recap-revenue').textContent='Выручка · '+Math.round(frame.revenue).toLocaleString(interfaceLocale)+' зл.';
 const play=$('recap-play'),slider=$('recap-timeline');
 play.disabled=!end;
 play.textContent=replay.playing?'Пауза':replay.elapsed>=CAMPAIGN_RECAP_SECONDS?'Сначала':replay.elapsed?'Продолжить':'Воспроизвести';
 $('recap-rematch').hidden=time+1e-7<end;
 slider.disabled=!end;
 slider.value=String(end?Math.round(10000*time/end):0);
 slider.setAttribute('aria-valuetext',value);
 if(replay.activeIndex===index)return;
 replay.activeIndex=index;
 replay.markers.forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));
}
function drawCampaignReplay(now){
 const replay=recapPlayback,{atlas,context:ctx,recap,extent}=replay;
 if(replay.lastFrame!=null&&replay.playing&&!document.hidden){
  replay.elapsed=Math.min(CAMPAIGN_RECAP_SECONDS,replay.elapsed+Math.max(0,Math.min(.2,(now-replay.lastFrame)/1000)));
  if(replay.elapsed===CAMPAIGN_RECAP_SECONDS)replay.playing=false;
 }
 replay.lastFrame=now;
 const width=atlas.clientWidth,height=atlas.clientHeight;
 if(!width||!height)return;
 const pixelRatio=Math.min(2,window.devicePixelRatio||1);
 const resized=atlas.width!==Math.round(width*pixelRatio)||atlas.height!==Math.round(height*pixelRatio);
 if(!resized&&now-replay.lastPaint<65)return;
 if(!resized&&!replay.playing&&replay.paintedAt===replay.elapsed&&replay.paintedSelection===replay.selected&&replay.lastPaint!==-Infinity)return;
 if(resized){atlas.width=Math.round(width*pixelRatio);atlas.height=Math.round(height*pixelRatio)}
 replay.lastPaint=now;replay.paintedAt=replay.elapsed;replay.paintedSelection=replay.selected;
 const time=replayTime(replay),frame=campaignRecapFrame(recap,time+1e-7);
 const cleared=replay.selected??Math.max(0,recap.highlights.findLastIndex(moment=>moment.time<=time+1e-7));
 updateReplayReadout(replay,frame,time+1e-7,cleared);
 const pad=Math.min(42,width*.075,height*.085),[left,top,right,bottom]=extent;
 const fit=Math.min((width-2*pad)/(right-left),Math.max(1,height-2*pad-22)/(bottom-top));
 const entry=replay.reduce||replay.selected!=null?0:.55*Math.pow(Math.max(0,1-replay.elapsed/1.8),3);
 const scale=fit*(1+entry);
 const centerX=(left+right)/2,replayCenterX=centerX+(replay.home.x-centerX)*entry;
 const centerZ=(top+bottom)/2,replayCenterZ=centerZ+(replay.home.z-centerZ)*entry;
 const dx=width/2-replayCenterX*scale,dz=(height-17)/2-replayCenterZ*scale;
 ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
 ctx.clearRect(0,0,width,height);
 ctx.beginPath();
 for(let x=width/2%36;x<width;x+=36){ctx.moveTo(x,0);ctx.lineTo(x,height)}
 for(let y=height/2%36;y<height;y+=36){ctx.moveTo(0,y);ctx.lineTo(width,y)}
 ctx.strokeStyle='rgba(146,180,176,.10)';ctx.lineWidth=1;ctx.stroke();
 ctx.setTransform(scale*pixelRatio,0,0,scale*pixelRatio,dx*pixelRatio,dz*pixelRatio);
 ctx.fillStyle='#263a35';ctx.strokeStyle='#8093834a';ctx.lineWidth=.9/scale;
 ctx.fill(replay.background,'evenodd');ctx.stroke(replay.background);
 ctx.lineJoin='round';
 for(const {id,path} of replay.shapes){
  const owner=frame.owners.get(id);
  ctx.fillStyle=owner==='you'?'#b89355':owner==='neutral'?'#374c41':FACTION_COLORS[owner]?factionCss(owner):'#974f44';
  ctx.fill(path,'evenodd');
  ctx.strokeStyle=owner==='you'?'#f6d98d':owner==='neutral'?'#667e685e':'#ecd3aa75';
  ctx.lineWidth=(owner==='you'?1.35:.72)/scale;ctx.stroke(path);
  const glow=frame.recent.get(id);
  if(glow&&replay.playing&&!replay.reduce){
   ctx.globalAlpha=glow*.85;
   ctx.strokeStyle=owner==='you'?'#ffe0a0':'#efa485';
   ctx.lineWidth=3.6/scale;ctx.stroke(path);
   ctx.globalAlpha=1;
  }
 }
 for(const route of frame.routes.slice().reverse()){
  ctx.beginPath();
  for(const path of route.paths){
   ctx.moveTo(path[0].x,path[0].z);
   for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].z);
  }
  ctx.setLineDash([]);
  ctx.lineCap='round';ctx.lineWidth=4/scale;ctx.strokeStyle='#0b1824ad';ctx.stroke();
  ctx.lineWidth=1.65/scale;ctx.strokeStyle=route.mode==='sea'?'#a4dfed':'#f5cb76';
  if(route.mode==='sea'){
   ctx.setLineDash([5/scale,4/scale]);
   ctx.lineDashOffset=replay.reduce?0:-replay.elapsed*12/scale;
  }
  ctx.stroke();
 }
 ctx.lineDashOffset=0;ctx.setLineDash([]);
 const event=recap.highlights[cleared];
 const region=state.regions.find(r=>r.id===event.regionId),pin=event.point||region?.slots[0];
 if(pin){
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  const x=dx+pin.x*scale,y=dz+pin.z*scale;
  ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);
  ctx.fillStyle='#13242b';ctx.fill();ctx.strokeStyle='#f2d383';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,2.6,0,Math.PI*2);
  ctx.fillStyle='#fff0bf';ctx.fill();
  if(region){
   ctx.font='600 14px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='bottom';
   ctx.lineWidth=3.5;ctx.strokeStyle='#13242b';ctx.fillStyle='#fbebc9';
   ctx.strokeText(region.city,x,y-11);ctx.fillText(region.city,x,y-11);
  }
 }
}
function onCampaignEnd(result){
 if(occupationDialog.open)occupationDialog.close();
 const won=result.owner==='you';
 const title=CAMPAIGN_VICTORY_NAMES[result.path]+'!';
 const recap=finishCampaignRecap(state,result,title);
 $('campaign-result-title').textContent=title;
 $('campaign-result-title').dataset.path=result.path;
 const detail=result.defeat?'Последнее герцогство заняла держава «'+countryName(result.owner)+'».':
  result.path==='military'?(won?'Вы контролируете все стартовые столицы.':
   'Держава «'+countryName(result.owner)+'» контролирует все стартовые столицы.'):
   (won?'Вы победили.':'Победила держава «'+countryName(result.owner)+'».');
 const minutes=Math.floor(result.time/60),seconds=Math.floor(result.time%60);
 const duration=globalThis.gameI18n?.text('{0} мин. {1} сек.',minutes,seconds)??(minutes+' мин. '+seconds+' сек.');
 const summary=localizedLabel(detail)+' '+recapDate(result.time)+' · '+duration;
 $('campaign-result-detail').textContent=globalThis.gameI18n?.rendered(summary)??summary;
 $('campaign-continue').hidden=!!result.defeat||state.defeated;
 $('campaign-rematch').hidden=!recap;
 $('campaign-watch-recap').hidden=!recap;
 updateCampaignReplayButton();
 if(openCampaignReplay(true))return;
 $('campaign-watch-recap').hidden=true;
 $('campaign-finale').hidden=false;
 $(recap?'campaign-rematch':'campaign-restart').focus?.();
}
function updateCampaignReplayButton(){
 $('campaign-reopen-recap').hidden=!state.campaign?.recap?.outcome||typeof Path2D==='undefined';
}
function campaignHarborOffer(other,owner='you'){
 if(!campaignAllies(state,owner).includes(other))return null;
 const nation=state.regions.filter(r=>r.owner===other);
 for(const region of nation)for(const port of region.buildings){
  if(port.type==='port'&&attachSupplyRoute(region,port,owner)&&portWaterCell(port)){
   return {owner:other,regionId:region.id,slotId:port.slotId,key:region.id+':'+port.slotId,region,port};
  }
 }
 return null;
}
function acceptHarborCharter(other,owner='you'){
 const offer=campaignHarborOffer(other,owner),ledger=factionLedger(state,owner);
 if(!offer||campaignPortCharter(state,owner)||ledger.gold<HARBOR_CHARTER_COST)return null;
 ledger.gold-=HARBOR_CHARTER_COST;
 factionLedger(state,other).gold+=HARBOR_CHARTER_COST;
 const charter={owner:other,regionId:offer.regionId,slotId:offer.slotId,key:offer.key};
 if(owner==='you')state.campaign.charter=charter;
 else state.factions[owner].charter=charter;
 return offer;
}
function updateCampaignDiplomacy(owner){
 const panel=$('diplomacy-tools');
 panel.hidden=!state.campaign||!campaignNationAlive(state,owner)||isAtWar(state,'you',owner);
 if(panel.hidden)return;
 const allied=campaignAllies(state,'you').includes(owner),relation=campaignRelation(state,owner);
 $('diplomacy-trust').textContent=allied?'Оборонительный союз · свободный проход':'Доверие '+relation.trust+' / '+ALLIANCE_TRUST+' · растёт от торговли и дипломатии';
 const embassy=campaignEmbassy(state,owner),embassyLine=$('diplomacy-embassy');
 embassyLine.hidden=!embassy;
 if(embassy)embassyLine.textContent='Посольство открыто · '+embassy.city;
 const envoy=envoyCheck(state,owner),alliance=campaignAllianceCheck(state,'you',owner);
 $('diplomacy-envoy').hidden=allied||relation.trust>=ALLIANCE_TRUST;
 $('diplomacy-envoy').textContent='Отправить посланника · '+ENVOY_COST+' зл.';
 $('diplomacy-envoy').disabled=!envoy.ok;
 $('diplomacy-ally').hidden=allied;
 $('diplomacy-ally').disabled=!alliance.ok;
 $('diplomacy-break').hidden=!allied;
 const embargo=$('diplomacy-embargo');
 const action=tradeEmbargoControl(owner);
 embargo.hidden=owner==='you';
 embargo.disabled=action.disabled;
 embargo.textContent=action.label;
 embargo.title='Закрывает взаимную торговлю на '+campaignTime(EMBARGO_DURATION)+'. Повтор возможен через '+campaignTime(EMBARGO_COOLDOWN)+' после введения.';
 const charter=campaignPortCharter(state),offer=allied&&!charter?campaignHarborOffer(owner):null;
 const partners=campaignAllies(state,owner).filter(id=>id!=='you');
 $('diplomacy-defenders').textContent=partners.length?'Союзники державы · '+partners.map(partner=>{
  const target=state.campaign.pacts.get(warKey(owner,partner))?.against;
  return countryName(partner)+(target?' (против '+countryName(target)+')':'');
 }).join(', '):'';
 $('diplomacy-harbor').hidden=!offer;
 $('diplomacy-harbor').disabled=state.gold<HARBOR_CHARTER_COST;
 $('diplomacy-harbor').textContent='Доступ к порту · '+HARBOR_CHARTER_COST+' зл.';
 $('diplomacy-hint').textContent=offer?'Один торговый корабль через порт '+offer.region.city+'. Нужен сухопутный путь до причала.':
  allied?(charter?.owner===owner?'Порт по концессии · '+charter.region.city:'Союзник вступит в войну, если на вашу державу нападут.'):
  relation.trust>=ALLIANCE_TRUST?(alliance.reason||'Союз даёт взаимный проход и общую оборону.'):(envoy.reason||'Посланник добавляет 30 доверия.');
}
$('campaign-toggle').onclick=()=>showCampaignPanel($('campaign-panel').hidden);
for(const button of victoryButtons)button.onclick=()=>showCampaignPanel($('campaign-panel').hidden);
$('campaign-close').onclick=()=>showCampaignPanel(false);
$('campaign-paths').onclick=event=>{
 if(event.target.dataset?.campaignEmbargo){togglePlayerEmbargo(event.target.dataset.campaignEmbargo);return;}
 const owner=event.target.dataset?.campaignOwner;
 if(owner){focusCampaignCapital(owner);return}
 const cityId=event.target.dataset?.campaignCity;
 if(cityId==null)return;
 const r=state.regions.find(region=>region.id===Number(cityId));
 if(r){cam.x=r.slots[0].x;cam.z=r.slots[0].z;dirtyLabels=true;setSelected(r)}
};
$('campaign-watch-recap').onclick=()=>openCampaignReplay(true);
$('campaign-reopen-recap').onclick=()=>openCampaignReplay(true,'goals');
$('recap-close').onclick=()=>closeCampaignReplay();
$('recap-play').onclick=toggleCampaignReplay;
$('recap-timeline').oninput=()=>{
 if(recapPlayback)seekCampaignReplay(recapPlayback.recap.outcome.time*Number($('recap-timeline').value)/10000);
};
function rematchCampaign(){
 const setup=state.campaign?.recap?.setup;
 if(!setup)return;
 resetGame();
 const region=state.regions.find(r=>r.id===setup.capitalId);
 if(region)start(region,setup.preset,setup);
}
$('campaign-rematch').onclick=rematchCampaign;
$('recap-rematch').onclick=rematchCampaign;
$('campaign-restart').onclick=resetGame;
$('campaign-continue').onclick=()=>{if(state.campaign){state.campaign.exploring=true;simClock=0}$('campaign-finale').hidden=true;showCampaignPanel(true)};
$('campaign-cargo').onclick=()=>{
 campaignCargoMode=CAMPAIGN_CARGO_MODES[(CAMPAIGN_CARGO_MODES.indexOf(campaignCargoMode)+1)%CAMPAIGN_CARGO_MODES.length];
 $('campaign-cargo').textContent='Обозы на карте · '+({commerce:'свои и торговые',all:'все',hidden:'скрыты'}[campaignCargoMode]);
 renderCargo();renderFleet();
};
$('diplomacy-envoy').onclick=()=>{
 const result=sendCampaignEnvoy(state,state.selected?.owner);
 flash(result.ok?'Посланник принят · +30 доверия':result.reason);
 updateUI();
};
$('diplomacy-ally').onclick=()=>{
 const result=formCampaignAlliance(state,'you',state.selected?.owner);
 if(!result.ok)flash(result.reason);
 updateUI();
};
$('diplomacy-break').onclick=()=>{
 const owner=state.selected?.owner;
 if(breakCampaignAlliance(state,owner))flash('Союз расторгнут · '+countryName(owner));
 updateUI();
};
$('diplomacy-embargo').onclick=()=>togglePlayerEmbargo(state.selected?.owner);
$('diplomacy-harbor').onclick=()=>{
 const offer=acceptHarborCharter(state.selected?.owner);
 if(!offer)return;
 addNotice('diplomacy','Получен доступ к порту',offer.region.city+' · добавлен торговый корабль.',offer.regionId);
 updateUI();
};
renderCampaignStarts();

function peacePaymentLabel({payer,gold,rate}){
 if(!gold&&!rate)return 'Мир без выплат';
 const amount=[gold?localizedLabel(gold+' зл. сразу'):null,rate?localizedLabel(rate+' зл./мин на 90 дн.'):null].filter(Boolean).join(' + ');
 return localizedLabel(payer==='you'?'Заплатить':'Получить')+' '+amount;
}
function updatePeaceTools(owner,fighting){
 const treaty=activePeaceTreaty(state,'you',owner),now=state.economy.seconds;
 const status=$('peace-treaty-status');
 status.hidden=!treaty||!treaty.rate||now>=treaty.end;
 if(!status.hidden){
  const direction=treaty.payer==='you'?'Выплачиваем':'Получаем';
  status.textContent=direction+' '+treaty.rate+' зл./мин · ещё '+councilDays(treaty.end-now)+
   ' · переведено '+councilGold(treaty.paid)+' зл.'+
   (treaty.arrears>=.1?' · просрочено '+councilGold(treaty.arrears)+' зл.':'');
 }
 const tools=$('peace-tools');
 tools.hidden=!fighting||!!state.factions[owner]?.isRebel;
 if(tools.hidden)return;
 const plain=peaceOptions(state,owner),installments=peaceOptions(state,owner,'you',true);
 $('peace-status').textContent=plain.reason;
 const white=$('peace-white');
 white.disabled=!plain.white;
 explainAction(white,'Мир без выплат',plain.white?'Война прекратится, обе стороны сохранят занятые земли.':plain.reason);
 for(const [id,terms] of [['peace-payment',plain.payment],['peace-reparations',installments.payment]]){
  const button=$(id),recurring=id==='peace-reparations';
  button.hidden=!terms;
  if(!terms)continue;
  button.disabled=!terms.ok;
  button.textContent=terms.gold||terms.rate?peacePaymentLabel(terms):recurring?'Мир с репарациями':'Мир с компенсацией';
  explainAction(button,recurring?'Мир с репарациями':'Мир с компенсацией',terms.reason||
   (recurring?'Ставка фиксируется на 90 дней. Если дохода не хватает, выплаты идут из казны.':
    'Сумма перечисляется при подписании договора.'));
 }
}
function updateWarPanel(region){
 const owner=region.owner,panel=$('war-panel');
 panel.hidden=!state.started||!state.factions?.[owner];
 if(panel.hidden)return;
 updateCampaignDiplomacy(owner);
 const fighting=isAtWar(state,'you',owner),days=truceDays(state,'you',owner);
 $('war-status').textContent=fighting?'Война · для осады разгромите защитников города':
  days?'Перемирие · осталось '+days+' дн.':state.transit?.['you>'+owner]?'Мир · договор о проходе':'Мир';
 updateTradePartner(owner);
 const declare=$('war-declare'),check=warDeclarationCheck(state,owner);
 declare.hidden=fighting;
 declare.disabled=!check.ok;
 declare.title=check.reason||'Торговля остановится. Армии смогут пересекать границу.';
 updatePeaceTools(owner,fighting);
}
for(const [id,kind,installments] of [['peace-white','white',false],['peace-payment','payment',false],['peace-reparations','payment',true]]){
 $(id).onclick=()=>{
  const result=settleWar(state,state.selected?.owner,'you',kind,installments);
  if(!result.ok){flash(result.reason);updateUI()}
  else flash('Заключён мир');
 };
}
$('war-declare').onclick=()=>{let r=state.selected,result=declareWar(state,r?.owner);if(!result.ok){flash(result.reason);return}flash('Война объявлена: торговля с соперником остановлена');updateUI()};
function updatePetition(r){let panel=$('petition');panel.hidden=!state.started||r.owner!=='neutral';if(panel.hidden)return;const occupation=neutralOccupationCheck(state,r);$('occupy-neutral').disabled=!occupation.ok;$('occupy-neutral-hint').textContent=occupation.ok?'Город перейдёт под ваш контроль. Стабильность после захвата снизится.':occupation.reason;let q=petitionFor(r),active=state.economy.shipments.find(s=>s.kind==='petition'&&s.owner==='you'&&s.targetId===r.id),check=petitionCheck(state,'you',r),rivals=state.economy.shipments.filter(s=>s.kind==='petition'&&s.owner!=='you'&&s.targetId===r.id);$('petition-description').textContent='Доставьте '+q.amount+' ед. '+PETITION_GOOD_NAMES[q.good]+' и оплатите '+q.cost+' зл. После прибытия обоза: присоединение, '+NEUTRAL_RESIDENTS+' жителей и '+q.reward+' зл.';let status=active?(active.mode==='sea'?'Посольство в пути':'Ваш обоз в пути')+' · '+Math.max(0,Math.ceil(active.duration-active.elapsed))+' сек.':check.ok?(check.path?.seaStart!=null?'Доступно посольство из своего порта':'Соседнее герцогство готово принять помощь'):check.reason;if(rivals.length)status+=' · соперник тоже отправил обоз';$('petition-status').textContent=status;let b=$('petition-send');b.disabled=!check.ok;b.textContent=active?(active.mode==='sea'?'ПОСОЛЬСТВО В ПУТИ':'ОБОЗ В ПУТИ'):check.path?.seaStart!=null?'ОТПРАВИТЬ ПОСОЛЬСТВО':'ОТПРАВИТЬ ОБОЗ';b.title=check.reason||''}
$('occupy-neutral').onclick=()=>{
 const result=occupyNeutralDuchy(state,state.selected);
 if(!result.ok)flash(result.reason);
 updateUI();
};
$('petition-send').onclick=()=>{const r=state.selected,q=sendPetition(state,'you',r);if(!q.ok){flash(q.reason);updateUI();return}flash('Обоз отправлен: '+r.city+' · '+Math.ceil(q.ship.duration)+' сек.');updateUI()};
const TOOL_INFO={city:['Город I уровня даёт 1 800 мест жилья, 60 рабочих мест в сфере услуг и +1 к цели довольства.','Улучшение добавляет жильё, рабочие места и развитие. Уровень столицы также даёт караваны и открывает повышение ранга.'],grain:['Ферма кормит население и войска. Сытое герцогство с избытком своего урожая получает до +0,3 п. п. базового роста за минуту.','Равнина даёт больше урожая. Излишек сверх вместимости хранилища постепенно портится.'],wood:['Лесопилка заготавливает древесину для строительства и кораблей.','Лучшее место: лес.'],iron:['Рудник добывает железо для вооружения.','Лучшее место: горы и месторождения.'],cloth:['Ткацкая мастерская производит ткани для армии и торговли.','Равнины и леса дают обычную выработку.'],port:['Открывает морскую торговлю с портами соперников.','Корабль перевозит общий груз; цена на 50% выше, спрос до 60 ед. на товар. Нужен мир и спрос покупателя.']};
const ICONS={
 city:'<path d="M4 15 16 5l12 10M7 13v14h18V13M13 27v-8h6v8M21 8V5h4v6"/>',
 grain:'<path d="M16 29V8m0 6c-5 0-8-2-8-6 5 0 8 2 8 6zm0 7c-6 0-9-2-9-7 6 0 9 2 9 7zm0-7c5 0 8-2 8-6-5 0-8 2-8 6zm0 7c6 0 9-2 9-7-6 0-9 2-9 7zm0-13c-3-3-2-5 0-6 2 1 3 3 0 6z"/>',
 wood:'<path d="M3 24 16 7l5 3-1 2 3 1-1 2 3 1-1 2 3 1-6 6-2-2-2 2-2-2-2 1-1-2-5 4zM19 7l3-4 8 6-3 4-3-2 1-2-3-2-1 2z"/>',
 iron:'<path d="M6 26 20 12l2 2L8 28zM5 10c6-6 13-7 19 0 3 3 4 7 3 12-1-5-3-8-7-11-5-4-10-4-15-1z"/>',
 cloth:'<path d="m6 25 20-20c1-1 3 1 2 2L8 27H5zm17-15 2-2M22 10c-4-6-9-4-12-2C5 12 11 15 13 14s1-5-3-4C5 11 2 17 7 20"/>',
 port:'<path d="M16 8v18M9 14h14M5 19c0 5 4 8 11 9 7-1 11-4 11-9M3 21l2-3 3 2m16 0 3-2 2 3"/><circle cx="16" cy="6" r="3"/>'
};

for(const [type,building] of Object.entries(TYPES)){
 const button=document.createElement('button');
 const [description,note]=TOOL_INFO[type];
 const price=`${building.cost} зл.`;
 button.type='button';
 button.className='tool';
 button.dataset.type=type;
 button.setAttribute('aria-label',localizedLabel(building.name));
 button.setAttribute('aria-describedby','tip-'+type);
 button.innerHTML=`
  <kbd class="hotkey" aria-hidden="true"></kbd>
  <span class="icon"><svg class="construction-glyph" viewBox="0 0 32 32" aria-hidden="true">${ICONS[type]}</svg></span>
  <span class="name">${building.name}</span>
  <span class="cost" data-game-stat="gold">${price}</span>
  <span id="tip-${type}" role="tooltip" class="tool-tip">
   <span class="tool-tip-heading"><strong>${building.name}</strong><kbd class="tool-shortcut"></kbd></span>
   <span class="tool-description"></span>
   <span class="tool-note"></span>
   <span class="tool-tip-facts">
    <span class="tool-fact" data-game-stat="gold">${resourceGlyph('gold')} <b>${price}</b></span>
    <span class="tool-fact"><svg class="ui-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#ui-parcels"/></svg>1 графство</span>
   </span>
   <span class="tool-shortfall" hidden></span>
  </span>`;
 setGameStatText(button.querySelector('.tool-description'),description);
 setGameStatText(button.querySelector('.tool-note'),note);
 button.onclick=()=>selectMode(type);
 $('tools').appendChild(button);
}
function syncShortcutHints(){
 const label=action=>gameSettings.keyName(gameSettings.getKey(action));
 for(const button of $('tools').children){
  const text=label(button.dataset.type);
  button.querySelector('.hotkey').textContent=text;
  button.querySelector('.tool-shortcut').textContent=text;
 }
 $('muster-toggle').querySelector('kbd').textContent=label('muster');
 $('camera-home').title='К столице и исходному ракурсу ('+label('capital')+')';
}
syncShortcutHints();
gameSettings.onChange(syncShortcutHints);
function finishConstruction(result){
 const {building,r}=result;
 if(building.type==='port'){
  if(r.owner==='you')recordRecapPort(state,r);
  const affected=new Set([r.owner]);
  state.visualJobs.push(()=>{refreshCapitalRoutes(false,affected);refreshSupplyShipments(affected)});
 }
 if(building.type==='city'&&state.network){
  attachCity(state.network,r,building);
  for(const other of r.buildings)if(other.product)other.route=state.attachRoute(r,other);
 }
 state.visualJobs.push(()=>{buildingsBuffer=geometryForBuildings();rebuildRoads()});
 dirtyLabels=true;
 showConstructionFeedback(building,COUNCIL_BUILT_LABELS[building.type],r.owner);
}
function onCouncilProject(kind,project,region,result){
 dirtyLabels=true;
 if(kind==='finished')finishConstruction(result);
}
function onCouncilUpgrade(building,owner){
 buildingsBuffer=geometryForBuildings();dirtyLabels=true;
 showConstructionFeedback(building,'Уровень '+building.level,owner);
}
function onCouncilRelief(region){
 showGain(region.slots[0],'Помощь жителям доставлена','receipt');
}

function placeBuilding(x,z){
 const result=build(state,mode,x,z);
 if(!result.ok){flash(result.reason);return result}
 hover=null;clearGhost();
 finishConstruction(result);setSelected(result.r);
 flash(TYPES[mode].name+(result.building.product&&!result.building.route?' · нужна дорога для поставок':' построена'));
 showPlacementPrompt();return result;
}
function renderSlotMarkers(){
 const content=[state.started,state.selected?.id,mode,slotMarkerRevision].join('|');
 if(content!==slotMarkerContent){
  slotMarkerContent=content;
  slotMarkerView='';
  const active=new Set(),layer=$('slot-markers');
  for(const region of state.started?state.regions:[]){
   if(region.owner!=='you'||(!mode&&region!==state.selected))continue;
   const occupiedSlots=new Map(region.buildings.map(building=>[building.slotId,building]));
   for(const slot of region.slots){
    const building=occupiedSlots.get(slot.id);
    if(mode?building:!building)continue;
    const key=region.id+':'+slot.id;
    active.add(key);
    let marker=slotMarkerNodes.get(key);
    if(!marker){
     const element=document.createElement('button');
     element.type='button';
     element.dataset.slot=String(slot.id);element.dataset.region=String(region.id);
     element.innerHTML='<span class="slot-dot"></span><span class="slot-tip"></span>';
     marker={element};
     element.addEventListener('pointerdown',event=>event.stopPropagation());
     const preview=()=>{if(mode&&!marker.building)updateGhost(marker.slot)};
     element.addEventListener('pointerenter',preview);
     element.addEventListener('focus',preview);
     element.addEventListener('pointerleave',()=>{if(mode)clearGhost()});
     element.addEventListener('click',event=>{
      event.stopPropagation();
      if(marker.building)inspectMapBuilding(marker.region,marker.building);
      else if(mode)placeBuilding(marker.slot.x,marker.slot.z);
     });
     slotMarkerNodes.set(key,marker);
     layer.appendChild(element);
    }
    Object.assign(marker,{slot,region,building});
    const check=mode?buildCheck(state,mode,slot.x,slot.z):null;
    const q=mode?productivity(mode,slot.terrain):null;
    const change=q?Math.round((q.multiplier-1)*100):0;
    const desc=building?TYPES[building.type].name+(building.capital?' · столица':building.product?' · уровень '+(building.level||1):'')+
     (building===duchySeat(region)?' · открыть герцогство':' · нажмите для управления'):
     region.name+' · '+LAND_NAMES[slot.terrain]+(q?' · '+(change>=0?'+':'')+change+'% · '+q.rate+' ед./мин':' · 1 место')+
     (check&&!check.ok?' · '+check.reason:'');
    const className='slot-marker'+(building?' occupied':'')+(mode?' choosing':'')+(check&&!check.ok?' unavailable':'');
    if(marker.element.className!==className)marker.element.className=className;
    if(marker.description!==desc){
     marker.description=desc;
     marker.element.setAttribute('aria-label',desc);
     marker.element.firstElementChild.textContent=building?'◆':'+';
     marker.element.lastElementChild.textContent=desc;
    }
   }
  }
  for(const [key,{element}] of slotMarkerNodes){
   if(!active.has(key)){element.remove();slotMarkerNodes.delete(key)}
  }
 }
 if(!slotMarkerNodes.size)return;
 const width=canvas.clientWidth,height=canvas.clientHeight;
 const view=[width,height,cam.x,cam.z,cam.scale,cam.yaw,cam.tilt].join('|');
 if(view===slotMarkerView)return;
 slotMarkerView=view;
 const projected=new Map();
 for(const {region} of slotMarkerNodes.values()){
  if(!projected.has(region)){
   projected.set(region,new Map(region.slots.map(slot=>[slot,project(slot.x,slot.z,surfaceHeight(slot.x,slot.z)+.8)])));
  }
 }
 for(const {element,region,slot} of slotMarkerNodes.values()){
  const positions=projected.get(region),p=positions.get(slot);
  element.hidden=p.x<-35||p.y<-35||p.x>width+35||p.y>height+35;
  if(element.hidden)continue;
  element.style.left=p.x+'px';element.style.top=p.y+'px';
  let nearest=Infinity;
  for(const [other,q] of positions){if(other!==slot)nearest=Math.min(nearest,Math.hypot(q.x-p.x,q.y-p.y))}
  element.style.setProperty('--hit-size',Math.max(24,Math.min(44,nearest*.9))+'px');
 }
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function issueGroupOrder(location,targetOwner=null){
 const group=selectedGroup.slice();
 requestArmyAction(()=>{
  for(const selection of group)selection.offset=simClock;
  return orderArmyGroup(state,group,location,'you',targetOwner);
 },({marches})=>{
  selectedGroup=marches.map(unit=>({kind:'unit',unit}));
  selectedArmy=null;
  flash('Выступили армии: '+selectedGroup.length);
  renderMarches();
 });
}
function selectArea(x1,y1,x2,y2){
 const left=Math.min(x1,x2),right=Math.max(x1,x2),top=Math.min(y1,y2),bottom=Math.max(y1,y2);
 const inside=({x,y})=>x>=left&&x<=right&&y>=top&&y<=bottom;
 const group=[];
 for(const element of marchElements.values()){
  const item=element.armyItem;
  if(!element.hidden&&item.owner==='you'&&!item.house&&!item.key.inBattle&&(inside(item.position)||inside(item.badge))){
   group.push(item.selection);
  }
 }
 const cargos=(state.economy?.shipments||[]).filter(ship=>{
  if(shipmentOwner(ship)!=='you')return false;
  const point=pointOnRoute(ship.path,Math.min(1,(ship.elapsed+(ship.supplyBlocked?0:simClock))/ship.duration));
  return inside(project(point.x,point.z,roadGround(point.x,point.z)+6));
 });
 selectedArmy=null;selectedGroup=group;selectedCargo=null;selectedCargoGroup=cargos;
 closeBuilding();
 $('object-chooser').hidden=true;$('placement').hidden=true;
 $('cargo-inspector').hidden=!!group.length||!cargos.length;
 if(group.length)playSelectionSound('unit');
 else if(cargos.length===1){
  selectedCargo=cargos[0];selectedCargoGroup=[];
  $('object-title').textContent='ВЫБРАННЫЙ ОБОЗ';$('cargo-info').textContent=cargoDescription(selectedCargo);
 }else if(cargos.length){
  $('object-title').textContent='ВЫБРАНО ОБОЗОВ: '+cargos.length;$('cargo-info').textContent='Обозы выполняют свои маршруты автоматически.';
 }
 renderMarches();renderCargo();
 return {armies:group.length,cargos:cargos.length};
}
function updateSelectionBox(rect,x,y){let box=$('selection-box'),a=drag.x-rect.left,b=drag.y-rect.top;box.style.left=Math.min(a,x)+'px';box.style.top=Math.min(b,y)+'px';box.style.width=Math.abs(x-a)+'px';box.style.height=Math.abs(y-b)+'px';box.hidden=false}
canvas.addEventListener('pointerdown',e=>{let button=e.button??0;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,button,select:button===0&&!councilMapOrder&&!mode&&state.started};canvas.setPointerCapture(e.pointerId);if(button!==0)e.preventDefault?.()});
canvas.addEventListener('pointermove',e=>{let rect=canvas.getBoundingClientRect();if(drag){const speed=preferences.mouseSpeed/100;let dx=(e.clientX-drag.lastX)*speed,dy=(e.clientY-drag.lastY)*speed;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;if(drag.moved){if(drag.select){updateSelectionBox(rect,e.clientX-rect.left,e.clientY-rect.top)}else if(drag.button===2){cam.yaw=(cam.yaw||0)-dx*.006;cam.tilt=Math.max(.4,Math.min(1.8,(cam.tilt??DEFAULT_CAMERA_TILT)+dy*.006));dirtyLabels=true}else if(drag.button===1)moveCameraScreen(dx,dy)}drag.lastX=e.clientX;drag.lastY=e.clientY}
 const x=e.clientX-rect.left,y=e.clientY-rect.top;
 if(councilMapOrder)return;
 if(mode){hoverPlacement(x,y);return}
 const p=unproject(x,y);
 hoverRegion=regionAt(state.regions,p.x,p.z);
});
$('cargo-close').onclick=()=>{selectedCargo=null;selectedCargoGroup=[];$('cargo-inspector').hidden=true};
function mapCandidates(x,y){let list=[];for(const [unit,el] of marchElements){if(el.hidden)continue;let dx=parseFloat(el.style.left)-x,dy=parseFloat(el.style.top)-y,d=Math.hypot(dx,dy);if(d<=32)list.push({el,d,label:el.title||'Армия'})}for(const [ship,el] of cargoElements){if(el.hidden)continue;let dx=parseFloat(el.style.left)-x,dy=parseFloat(el.style.top)-y,d=Math.hypot(dx,dy);if(d<=32)list.push({el,d,label:cargoDescription(ship)})}return list.sort((a,b)=>a.d-b.d)}
function chooseMapCandidate(x,y){let options=mapCandidates(x,y);if(!options.length){$('object-chooser').hidden=true;return false}if(options.length===1){options[0].el.click();return true}let menu=$('object-chooser');menu.textContent='';menu.hidden=false;menu.style.left=Math.max(8,Math.min(canvas.clientWidth-240,x))+'px';menu.style.top=Math.max(55,Math.min(canvas.clientHeight-200,y))+'px';for(const option of options.slice(0,8)){let button=document.createElement('button');button.type='button';button.textContent=option.label;button.onclick=()=>{menu.hidden=true;option.el.click()};menu.appendChild(button)}return true}
canvas.addEventListener('pointerup',e=>{if(!drag)return;let moved=drag.moved,button=drag.button,select=drag.select,startX=drag.x,startY=drag.y;let rect=canvas.getBoundingClientRect();$('selection-box').hidden=true;drag=null;if(moved){if(select){if(selectedWarship)$('placement').hidden=true;selectedWarship=null;selectArea(startX-rect.left,startY-rect.top,e.clientX-rect.left,e.clientY-rect.top)}return}if(button===2&&mode){selectMode(mode);return}if(button!==0)return;
 if(councilMapOrder){
  const hit=placementGroundAtScreen(e.clientX-rect.left,e.clientY-rect.top);
  assignCouncilAdvisor(hit?.region);
  return;
 }
 if(mode){
  const hit=placementGroundAtScreen(e.clientX-rect.left,e.clientY-rect.top);
  const slot=hit?.region.owner==='you'?slotAt(hit.region,hit.x,hit.z):null;
  if(slot)placeBuilding(slot.x,slot.z);
  else flash('Выберите свободное графство в своём герцогстве');
  return;
 }
 const x=e.clientX-rect.left,y=e.clientY-rect.top,point=unproject(x,y);
 if(selectedWarship){issueNavalOrder(point);return}
 if(selectedGroup.length||selectedArmy){
  const destination=state.network&&nearestRoadLocation(state.network,point.x,point.z);
  if(!destination){flash('Нет дороги до выбранной точки');return}
  if(selectedGroup.length)issueGroupOrder(destination);
  else issueSingleArmyOrder(destination);
  return;
 }
 if(chooseMapCandidate(x,y))return;
 const region=regionAt(state.regions,point.x,point.z);
 let hit=null,best=18;
 for(const area of state.regions){
  if(area.owner!=='you')continue;
  for(const building of area.buildings){
   const position=project(building.x,building.z,surfaceHeight(building.x,building.z)+2);
   const distance=Math.hypot(position.x-x,position.y-y);
   if(distance<best){best=distance;hit={region:area,building}}
  }
 }
 if(hit){inspectMapBuilding(hit.region,hit.building);return}
 if(!region){closeBuilding();return}
 if(!state.started)chooseCampaignStart(region);
 else{
  closeBuilding();setSelected(region);
  if(duchySeat(region))playSelectionSound('city');
 }
});
canvas.addEventListener('pointercancel',()=>{drag=null;$('selection-box').hidden=true});canvas.addEventListener('wheel',e=>{e.preventDefault();let rect=canvas.getBoundingClientRect(),old=unproject(e.clientX-rect.left,e.clientY-rect.top);cam.scale=Math.max(MIN_MAP_ZOOM,Math.min(MAX_MAP_ZOOM,cam.scale*Math.exp(-e.deltaY*.001*preferences.zoomSpeed/100)));let next=unproject(e.clientX-rect.left,e.clientY-rect.top);cam.x+=old.x-next.x;cam.z+=old.z-next.z;dirtyLabels=true;if(mode&&!councilMapOrder)hoverPlacement(e.clientX-rect.left,e.clientY-rect.top)},{passive:false});
function focusCapital(){let r=state.regions.find(x=>x.id===state.capitalId);if(r){cam.x=r.slots[0].x;cam.z=r.slots[0].z}cam.yaw=0;cam.tilt=DEFAULT_CAMERA_TILT;dirtyLabels=true}
$('camera-home').onclick=focusCapital;
window.addEventListener('keydown',e=>{
 if(occupationDialog.open)return;
 if($('settings-panel').open)return;
 if(warAlerts.length){
  if(e.key==='Escape'){e.preventDefault?.();dismissWarAlert()}
  if(e.key==='Tab'){
   e.preventDefault?.();
   $(e.target?.id==='war-alert-dismiss'?'war-alert-focus':'war-alert-dismiss').focus?.();
  }
  return;
 }
 if(recapPlayback||!$('campaign-finale').hidden){
  if(recapPlayback&&e.key==='Escape'){e.preventDefault?.();closeCampaignReplay()}
  if(e.key==='Tab'){
   const panel=$(recapPlayback?'campaign-recap':'campaign-finale');
   const controls=panel.querySelectorAll?.('button:not([hidden]):not([disabled]),input:not([disabled])');
   if(controls?.length){
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&e.target===first){e.preventDefault?.();last.focus()}
    if(!e.shiftKey&&e.target===last){e.preventDefault?.();first.focus()}
   }
  }
  return;
 }
 if(e.key==='Escape'&&!$('council-month-report').hidden){$('council-month-close').onclick();return}
 if(e.key!=='Escape'&&['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
 if(e.key==='Escape'&&councilMapOrder){$('council-map-cancel').onclick();return}
 const shortcut=e.ctrlKey||e.metaKey||e.altKey?undefined:gameSettings.actionFor(e.code);
 if (shortcut==='muster' && !e.repeat && state.started && !state.defeated && $('border-modal').hidden) {
  setMusterOpen($('muster-panel').hidden); e.preventDefault?.(); return;
 }
 if(e.key==='Escape'&&!$('council-panel').hidden&&$('border-modal').hidden&&$('campaign-finale').hidden){showCouncil(false);return}
 if (e.key==='Escape' && !$('muster-panel').hidden && $('border-modal').hidden) {setMusterOpen(false);return}
 if(e.key==='Escape'&&selectedWarship){selectedWarship=null;$('placement').hidden=true;renderFleet();return}if(e.key==='Escape'){if(!$('campaign-finale').hidden)return;if(!$('campaign-panel').hidden){showCampaignPanel(false);return}if(!$('border-modal').hidden){closeBorderModal();return}if(selectedArmy||selectedGroup.length||selectedCargo||selectedCargoGroup.length){selectedArmy=null;selectedGroup=[];selectedCargo=null;selectedCargoGroup=[];$('placement').hidden=true;$('cargo-inspector').hidden=true;renderMarches();renderCargo()}else if(mode){clearCameraInput();globalThis.gameShell?.pause();}
 else if(!$('realm-overview').hidden)$('realm-overview-close').onclick();
 else if(!$('notifications-panel').hidden)$('notifications-toggle').onclick();
 else if(selectedBuilding)closeBuilding();
 else if(state.selected)setSelected(null);
 else if(state.started){cameraKeys.clear();globalThis.gameShell?.pause()}
 return}
 if(e.defaultPrevented||!shortcut)return;
 if(shortcut==='capital'){focusCapital();e.preventDefault();return;}
 if(Object.hasOwn(TYPES,shortcut)){if(!e.repeat)selectMode(shortcut);e.preventDefault();return;}
 if(shortcut.startsWith('camera')||shortcut.startsWith('turn')||shortcut.startsWith('tilt')){cameraKeys.set(e.code,shortcut);e.preventDefault();}
});
window.addEventListener('keyup',e=>cameraKeys.delete(e.code));
function clearCameraInput(){cameraKeys.clear();drag=null;$('selection-box').hidden=true;}
window.addEventListener('blur',clearCameraInput);
window.addEventListener('game-settings-open',clearCameraInput);
$('defeat-restart').onclick=()=>$('reset').onclick();
function resetGame(){
 campaignStartChoice=null;
 $('setup-start').disabled=true;$('setup-all').value='';
 $('scenario-intro').textContent='Выберите один из предложенных стартов или город на карте.';
 for(const button of $('campaign-starts').children)button.setAttribute('aria-pressed','false');
 warAlerts.length=0;warAlertReturnFocus=null;$('war-alert').hidden=true;closeCampaignReplay(false);resetGameFeedback();$('app').classList.add('campaign-setup');hideActionExplanation();duchyTab='overview';$('duchy-pages').scrollTop=0;
 for(const id of ['duchy-control-details','duchy-war-details'])$(id).open=false;$('council-month-report').hidden=true;showCouncil(false);showCouncilTab('steward');
 councilDrafts.clear();cityAdvisors.clear();
 showCampaignPanel(false);$('campaign-finale').hidden=true;realmFilter='all';for(const filter of realmFilters) $('realm-'+filter).setAttribute('aria-pressed',String(filter==='all'));$('fleet-actions').hidden=true;selectedWarship=null;for(const marker of fleetMarkers.values())marker.remove();fleetMarkers.clear();orderPing=null;$('order-ping').hidden=true;$('patrol-range').hidden=true;$('muster-list').dataset.regions='';setMusterOpen(false);$('realm-overview').hidden=true;$('realm-overview-toggle').setAttribute('aria-expanded','false');closeBorderModal();$('defeat').hidden=true;$('notifications-panel').hidden=true;$('notifications-toggle').setAttribute('aria-expanded','false');closeBuilding();for(const el of cargoElements.values())el.remove();cargoElements.clear();$('effects-layer').textContent='';$('resource-bar').hidden=true;simClock=0;lastFrame=null;state={regions:HISTORICAL_REGIONS.map(initRegion),gold:450,started:false,selected:null};updateParcelStyles([]);mode=null;hover=null;$('app').classList.remove('placing-buildings');$('army-layer').style.zIndex='4';$('cargo-layer').style.zIndex='3';selectedArmy=null;selectedGroup=[];selectedCargo=null;selectedCargoGroup=[];$('selection-box').hidden=true;$('cargo-inspector').hidden=true;$('object-chooser').hidden=true;lastSlotAffordability='';playerGeneralSlot=1;for(const el of battlePanels.values())el.remove();battlePanels.clear();for(const el of siegePanels.values())el.remove();siegePanels.clear();if(trafficBuffer){gl.deleteBuffer(trafficBuffer.buffer);trafficBuffer=null}if(selectedRouteBuffer){gl.deleteBuffer(selectedRouteBuffer.buffer);selectedRouteBuffer=null}selectedRoutePath=null;deleteMeshBatch(parcelDecorBuffer);parcelDecorBuffer=null;parcelDecorCache.clear();parcelSignature='';parcelSurfaceSignature='';trafficRebuildAt=0;for(const el of marchElements.values())el.remove();marchElements.clear();document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));$('intro').hidden=false;$('placement').hidden=true;clearGhost();buildingsBuffer=geometryForBuildings();rebuildRoads();cam=startingCamera();clearCountryTints();refreshBorders();dirtyLabels=true;renderNotifications();updateUI()}
$('reset').onclick=resetGame;
closeBorderModal();$('notifications-panel').hidden=true;renderNotifications();updateUI();
const MALAGA_START_BUILDINGS={port:[3,'port'],sawmill:[5,'wood'],mine:[2,'iron'],weaver:[5,'cloth']};
function applyMalagaStart(region,view){
 const [slotId,type]=Object.hasOwn(MALAGA_START_BUILDINGS,view)?MALAGA_START_BUILDINGS[view]:[];
 for(const id of [3,view==='mine'?2:5,6]){
  const site=region.slots[id];
  build(state,id===slotId?type:'grain',site.x,site.z);
 }
}
function startMalaga(view){
 if(!pilotLand||state.started)return;
 const region=state.regions.find(r=>r.key==='malaga');
 const [slotId,type]=Object.hasOwn(MALAGA_START_BUILDINGS,view)?MALAGA_START_BUILDINGS[view]:[];
 start(region,null,{malagaView:view||'landscape'});
 Object.assign(cam,{x:267,z:714,scale:.033,yaw:.01,tilt:1.1});
 if(type){
  const site=region.slots[slotId];
  const point=type==='port'?portWaterCell(site):site;
  Object.assign(cam,{x:(site.x+point.x)/2,z:(site.z+point.z)/2,scale:type==='port'?.066:.078,yaw:{port:-.32,wood:.32,iron:-.29,cloth:.27}[type],tilt:{port:1.05,wood:1.05,iron:1.02,cloth:1.03}[type]});
 }
 dirtyLabels=true;updateUI();
 flash(type?'Малага · '+TYPES[type].name.toLowerCase()+' и две фермы':'Малага · три фермы снабжают столицу');
}
if(typeof location!=='undefined'){
 const params=new URLSearchParams(location.search);
 const region=params.has('region')?state.regions.find(r=>r.key===params.get('region')):null;
 if(region&&!params.has('start')){
  const site=region.slots[0];
  const panorama=params.get('view')==='landscape';
  Object.assign(cam,panorama?{x:site.x+14,z:site.z+15,scale:.0215,yaw:-.06,tilt:1.04}:{x:site.x,z:site.z,scale:.042,yaw:-.17,tilt:1.16});
  dirtyLabels=true;
 }
}
if(pilotLand){
 if(typeof location!=='undefined'){
  const query=new URLSearchParams(location.search);
  if(query.get('start')==='malaga'){
   startMalaga(query.get('view'));
   if(query.get('view')==='city'){
    const home=state.selected.slots[0];
    Object.assign(cam,{x:home.x,z:home.z,scale:.065,yaw:-.28,tilt:1.08});
    dirtyLabels=true;
   }
  }
 }
}
mapImagesRegistered=true;reportMapMaterials();
requestAnimationFrame(draw);
