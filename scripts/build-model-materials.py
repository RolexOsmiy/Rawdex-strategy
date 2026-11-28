"""Paint the repeating surface patterns used by the campaign models."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SIZE = 128
rng = np.random.default_rng(1619)
y, x = np.mgrid[:SIZE, :SIZE] / SIZE
grain = rng.standard_normal((SIZE, SIZE))
cloud = gaussian_filter(grain, 7, mode="wrap")
cloud /= cloud.std()
fine = np.clip(grain, -2.2, 2.2)


def material(tone, relief, dye=0):
    return np.uint8(np.clip(np.stack(np.broadcast_arrays(tone, relief, .5 + dye), axis=-1), 0, 1)*255)


def masonry(rows, columns, mortar, offset):
    warped = y*rows + cloud*.027
    row = np.floor(warped)
    along = x*columns + (row % 2)*.5 + cloud*.02
    seams = np.minimum(np.abs(warped-np.round(warped)), np.abs(along-np.round(along)))
    block = np.clip((seams-mortar)*34, 0, 1)
    tint = np.sin((np.floor(along) % columns)*71.1 + row*34.9 + offset)*.09
    return material(.39 + block*(.18+tint)+fine*.018, block*.62+.16+cloud*.035, tint)


streak = np.sin(2*np.pi*(y*22 + np.sin(x*2*np.pi)*.65 + cloud*.14))
groove = np.sin(2*np.pi*(y*5 + np.sin(x*2*np.pi)*.18))
timber = material(.51+streak*.105+groove*.085+fine*.023, .49+streak*.14+groove*.11, groove*.14)
stone = masonry(5, 5, .035, 7)
plaster = material(.55+cloud*.064+fine*.029, .49+cloud*.057+fine*.043, cloud*.057)
roof = masonry(6, 8, .026, 49)
reed = np.sin(2*np.pi*(x*36 + cloud*.13))
courses = np.cos(2*np.pi*y*5)
thatch = material(.50+reed*.079+courses*.074+fine*.019, .50+reed*.16+courses*.13, courses*.087)
warp = np.cos(2*np.pi*x*34)
weft = np.cos(2*np.pi*y*32)
cloth = material(.54+(warp+weft)*.059+fine*.021, .49+warp*weft*.17, cloud*.039)
scratch = np.cos(2*np.pi*(x*44 + np.sin(y*2*np.pi)*.58))
metal = material(.55+cloud*.074+scratch*.031+fine*.02, .52+fine*.029+scratch*.09, cloud*.029)
leather = material(.47+cloud*.054+fine*.023, .52+fine*.09+cloud*.03, cloud*.057)

tiles = [timber, stone, plaster, roof, thatch, cloth, metal, leather]
pad = 8
sheet = Image.new("RGB", ((SIZE+2*pad)*4, (SIZE+2*pad)*2))
for i, tile in enumerate(tiles):
    padded = np.pad(tile, ((pad, pad), (pad, pad), (0, 0)), mode="wrap")
    sheet.paste(Image.fromarray(padded), ((i % 4)*(SIZE+2*pad), (i // 4)*(SIZE+2*pad)))
sheet.save(Path(__file__).resolve().parents[1] / "dist" / "gpu" / "model-materials.png", optimize=True)
