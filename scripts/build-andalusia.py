"""Bake the Malaga landscape, its agricultural ground cover and its shared height grid."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates

out = Path(__file__).resolve().parents[1] / 'dist/maps/mediterranean'
rng = np.random.default_rng(1619)
west, north, span_x, span_z, density = 176, 650, 152, 120, 10
width, height = span_x*density, span_z*density
j, i = np.indices((height, width), dtype=np.float32)
x, z = west+(i+.5)/density, north+(j+.5)/density

def read_js(name):
    src = (out / name).read_text().split('const ', 1)[1].split('=', 1)[1]
    return json.JSONDecoder().raw_decode(src)[0]

def noise(size):
    grid = rng.normal(size=(int(span_z/size)+5, int(span_x/size)+5)).astype('f')
    return map_coordinates(grid, [(z-north)/size+1,(x-west)/size+1], order=3, mode='nearest').clip(-2.5,2.5)

def smooth(a, b, value):
    t = np.clip((value-a)/(b-a),0,1)
    return t*t*(3-2*t)

def mix(a, b, t):
    return np.asarray(a)+(np.asarray(b)-a)*np.asarray(t)[...,None]

def pixels(flat):
    return [((px-west)*density,(pz-north)*density) for px,pz in flat]

# Spurs descend from the inland divide on either side of the cultivated valley.
broad, fold, rough, fleck = (noise(s) for s in [17,5,1.15,.30])
valley_axis = 712 - .25*(x-250) + 3.1*np.sin((x-237)*.095)
valley = np.exp(-((z-valley_axis)/7.0)**2)
spine = 690 + 4.3*np.sin((x-198)*.072) - .12*(x-254)
mass = np.exp(-((z-spine)/14)**2) * (.74+.26*np.cos((x-229)*.074))
mass += .72*np.exp(-((x-238)/15)**2-((z-735)/13)**2)
mass += .63*np.exp(-((x-301)/16)**2-((z-710)/14)**2)
spurs = np.maximum(0,1-np.abs(.72*fold+.35*broad))
relief = np.maximum(.12,(.6+mass*(5.5+3.4*spurs)+.40*broad+.27*fold)*(1-.79*valley))
dz, dx = np.gradient(gaussian_filter(relief, 4), 1/density)
incline = np.hypot(dx,dz)
sun = np.clip((.95+.95*dx+1.35*dz)/np.sqrt(1+dx*dx+dz*dz), .48,1.25)
rock = smooth(.45,1.18,incline*.78+mass*.48+.14*rough+.085*fleck)
green = smooth(-.25,.79,.50*valley+.26*broad+.27*fold+.13*rough-.38*mass)
ground = mix([139,133,94],[72,94,61],green)
ground = mix(ground,[178,167,135],rock)
scrub = smooth(.35,1.1,rough*.68+fleck*.44+.22*fold)*(1-.70*rock)
ground = mix(ground,[66,77,49],scrub*.65)
grit = rng.normal(0,2.3,(height,width)).astype('f')
ground *= (.58+.43*sun)[...,None]
ground += (.9*grit+3*fleck+2.5*rough)[...,None]
worked = ground.copy()
regions, parcels = read_js('map-data.js'), read_js('parcel-data.js')
region_id = next(k for k,r in enumerate(regions) if r['key']=='malaga')
region = parcels[region_id]
labels_img = Image.new('L',(width,height))
pen=ImageDraw.Draw(labels_img)
for slot,cell in enumerate(region['cells']):
    v = np.asarray(cell['v']).reshape(-1,2)
    for tri in np.asarray(cell['i']).reshape(-1,3):
        pen.polygon(pixels(v[tri]),fill=slot+1)
labels=np.asarray(labels_img)
road_mask=Image.new('L',(width,height))
pen=ImageDraw.Draw(road_mask)
roads=read_js('road-data.js')
nodes={key:(px,pz) for key,px,pz in roads['nodes']}
for a,b in roads['links']:
    pen.line(pixels([nodes[a],nodes[b]]),fill=255,width=2)
road_distance=distance_transform_edt(np.asarray(road_mask)==0)/density
roadside=smooth(.8,1.65,road_distance)
boundary=np.zeros_like(x)
props=[]
forms=[0,2,1,0,1,2,1]
# Soft courtyard shadows share the painted ground, so they follow hills and camera rotation.
# Each base and height is expressed in the same model units as its roof or mill tower.
farm_footprints = [
    [(-4,-.8,3.85,3.85,8,True),(2.6,-2.4,7.15,4.12,4.1,False)],
    [(0,-2.8,11,4.6,5.1,False),(4.35,1.02,2.85,5.3,3.5,False),
     (0,.43,7.8,2.2,2.9,False),(-3.05,3.7,1.8,1.8,1.1,True)],
    [(-.8,-3.6,11.0,5.35,5.7,False),(.9,3.3,8.0,2.85,3.1,False)],
]
def shade_yard(surface, slot, form):
    sx,sz,scale=slot['x'],slot['z'],slot['scale']
    px,pz=int((sx-west)*density),int((sz-north)*density)
    reach=int(14*scale*density)+4
    area=np.s_[max(0,pz-reach):pz+reach+1,max(0,px-reach):px+reach+1]
    xx,zz=(x[area]-sx)/scale,(z[area]-sz)/scale
    shadow=np.zeros_like(xx)
    for cx,cz,w,d,h,round_base in farm_footprints[form]:
        for t in np.linspace(0,1,7):
            dx=np.abs(xx-cx-t*h*.53)
            dz=np.abs(zz-cz-t*h*.41)
            if round_base:
                distance=(np.hypot(dx/(w*.5),dz/(d*.5))-1)*w*.5
            else:
                distance=np.maximum(dx-w*.5,dz-d*.5)
            cover=1-smooth(-.26,.38+t*.72,distance)
            shadow=np.maximum(shadow,cover*(.34-.12*t))
    surface[area]*=1-shadow[...,None]

for k,slot in enumerate(region['slots']):
    owned=labels==k+1
    edge=distance_transform_edt(owned)/density
    boundary[owned]=edge[owned]
    sx,sz=slot['x'],slot['z']
    form=forms[k]
    angle=[.22,-.55,.76][form]+rng.uniform(-.13,.13)
    u=(x-sx)*np.cos(angle)+(z-sz)*np.sin(angle)
    v=-(x-sx)*np.sin(angle)+(z-sz)*np.cos(angle)
    # A farm lane curves through the yard. Each side has its own runs of fields.
    v += 1.15*np.sin(u*.10+k*.61)+.17*fold
    yard=np.maximum(np.abs(u+.23*v)*.83,np.abs(v-.12*u)*1.07)+.21*rough
    farm=ground.copy()
    yard_mask=(1-smooth(1.45,2.7,yard))*(.72+.12*rough)
    farm=mix(farm,[132,109,77],yard_mask*.75)
    lane=(1-smooth(.19,.49,np.abs(v)))*smooth(.22,1.2,edge)
    farm=mix(farm,[147,128,93],lane*.78)
    grass_border=np.zeros_like(x)
    short,long=[(3.3,12),(5.1,7.9),(6.9,12.8)][form]
    palette=np.array([[164,143,77],[188,160,91],[126,106,74],[107,125,71],[144,146,86],[147,119,75]])
    # Deterministic strip boundaries bend with the land. Vary their length,
    # orientation and planting independently on either side of the lane.
    for side in [-1,1]:
        near=.52
        for band in range(8):
            far=near+short*rng.uniform(.72,1.45)
            lo=-57+rng.uniform(-6,6)
            while lo<55:
                hi=lo+long*rng.uniform(.57,1.48)
                shear=rng.uniform(-.24,.24)
                uu=u+shear*(side*v-near)
                margin=np.minimum(np.minimum(uu-lo,hi-uu),np.minimum(side*v-near,far-side*v))
                margin=np.minimum.reduce([margin,edge-.32,(yard-1.75),road_distance-.47])
                planted=(rng.uniform()>.20)
                if planted:
                    mask=smooth(.09,.32,margin)*smooth(1.02,.45,incline)*owned
                    if mask.max()>.05:
                        color=palette[rng.integers(len(palette))]
                        direction=rng.uniform(-.11,.11)
                        phase=(v+direction*u)*rng.uniform(10,14)
                        grain=(np.cos(phase)*.5+np.cos(phase*2)*.20)*13
                        surface=color+(grain+rough*3.8+fleck*3.5+grit+fold*4.6)[...,None]
                        surface*= (.64+.36*sun)[...,None]
                        farm=mix(farm,surface,mask)
                        grass_border=np.maximum(grass_border,(1-smooth(.03,.37,np.abs(margin)))*owned*(edge>.85)*roadside)
                lo=hi+.12
            near=far+.08
            if near>28:break
    farm=mix(farm,[93,101,59],grass_border*.38)
    # Contact shade ties the barn, trees and outbuildings to the ground layer.
    for px,pz,rx,rz in [(sx+1.5,sz-.65,1.7,1.13),(sx-1.25,sz-1.08,.95,.69)]:
        shadow=np.exp(-(((x-px)/rx)**2+((z-pz)/rz)**2)*1.6)
        farm*=1-.26*shadow[...,None]
    candidates=np.argwhere((grass_border>.48)&(edge>1.2)&(road_distance>1.4)&(yard>3.4))
    trees=[]
    if len(candidates):
        for row,col in candidates[rng.permutation(len(candidates))[:550]]:
            px,pz=float(x[row,col]),float(z[row,col])
            if any((px-a)**2+(pz-b)**2<2.3**2 for a,b,*_ in trees):continue
            size=float(rng.uniform(.69,1.15))
            trees.append([round(px,2),round(pz,2),round(size,2),int(rng.random()<.18)])
            shadow=np.exp(-(((x-px-.39*size)/(.84*size))**2+((z-pz-.37*size)/(.52*size))**2)*1.4)
            farm*=1-.29*shadow[...,None]
            if len(trees)>=min(28,round(region['cells'][k]['area']/23)):break
    props.append(trees)
    shade_yard(farm,slot,form)
    worked[owned]=farm[owned]
# Alpha stores signed-inward distance at high resolution for anti-aliased
# placement strokes. Keep it above 50% for accurate browser canvas decoding.
alpha=np.uint8(128+np.minimum(boundary/1.5,1)*127)
def rgba(rgb):
    return np.dstack([rgb.clip(0,255).astype('uint8'),alpha])
Image.fromarray(np.concatenate((rgba(ground),rgba(worked)),axis=1)).save(out/'andalusia-ground.png')
cols,rows=span_x+1,span_z+1
sample=map_coordinates(relief,[np.linspace(0,height-1,rows)[:,None]+np.zeros(cols),np.zeros((rows,1))+np.linspace(0,width-1,cols)],order=1)
data=dict(x=west,z=north,w=span_x,h=span_z,cols=cols,rows=rows,region=region_id,forms=forms,trees=props,
          heights=np.rint(sample*20).clip(0,255).astype(int).ravel().tolist())
(out/'andalusia.js').write_text('const ANDALUSIA='+json.dumps(data,separators=(',',':'))+';\n')
