#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uCaptureOrigin;uniform float uCaptureRadius;uniform float uCaptureStrength;uniform vec3 uCaptureOld;uniform float uCaptureOldMix;
varying vec3 vColor;varying float vEdge;varying vec2 vWorld;varying float vElevation;uniform vec3 uTint;uniform float uTintAmount;uniform float uTerrainDetail;uniform float uParcel;uniform float uPaintPlots;uniform float uParcelIndexReady;uniform float uShowPlotBorders;uniform float uAndalusiaReady;uniform sampler2D uAndalusia;uniform vec2 uHoverPlot;uniform float uHoverValid;uniform vec2 uParcelIndexSize;uniform sampler2D uParcelIndex;uniform sampler2D uParcelStyle;uniform float uScale;uniform float uWater;uniform float uRoadDetail;uniform sampler2D uRoadMap;uniform float uTime;uniform float uTextureReady;uniform float uWaterReady;uniform sampler2D uGround;uniform sampler2D uWaterMap;uniform sampler2D uMaterialMap;uniform sampler2D uShoreMap;
uniform float uMaterialsReady;uniform float uShoreReady;float hash21(vec2 p){vec3 p3=fract(vec3(p.x,p.y,p.x)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);}float shoreProximity(){
 vec2 uv=vWorld/vec2(mapSize.x,mapSize.y);
 if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return 0.0;
 return texture2D(uShoreMap,uv).r*uShoreReady;
}
// The two halves contain natural ground and cultivated ground in the same UVs.
vec2 andalusiaUV(){return (vWorld-vec2(176.,650.))/vec2(152.,120.);}
float regionalBlend(vec2 uv){
 vec2 edge=min(uv,1.-uv)*vec2(152.,120.);
 return uAndalusiaReady*smoothstep(0.,8.,min(edge.x,edge.y));
}
// Separate repeating micro-materials from the large geographic color map.
uniform sampler2D uCloseGround;
uniform sampler2D uUrbanPaint;
vec3 groundDetail(){
 vec2 drift=texture2D(uCloseGround,vWorld/43.).rg-.5;
 vec2 uv=vWorld/8.+drift*.32;
 vec3 first=texture2D(uCloseGround,uv).rgb;
 vec2 rotated=mat2(.8,-.6,.6,.8)*vWorld/3.13;
 vec3 second=texture2D(uCloseGround,rotated+drift*.13).rgb;
 return .76*first+.24*second-.5;
}
uniform sampler2D uPaintedMaterials;
uniform sampler2D uHabitat;
uniform sampler2D uCanopyShadow;

