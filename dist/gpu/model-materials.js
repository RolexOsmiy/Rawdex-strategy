'use strict';

const MODEL_MATERIAL={timber:1,stone:2,plaster:3,roof:4,thatch:5,cloth:6,metal:7,leather:8};
function modelMaterial(color,kind){return Object.assign(color,{material:MODEL_MATERIAL[kind]})}

function installModelMaterials(shaders){
 const world=shaders.programs.world;
 const entry='    vColor_1 = vColor;';
 const result=/let (\w+) = outColor;\s*return FragmentOutput\(\1\);/;
 if(!world.frag.includes(entry)||!result.test(world.frag))throw Error('World shader cannot accept model materials');
 const surface=`
@group(1) @binding(17) var modelAtlas: texture_2d<f32>;

fn paintModelSurface(color: vec4<f32>, p: vec3<f32>, pigment: vec3<f32>, tag: f32) -> vec4<f32> {
    let zoom = constants.values[1].z;
    let detail = smoothstep(0.0047, 0.018, zoom);
    if (detail <= 0.0 || constants.values[7].z < 0.5 || textureDimensions(modelAtlas).x <= 1u) { return color; }
    var index = tag;
    if (index < 0.5) {
        let warm = pigment.r - pigment.b;
        let luminous = dot(pigment, vec3<f32>(0.26, 0.60, 0.14));
        index = select(2.0, 1.0, warm > 0.09);
        if (luminous > 0.59 && warm > 0.09) { index = 3.0; }
        if (pigment.r > 0.21 && pigment.b > pigment.r * 1.2) { index = 6.0; }
    }
    let normal = normalize(cross(dpdx(p), dpdy(p)) + vec3<f32>(0.0000001));
    let faces = abs(normal);
    var planar = p.xy;
    if (faces.x > faces.z) { planar = p.zy; }
    if (faces.y > max(faces.x, faces.z)) { planar = p.xz; }
    let tile = index - 1.0;
    let cell = vec2<f32>(tile % 4.0, floor(tile / 4.0));
    let period = select(1.35, 0.58, index >= 6.0);
    let uv = planar / period;
    let size = vec2<f32>(0.25, 0.5);
    let atlasUv = (cell + (vec2<f32>(8.5) + fract(uv) * 127.0) / 144.0) * size;
    let lod = clamp(log2(max(length(dpdx(uv)), length(dpdy(uv))) * 128.0), 0.0, 3.0);
    let pattern = textureSampleLevel(modelAtlas, sample1_, atlasUv, lod).rgb;
    let keyLight = dot(normal * select(-1.0, 1.0, normal.y >= 0.0), normalize(vec3<f32>(-0.47, 0.83, -0.43)));
    let surface = (pattern.r - 0.5) * 0.64 + (pattern.g - 0.5) * 0.24;
    let exposure = mix(0.99, 1.0 + surface + (abs(keyLight) - 0.48) * 0.08, detail);
    let grain = (pattern.b - 0.5) * detail;
    return vec4<f32>(color.rgb * exposure + grain * vec3<f32>(0.053, 0.025, -0.027), color.a);
}
`;
 world.frag=world.frag.replace('@fragment',surface+'\n@fragment')
  .replace('fn main(@location(0) vColor:', 'fn main(@builtin(position) pixel: vec4<f32>, @location(0) vColor:')
  .replace(entry,`    if (constants.values[7].z > 0.5) {
        let dissolve = constants.values[3].y;
        if (abs(dissolve) > 0.001) {
            let cell = vec2<u32>(pixel.xy) % vec2<u32>(4u);
            let rank = ((cell.x ^ cell.y) & 1u) * 8u + (cell.y & 1u) * 4u + (((cell.x ^ cell.y) >> 1u) & 1u) * 2u + (cell.y >> 1u);
            let threshold = (f32(rank) + 0.5) / 16.0;
            if ((dissolve > 0.0 && threshold >= dissolve) || (dissolve < 0.0 && threshold < -dissolve)) { discard; }
        }
    }
    let materialTag = floor(vColor.r / 2.0);
    vColor_1 = vec3<f32>(vColor.r - materialTag * 2.0, vColor.gb);`)
  .replace(result,'let $1 = paintModelSurface(outColor, vec3<f32>(vWorld.x, vElevation, vWorld.y), vColor_1, materialTag);\n    return FragmentOutput($1);');
}
