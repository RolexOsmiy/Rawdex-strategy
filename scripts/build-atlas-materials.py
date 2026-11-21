"""Bake the seamless water material used by the atlas renderer."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SIZE = 1024
rng = np.random.default_rng(1619)
y, x = np.indices((SIZE, SIZE), dtype=np.float32) * (2 * np.pi / SIZE)
dist = Path(__file__).resolve().parents[1] / "dist"


def noise(spread):
    smooth = gaussian_filter(rng.standard_normal((SIZE, SIZE)).astype("f"), spread, mode="wrap")
    return np.clip(smooth / smooth.std(), -2.6, 2.6)


def save(filename, channels):
    pixels = np.stack(channels, axis=-1)
    Image.fromarray(np.uint8(np.clip(pixels, 0, 255))).save(dist / filename)


swell = noise((10, 32))
breakers = noise(12)
capillary = noise((1.6, 7))
wind = np.sin(x * 12 + y * 27 + swell * .95 + breakers * .52)
crossing = np.sin(x * 21 - y * 36 + breakers * 1.46)
crest = np.maximum(0, wind * .86 + crossing * .22) ** 4
save("terrain-water.png", [
    114 + swell * 15 + wind * 17 + crest * 46 + capillary * 9,
    126 + swell * 12 + crossing * 21 + crest * 31 + capillary * 14,
    132 + swell * 11 + wind * 15 + crest * 20 + capillary * 9,
])