// Meadow, undergrowth and limestone marks come from the same painting as Málaga.
// Two rotated scales and a continuous warp break up repeating silhouettes.
vec3 paintedGround(vec3 base, vec2 worldUV, float moisture){
 vec4 habitat=texture2D(uHabitat,worldUV);
 float exposure=habitat.r,canopy=habitat.g,hollow=habitat.b,warmth=habitat.a;
 vec2 warp=texture2D(uPaintedMaterials,vWorld/101.+vec2(.27,.45)).rg-.5;
 vec2 p=vWorld+warp*7.;
 vec3 broad=texture2D(uPaintedMaterials,mat2(.80,-.60,.60,.80)*p/48.).rgb;
 vec3 fine=texture2D(uPaintedMaterials,mat2(.36,.93,-.93,.36)*p/18.3+vec2(.17,.62)).rgb;
 vec3 mark=mix(broad,fine,.31);
 float arid=smoothstep(.60,.84,warmth)*(1.-smoothstep(.25,.63,moisture));
 float cover=clamp(.19+canopy*.60+hollow*.34+moisture*.19-arid*.60,0.,1.);
 float thicket=(1.-smoothstep(.23,.60,mark.g))*cover;
 vec3 earth=mix(base,base*vec3(.84,.97,.78),.37+cover*.37);
 earth*=.80+.39*mark.r;
 vec3 scrub=mix(vec3(.22,.292,.172),vec3(.29,.346,.239),moisture);
 earth=mix(earth,scrub*(.75+.46*fine.g),thicket*.80);
 // Dry washes collect pale gravel. Humid hollows carry denser ground cover.
 float wash=hollow*(.26+.63*arid)*(1.-canopy*.72);
 vec3 sediment=mix(vec3(.34,.39,.25),vec3(.68,.56,.395),arid);
 earth=mix(earth,sediment*(.76+.48*mark.r),wash*.52);
 float outcrop=smoothstep(.24,.88,exposure+(.58-mark.b)*.50);
 vec3 stone=mix(vec3(.46,.487,.452),vec3(.615,.555,.437),warmth);
 float faces=.62+.83*mark.b+.14*(fine.b-.5);
 vec3 crag=mix(earth,stone,.66)*faces;
 earth=mix(earth,crag,outcrop*.92);
 // Sheltered northern basins, dune fields and alpine ledges each have a
 // different physical grain. Ground moisture also picks out cultivated oases.
 float fen=(1.-smoothstep(.40,.65,warmth))*smoothstep(.56,.82,moisture)*hollow*(1.-exposure);
 vec3 fenSoil=mix(vec3(.228,.283,.201),vec3(.417,.446,.274),mark.g);
 earth=mix(earth,fenSoil,fen*.46);
 float aeolian=arid*(1.-smoothstep(.25,.82,exposure))*(1.-hollow*.68);
 if(aeolian>.01){
  vec2 wind=mat2(.90,-.436,.436,.90)*vWorld;
  vec2 sandSupply=texture2D(uPaintedMaterials,vWorld/174.+vec2(.45,.83)).rg;
  float duneField=smoothstep(.34,.67,sandSupply.r+warp.x*.37);
  float phase=wind.y*.71+3.6*sin(wind.x*.079+3.2*sandSupply.g)+6.1*warp.y+mark.r*.73;
  float lee=smoothstep(.42,.96,cos(phase))*(.5+.5*mark.r);
  vec3 sand=mix(vec3(.595,.477,.327),vec3(.73,.632,.448),smoothstep(.19,.84,broad.r));
  vec3 pavement=mix(vec3(.49,.418,.307),vec3(.64,.551,.404),mark.b);
  vec3 dryGround=mix(pavement,sand*(1.+lee*.15-.063*sin(phase)),duneField);
  earth=mix(earth,dryGround,aeolian*.73);
 }
 float alpine=(1.-smoothstep(.39,.60,warmth))*outcrop;
 float ledge=sin(vElevation*4.2+dot(p,vec2(.16,-.13))+mark.b*2.6);
 earth*=1.+alpine*(.073*ledge+.14*(mark.b-.5));
 return earth;
}
uniform sampler2D uParcelAnchor;
vec2 parcelSite(vec2 styleUV){
 vec4 packed=floor(texture2D(uParcelAnchor,styleUV)*255.+.5);
 return vec2(packed.r*256.+packed.g,packed.b*256.+packed.a)/65535.*mapSize;
}
vec3 fieldPalette(float moisture,float plot){
 vec3 dry=mix(vec3(.52,.43,.31),vec3(.69,.60,.39),smoothstep(.14,.54,plot));
 vec3 moist=mix(vec3(.34,.40,.28),vec3(.58,.60,.35),smoothstep(.18,.67,plot));
 vec3 harvest=mix(vec3(.73,.63,.40),vec3(.71,.66,.42),moisture);
 return mix(mix(dry,moist,smoothstep(.28,.75,moisture)),harvest,smoothstep(.59,.89,plot)*.90);
}
uniform float uModelDetail;
float overviewWeight(){
 return 1.-smoothstep(.0024,.0072,uScale*mapSize.x/1100.);
}
float terrainLight(){
 // Cross derivatives recover the triangle normal in map space at any camera angle.
 vec3 p=vec3(vWorld.x,vElevation,vWorld.y);
 vec3 n=cross(dFdx(p),dFdy(p));
 n=normalize(n*sign(n.y)+vec3(0.,.0000001,0.));
 float key=dot(n,normalize(vec3(-.56,1.,-.39)));
 return clamp((key-.80)*.28,-.21,.13);
}
void main(){
 float overview=overviewWeight();
 vec3 land=vColor;
 if(uTerrainDetail<-.5){
  float fibres=texture2D(uCloseGround,vec2(vWorld.x/430.,vWorld.y/16.)).g-.5;
  float broad=noise2(vWorld*vec2(.002,.049))-.5;
  land=vec3(.068,.092,.102)*(1.+fibres*.35+broad*.38);
 }else if(uTerrainDetail>0.5){
 float detail=noise2(vWorld*.086)-.5;
 float geology=noise2(vWorld*.033+vec2(vElevation*.13,11.));
 float slope=smoothstep(2.1,6.6,vElevation+detail*1.6);
 float rock=smoothstep(4.9,12.9,vElevation+detail*3.2+geology*1.8);
 vec4 broadMaterial=texture2D(uMaterialMap,vWorld/76.0);
 vec4 detailMaterial=texture2D(uMaterialMap,mat2(.92,-.39,.39,.92)*vWorld/19.0+vec2(.29,.61));
 vec4 material=mix(broadMaterial,detailMaterial,.49*smoothstep(.002,.018,uScale));
 float grass=material.r;
 float grain=mix(mix(grass,material.g,slope),material.b,rock);
 float shear=noise2(vec2(vWorld.x*.15+vWorld.y*.09,vElevation*.83+vWorld.y*.12))-.5;
 land=vColor*(1.0+(grain-.5)*.65*min(1.,uMaterialsReady)+detail*.19+rock*shear*.16);
 land=mix(land,land*vec3(1.08,1.02,.91)+vec3(.039,.034,.028),rock*(.15+.30*geology));
 vec2 worldUV=clamp(vWorld/mapSize,vec2(.00045),vec2(.99955));
 vec4 geography=texture2D(uGround,worldUV);
 float moisture=mix(.56,geography.a,uTextureReady);
 vec3 geologic=geography.rgb*(.91+grain*.21+detail*.061);
 land=mix(land,geologic,uTextureReady*.92);
 if(uMaterialsReady>2.5)land=mix(land,paintedGround(land,worldUV,moisture),1.-overview*.43);
 float shore=shoreProximity();
 float beach=smoothstep(.81,.957,shore+detail*.034);
 float damp=smoothstep(.930,1.,shore+detail*.011);
 vec3 sand=mix(vec3(.67,.603,.444),vec3(.53,.49,.37),damp)*(.90+material.a*.22);
 land=mix(land,sand,beach*.86);
 vec2 localUV=andalusiaUV();
 float local=regionalBlend(localUV);
 vec4 naturalGround=vec4(0.);
 if(local>0.)naturalGround=texture2D(uAndalusia,vec2(localUV.x*.5,localUV.y));
 float parcel=uParcel,plotBorder=0.0,lineOpacity=0.70;
 float development=0.,kind=0.,frame=0.,homestead=0.,parcelDepth=0.;
 vec2 site=vec2(0.);
 bool malagaSlot=false,urbanSlot=false,mineSlot=false,clothSlot=false;
 if(uPaintPlots>.5&&uParcelIndexReady>.5){
  vec2 uv=(clamp(vWorld/vec2(mapSize.x,mapSize.y),0.0,1.0)*(uParcelIndexSize-1.0)+.5)/uParcelIndexSize;
  vec3 parcelPixel=texture2D(uParcelIndex,uv).rgb;
  vec2 index=floor(parcelPixel.rg*255.0+.5);
  parcelDepth=parcelPixel.b*4.;
  if(index.x>.5&&index.y>.5){
   vec2 chartUV=(index+.5)/vec2(32.0,parcelRows);
   vec4 style=texture2D(uParcelStyle,chartUV);
   kind=floor(style.r*255.0+.5);
   development=floor(style.g*255.0+.5);
   homestead=1.-step(1.5,index.x);
   frame=hash21(index*vec2(.57,1.21));
   site=parcelSite(chartUV);malagaSlot=style.a>.50&&style.a<.85;mineSlot=kind>2.5&&kind<3.5;clothSlot=kind>3.5&&kind<4.5;urbanSlot=malagaSlot&&kind>1.5&&kind<6.5;
   if(kind>.5&&kind<1.5)parcel=floor(style.g*255.0+.5);
   else if(kind>1.5){vec3 tintPlot=kind<2.5?vec3(.31,.43,.30):kind<3.5?vec3(.47,.47,.43):kind<4.5?vec3(.52,.49,.40):kind<5.5?vec3(.57,.54,.44):vec3(.54,.49,.39);land=mix(land,tintPlot,kind<2.5?.04:.09);}
   bool hovered=abs(index.y-uHoverPlot.y)<.25&&abs(index.x-uHoverPlot.x)<.25&&uHoverPlot.x>.5;
   if(hovered||(style.b>.5&&(uShowPlotBorders>.5))){
    if(malagaSlot&&local>.5){
     float distanceToEdge=max(0.,(naturalGround.a*255.-128.)*(1.5/127.));
     float footprint=max(.075,max(length(dFdx(vWorld)),length(dFdy(vWorld))));
     lineOpacity=.86*(1.-smoothstep(.08,.08+footprint*1.1,distanceToEdge));
     plotBorder=hovered?(uHoverValid>1.5?1.0:uHoverValid>.5?2.0:3.0):1.0;
    }else{
    vec2 pixel=1.0/uParcelIndexSize;
    vec2 a=floor(texture2D(uParcelIndex,uv+vec2(pixel.x,0.0)).rg*255.0+.5),b=floor(texture2D(uParcelIndex,uv-vec2(pixel.x,0.0)).rg*255.0+.5),c=floor(texture2D(uParcelIndex,uv+vec2(0.0,pixel.y)).rg*255.0+.5),d=floor(texture2D(uParcelIndex,uv-vec2(0.0,pixel.y)).rg*255.0+.5);
    if((abs(a.y-index.y)<.25&&abs(a.x-index.x)>.25)||(abs(b.y-index.y)<.25&&abs(b.x-index.x)>.25)||(abs(c.y-index.y)<.25&&abs(c.x-index.x)>.25)||(abs(d.y-index.y)<.25&&abs(d.x-index.x)>.25))plotBorder=hovered?(uHoverValid>1.5?1.0:uHoverValid>.5?2.0:3.0):1.0;
    }
   }
  }
 }
 if(!malagaSlot&&(kind>.5||homestead>.5)){
  vec2 offset=vWorld-site;
  float ragged=noise2(vWorld*.13+31.)-.5;
  float dist=length(offset*vec2(.87,1.03))+ragged*6.2;
  float farmLevel=parcel>.5?mod(parcel-1.0,4.0):0.;
  float plotScale=farmLevel*.66;
  float settlement=(kind>4.5&&kind<5.5)||kind<.5?1.:0.;
  float viable=smoothstep(.11,.38,moisture)*(1.-smoothstep(4.4,12.5,vElevation))*(1.-beach*.89);
  float crops=parcel>.5?(1.-smoothstep(11.,32.+plotScale*5.,dist))*(0.54+viable*.39+farmLevel*.014)
   :settlement*(1.-smoothstep(13.,30.+development*.3,dist))*smoothstep(2.9,8.0,dist)*viable*.73;
  if(crops>.01){
   float angle=.35+frame*2.36+floor((parcel-1.0)/4.0)*.11;
   vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*(vWorld-site);
   float grade=smoothstep(1.25,6.6,vElevation);
   q+=vec2(sin(q.y*.18)*1.17,sin(q.x*.13+frame*7.)*(.67+grade*1.7));
   // Cultivated strips share a headland; stagger their ends independently by band.
   float bandWidth=mix(3.8,2.65,grade);
   float band=floor(q.y/bandWidth);
   float bandSeed=hash21(vec2(band,frame+17.));
   float lengthwise=q.x+(fract(q.y/bandWidth)-.5)*(bandSeed-.5)*2.8;
   float run=9.4+bandSeed*7.8;
   float strip=lengthwise/run+bandSeed*5.;
   float seed=hash21(vec2(floor(strip)+frame*79.,band));
   vec2 laneDistance=(.5-abs(fract(vec2(strip,q.y/bandWidth))-.5))*vec2(run,bandWidth);
   float marginToLane=min(laneDistance.x,laneDistance.y);
   float footprint=max(.045,max(length(dFdx(vWorld)),length(dFdy(vWorld))));
   float boundary=smoothstep(.08,.22+footprint*.52,marginToLane);
   crops*=mix(.37,1.,smoothstep(.11,.30,seed));
   float texture=noise2(q*.68+vec2(13.0,31.0));
   float terraces=cos(q.y*(mix(6.7,8.9,grade))+seed*6.28+sin(q.x*.12)*.39);
   float rowDetail=smoothstep(.011,.052,uScale);
   float weave=(.018+(.049+farmLevel*.012)*rowDetail)*terraces;
   vec3 cultivated=fieldPalette(moisture,seed)*(.88+texture*.23+weave);
   cultivated*=clamp(dot(land,vec3(.28,.57,.15))*1.42,.67,1.19);
   // Hedges and bare tracks share the same curved field boundaries.
   vec3 edge=mix(land*.79,vec3(.48,.41,.29),step(.59,seed)*.62);
   float margin=smoothstep(.12,1.75,parcelDepth);
   land=mix(land,mix(edge,cultivated,boundary),crops*mix(.72,1.,boundary)*margin);
  }
  vec2 delta=vWorld-site;
  vec2 yardUV=vec2(delta.x+.17*delta.y,delta.y-.16*delta.x);
  float size=3.4+settlement*(1.9+development*.49);
  float yard=(1.-smoothstep(.26,1.0,length(yardUV/vec2(size,size*.72))))*(1.-beach*.84);
  float lane=abs(sin(yardUV.y*1.05+sin(yardUV.x*.34)*.37));
  vec3 packed=mix(vec3(.48,.405,.306),vec3(.45,.46,.39),moisture);
  packed*=.89+material.a*.21+.055*noise2(vWorld*1.2);
  float paving=yard*(settlement*(.50+(1.-smoothstep(.15,.40,lane))*.28)+(1.-settlement)*.56);
  land=mix(land,packed,paving*smoothstep(.06,.91,parcelDepth));
 }
 if(local>0.&&(parcel<.5||malagaSlot)){
  vec3 localColor=naturalGround.rgb;
  if(parcel>.5)localColor=texture2D(uAndalusia,vec2(.5+localUV.x*.5,localUV.y)).rgb;
  localColor*=.97+.06*material.r;
  float wet=smoothstep(.90,.99,shoreProximity()+detail*.008);
  vec3 strand=mix(vec3(.72,.67,.51),vec3(.54,.52,.42),wet);
  localColor=mix(localColor,strand,smoothstep(.84,.97,shoreProximity()+detail*.014));
  // The regional survey supplies local features while the same light and colors join both maps.
  localColor=localColor*vec3(1.00,1.07,.96);
  localColor=mix(localColor,localColor*vec3(.77,.94,.86),smoothstep(.03,.15,localColor.g-localColor.r)*.48);
  land=mix(land,localColor,local);
 }
 if(uMaterialsReady>1.5&&uScale>.0058){
  float weight=smoothstep(.0058,.031,uScale);
  vec3 micro=groundDetail();
  float exposed=max(rock,smoothstep(.08,.24,land.r-land.g)*.65);
  float grains=mix(micro.r,micro.b,exposed);
  grains=mix(grains,micro.g,parcel>.5?.55:beach);
  land*=1.+weight*(grains*.99+micro.g*.20);
 }
 if(urbanSlot&&local>0.){
  vec3 paint=texture2D(uUrbanPaint,localUV).rgb;
  vec3 paving=vec3(.57,.50,.40)*(.85+.30*material.a+.12*detail);
  land=mix(land,paving,paint.g*local*.85);
  vec3 soil=vec3(.65,.49,.30)*(.84+.38*material.a+.19*detail);
  if(mineSlot){
   vec2 gravelUV=vWorld*.94;
   vec3 gravel=texture2D(uRoadMap,gravelUV).rgb;
   soil=mix(vec3(.40,.32,.26),vec3(.57,.51,.43),material.a)*(.72+.55*gravel.r+.16*detail);
  }
  if(clothSlot)soil=vec3(.37,.30,.33)*(.76+.32*material.a+.22*detail);
  land=mix(land,soil,paint.b*local);
  land*=1.-paint.r*local*.48;
 }
 // The regional painting supplies the terrain lighting. Contact shadows are
 // painted in world space instead of intersecting the terrain as separate faces.
 float canopyShade=texture2D(uCanopyShadow,worldUV).r;
 float cultivated=step(.5,kind)*smoothstep(1.5,5.,parcelDepth);
 land*=1.-canopyShade*(1.-.72*overview)*(1.-.62*cultivated)*(1.-beach*.86);
 float luminance=dot(land,vec3(.30,.55,.15));
 vec3 wash=mix(vec3(.28,.35,.31),vec3(.76,.73,.59),smoothstep(.19,.69,luminance));
 float paper=(material.a-.5)*.058+detail*.043;
 land=mix(land,wash+paper,overview*.63);
 vec3 edgeColor=plotBorder>2.5?vec3(.84,.39,.30):plotBorder>1.5?vec3(.38,.76,.59):vec3(.82,.74,.53);
 land=mix(land,edgeColor,plotBorder>.5?lineOpacity:0.0);
 }else if(uRoadDetail>0.5){
  vec3 dirt=texture2D(uRoadMap,mat2(.90,-.43,.43,.90)*vWorld/9.0).rgb;
  if(vColor.g>1.5){
   float side=abs(vColor.g-3.);
   float noise=noise2(vWorld*3.3)-.5;
   float rut=exp(-pow((side-.52)*8.,2.));
   float verge=smoothstep(.61,1.,side+noise*.21);
   float widthFactor=clamp((vColor.r-.47)*7.,0.,1.);
   vec3 core=mix(vec3(.43,.386,.29),vec3(.58,.505,.361),widthFactor);
   vec3 soil=core*(.79+dot(dirt,vec3(.3,.54,.16))*.34+noise*.11)-rut*.058;
   vec3 shoulder=mix(vColor.b*vec3(1.22,1.33,1.0),soil,.24);
   land=mix(soil,shoulder,verge*.80);
  } else land=vColor*(.86+dirt.r*.22);
  if(uMaterialsReady>1.5&&uScale>.009)land*=1.+groundDetail().g*.57*smoothstep(.009,.047,uScale);
  land=mix(land,vec3(.42,.375,.30),overview*.66);
 }else if(uWater>0.5){
  float shore=shoreProximity();
  float shallows=smoothstep(.21,.98,shore);
  float shelf=smoothstep(.68,.97,shore);
  vec2 t=vec2(uTime*.00027,-uTime*.00014);
  vec3 broad=texture2D(uWaterMap,mat2(.86,-.51,.51,.86)*vWorld/121.+t).rgb;
  float crossing=texture2D(uWaterMap,mat2(.54,.84,-.84,.54)*vWorld/46.-t*2.).g;
  float grain=(broad.r-.5)*.077+(crossing-.5)*.065;
  vec3 deep=mix(vec3(.078,.155,.201),vec3(.103,.208,.246),smoothstep(0.,.6,shore));
  vec3 color=mix(deep,vec3(.215,.380,.370),shallows*.79);
  color=mix(color,vec3(.309,.462,.424),shelf*.60);
  float pulse=sin(shore*208.+crossing*3.2-uTime*1.01);
  float wash=smoothstep(.94,.997,shore+(crossing-.5)*.029)*(.45+pulse*.13);
  color=mix(color+grain,vec3(.65,.715,.624),wash);
  vec2 chart=vWorld/(mapSize.x/10.);
  vec2 spacing=abs(fract(chart-.5)-.5);
  float lines=1.-smoothstep(.003,.013,min(spacing.x,spacing.y));
  vec3 plotted=mix(color*.88+vec3(.015,.027,.033),vec3(.37,.49,.48),lines*.16);
  land=mix(color,plotted,overview);
 }else if(uModelDetail>.5){
 float grain=noise2(vWorld*4.8+vec2(vElevation*2.7,vElevation*1.9));
 float broad=noise2(vWorld*1.3+vec2(vElevation*.87,vElevation*.56));
 float shape=terrainLight();
 land=vColor*(.86+grain*.20+broad*.17+shape*.48);
 land=mix(land,land*vec3(1.04,.99,.90)+vec3(.020,.028,.030),.65);
 }
 float political=uTintAmount*mix(vEdge,.42+.58*vEdge,overview);
 vec3 ink=mix(uTint,uTint*.83+vec3(.096,.098,.080),overview*.62);
 vec3 surface=mix(land,ink,political);
 if(uCaptureStrength>0.0){
  float d=distance(vWorld,uCaptureOrigin);
  float feather=max(1.7,uCaptureRadius*.075);
  float reveal=1.0-smoothstep(uCaptureRadius-feather,uCaptureRadius+feather,d);
  float rim=1.0-smoothstep(feather*.25,feather,abs(d-uCaptureRadius));
  vec3 oldSurface=mix(land,uCaptureOld,uCaptureOldMix);
  surface=mix(surface,mix(oldSurface,surface,reveal),uCaptureStrength);
  surface=mix(surface,mix(ink,vec3(1.0,.90,.66),.55),(.26*rim+.10*reveal)*uCaptureStrength);
 }
 gl_FragColor=vec4(surface,1.0);
}
