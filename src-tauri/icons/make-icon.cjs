'use strict';
// Рисует иконку 512×512 (герб: тёмно-зелёный щит, золотое кольцо и звезда)
// без внешних зависимостей и сохраняет рядом как icon.png.
// Запуск: node src-tauri/icons/make-icon.cjs
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

const SIZE=512;
const img=Buffer.alloc(SIZE*SIZE*4);

const TOP=40,FULL=250,TAPER=90,HALF=235;
const insideShield=(x,y)=>{
 const dy=y-TOP;
 if(dy<0||dy>FULL+TAPER)return false;
 const dx=Math.abs(x-SIZE/2);
 let half=dy<FULL?HALF:HALF*(1-(dy-FULL)/TAPER);
 if(dx>half)return false;
 // скруглённые верхние углы
 if(dy<70&&dx>half-70){
  if(Math.hypot(dx-(half-70),dy-70)>70)return false;
 }
 return true;
};
const insideStar=(x,y,cx=SIZE/2,cy=200,outer=70,inner=28)=>{
 const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy);
 if(r>outer)return false;
 const a=Math.atan2(dy,dx);
 const s=Math.abs(Math.sin((a+Math.PI/2)*5/2));
 return r<=inner+(outer-inner)*s;
};
const inRing=(x,y)=>{
 const r=Math.hypot(x-SIZE/2,y-200);
 return r>=95&&r<=109;
};
const set=(x,y,r,g,b,a)=>{
 if(x<0||y<0||x>=SIZE||y>=SIZE)return;
 const i=(y*SIZE+x)*4;
 img[i]=r;img[i+1]=g;img[i+2]=b;img[i+3]=a;
};
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 if(!insideShield(x,y))continue;
 const grad=1-.22*(y/SIZE);
 let r=Math.round(24*grad),g=Math.round(35*grad),b=Math.round(30*grad),a=255;
 const edge=!(insideShield(x+1,y)&&insideShield(x-1,y)&&insideShield(x,y+1)&&insideShield(x,y-1));
 if(edge){r=201;g=165;b=63}
 if(inRing(x,y)){r=201;g=165;b=63}
 if(insideStar(x,y)){r=213;g=189;b=127}
 set(x,y,r,g,b,a);
}
// мягкая тень под щитом
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 if(img[(y*SIZE+x)*4+3]>0)continue;
 const d=Math.hypot((x-SIZE/2)/1.15,(y-410)/1.4);
 if(d<160){const t=1-d/160;set(x,y,0,0,0,Math.round(t*t*26))}
}

// --- PNG (RGBA, без зависимостей) ---
const crcTable=[];
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable.push(c>>>0)}
const crc32=buf=>{let c=0xFFFFFFFF;for(const byte of buf)c=crcTable[(c^byte)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
const chunk=(type,data)=>{
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const body=Buffer.concat([Buffer.from(type,'ascii'),data]);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));
 return Buffer.concat([len,body,crc]);
};
const ihdr=Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE,0);ihdr.writeUInt32BE(SIZE,4);
ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
const raw=Buffer.alloc(SIZE*(SIZE*4+1));
for(let y=0;y<SIZE;y++)img.copy(raw,y*(SIZE*4+1)+1,y*SIZE*4,(y+1)*SIZE*4);
const png=Buffer.concat([
 Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
 chunk('IHDR',ihdr),
 chunk('IDAT',zlib.deflateSync(raw,{level:9})),
 chunk('IEND',Buffer.alloc(0))
]);
const out=path.join(__dirname,'icon.png');
fs.writeFileSync(out,png);
console.log('icon.png готов:',out,png.length+' байт');
