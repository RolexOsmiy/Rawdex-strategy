'use strict';

// World positions and tangents stay in the vertex buffer across camera changes.
function installPoliticalBorders(shaders){
 const uniforms=`
struct Draw { values: array<vec4<f32>, 12> }
@group(0) @binding(0) var<uniform> constants: Draw;
`;
 shaders.programs.politicalBorder={
  vert:uniforms+`
struct BorderVertex {
 @builtin(position) position: vec4<f32>,
 @location(0) side: f32,
 @location(1) distance: f32,
}
@vertex
fn main(@location(0) p: vec3<f32>, @location(1) tangent: vec3<f32>,
        @location(2) along: vec2<f32>) -> BorderVertex {
 let viewport = constants.values[0].zw;
 let camera = constants.values[1];
 let d = p.xz - constants.values[0].xy;
 let across = vec2<f32>(camera.x, -camera.y);
 let down = vec2<f32>(camera.y, camera.x);
 let norm = inverseSqrt(1.0 + camera.w * camera.w);
 let center = vec2<f32>(dot(across, d) * viewport.y / viewport.x,
                        (p.y - dot(down, d) * camera.w) * norm) * camera.z;
 let direction = vec2<f32>(dot(across, tangent.xz), (tangent.y - dot(down, tangent.xz) * camera.w) * norm);
 let normal = vec2<f32>(-direction.y, direction.x) / max(length(direction), 0.00001);
 let offset = normal * along.x * constants.values[7].w * 2.0 / viewport;
 let pixelsPerUnit = camera.z * constants.values[3].x * 0.5;
 return BorderVertex(vec4<f32>(center + offset, 0.5, 1.0), along.x, along.y * pixelsPerUnit);
}`,
  frag:uniforms+`
@fragment
fn main(@location(0) side: f32, @location(1) distance: f32) -> @location(0) vec4<f32> {
 let color = constants.values[8].xyz;
 let strength = constants.values[2].w;
 let edge = abs(side);
 if (constants.values[3].y < 0.5) {
  let fade = 1.0 - edge;
  return vec4<f32>(color, strength * fade * fade);
 }
 let spacing = 15.0;
 let phase = distance % (2.0 * spacing);
 let ink = select(color, constants.values[2].xyz, phase >= spacing);
 let dash = phase % spacing;
 let feather = clamp(fwidth(distance), 0.45, 1.0);
 let opacity = smoothstep(0.0, feather, dash) * (1.0 - smoothstep(8.0 - feather, 8.0, dash));
 return vec4<f32>(ink, strength * opacity * (1.0 - smoothstep(0.48, 1.0, edge)));
}`
 };
}
