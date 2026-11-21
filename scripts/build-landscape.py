"""Bake seamless material grains and shoreline proximity from the campaign polygons."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, map_coordinates

DIST = Path(__file__).resolve().parent.parent / 'dist'


def value(source, name):
    return json.JSONDecoder().raw_decode(source.split(f'const {name}=', 1)[1])[0]


def materials():
    rng = np.random.default_rng(1619)
    size = 1024
    y, x = np.mgrid[0:size, 0:size] / size

    def noise(nx, ny):
        lattice = rng.random((ny, nx))
        return map_coordinates(lattice, [y*ny, x*nx], order=3, mode='grid-wrap')

    grass = .38 + .32*noise(12, 12) + .22*noise(85, 92) + .08*rng.random(x.shape)
    grain = noise(171, 61)
    heath = .36 + .32*noise(15, 20) + .24*grain + .08*rng.random(x.shape)
    stone = .29 + .37*noise(24, 19) + .26*noise(106, 39)
    seams = np.abs(np.sin(2*np.pi*(7*x+12*y+.73*noise(6, 6))))
    stone += .13*seams - .17*(seams < .15)
    sand = .53 + .31*noise(20, 20) + .16*rng.random(x.shape)
    packed = np.uint8(np.clip(np.stack([grass, heath, stone, sand], axis=-1), 0, 1)*255)
    Image.fromarray(packed, 'RGBA').save(DIST/'terrain-materials.png', optimize=True)


def coast_texture(target, width, height, land, water_boundary=None):
    w, h = 4096, round(4096*height/width)
    size = (w, h)

    def ring_pixels(ring):
        return [(x/width*(w-1), z/height*(h-1)) for x, z in ring]

    if water_boundary is None:
        image = Image.new('1', size, 0)
    else:
        image = Image.new('1', size, 1)
        ImageDraw.Draw(image).polygon(ring_pixels(water_boundary), fill=0)
    draw = ImageDraw.Draw(image)
    for polygon in land:
        if not polygon:
            continue
        draw.polygon(ring_pixels(polygon[0]), fill=1)
        for hole in polygon[1:]:
            draw.polygon(ring_pixels(hole), fill=0)

    dry = np.asarray(image, dtype=bool)
    sampling = (height/(h-1), width/(w-1))
    land_distance = distance_transform_edt(dry, sampling=sampling)
    water_distance = distance_transform_edt(~dry, sampling=sampling)
    distance = np.maximum(0, land_distance+water_distance-min(sampling)*.5)
    shoreline = np.uint8((1-np.minimum(distance/24, 1))*255)
    Image.fromarray(shoreline, 'L').save(target/'terrain-shore.png', optimize=True)


materials()
baltic = value((DIST/'logic.js').read_text(), 'BALTIC')
baltic_regions = value((DIST/'map-data.js').read_text(), 'HISTORICAL_REGIONS')
coast_texture(DIST, 1100, 710, [polygon for region in baltic_regions for polygon in region['polys']], baltic)
med = DIST/'maps'/'mediterranean'
scenario = (med/'scenario.js').read_text()
coast_texture(med, *value(scenario, 'MAP_SCENARIO')['world'], value(scenario, 'SCENARIO_LAND'))
