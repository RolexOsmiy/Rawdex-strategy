'use strict';

const seaDistance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const TILE = 16;
const STEPS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function seaInRing([x,y],ring) {
 let inside = false;
 for (let i=1;i<ring.length;i++) {
  const [ax,ay]=ring[i-1], [bx,by]=ring[i];
  if ((ay>y)!==(by>y) && x<ax+(y-ay)*(bx-ax)/(by-ay)) inside=!inside;
 }
 return inside;
}

function linesMeet(a,b,c,d) {
 if (Math.max(a[0],b[0])<Math.min(c[0],d[0]) || Math.min(a[0],b[0])>Math.max(c[0],d[0]) ||
     Math.max(a[1],b[1])<Math.min(c[1],d[1]) || Math.min(a[1],b[1])>Math.max(c[1],d[1])) return false;
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 return cross(a,b,c)*cross(a,b,d)<=1e-10 && cross(c,d,a)*cross(c,d,b)<=1e-10;
}

function pointSegmentDistanceSquared(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den?Math.min(1,Math.max(0,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
 const x=p[0]-a[0]-t*dx,y=p[1]-a[1]-t*dy;
 return x*x+y*y;
}

function segmentsTooClose(a,b,c,d,radiusSquared){
 return linesMeet(a,b,c,d)||(radiusSquared>0&&(
  pointSegmentDistanceSquared(a,c,d)<radiusSquared||pointSegmentDistanceSquared(b,c,d)<radiusSquared||
  pointSegmentDistanceSquared(c,a,b)<radiusSquared||pointSegmentDistanceSquared(d,a,b)<radiusSquared));
}

class RouteQueue {
 items=[];
 push(cell,priority) {
  const a=this.items;
  let i=a.length;
  a.push(null);
  while(i>0) {
   const parent=(i-1)>>1;
   if(a[parent].priority<=priority) break;
   a[i]=a[parent];
   i=parent;
  }
  a[i]={cell,priority};
 }
 pop() {
  const a=this.items, top=a[0], last=a.pop();
  if(!a.length) return top.cell;
  let i=0;
  while(i*2+1<a.length){
   let child=i*2+1;
   if(child+1<a.length&&a[child+1].priority<a[child].priority) child++;
   if(last.priority<=a[child].priority) break;
   a[i]=a[child];
   i=child;
  }
  a[i]=last;
  return top.cell;
 }
}

class SeaNavigator {
 constructor(chart) {
  this.size=chart.size;
  this.bounds=chart.gridBounds||[0,0,chart.size[0],chart.size[1]];
  this.step=chart.gridKm;
  this.clearance=chart.clearance||0;
  this.heuristicWeight=chart.heuristicWeight||1;
  this.width=Math.floor(chart.size[0]/this.step)+1;
  this.height=Math.floor(chart.size[1]/this.step)+1;
  this.shore=new Map();
  this.land=chart.land.map((rings)=>{
   const points=rings[0];
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   for(const [x,y] of points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
   return {rings,minX,minY,maxX,maxY};
  });
  const cells=this.width*this.height;
  this.mask=new Uint8Array(cells);
  this.visits=new Uint32Array(cells);
  this.done=new Uint32Array(cells);
  this.cost=new Float32Array(cells);
  this.parent=new Int32Array(cells);
  this.search=0;
  this.buildGrid();
  if(this.clearance)this.markShallowCells();
  const [x0,y0,x1,y1]=this.bounds;
  if(chart.gridBounds)for(let y=0;y<this.height;y++){
   const offset=y*this.width;
   if(y*this.step<y0||y*this.step>y1)this.mask.fill(1,offset,offset+this.width);
   else{
    this.mask.fill(1,offset,offset+Math.ceil(x0/this.step));
    this.mask.fill(1,offset+Math.floor(x1/this.step)+1,offset+this.width);
   }
  }
 }
 buildGrid() {
  const step=this.step;
  for(const {rings,minY,maxY} of this.land) {
   const rows=Array.from({length:this.height},()=>[]);
   for(const ring of rings) for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i];
    const x0=Math.floor(Math.min(a[0],b[0])/TILE), x1=Math.floor(Math.max(a[0],b[0])/TILE);
    const y0=Math.floor(Math.min(a[1],b[1])/TILE), y1=Math.floor(Math.max(a[1],b[1])/TILE);
    const segment=[a,b];
    for(let ty=y0;ty<=y1;ty++) for(let tx=x0;tx<=x1;tx++){
     const key=ty*10000+tx;
     if(!this.shore.has(key)) this.shore.set(key,[]);
     this.shore.get(key).push(segment);
    }
    const low=Math.min(a[1],b[1]),high=Math.max(a[1],b[1]);
    for(let row=Math.max(0,Math.ceil(low/step));row<this.height&&row*step<high;row++)
     rows[row].push(a[0]+(row*step-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   for(let row=Math.max(0,Math.ceil(minY/step));row<this.height&&row*step<=maxY;row++){
    const hits=rows[row].sort((a,b)=>a-b);
    for(let i=1;i<hits.length;i+=2){
     const lo=Math.max(0,Math.ceil(hits[i-1]/step)),hi=Math.min(this.width,Math.floor(hits[i]/step)+1);
     if(hi>lo) this.mask.fill(1,row*this.width+lo,row*this.width+hi);
    }
   }
  }
 }
 inMap([x,y]) {const [x0,y0,x1,y1]=this.bounds;return x>=x0&&y>=y0&&x<=x1&&y<=y1}
 isWater(p){
  if(!this.inMap(p)) return false;
  const [x,y]=p;
  return !this.land.some(({rings,minX,minY,maxX,maxY})=>x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&
   seaInRing(p,rings[0])&&!rings.slice(1).some(ring=>seaInRing(p,ring)));
 }
 markShallowCells(){
  const step=this.step,r=this.clearance,r2=r*r;
  const marked=new Set();
  for(const bucket of this.shore.values())for(const segment of bucket){
   if(marked.has(segment))continue;
   marked.add(segment);
   const [a,b]=segment;
   const x0=Math.max(0,Math.ceil((Math.min(a[0],b[0])-r)/step));
   const x1=Math.min(this.width-1,Math.floor((Math.max(a[0],b[0])+r)/step));
   const y0=Math.max(0,Math.ceil((Math.min(a[1],b[1])-r)/step));
   const y1=Math.min(this.height-1,Math.floor((Math.max(a[1],b[1])+r)/step));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const cell=y*this.width+x;
    if(!this.mask[cell]&&pointSegmentDistanceSquared([x*step,y*step],a,b)<r2)this.mask[cell]=1;
   }
  }
 }
 clearSegment(a,b){
  const r=this.clearance,r2=r*r;
  // Walk only the tiles along the course. An axis-aligned rectangle around a
  // diagonal crossing would also visit every coastal tile inside that rectangle.
  const span=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))/TILE));
  const checked=span>1?new Set():null;
  for(let i=0;i<span;i++){
   const t=i/span,u=(i+1)/span,ax=a[0]+(b[0]-a[0])*t,ay=a[1]+(b[1]-a[1])*t;
   const bx=a[0]+(b[0]-a[0])*u,by=a[1]+(b[1]-a[1])*u;
   const x0=Math.floor((Math.min(ax,bx)-r)/TILE),x1=Math.floor((Math.max(ax,bx)+r)/TILE);
   const y0=Math.floor((Math.min(ay,by)-r)/TILE),y1=Math.floor((Math.max(ay,by)+r)/TILE);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const key=y*10000+x;
    if(checked?.has(key))continue;
    checked?.add(key);
    const bucket=this.shore.get(key);
    if(bucket?.some(([c,d])=>segmentsTooClose(a,b,c,d,r2)))return false;
   }
  }
  return true;
 }
 safeWater(point){return this.isWater(point)&&this.clearSegment(point,point)}
 snap(point) {
  const step=this.step, cx=Math.round(point[0]/step), cy=Math.round(point[1]/step);
  let best=-1,min=Infinity;
  for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){
   const x=cx+dx,y=cy+dy;
   if(x<0||x>=this.width||y<0||y>=this.height) continue;
   const id=y*this.width+x,p=[x*step,y*step];
   const gap=seaDistance(point,p);
   if(gap<min&&!this.mask[id]&&this.clearSegment(point,p)){min=gap;best=id}
  }
  return best;
 }
 component(cell){
  if(!this.components){
   const {width,height,mask}=this,size=width*height;
   const groups=new Uint16Array(size),queue=new Int32Array(size);
   let group=0;
   for(let id=0;id<size;id++){
    if(mask[id]||groups[id])continue;
    let end=1;
    groups[id]=++group;
    queue[0]=id;
    for(let i=0;i<end;i++){
     const current=queue[i],x=current%width,y=Math.floor(current/width);
     if(x>0&&!mask[current-1]&&!groups[current-1]){groups[current-1]=group;queue[end++]=current-1}
     if(x+1<width&&!mask[current+1]&&!groups[current+1]){groups[current+1]=group;queue[end++]=current+1}
     if(y>0&&!mask[current-width]&&!groups[current-width]){groups[current-width]=group;queue[end++]=current-width}
     if(y+1<height&&!mask[current+width]&&!groups[current+width]){groups[current+width]=group;queue[end++]=current+width}
    }
   }
   this.components=groups;
  }
  return this.components[cell];
 }
 point(cell) {return [(cell%this.width)*this.step,Math.floor(cell/this.width)*this.step]}
 route(from,to){
  if(!this.safeWater(from)||!this.safeWater(to)) return null;
  if(this.clearSegment(from,to)) return {points:[from,to],km:seaDistance(from,to)};
  const start=this.snap(from), goal=this.snap(to);
  if(start<0||goal<0||this.clearance&&this.component(start)!==this.component(goal)) return null;
  const w=this.width,h=this.height,step=this.step,token=++this.search;
  const goalX=goal%w,goalY=Math.floor(goal/w), queue=new RouteQueue();
  this.visits[start]=token;this.cost[start]=0;this.parent[start]=-1;
  queue.push(start,0);
  while(queue.items.length){
   const cell=queue.pop();
   if(this.done[cell]===token) continue;
   if(cell===goal){
    const path=[];
    for(let i=goal;i>=0;i=this.parent[i]) path.push(this.point(i));
    path.push(from);
    path.reverse();
    path.push(to);
    const points=this.simplify(path);
    return {points,km:points.slice(1).reduce((sum,p,i)=>sum+seaDistance(p,points[i]),0)};
   }
   this.done[cell]=token;
   const x=cell%w,y=Math.floor(cell/w),a=[x*step,y*step];
   for(const [dx,dy] of STEPS){
    const nx=x+dx,ny=y+dy;
    if(nx<0||nx>=w||ny<0||ny>=h) continue;
    const next=ny*w+nx;
    if(this.mask[next]||this.done[next]===token) continue;
    const diagonal=dx&&dy;
    const cost=this.cost[cell]+(diagonal?Math.SQRT2:1);
    if(this.visits[next]===token&&cost>=this.cost[next]-1e-5) continue;
    if(diagonal&&(this.mask[y*w+nx]||this.mask[ny*w+x])) continue;
    if(!this.clearSegment(a,[nx*step,ny*step])) continue;
    this.visits[next]=token;this.cost[next]=cost;this.parent[next]=cell;
    const vx=Math.abs(nx-goalX),vy=Math.abs(ny-goalY);
    const estimate=Math.max(vx,vy)+(Math.SQRT2-1)*Math.min(vx,vy);
    queue.push(next,cost+this.heuristicWeight*estimate);
   }
  }
  return null;
 }
 simplify(path){
  const points=[path[0]];
  let current=0;
  while(current<path.length-1){
   let next=Math.min(path.length-1,current+96);
   while(next>current+1&&!this.clearSegment(path[current],path[next])) next--;
   if(seaDistance(path[current],path[next])>0.001) points.push(path[next]);
   current=next;
  }
  return points;
 }
}

if(typeof module!=='undefined') module.exports={SeaNavigator,segmentsTooClose};
