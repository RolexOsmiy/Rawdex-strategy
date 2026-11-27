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
  this.loaded=Promise.all([load('desk'),load(map)]).then(([desk,base])=>{
   this.desk=desk;this.base=base;this.ready=!!this.context;
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
 contains(x,y,margin=0){
  const a=this.area(this.canvas.clientWidth,this.canvas.clientHeight);
  return x>=a.left+margin&&x<=a.right-margin&&y>=a.top+margin&&y<=a.bottom-margin;
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
 makePaper(width,height,ratio){
  const paper=new Path2D(),points=[];
  const a=this.area(width,height);
  const corners=[[a.left,a.top],[a.right,a.top],[a.right,a.bottom],[a.left,a.bottom]];
  for(let edge=0;edge<4;edge++){
   const [x,y]=corners[edge],[nextX,nextY]=corners[(edge+1)%4];
   const count=Math.max(1,Math.round(Math.hypot(nextX-x,nextY)/7));
   for(let i=0;i<count;i++){
    const t=i/count,seed=edge*37+i;
    const grain=Math.sin(seed*127.1+9.7)*43758.5453;
    const tear=((grain-Math.floor(grain)-.5)*5.2+Math.sin(seed*.37)*1.55)*Math.min(1,i/3,(count-i)/3);
    points.push([x+(nextX-x)*t+(edge%2?tear:0),y+(nextY-y)*t+(edge%2?0:tear)]);
   }
  }
  paper.moveTo(...points[0]);
  for(const point of points.slice(1))paper.lineTo(...point);
  paper.closePath();
  this.canvas.parentElement.style.setProperty('--atlas-clip',`path("M${points.map(([x,y])=>x.toFixed(1)+' '+y.toFixed(1)).join(' L')} Z")`);
  const backing=document.createElement('canvas');
  backing.width=Math.round(width*ratio);backing.height=Math.round(height*ratio);
  const ctx=backing.getContext('2d');
  ctx.scale(ratio,ratio);
  const zoom=Math.max(width/this.desk.width,height/this.desk.height);
  const dw=this.desk.width*zoom,dh=this.desk.height*zoom;
  ctx.drawImage(this.desk,(width-dw)*.5,(height-dh)*.5,dw,dh);
  const shade=ctx.createRadialGradient(width*.48,height*.42,height*.18,width*.48,height*.42,Math.max(width,height)*.65);
  shade.addColorStop(0,'rgba(38,26,19,.15)');shade.addColorStop(1,'rgba(16,10,8,.56)');
  ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
  return {paper,backing};
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
  if(!this.frame||this.canvas.width!==w||this.canvas.height!==h){
   this.canvas.width=w;this.canvas.height=h;
   this.frame=this.makePaper(width,height,ratio);
   this.lastPaint=null;
  }
  const paint=this.politics(regions,neighbors,colors);
  const key=[paint.signature,selected?.id,scale,tilt,yaw,x,z,paper,routes.length,showTrees].join('|');
  if(key===this.lastPaint&&routes.every((route,i)=>route===this.lastRoutes[i]))return;
  this.lastPaint=key;this.lastRoutes=routes;
  const ctx=this.context;
  ctx.setTransform(1,0,0,1,0,0);
  if(paper)ctx.drawImage(this.frame.backing,0,0);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  let sheet=this.frame.paper;
  if(paper>0&&paper<1){
   const a=this.area(width,height);
   const outset=1-paper,left=(a.left+6)*outset,top=(a.top+6)*outset;
   const sx=1+2*left/(a.right-a.left),sy=1+(a.top+height-a.bottom+12)*outset/(a.bottom-a.top);
   sheet=new Path2D();
   sheet.addPath(this.frame.paper,new DOMMatrix([sx,0,0,sy,a.left-left-a.left*sx,a.top-top-a.top*sy]));
  }
  ctx.fillStyle='#a69778';
  if(paper){
   ctx.shadowColor='rgba(18,11,8,.68)';ctx.shadowBlur=17*ratio;ctx.shadowOffsetY=6*ratio;
   ctx.fill(sheet);
   ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  }else ctx.fillRect(0,0,width,height);
  ctx.save();
  if(paper)ctx.clip(sheet);
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
  if(paper){
   ctx.lineWidth=2.8;ctx.strokeStyle='rgba(86,67,43,.63)';ctx.stroke(sheet);
   ctx.save();ctx.clip(sheet);
   ctx.lineWidth=5.2;ctx.strokeStyle='rgba(224,200,154,.27)';ctx.stroke(sheet);
   ctx.lineWidth=2.2;ctx.strokeStyle='rgba(234,213,170,.62)';ctx.stroke(sheet);
   ctx.restore();
  }
 }
}
