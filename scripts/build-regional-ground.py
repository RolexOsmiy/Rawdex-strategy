"""Bake elevation, woodland suitability, and soil color from the same regional landscape."""
import base64
import json
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image

DIST = Path(__file__).resolve().parents[1] / "dist"


def value(source, name):
    section = source.split(f"const {name}=", 1)[1]
    return json.JSONDecoder().raw_decode(section)[0]


def smooth(a, b, field):
    t = np.clip((field - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blend(a, b, t):
    return np.asarray(a, np.float32) * (1 - t[..., None]) + np.asarray(b, np.float32) * t[..., None]


# Ridge axes are in campaign geography. Widths and heights are expressed in map art units.
MEDITERRANEAN_RIDGES = [
    # Iberian highlands. The two Castilian ranges leave an open plateau between them.
    (20, 46, [(-6.75, 40.20), (-5.65, 40.28), (-4.70, 40.48), (-4.14, 40.83), (-3.66, 41.10), (-3.23, 41.20)]),
    (17, 28, [(-6.03, 39.29), (-5.37, 39.43), (-4.63, 39.48), (-3.64, 39.55), (-3.20, 39.39)]),
    (27, 32, [(-7.02, 38.09), (-6.17, 38.15), (-5.42, 38.04), (-4.68, 38.28), (-3.80, 38.35)]),
    (29, 45, [(-5.68, 36.62), (-5.04, 36.79), (-4.42, 37.00), (-3.37, 37.10), (-2.59, 37.09)]),
    (31, 51, [(-8.03, 43.01), (-6.44, 43.02), (-4.74, 43.10), (-3.22, 43.12)]),
    (25, 40, [(-2.83, 42.23), (-2.08, 41.47), (-1.25, 40.67), (-.48, 40.27), (.34, 40.72)]),
    (30, 62, [(-1.63, 42.91), (-.12, 42.86), (1.10, 42.69), (2.22, 42.49), (3.04, 42.34)]),
    (25, 23, [(-8.04, 40.03), (-7.61, 40.36), (-7.14, 41.02), (-7.02, 41.65)]),
    # Massif Central, Alps and Apennines.
    (36, 33, [(2.12, 44.45), (2.85, 45.04), (3.47, 45.22), (4.11, 45.08)]),
    (38, 75, [(6.70, 44.18), (6.96, 44.97), (7.31, 45.80), (8.86, 46.31), (10.71, 46.58), (12.19, 46.50), (13.23, 46.21)]),
    (23, 45, [(8.22, 44.25), (9.24, 44.53), (10.34, 44.25), (11.20, 44.03), (12.17, 43.76), (13.18, 42.59), (14.46, 41.58), (15.82, 40.72), (16.06, 39.23)]),
    (17, 33, [(8.79, 41.80), (9.08, 42.21), (9.05, 42.72)]),
    (17, 29, [(9.24, 39.71), (9.31, 40.17), (9.38, 40.51)]),
    (19, 33, [(13.33, 37.70), (14.11, 37.96), (14.82, 37.93), (15.02, 37.74)]),
    # Dinaric, Balkan, Greek and Anatolian chains.
    (27, 46, [(13.65, 45.69), (15.40, 44.91), (16.68, 44.06), (17.51, 43.84), (18.75, 43.18), (19.85, 42.66), (20.37, 41.66)]),
    (26, 37, [(22.47, 43.81), (23.43, 43.22), (24.70, 42.87), (26.52, 42.79), (27.83, 42.73)]),
    (26, 41, [(20.85, 41.24), (21.07, 40.57), (21.50, 39.80), (21.82, 39.17), (22.18, 38.53)]),
    (19, 34, [(21.72, 37.91), (22.19, 37.58), (22.31, 37.08), (22.36, 36.74)]),
    (16, 31, [(23.90, 35.35), (24.35, 35.28), (24.98, 35.18), (25.68, 35.13)]),
    (29, 38, [(28.74, 40.23), (29.42, 40.03), (30.74, 40.63), (32.66, 40.93), (34.15, 41.18), (36.20, 41.43), (37.38, 40.87)]),
    (28, 49, [(29.25, 36.71), (30.66, 36.93), (31.91, 37.27), (33.06, 37.03), (34.60, 37.29), (35.86, 38.05), (37.18, 37.54)]),
    (16, 34, [(35.52, 33.19), (35.94, 34.21), (36.06, 34.54), (36.22, 35.59)]),
    # North Africa: coastal ridges and the Atlas with broad dry plateaus behind them.
    (22, 36, [(-5.76, 35.16), (-5.10, 35.01), (-4.34, 34.89), (-3.48, 35.07)]),
    (33, 57, [(-9.37, 30.68), (-8.16, 31.14), (-7.20, 31.13), (-6.17, 31.62), (-5.06, 31.98), (-3.59, 32.45)]),
    (28, 34, [(-4.96, 33.25), (-3.74, 34.19), (-2.38, 34.57), (-.65, 34.80), (1.43, 35.54), (2.87, 35.75), (4.30, 35.73), (6.43, 35.30), (8.74, 35.50), (10.07, 35.99)]),
    (23, 21, [(12.28, 31.95), (13.33, 31.98), (14.37, 31.81)]),
    (25, 26, [(20.85, 32.30), (21.77, 32.56), (22.40, 32.59), (23.19, 32.43)]),
]
BALTIC_RIDGES = [
    # Carpathian arc, uplands and low moraine belts using the campaign's historical projection.
    (32, 54, [(79,571),(161,557),(224,548),(270,554),(326,558),(367,571),(414,593),(454,624),(487,656),(533,685)]),
    (26, 20, [(215,465),(269,472),(311,482),(348,475),(396,493),(445,509)]),
    (22, 13, [(91,330),(139,331),(178,348),(211,340),(257,347),(291,333)]),
    (25, 13, [(451,166),(474,199),(517,216),(552,239),(594,257),(628,241)]),
    (35, 15, [(558,457),(618,473),(675,493),(711,504),(742,521)]),
]
MEDITERRANEAN_VALLEYS = [
    (10.5, .69, [(-2.18, 40.14),(-3.11,40.01),(-4.02,39.86),(-4.68,39.83),(-5.35,39.90),(-6.09,39.80),(-7.12,39.63)]),
    (8.0, .59, [(-3.0,37.89),(-4.26,37.99),(-5.24,37.61),(-5.98,37.38),(-6.25,36.76)]),
    (12, .69, [(7.48,44.99),(8.51,45.11),(9.67,45.03),(10.65,45.04),(11.99,44.99),(12.34,44.93)]),
]


def med_point(lon, lat):
    scale = 2100 / 47.1
    return 50 + (lon + 9.7)*scale, 130 + (47.1-lat)*scale/np.cos(np.radians(38))


def line_surface(x, z, profiles, result):
    """Apply a narrow influence band to each chain, only touching its bounding box."""
    step_x, step_z = x[0, 1], z[1, 0]
    for width, strength, points in profiles:
        for (ax, az), (bx, bz) in zip(points, points[1:]):
            radius = width * 2.65
            xx = slice(max(0, int((min(ax,bx)-radius)/step_x)), max(0,int((max(ax,bx)+radius)/step_x)+2))
            zz = slice(max(0, int((min(az,bz)-radius)/step_z)), max(0,int((max(az,bz)+radius)/step_z)+2))
            px,pz=x[zz,xx]-ax,z[zz,xx]-az
            dx,dz=bx-ax,bz-az
            travel=np.clip((px*dx+pz*dz)/max(.01,dx*dx+dz*dz),0,1)
            distance=(px-travel*dx)**2+(pz-travel*dz)**2
            wedge=strength*np.exp(-distance/width**2)
            np.maximum(result[zz,xx], wedge, out=result[zz,xx])


def write_relief(folder, world, relief, canopy):
    step = 2.4 if world[0] > 1500 else 1.85
    gw, gh = [round(size/step)+1 for size in world]
    j,i=np.indices((gh,gw),dtype=np.float32)
    coords = [j/(gh-1)*(relief.shape[0]-1),i/(gw-1)*(relief.shape[1]-1)]
    quantized=np.uint16(np.clip(map_coordinates(relief,coords,order=1)*256,0,65535))
    forest=np.uint8(np.clip(map_coordinates(canopy,coords,order=1)*255,0,255))
    packed=np.stack([quantized&255,quantized>>8,forest],axis=-1).astype(np.uint8)
    data={"cols":gw,"rows":gh,"data":base64.b64encode(packed.tobytes()).decode()}
    (folder/"terrain-relief.js").write_text(
        "// Generated by scripts/build-regional-ground.py from the campaign ridge profiles.\nconst TERRAIN_RELIEF="
        +json.dumps(data,separators=(',',':'))+";\n")

def bake(campaign, folder, world, width, ridges):
    length, depth = world
    rows = round(width * depth / length)
    z, x = np.indices((rows, width), dtype=np.float32)
    x *= length / (width - 1)
    z *= depth / (rows - 1)
    reach = campaign["reach"]
    weight = np.zeros_like(x)
    moisture = np.zeros_like(x)
    warmth = np.zeros_like(x)
    for cx, cz, wet, warm in campaign["anchors"]:
        w = np.exp(-((x - cx)**2 + (z - cz)**2) / reach**2)
        weight += w
        moisture += w * wet
        warmth += w * warm
    moisture = np.divide(moisture, weight, out=np.full_like(x, .46), where=weight > 1e-7)
    warmth = np.divide(warmth, weight, out=np.full_like(x, .50), where=weight > 1e-7)
    if ridges:
        river = 1858 + (z - 1034) * .34 + 3.8 * np.sin((z - 1018) * .101)
        irrigated = np.exp(-((x - river) / (5 + 18 * np.maximum(0, 1 - (z - 1030) / 63)))**2)
        irrigated *= np.clip((z - 1000) / 24, 0, 1) * (x > 1770) * (x < 1920)
        moisture += (1 - moisture) * irrigated * .71

    rng = np.random.default_rng(513)
    def noise(spacing):
        lattice = rng.standard_normal((int(depth/spacing)+5, int(length/spacing)+5)).astype("f")
        return np.clip(map_coordinates(lattice, [z/spacing+1, x/spacing+1], order=3, mode="nearest"), -2.2, 2.2)

    broad, fold, spur, cover, grit = (noise(scale) for scale in (36, 13, 5.9, 2.85, 1.18))
    uplift, valleys = np.zeros_like(x), np.zeros_like(x)
    chains = [(w,h,[med_point(*point) for point in points]) for w,h,points in MEDITERRANEAN_RIDGES] if ridges else BALTIC_RIDGES
    line_surface(x, z, chains, uplift)
    if ridges:
        line_surface(x,z,[(w,h,[med_point(*p) for p in points]) for w,h,points in MEDITERRANEAN_VALLEYS],valleys)
        plateau=6.5*np.exp(-((x-319)/112)**2-((z-511)/139)**2)
    else:
        plateau=2.1*np.exp(-((x-349)/235)**2-((z-356)/244)**2)
    mountains=smooth(7,32,uplift)
    crease=np.maximum(0,1-np.abs(spur*.89+fold*.52+.21*broad))
    shoulders=uplift*(.82+.19*crease+.062*fold)
    rolling=np.clip(6.2+plateau+2.1*broad+1.32*fold+.53*spur,1.4,None)
    relief=np.clip((rolling+shoulders+mountains*(spur*1.67+grit*.58))*(1-valleys*.47),1.1,102)
    dz, dx = np.gradient(gaussian_filter(relief, 1.32), depth / rows, length / width)
    grade = np.hypot(dx, dz)
    forest = np.sin(x*.009 + np.sin(z*.012)*1.6) + np.cos(z*.014 - x*.008) + .35*np.sin(x*.027 + z*.023)
    arid = smooth(.61, .87, warmth)*(1-smooth(.24,.63,moisture))
    greenery = smooth(.33, .85, moisture + .14*broad + .12*fold + .055*cover)
    cool = blend([159, 149, 106], [92, 123, 82], greenery)
    dry = blend([185, 153, 107], [135, 135, 91], smooth(.04,.56,moisture + .13*fold))
    art = blend(cool, dry, arid)
    wooded_slopes = smooth(4,23,uplift)*(1-smooth(32,64,relief))
    woodland = -forest*.22 + .25*fold + .17*spur + .13*broad + .31*wooded_slopes + .21*valleys
    canopy = smooth(.095,.63,moisture*.56+woodland)*smooth(.24,.51,moisture)*(1-arid*.92)
    canopy *= (1-smooth(54,77,relief))*(1-smooth(1.02,2.45,grade))
    art = blend(art, [65, 94, 72], canopy*.76)
    rock = smooth(.39,1.69,grade + relief*.0046 + .147*cover + .042*grit)
    stone = blend([150, 152, 134], [183, 169, 139], smooth(.42,.79,warmth))
    art = blend(art, stone, rock*.79)
    snow = smooth(56,72,relief)*(1-smooth(.29,.43,warmth))*smooth(.10,.46,grade+.07*cover)
    art = blend(art, [199, 205, 197], snow*.83)
    # Anisotropic runoff makes foothills read as ridges with green floors.
    bands = .5 + .5*np.sin(x*.34 + z*.18 + relief*.35 + fold*1.37)
    sun = .48 + .48*mountains
    light = np.clip(1.+(dx*.81+dz*.59)*sun/(1+grade*1.04), .70, 1.23)
    shade = np.maximum(0,gaussian_filter(relief,8)-relief)*smooth(.12,.65,grade)
    art *= (light*np.clip(1-shade*.013,.90,1.0))[...,None]
    art += (5.7*cover + 3.0*grit + (bands-.5)*11.0*rock)[...,None]
    # A material distribution map gives both the GPU detail pass and the tree
    # placement the same ground truth. Concavity follows the actual height field.
    hollow = gaussian_filter(relief, 8 * width/length) - relief
    drainage = smooth(.09, 1.85, hollow + valleys*1.4) * (1-smooth(.59,1.8,grade))
    masks = np.uint8(np.clip(np.stack([rock, canopy, drainage, warmth], axis=-1)*255,0,255))
    weights = Image.fromarray(masks).resize((width//2, rows//2), Image.Resampling.BOX)
    weights.save(folder / "terrain-habitats.png")
    write_relief(folder,world,relief,canopy)
    pixels = np.uint8(np.clip(np.dstack([art, moisture*255]), 0, 255))
    Image.fromarray(pixels, "RGBA").save(folder / "terrain-meadow.png")
    print(folder.name, pixels.shape, flush=True)


climates = value((DIST / "app.js").read_text(), "REGIONAL_CLIMATE")
med = DIST / "maps" / "mediterranean"
scenario = value((med / "scenario.js").read_text(), "MAP_SCENARIO")
bake(climates["baltic"], DIST, [1100, 710], 2048, [])
bake(climates["mediterranean"], med, scenario["world"], 3072, scenario["ridges"])
