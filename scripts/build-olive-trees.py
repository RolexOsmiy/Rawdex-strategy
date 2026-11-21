"""Render two original olive tree silhouettes for the field-edge billboard atlas."""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

rng=random.Random(218)
n=384
atlas=Image.new('RGBA',(2*n,n))
for variant in range(2):
    tree=Image.new('RGBA',(n,n))
    pen=ImageDraw.Draw(tree)
    tips=[]
    def branch(x,y,length,angle,radius,depth):
        mid=angle+rng.uniform(-.18,.18)
        ex,ey=x+math.cos(mid)*length,y+math.sin(mid)*length
        pen.line((x,y,ex,ey),fill=(68,61,45),width=max(1,int(radius)))
        pen.line((x-radius*.18,y,ex-radius*.13,ey),fill=(107,99,77),width=max(1,int(radius*.30)))
        if depth==0:
            tips.append((ex,ey))
            return
        for side in [-1,1]:
            direction=angle+side*rng.uniform(.26,.71)
            direction=max(-2.94,min(-.20,direction))
            branch(ex,ey,length*rng.uniform(.64,.82),direction,radius*.64,depth-1)
    branch(194,362,66,-1.48,16,5)
    branch(192,328,53,-2.04,9,4)
    branch(194,312,48,-.81,8,4)
    spots=[]
    for cx,cy in tips:
        radius=rng.uniform(14,34)
        for _ in range(50):
            dx,dy=rng.gauss(0,.48),rng.gauss(0,.40)
            if dx*dx+dy*dy>1:continue
            spots.append((cy+dy*radius,cx+dx*radius,dx,dy,radius))
    for cy,cx,dx,dy,radius in sorted(spots):
        light=rng.uniform(-13,13)-dx*14-dy*23
        base=[82,92,64] if variant==0 else [91,96,69]
        for j in range(10):
            lx,ly=cx+rng.gauss(0,3.6),cy+rng.gauss(0,3.)
            size=rng.uniform(1.2,4)
            c=tuple(int(v+light+rng.uniform(-5,5)) for v in base)
            pen.ellipse((lx-size,ly-size*.65,lx+size,ly+size*.65),fill=c)
    bounds=tree.getbbox()
    sprite=tree.crop(bounds);sprite.thumbnail((n-8,n-8),Image.Resampling.LANCZOS)
    atlas.paste(sprite,(variant*n+(n-sprite.width)//2,n-4-sprite.height))
atlas.save(Path(__file__).resolve().parents[1]/'dist/maps/mediterranean/olive-trees.png')
