'use strict';

const DIPLOMATIC_ATLAS_MAPS={
 baltic:{label:[231,121,'БАЛТИЙСКОЕ МОРЕ']},
 mediterranean:{label:[1340,835,'СРЕДИЗЕМНОЕ МОРЕ']}
};
const ATLAS_INK={you:'#C6A34F',bot:'#B96655',bot2:'#677DA1',bot3:'#778856'};

class DiplomaticAtlas{
 constructor(canvas,map,regions){
  this.canvas=canvas;
  this.context=canvas.getContext('2d');
  this.map=DIPLOMATIC_ATLAS_MAPS[map]||DIPLOMATIC_ATLAS_MAPS.baltic;
  this.extent=CAMPAIGN_RIVERS.backdrop.extent;
  this.edge=document.querySelector("#map-paper-edge path");
  const boxes=regions.flatMap(region=>region.bounds);
  this.bounds=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
   Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
  const [x0,z0,x1,z1]=this.bounds;
  this.center={x:(x0+x1)/2,z:(z0+z1)/2};
  this.shapes=new Map(regions.map(region=>[region.id,recapPolygons(region.polys)]));
  this.riverLines=new Path2D();
  for(const [,,rank,points] of CAMPAIGN_RIVERS.lines){
   if(rank>5)continue;
   this.riverLines.moveTo(...points[0]);
   for(const point of points.slice(1))this.riverLines.lineTo(...point);
  }
  this.ready=false;
  const load=name=>new Promise((resolve,reject)=>{
   const image=new Image();
   image.onload=()=>resolve(image);
   image.onerror=reject;
   image.src='maps/atlas/diplomatic-'+name+'.webp?v='+globalThis.__gameScriptStamp;
  });
  this.loaded=load(map).then(base=>{
   this.base=base;this.ready=!!this.context;
   return this.ready;
  },()=>false);
 }
 area(width,height){
  const side=Math.max(12,Math.min(width*.055,height*.105));
  return {left:side,top:Math.min(93,Math.max(48,height*.091)),
   right:width-side,bottom:height-Math.min(113,Math.max(60,height*.117))};
 }
 fit(width,height,yaw){
  const [x0,z0,x1,z1]=this.bounds,area=this.area(width,height);
  const x=x1-x0+42,z=z1-z0+42,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
  return 2/height*Math.min((area.right-area.left-26)/(c*x+s*z),(area.bottom-area.top-23)/(s*x+c*z));
 }
 contains(x,y){return !!this.sheetPoints&&inRing(x,y,this.sheetPoints)}
 updateSheet(view){
  if(this.sheetView===view||!view.width||!view.height)return;
  this.sheetView=view;
  this.sheetTerrain??=CAMPAIGN_RIVERS.paper.map(([x,z])=>[x,Math.max(-1,backgroundHeight(x,z)),z]);
  const {width,height,x,z,c,s,scale,tilt,norm,opacity}=view,zoom=height*scale*.5;
  this.sheetPoints=this.sheetTerrain.map(([px,y,pz])=>{
   const dx=px-x,dz=pz-z;
   return [width*.5+(c*dx-s*dz)*zoom,height*.5+((s*dx+c*dz)*tilt-y*(1-opacity))*zoom/norm];
  });
  const path='M'+this.sheetPoints.map(([x,y])=>x.toFixed(1)+' '+y.toFixed(1)).join(' L')+' Z';
  this.sheet=new Path2D(path);
  this.edge.setAttribute('d',path);
  this.canvas.parentElement.style.setProperty('--map-sheet',`path("${path}")`);
 }
 prepareWoods(layers){
  const canopy=document.createElement('canvas');
  canopy.width=this.base.width;canopy.height=this.base.height;
  const brush=canopy.getContext('2d');
  const [x0,z0,x1,z1]=this.extent;
  const scaleX=canopy.width/(x1-x0),scaleZ=canopy.height/(z1-z0);
  brush.globalAlpha=.72;
  let layer=0,offset=0;
  const paintBatch=()=>{
   let remaining=512;
   while(layer<layers.length&&remaining>0){
    const {image,stamps}=layers[layer],width=image.naturalWidth,height=image.naturalHeight;
    for(;offset<stamps.length&&remaining>0;offset+=8,remaining--){
     const x=(stamps[offset]-x0)*scaleX,z=(stamps[offset+1]-z0)*scaleZ;
     const w=stamps[offset+2]*scaleX*1.34,h=stamps[offset+3]*scaleZ*.62;
     brush.drawImage(image,stamps[offset+4]*width,stamps[offset+5]*height,stamps[offset+6]*width,stamps[offset+7]*height,
      x-w/2,z-h*.53,w,h);
    }
    if(offset===stamps.length){layer++;offset=0}
   }
   if(layer<layers.length)requestIdleCallback(paintBatch,{timeout:160});
   else{this.woods=canopy;this.lastPaint=null}
  };
  requestIdleCallback(paintBatch,{timeout:160});
 }
 politics(regions,neighbors,colors){
  const signature=regions.map(r=>r.owner).join(',');
  if(this.paint?.signature===signature)return this.paint;
  const fills=new Map(),territory=new Path2D(),inside=new Path2D(),frontiers=new Path2D();
  const byId=new Map(regions.map(region=>[region.id,region]));
  for(const region of regions){
   if(region.owner==='neutral')continue;
   if(!fills.has(region.owner))fills.set(region.owner,new Path2D());
   const path=this.shapes.get(region.id);
   fills.get(region.owner).addPath(path);
   territory.addPath(path);
   for(const [a,b,id] of neighbors(region)){
    const adjacent=byId.get(id);
    if(adjacent?.owner!=='neutral'&&adjacent?.id<region.id)continue;
    const outline=adjacent?.owner===region.owner?inside:frontiers;
    outline.moveTo(a[0],a[2]);outline.lineTo(b[0],b[2]);
   }
  }
  const inks=[...fills].map(([owner,path])=>[ATLAS_INK[owner]||paletteCss(colors[owner]||[.52,.45,.39]),path]);
  return this.paint={signature,inks,territory,inside,frontiers};
 }
 render(view,regions,neighbors,colors,selected,routes,showTrees){
  const {width,height,scale,tilt,norm,yaw,x,z,paper}=view;
  const ratio=Math.min(1.65,devicePixelRatio||1);
  const w=Math.round(width*ratio),h=Math.round(height*ratio);
  if(!w||!h)return;
  if(this.canvas.width!==w||this.canvas.height!==h){
   this.canvas.width=w;this.canvas.height=h;
   this.lastPaint=null;
  }
  const paint=this.politics(regions,neighbors,colors);
  const key=[paint.signature,selected?.id,scale,tilt,yaw,x,z,paper,routes.length,showTrees].join('|');
  if(key===this.lastPaint&&routes.every((route,i)=>route===this.lastRoutes[i]))return;
  this.lastPaint=key;this.lastRoutes=routes;
  const ctx=this.context;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.save();
  ctx.clip(this.sheet);
  ctx.fillStyle='#a69778';
  ctx.fill(this.sheet);
  const zoom=height*scale/2,vertical=zoom*tilt/norm,c=Math.cos(yaw),s=Math.sin(yaw);
  ctx.transform(c*zoom,s*vertical,-s*zoom,c*vertical,width*.5-zoom*(c*x-s*z),height*.5-vertical*(s*x+c*z));
  const [x0,z0,x1,z1]=this.extent,dw=x1-x0,dh=z1-z0;
  ctx.drawImage(this.base,x0,z0,dw,dh);
  ctx.globalAlpha=.62;
  for(const [ink,path] of paint.inks){ctx.fillStyle=ink;ctx.fill(path,'evenodd')}
  ctx.globalAlpha=1;
  if(showTrees&&this.woods){
   ctx.save();
   ctx.clip(paint.territory,'evenodd');
   ctx.drawImage(this.woods,x0,z0,dw,dh);
   ctx.restore();
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  const stroke=(path,color,weight)=>{ctx.strokeStyle=color;ctx.lineWidth=weight/zoom;ctx.stroke(path)};
  ctx.save();
  const riverExtent=new Path2D();
  riverExtent.rect(x0,z0,dw,dh);
  ctx.clip(riverExtent);
  stroke(this.riverLines,'rgba(46,84,97,.74)',1.05);
  ctx.restore();
  stroke(paint.inside,'rgba(110,92,72,.38)',.8);
  stroke(paint.frontiers,'rgba(100,84,58,.62)',2.4);
  stroke(paint.frontiers,'rgba(237,214,156,.90)',1.35);
  const outline=selected&&this.shapes.get(selected.id);
  if(outline){
   stroke(outline,'rgba(62,43,23,.83)',3.6);
   stroke(outline,'#F1CA72',1.85);
  }
  for(const route of routes){
   const path=new Path2D();
   path.moveTo(route[0].x,route[0].z);
   for(const point of route.slice(1))path.lineTo(point.x,point.z);
   stroke(path,'rgba(28,51,32,.9)',3.4);
   stroke(path,'#B5CF77',1.65);
  }
  ctx.restore();
 }
}
