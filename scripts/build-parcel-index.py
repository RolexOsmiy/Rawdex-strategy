"""Rasterize precomputed parcel IDs for paint on the original terrain mesh.

Run after build-parcels.cjs. Red and green encode the exact slot and region IDs.
Blue stores the distance to the nearest boundary, capped at four world units.
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent.parent
target=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'dist'
src=(target/'parcel-data.js').read_text()
scenario=target/'scenario.js'
world_width,world_height=(json.loads(scenario.read_text().splitlines()[0].removeprefix('const MAP_SCENARIO=').rstrip(';')).get('world',[1100,710])
                          if scenario.exists() else [1100,710])
parcels=json.loads(src.split('=',1)[1].strip().rstrip(';'))
for width in (2048,4096):
 height=round(width*world_height/world_width)
 image=Image.new('RGB',(width,height),(0,0,0));draw=ImageDraw.Draw(image)
 for region in parcels:
  rid=region['id']+1
  if rid>255: raise ValueError('region ID does not fit index texture')
  for slot,cell in enumerate(region['cells']):
   if slot+1>=32: raise ValueError('slot exceeds lookup texture')
   verts=cell['v'];indices=cell['i'];color=(slot+1,rid,0)
   for j in range(0,len(indices),3):
    points=[(round(verts[2*k]*(width-1)/world_width),round(verts[2*k+1]*(height-1)/world_height)) for k in indices[j:j+3]]
    draw.polygon(points,fill=color)
 pixels=np.array(image)
 labels=pixels[:,:,0].astype(np.uint16)+pixels[:,:,1].astype(np.uint16)*32
 boundary=labels==0
 vertical=labels[1:]!=labels[:-1]
 horizontal=labels[:,1:]!=labels[:,:-1]
 boundary[1:]|=vertical
 boundary[:-1]|=vertical
 boundary[:,1:]|=horizontal
 boundary[:,:-1]|=horizontal
 distance=distance_transform_edt(~boundary,sampling=(world_height/(height-1),world_width/(width-1)))
 pixels[:,:,2]=np.uint8(np.clip(distance*63.75,0,255))
 Image.fromarray(pixels).save(target/f'parcel-index-{width}.png',optimize=True)
 print(width,height)
