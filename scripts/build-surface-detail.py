"""Bake seamless, neutral-centered grass, gravel and limestone detail channels."""
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image

rng = np.random.default_rng(1619)
n = 1024
y, x = np.indices((n, n), dtype=np.float32)
def band(radius):
    layer = gaussian_filter(rng.standard_normal((n, n)).astype('f'), radius, mode='wrap')
    return layer / layer.std()

def relief(height):
    return np.roll(height, 2, axis=1) - np.roll(height, -2, axis=1) + np.roll(height, 2, axis=0) - np.roll(height, -2, axis=0)

# Periodic jittered Voronoi distances give each stone its own outline.
step = 32
jitter = rng.uniform(.16, .84, (step, step, 2))
near = np.full_like(x, 10)
second = near.copy()
gx, gy = x / step, y / step
ix, iy = gx.astype(int), gy.astype(int)
for dz in [-1, 0, 1]:
    for dx in [-1, 0, 1]:
        j = jitter[(iy + dz) % step, (ix + dx) % step]
        d = np.hypot(ix + dx + j[..., 0] - gx, iy + dz + j[..., 1] - gy)
        second = np.minimum(second, np.maximum(near, d))
        near = np.minimum(near, d)
broad, tufts, grit = band(29), band(5), band(1.2)
blades = gaussian_filter(rng.normal(size=(n,n)), (.9, 4), mode='wrap')
blades /= blades.std()
grass = 128 + 18*broad + 19*tufts + 25*blades + 12*grit
cobbles = np.maximum(0, .40 - near) * np.clip(tufts*.30 + .70, .15, 1.5)
gravel = 126 + 17*tufts + 19*grit + 100*cobbles + 145*relief(cobbles)
seams = np.clip((second-near)*4, 0, 1)
stone = 124 + 22*broad + 15*tufts + 10*grit + 27*(seams-.5) + 55*relief(seams)
out = np.uint8(np.clip(np.stack([grass,gravel,stone], axis=-1), 0, 255))
Image.fromarray(out).save(Path(__file__).resolve().parents[1]/'dist/terrain-close.png')
