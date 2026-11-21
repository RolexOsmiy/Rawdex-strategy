"""Extract repeatable ground detail from the natural half of the Andalusian painting.

Each channel carries the painted value variation of one surface at the same
texel density as the original. The renderer supplies each region's soil color.
"""
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1] / "dist"
source = np.asarray(Image.open(root / "maps/mediterranean/andalusia-ground.png").convert("RGB"), dtype="f")
natural = source[:, :source.shape[1]//2]
luma = natural @ np.array([.30, .56, .14], dtype="f")
size = 512
y, x = np.indices((size, size))
# Overlap four windows on a torus. Their weights sum to one, including across the seam.
wx, wy = np.sin(np.pi*(x+.5)/size)**2, np.sin(np.pi*(y+.5)/size)**2
def sample(windows):
    result = np.zeros((size, size), dtype="f")
    for k, (left, top) in enumerate(windows):
        ox, oy = k % 2, k // 2
        patch = luma[top:top+size, left:left+size]
        low, high = np.percentile(patch, [3, 97])
        values = np.clip((patch-low)/(high-low), -.12, 1.12)
        weight = (1-wx if ox else wx)*(1-wy if oy else wy)
        result += values[(y+oy*(size//2))%size,(x+ox*(size//2))%size]*weight
    return result

# The inland grassland, valley scrub and exposed limestone have distinct mark sizes.
meadow = sample([(20,0),(400,0),(845,0),(990,0)])
scrub = sample([(5,665),(360,646),(700,648),(985,637)])
stone = sample([(80,252),(405,209),(726,168),(980,290)])
data = np.uint8(np.clip(np.stack([meadow,scrub,stone],axis=-1)*255,0,255))
Image.fromarray(data).save(root / "terrain-andalusia-materials.png")
