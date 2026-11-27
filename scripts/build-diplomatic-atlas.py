"""Bake the atlas layers from the campaign geography and supplied textures.

Usage: python scripts/build-diplomatic-atlas.py <ne_10m_land.zip> <texture directory>
Requires numpy, pillow, pyshp, scipy and shapely.
"""
import argparse
import base64
import json
from pathlib import Path

import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageOps
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates
from shapely.geometry import box, shape

DIST = Path(__file__).resolve().parents[1] / "dist"
DESTINATION = DIST / "maps" / "atlas"
# Keep one quarter of the former margin beyond the playable provinces.
# build-rivers.py uses the same extent for the 3D terrain and waterways.
BALTIC_EXTENT = (-95, -60, 1199, 752)
MEDITERRANEAN_EXTENT = (-230, -79, 2430, 1328)


def read_constant(file, name):
    text = file.read_text(encoding="utf-8").split(f"const {name}=", 1)[1]
    return json.JSONDecoder().raw_decode(text)[0]


def polygon_parts(geometry):
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygon_parts(part)


def baltic_projection():
    # Register Natural Earth to the historical map's existing city anchors.
    parcels = read_constant(DIST / "parcel-data.js", "PARCEL_DATA")
    regions = read_constant(DIST / "map-data.js", "HISTORICAL_REGIONS")
    sites = {
        "Гданьск": (18.65, 54.35), "Мальборк": (19.03, 54.04),
        "Кёнигсберг": (20.51, 54.71), "Фромборк": (19.68, 54.36),
        "Пернов": (24.50, 58.39), "Венден": (25.27, 57.31),
        "Дерпт": (26.72, 58.38), "Варшава": (21.01, 52.23),
        "Познань": (16.93, 52.41), "Вильно": (25.29, 54.69),
        "Киев": (30.52, 50.45), "Краков": (19.94, 50.06),
        "Полоцк": (28.77, 55.49), "Каменец": (26.57, 48.68),
        "Витебск": (30.20, 55.19), "Смоленск": (32.05, 54.78),
    }
    inputs, outputs = [], []
    for region in regions:
        if region["city"] not in sites:
            continue
        anchor = parcels[str(region["id"])]["slots"][0] if isinstance(parcels, dict) else parcels[region["id"]]["slots"][0]
        lon, lat = sites[region["city"]]
        inputs.append((lon, lat, 1))
        outputs.append((anchor["x"], anchor["z"]))
    transform = np.linalg.lstsq(inputs, outputs, rcond=None)[0]
    return transform, regions


def baltic_land(archive):
    transform, regions = baltic_projection()
    return read_land(archive, box(8, 43, 47, 65), transform), regions


def read_land(archive, study_area, transform):
    west, south, east, north = study_area.bounds
    coast = []
    with shapefile.Reader(str(archive)) as data:
        for feature in data.shapes():
            x0, y0, x1, y1 = feature.bbox
            if x1 < west or x0 > east or y1 < south or y0 > north:
                continue
            for polygon in polygon_parts(shape(feature.__geo_interface__).intersection(study_area)):
                rings = []
                for ring in [polygon.exterior, *polygon.interiors]:
                    coords = np.asarray(ring.coords)
                    rings.append(np.column_stack((coords, np.ones(len(coords)))) @ transform)
                coast.append(rings)
    return coast


def paint_mask(polygons, size, extent):
    mask = Image.new("L", size)
    draw = ImageDraw.Draw(mask)
    x0, z0, x1, z1 = extent
    sx, sz = (size[0] - 1) / (x1 - x0), (size[1] - 1) / (z1 - z0)
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            if len(ring) < 3:
                continue
            draw.polygon([((x - x0) * sx, (z - z0) * sz) for x, z in ring], fill=255 if index == 0 else 0)
    return np.asarray(mask) > 127


def texture_grain(file, size, amount):
    image = ImageOps.fit(Image.open(file).convert("L"), size, Image.Resampling.LANCZOS)
    gray = np.asarray(image, dtype=np.float32)
    high = gray - gaussian_filter(gray, 5)
    return np.clip(high * (amount / max(1, np.std(high) * 3)), -amount, amount)


