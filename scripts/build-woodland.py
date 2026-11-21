"""Derive high-detail regional crowns from the game's original oak foliage."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

root = Path(__file__).resolve().parents[1] / 'dist'
oak = Image.open(root/'forest-oak.png').convert('RGBA')
oak = oak.crop(oak.getbbox())
pixels = np.asarray(oak, dtype=np.float32)
height, width = pixels.shape[:2]
size = 512
y, x = (np.indices((size, size), dtype=np.float32) + .5) / size
sheet = Image.new('RGBA', (2*size, 2*size))
# Vary crown width, height of the main fork, lean, foliage tone and branch direction.
for k, (shoulder,spread,lean,mirror,tint) in enumerate([
    (.70,.91,-.05,False,[1.03,1.04,.96]),
    (.74,.80,.09,True,[1.14,1.08,.95]),
    (.51,.98,.035,True,[.95,1.04,1.04]),
    (.77,.98,-.09,False,[1.09,1.07,.92]),
]):
    v = np.interp(y,[.025,shoulder,.98], [0,.79,1])
    widest = spread*(1+.09*np.sin(v*6.28+k)-.08*np.cos(v*3.14))
    u = .5+(x-.5-lean*(1-v)**2)/widest
    if mirror:
        u = 1-u
    pos = [v*(height-1),u*(width-1)]
    rgba = np.stack([map_coordinates(pixels[...,ch],pos,order=1,mode='constant') for ch in range(4)],axis=-1)
    rgba[...,3] *= ((y>.025)&(y<.98))
    rgba[...,:3] *= np.array(tint)
    # Lift the darkest interior leaves slightly for readability in overlapping stands.
    rgba[...,:3] = rgba[...,:3]*.97 + [4,5,3]
    tile=Image.fromarray(np.uint8(rgba.clip(0,255)))
    sheet.paste(tile,((k%2)*size,(k//2)*size))
sheet.save(root/'maps/mediterranean/woodland.png')
