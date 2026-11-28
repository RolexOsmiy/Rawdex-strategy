'use strict';

const warsawVisuals=(()=>{
 const center=[338,357],radius=[163,112];
 const smooth=(start,end,value)=>{
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
 };
 const influence=(x,z)=>1-smooth(.53,1,Math.hypot((x-center[0])/radius[0],(z-center[1])/radius[1]));
 const relief=(x,z)=>influence(x,z)*(
  .79*Math.exp(-((x-261)**2/1500+(z-389)**2/390))+
  .53*Math.exp(-((x-400)**2/1820+(z-326)**2/440))-
  .18*Math.exp(-((z-355+(x-320)*.14)**2)/89));
 const grove=(x,z)=>smooth(-.57,.6,
  Math.sin(x*.096+Math.sin(z*.11)*1.4)+.63*Math.sin(z*.201-x*.058));

 const region=`
fn warsawInfluence(p: vec2<f32>) -> f32 {
    return 1.0 - smoothstep(0.53, 1.0, length((p - vec2<f32>(${center.map(n=>n+'.0')})) / vec2<f32>(${radius.map(n=>n+'.0')})));
}
`;
 const grading=`
fn cultivatedStrips(ground: vec3<f32>, p: vec2<f32>, center: vec2<f32>, angle: f32, halfSize: vec2<f32>, detail: f32) -> vec3<f32> {
    let offset = p - center;
    if (dot(offset, offset) > dot(halfSize + 2.0, halfSize + 2.0)) { return ground; }
    let direction = vec2<f32>(cos(angle), sin(angle));
    var q = vec2<f32>(dot(offset, direction), dot(offset, vec2<f32>(-direction.y, direction.x)));
    q.y += sin(q.x * 0.19) * 0.51;
    let band = floor((q.y + halfSize.y) / 1.8);
    let seed = noise2_(vec2<f32>(band * 1.83, center.x * 0.13));
    let limit = halfSize - vec2<f32>(seed * 2.1, 0.0);
    let distance = min(limit.x - abs(q.x), limit.y - abs(q.y));
    let edge = smoothstep(-0.4, 0.75, distance);
    let lane = 1.0 - smoothstep(0.07, 0.19, abs(fract((q.y + halfSize.y) / 1.8) - 0.5));
    let rows = sin(q.y * 15.0 + sin(q.x * 0.65) * 0.38) * detail;
    let soil = mix(vec3<f32>(0.42, 0.40, 0.27), vec3<f32>(0.60, 0.51, 0.33), seed);
    let field = soil * (0.96 + 0.09 * noise2_(p * 0.65) + 0.046 * rows - lane * 0.11);
    return mix(ground, field, edge * 0.49);
}

fn warsawSurface(color: vec4<f32>, p: vec2<f32>, brush: vec3<f32>) -> vec4<f32> {
    let strength = warsawInfluence(p);
    if (strength < 0.001) { return color; }
    let zoom = constants.values[1].z;
    let brushDetail = smoothstep(0.006, 0.024, zoom);
    let earth = color.rgb;
    if (constants.values[7].z > 0.5) { return color; }
    if (constants.values[6].x > 0.5) {
        let side = abs(brush.g - 3.0);
        let edge = 1.0 - smoothstep(0.64, 1.03, side + (noise2_(p * 1.7) - 0.5) * 0.14);
        let rut = 1.0 - smoothstep(0.035, 0.18, abs(side - 0.51));
        let sand = earth * vec3<f32>(1.045, 1.025, 0.91) + vec3<f32>(0.012, 0.01, 0.006);
        let tracks = sand * (1.0 - 0.19 * rut * brushDetail);
        let opacity = select(color.a, color.a * edge, brush.g > 1.5);
        return vec4<f32>(mix(earth, tracks, strength * 0.84), mix(color.a, opacity, strength));
    }
    if (constants.values[3].y > 1.5) {
        let water = smoothstep(-0.08, 0.11, brush.b - brush.r);
        let cloud = noise2_(p * vec2<f32>(0.23, 0.31));
        let ripples = noise2_(p * vec2<f32>(1.35, 0.39) + vec2<f32>(cloud * 0.5, constants.values[6].y * 0.028));
        let pigment = (cloud - 0.5) * 0.095 + (ripples - 0.5) * brushDetail * 0.16;
        return vec4<f32>(earth * (1.0 + pigment * strength * water), color.a);
    }
    if (constants.values[3].x > 0.5) {
        let moss = noise2_(p * 0.033 + vec2<f32>(28.0, 17.0));
        let brushwork = noise2_(p * vec2<f32>(0.33, 0.22));
        let fibres = (noise2_(p * vec2<f32>(1.8, 1.1)) - 0.5) * brushDetail;
        let luminosity = dot(earth, vec3<f32>(0.31, 0.55, 0.14));
        let olive = smoothstep(0.005, 0.13, earth.g - earth.r);
        let meadow = mix(vec3<f32>(0.48, 0.435, 0.28), vec3<f32>(0.50, 0.535, 0.325), moss);
        let grass = mix(meadow, vec3<f32>(0.32, 0.415, 0.28), olive * 0.79);
        let paint = grass * clamp(luminosity * 1.98, 0.56, 1.34);
        let field = smoothstep(0.04, 0.14, earth.r - earth.b) * (1.0 - olive);
        let directional = terrainLight();
        var result = mix(earth, paint, 0.43 - field * 0.2);
        result *= 1.0 + directional * 0.78 + (moss - 0.5) * 0.19 + (brushwork - 0.5) * 0.19 + fibres * 0.11;
        result += vec3<f32>(0.032, 0.021, 0.006) * smoothstep(0.46, 0.78, luminosity);
        result = cultivatedStrips(result, p, vec2<f32>(349.5, 347.0), 0.23, vec2<f32>(11.2, 5.2), brushDetail);
        result = cultivatedStrips(result, p, vec2<f32>(322.0, 351.0), -0.30, vec2<f32>(9.0, 4.6), brushDetail);
        result = cultivatedStrips(result, p, vec2<f32>(350.0, 361.8), 0.56, vec2<f32>(8.7, 3.7), brushDetail);
        result = cultivatedStrips(result, p, vec2<f32>(272.0, 345.5), 0.47, vec2<f32>(8.6, 4.8), brushDetail);
        result = cultivatedStrips(result, p, vec2<f32>(286.0, 389.5), -0.38, vec2<f32>(9.5, 4.8), brushDetail);
        return vec4<f32>(mix(earth, result, strength), color.a);
    }
    return color;
}
`;

 function amendShader(fragment,functions,replacement){
  const output=/return FragmentOutput\((\w+)\);/;
  if(!fragment.includes('@fragment')||!output.test(fragment)){
   throw Error('Структура шейдера оформления карты изменилась');
  }
  return fragment.replace('@fragment',functions+'\n@fragment').replace(output,replacement);
 }

 function apply(shaders){
  const {world,forest}=shaders.programs;
  world.frag=amendShader(world.frag,region+grading,'return FragmentOutput(warsawSurface($1, vWorld, vColor));');
  forest.frag=amendShader(forest.frag,region,`let painted = warsawInfluence(vTreePos);
    let tone = select(vec3<f32>(0.96, 0.99, 0.88), vec3<f32>(0.89, 0.98, 1.06), constants.values[7].w > 0.5);
    let leaf = $1.rgb * tone;
    return FragmentOutput(vec4<f32>(mix($1.rgb, leaf, painted * (1.0 - step(1.5, constants.values[3].z))), $1.a));`);
 }

 return {influence,relief,grove,smooth,apply};
})();
