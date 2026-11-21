"""Rebuild WGSL from the map shader sources. Usage: python3 scripts/build-webgpu-shaders.py /path/to/naga"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
shader_dir = root / 'scripts/map-shaders'
# Pack the per-draw data in vec4s so the layouts match across graphics APIs.
slots = [
    'uCenter:xy uViewport:zw', 'uOrientation:xy uScale:z uTilt:w',
    'uTint:xyz uTintAmount:w', 'uTerrainDetail:x uParcel:y uPaintPlots:z uParcelIndexReady:w',
    'uShowPlotBorders:x uAndalusiaReady:y uHoverValid:z uWater:w',
    'uHoverPlot:xy uParcelIndexSize:zw', 'uRoadDetail:x uTime:y uTextureReady:z uWaterReady:w',
    'uMaterialsReady:x uShoreReady:y uModelDetail:z uWidth:w', 'uColor:xyz uDefaultEdge:w',
    'mapSize:xy depthScale:z parcelRows:w',
    'uCaptureOrigin:xy uCaptureRadius:z uCaptureStrength:w', 'uCaptureOld:xyz uCaptureOldMix:w'
]
uniforms = {}
defines = []
for slot, fields in enumerate(slots):
    for field in fields.split():
        name, lanes = field.split(':')
        uniforms[name] = slot * 4 + 'xyzw'.index(lanes[0])
        defines.append(f'#define {name} constants.values[{slot}].{lanes}')
textures = {
    'uGround': (0, 0), 'uWaterMap': (1, 0), 'uTree': (2, 1), 'uCloseGround': (2, 0), 'uAndalusia': (3, 1),
    'uMaterialMap': (4, 0), 'uRoadMap': (4, 0), 'uShoreMap': (5, 1),
    'uPaintedMaterials': (12, 0), 'uHabitat': (14, 1), 'uCanopyShadow': (15, 1), 'uParcelAnchor': (13, 2), 'uUrbanPaint': (11, 1), 'uForestMask': (5, 2), 'uParcelIndex': (6, 2), 'uParcelStyle': (7, 2)
}
attribs = {'aPos': 0, 'aColor': 1, 'aEdge': 2, 'aPosition': 0,
           'aOffset': 1, 'aUV': 2, 'aDirection': 1, 'aSide': 2}
varyings = {'vColor': 0, 'vEdge': 1, 'vWorld': 2, 'vElevation': 3,
            'vUV': 0, 'vTreePos': 1, 'vShade': 2}
programs = {}
with tempfile.TemporaryDirectory(dir='.') as temp:
    for name in ['world', 'forest', 'border']:
        programs[name] = {}
        for stage in ['vert', 'frag']:
            source = (shader_dir / f'{name}.{stage}').read_text()
            source = re.sub(r'#ifdef GL_FRAGMENT_PRECISION_HIGH.*?#endif|precision \w+ float;', '', source, flags=re.S)
            source = re.sub(r'uniform (?:sampler2D|vec[23]|float) \w+;', '', source)
            source = re.sub(r'attribute (\w+) (\w+);', lambda m: f'layout(location={attribs[m[2]]}) in {m[1]} {m[2]};', source)
            def varying(m):
                direction = 'out' if stage == 'vert' else 'in'
                return f'layout(location={varyings[m[2]]}) {direction} {m[1]} {m[2]};'
            source = re.sub(r'varying (?:mediump )?(\w+) (\w+);', varying, source)
            header = ['#version 450', 'layout(set=0,binding=0,std140) uniform Draw { vec4 values[' + str(len(slots)) + ']; } constants;', *defines]
            if stage == 'frag':
                header.append('layout(location=0) out vec4 outColor;')
                source = source.replace('gl_FragColor', 'outColor')
                declared = set()
                for key, (unit, sampler) in textures.items():
                    if key not in source:
                        continue
                    for entry in (f'layout(set=1,binding={unit}) uniform texture2D image{unit};',
                                  f'layout(set=1,binding={8+sampler}) uniform sampler sample{sampler};'):
                        if entry not in declared:
                            header.append(entry)
                            declared.add(entry)
                    source = source.replace(f'texture2D({key},', f'texture(sampler2D(image{unit}, sample{sampler}),')
                source = re.sub(r'\btexture\b(?!\s*\()', 'cropNoise', source)
            else:
                source = source.replace('vEdge=aEdge;', 'vEdge=aEdge+uDefaultEdge;')
                i = source.rindex('}')
                source = source[:i] + 'gl_Position.z = (gl_Position.z + gl_Position.w) * 0.5;' + source[i:]
            inp = Path(temp).relative_to(Path.cwd()) / ('shader.' + stage)
            out = inp.with_suffix('.wgsl')
            inp.write_text('\n'.join(header) + '\n' + source)
            subprocess.run([sys.argv[1], '--input-kind', 'glsl', '--shader-stage', stage, '--keep-coordinate-space', str(inp), str(out)], check=True)
            programs[name][stage] = 'diagnostic(off, derivative_uniformity);\n' + out.read_text()
output = {'uniforms': uniforms, 'programs': programs}
(root / 'dist/gpu/shaders.json').write_text(json.dumps(output, separators=(',', ':')))
