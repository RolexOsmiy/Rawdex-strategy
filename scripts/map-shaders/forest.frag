precision mediump float;uniform float uScale;uniform float uParcel;uniform float uPaintPlots;uniform sampler2D uTree;uniform sampler2D uForestMask;varying mediump vec2 vUV;varying mediump vec2 vTreePos;varying mediump float vShade;void main(){if((uPaintPlots<.5||(uPaintPlots>1.5&&uPaintPlots<2.5))&&texture2D(uForestMask,clamp(vTreePos/vec2(mapSize.x,mapSize.y),0.0,1.0)).r>.5)discard;if(uPaintPlots>1.5){
 vec2 delta=2.*vUV-1.;float alpha=(uPaintPlots>2.5?.44:.30)*(1.-smoothstep(.06,.83,dot(delta,delta)));
 gl_FragColor=vec4(.065,.108,.115,alpha);return;
}
vec4 c=texture2D(uTree,vUV);if(c.a<.22)discard;float overview=1.-smoothstep(.0024,.0072,uScale*mapSize.x/1100.);
vec3 foliage=c.rgb*vec3(.82,1.0,.88)*vShade+vec3(.013,.024,.021);
float lum=dot(foliage,vec3(.29,.59,.12));
vec3 canopy=mix(vec3(.090,.151,.126),vec3(.368,.445,.334),smoothstep(.08,.48,lum));
gl_FragColor=vec4(mix(foliage,canopy,overview*.63),c.a*(1.-uParcel));}
