'use strict';

function installRiverSurface(shaders){
 const world=shaders.programs.world;
 const entry='    vColor_1 = vColor;';
 const seaColor=/let _e2036 = shoreProximity\(\);[\s\S]*?(?=let _e2197 = vWorld_1;)/;
 if(!world.frag.includes(entry)||!seaColor.test(world.frag))throw Error('World shader cannot accept river water');
 const surface=`
fn waterPattern(world: vec2<f32>, time: f32) -> vec2<f32> {
    let drift = time * vec2<f32>(0.00027, -0.00014);
    let broad = textureSample(image1_, sample0_, mat2x2<f32>(vec2<f32>(0.86, -0.51), vec2<f32>(0.51, 0.86)) * world / 121.0 + drift).r;
    let fine = textureSample(image1_, sample0_, mat2x2<f32>(vec2<f32>(0.54, 0.84), vec2<f32>(-0.84, 0.54)) * world / 46.0 - drift * 2.0).g;
    return vec2<f32>((broad - 0.5) * 0.077 + (fine - 0.5) * 0.065, fine);
}
fn coastalWater(shore: f32, pattern: vec2<f32>, time: f32) -> vec3<f32> {
    let deep = mix(vec3<f32>(0.078, 0.155, 0.201), vec3<f32>(0.103, 0.208, 0.246), smoothstep(0.0, 0.6, shore));
    let shallows = mix(deep, vec3<f32>(0.215, 0.38, 0.37), smoothstep(0.21, 0.98, shore) * 0.79);
    let shelf = mix(shallows, vec3<f32>(0.309, 0.462, 0.424), smoothstep(0.68, 0.97, shore) * 0.6);
    let pulse = sin(shore * 208.0 + pattern.y * 3.2 - time * 1.01);
    let wash = smoothstep(0.94, 0.997, shore + (pattern.y - 0.5) * 0.029) * (0.45 + pulse * 0.13);
    return mix(shelf + vec3<f32>(pattern.x), vec3<f32>(0.65, 0.715, 0.624), wash);
}

// The vertex colors carry cross-channel position, coverage, and the strip type.
fn paintRiver(world: vec2<f32>, profile: vec3<f32>) -> vec4<f32> {
    let bank = abs(profile.r);
    let coverage = profile.g;
    let zoom = constants.values[1].z;
    if (profile.b < 0.5) {
        let feather = smoothstep(0.0, 0.24, bank) * (1.0 - smoothstep(0.56, 1.0, bank));
        let earth = mix(vec3<f32>(0.35, 0.34, 0.24), vec3<f32>(0.51, 0.49, 0.34), bank);
        return vec4<f32>(earth, feather * coverage * 0.78 * smoothstep(0.003, 0.011, zoom));
    }
    let time = constants.values[6].y;
    let pattern = waterPattern(world, time);
    let deep = vec3<f32>(0.103, 0.208, 0.246);
    let shallows = vec3<f32>(0.215, 0.38, 0.37);
    let river = mix(deep, shallows, smoothstep(0.35, 1.02, bank) * 0.83) + vec3<f32>(pattern.x);
    var water = river;
    if (profile.b > 1.0) {
        let sea = coastalWater(shoreProximityAt(world), pattern, time);
        water = mix(river, sea, profile.b - 1.0);
    }
    let edge = 1.0 - smoothstep(0.87, 1.02, bank + (pattern.y - 0.5) * 0.045);
    return vec4<f32>(water, edge * coverage);
}
`;
 world.frag=world.frag
  .replace('fn shoreProximity() -> f32 {\n    var uv: vec2<f32>;\n\n    let _e24 = vWorld_1;',
   'fn shoreProximity() -> f32 { return shoreProximityAt(vWorld_1); }\n\nfn shoreProximityAt(world: vec2<f32>) -> f32 {\n    var uv: vec2<f32>;\n\n    let _e24 = world;')
  .replace(seaColor,'color = coastalWater(shoreProximity(), waterPattern(vWorld_1, constants.values[6].y), constants.values[6].y);\n                        ')
  .replace('@fragment',surface+'\n@fragment').replace(entry,`    if (constants.values[4].w > 1.5) {
        return FragmentOutput(paintRiver(vWorld, vColor));
    }
${entry}`);
}
