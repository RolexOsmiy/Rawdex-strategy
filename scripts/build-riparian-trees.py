"""Paint date palms and narrow floodplain trees at the woodland atlas viewing angle."""
from pathlib import Path
from math import cos, sin, pi

import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'dist'
rng = np.random.default_rng(7519)
size = 512
sheet = Image.new('RGBA', (2*size, 2*size))
woods = Image.open(root/'maps/mediterranean/woodland.png').convert('RGBA')

def palm(lean):
    tile = Image.new('RGBA',(size,size))
    pen = ImageDraw.Draw(tile)
    cx, cy = 258 + lean, 142
    # Overlapping leaf scars follow the bend and taper of the trunk.
    for j in range(189):
        t=j/188
        x=255+lean*t*t
        y=483-335*t
        radius=9.8-3.7*t
        pen.ellipse((x-radius,y-3,x+radius,y+3),fill=(91,74,46))
        pen.line((x-radius*.87,y+1,x+radius*.38,y-2), fill=(143,125,78), width=2)
    fronds=[]
    for j in range(28):
        theta=2*pi*j*.381966+rng.uniform(-.10,.10)
        radius=rng.uniform(110,215)
        arch=rng.uniform(50,108)
        tip=sin(theta)*radius*.36+rng.uniform(14,53)
        fronds.append((sin(theta),theta,radius,arch,tip))
    for depth,theta,radius,arch,tip in sorted(fronds):
        light=.46+.22*cos(theta+2.5)+rng.uniform(-.09,.10)
        color=np.array([49,69,42])+np.array([76,75,36])*light
        def axis(t):
            return cx+cos(theta)*radius*t,cy+tip*t-arch*sin(pi*t)
        pen.line([axis(t) for t in np.linspace(0,1,31)],fill=tuple(color.astype(int)),width=3)
        for t in np.linspace(.07,.98,30):
            x,y=axis(t)
            length=(12+28*sin(t*pi))*(1.-.56*t)
            for side in (-1,1):
                spread=side*length
                dx=cos(theta)*length*.67-sin(theta)*spread
                dy=16*sin(t*pi)+sin(theta)*length*.26+cos(theta)*spread*.52
                tipx,tipy=x+dx,y+dy
                v=tuple(np.clip(color+rng.uniform(-17,18)+side*4,0,255).astype(int))
                pen.polygon([(x-1.4,y),(x+dx*.63-1,y+dy*.36-2),(tipx,tipy),(x+dx*.48+1,y+dy*.49),(x+1.3,y)],fill=v)
    return tile

for variant in range(2):
    sheet.paste(palm((-21,27)[variant]),(variant*size,0))
    # A tall, more open crown and a lit trunk distinguish the alluvial woods.
    crop=woods.crop((variant*size,0,(variant+1)*size,size)).resize((310,417),Image.Resampling.LANCZOS)
    pixels=np.array(crop)
    pixels[:,:,:3]=np.clip(pixels[:,:,:3]*np.array([.95,1.10,.87])+np.array([9,14,7]),0,255)
    tree=Image.new('RGBA',(size,size))
    draw=ImageDraw.Draw(tree)
    draw.polygon([(247,493),(258,490),(260,272),(251,233)],fill=(152,148,116))
    draw.line([(252,483),(255,327),(248,225)],fill=(91,91,71),width=3)
    tree.alpha_composite(Image.fromarray(pixels),(100,18))
    sheet.paste(tree,(variant*size,size))
sheet.save(root/'forest-floodplain.png')