def gradient(start, end, amount):
    return np.asarray(start) + (np.asarray(end) - np.asarray(start)) * amount[..., None]


def bake(name, extent, world, directory, textures, coast, regions):
    x0, z0, x1, z1 = extent
    width = 1820 if name == "baltic" else 2048
    size = (width, round(width * (z1 - z0) / (x1 - x0)))
    z, x = np.meshgrid(np.linspace(z0, z1, size[1]), np.linspace(x0, x1, size[0]), indexing="ij")
    original = paint_mask(coast, size, extent)
    # Keep the game provinces on paper where the historical and modern coastlines diverge.
    playable = paint_mask([p for region in regions for p in region["polys"]], size, extent)
    land = original | playable
    spacing = (x1 - x0) / (size[0] - 1)
    distance, nearest = distance_transform_edt(~land, return_indices=True)
    to_land = distance * spacing
    to_water = distance_transform_edt(land) * spacing
    relief = read_constant(directory / "terrain-relief.js", "TERRAIN_RELIEF")
    pixels = np.frombuffer(base64.b64decode(relief["data"]), dtype=np.uint8).reshape(relief["rows"], relief["cols"], 3)
    coordinates = [z / world[1] * (relief["rows"] - 1), x / world[0] * (relief["cols"] - 1)]
    height = map_coordinates(pixels[..., 0] / 256 + pixels[..., 1], coordinates, order=1, mode="nearest")
    vertical, horizontal = np.gradient(gaussian_filter(height, 1.2), spacing)
    light = np.clip((vertical + horizontal * .8) * 14, -27, 27)
    land_color = gradient((179, 165, 135), (147, 134, 108), .53 * (x-x0)/(x1-x0) + .47 * (z-z0)/(z1-z0))
    land_color += (light * np.where(playable, 1, .69) + texture_grain(textures / "atlas-paper.png", size, 5))[..., None]
    water_color = gradient((56, 83, 97), (43, 66, 79), .28 * (x-x0)/(x1-x0) + .72 * (z-z0)/(z1-z0))
    landmass = gaussian_filter(land.astype(np.float32), 2.2)[tuple(nearest)]
    slope = np.interp(to_land, [0, 3.7, 12 if name == "baltic" else 20], [.86, .36, 0])
    slope *= np.clip(landmass * 2.1, .18, 1)
    water_color += (np.array((110, 129, 128)) - water_color) * slope[..., None]
    step = 86 if name == "baltic" else 165
    grid = np.minimum(abs((x + step/2) % step - step/2), abs((z + step/2) % step - step/2))
    water_color += (np.maximum(0, 1 - grid / (spacing * 1.05)) * 11 + texture_grain(textures / "atlas-water.png", size, 4))[..., None]
    edge = np.maximum(0, 1.5 - to_water / spacing) * .54
    land_color += (np.array((195, 175, 134)) - land_color) * edge[..., None]
    result = np.where(land[..., None], land_color, water_color)
    Image.fromarray(np.uint8(np.clip(result, 0, 255))).save(DESTINATION / f"diplomatic-{name}.webp", quality=88, method=6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("land_archive", type=Path)
    parser.add_argument("textures", type=Path)
    args = parser.parse_args()
    med = DIST / "maps" / "mediterranean"
    med_scenario = read_constant(med / "scenario.js", "MAP_SCENARIO")
    baltic, baltic_regions = baltic_land(args.land_archive)
    scale = 2100 / 47.1
    depth = scale / np.cos(np.radians(38))
    transform = np.array([[scale, 0], [0, -depth], [50 + 9.7 * scale, 130 + 47.1 * depth]])
    med_coast = read_land(args.land_archive, box(-30, 19, 56, 58), transform)
    bake("baltic", BALTIC_EXTENT, (1100, 710), DIST, args.textures, baltic, baltic_regions)
    bake("mediterranean", MEDITERRANEAN_EXTENT, med_scenario["world"], med, args.textures,
         med_coast, read_constant(med / "map-data.js", "HISTORICAL_REGIONS"))
    Image.open(args.textures / "atlas-desk.png").convert("RGB").save(DESTINATION / "diplomatic-desk.webp", quality=84, method=6)


if __name__ == "__main__":
    main()
