"""Project Natural Earth 1:10m river centerlines onto the campaign maps.

Run: python scripts/build-rivers.py ne_10m_rivers_lake_centerlines.zip ne_10m_land.zip
River mouths and navigable systems are scenario rules based on the source geography.
"""
import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import shapefile
from scipy.ndimage import distance_transform_edt
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, unary_union
from shapely.validation import explain_validity

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("atlas_projection", root / "build-diplomatic-atlas.py")
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)

# Each navigable system has a named sea outlet, represented by the coordinates
# of the mouth. Tributaries listed in that system can share its outlet.
SYSTEMS = {
    "baltic": [
        ("Висла", (18.94, 54.36), ["Vistula", "Western Bug", "Sane"]),
        ("Неман", (21.28, 55.34), ["Neman", "Neris"]),
        ("Западная Двина", (24.03, 57.07), ["Daugava"]),
        ("Одра", (14.33, 53.91), ["Oder", "Warta"]),
        ("Днепр", (32.65, 46.65), ["Dnieper", "Prypiat", "Desna", "Seym"]),
        ("Днестр", (30.50, 46.07), ["Dniester"]),
        ("Южный Буг", (31.65, 46.59), ["Southern Bug"]),
    ],
    "mediterranean": [
        ("Гвадалквивир", (-6.38, 36.80), ["Guadalquivir"]),
        ("Тахо", (-9.32, 38.66), ["Tagus"]),
        ("Гвадиана", (-7.41, 37.17), ["Guadiana"]),
        ("Дору", (-8.68, 41.14), ["Douro", "Esla"]),
        ("Эбро", (0.89, 40.72), ["Ebro", "Segre"]),
        ("Рона", (4.86, 43.33), ["Rhône", "Saône", "Durance"]),
        ("По", (12.52, 44.96), ["Po", "Ticino", "Dora Baltea", "Mincio"]),
        ("Адидже", (12.34, 45.14), ["Adige"]),
        ("Тибр", (12.23, 41.74), ["Tiber"]),
        ("Дунай", (29.68, 45.15), ["Danube", "Sulina branch", "Chilia branch", "Tisza", "Sava", "Inn", "Drava", "Prut"]),
        ("Марица", (26.04, 40.73), ["Maritsa"]),
        ("Нил", (30.34, 31.47), ["Nile", "Rosetta Branch", "Damietta Branch"]),
        ("Сакарья", (30.65, 41.13), ["Sakarya"]),
        ("Кызылырмак", (35.97, 41.73), ["Kızılırmak"]),
    ],
}


def parts(geometry):
    if geometry.geom_type == "LineString":
        if not geometry.is_empty:
            yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from parts(part)


def extended_seas(transform, land_archive, regions):
    coast = atlas.read_land(land_archive, box(8, 43, 47, 65), transform)
    land = unary_union([Polygon(rings[0], rings[1:]).buffer(0) for rings in coast])
    playable = unary_union([Polygon(p[0], p[1:]).buffer(0) for region in regions for p in region["polys"]])
    limits = [
        (box(0, 175, 140, 365), (14.3, 54.22)),
        (box(735, 620, 1100, 710), (32.27, 45.56)),
    ]
    result = []
    for frame, seed in limits:
        water = frame.difference(land.union(playable))
        point = Point(np.array([*seed, 1]) @ transform)
        candidates = sorted(atlas.polygon_parts(water), key=lambda polygon: polygon.distance(point))
        if not candidates:
            continue
        area = candidates[0].simplify(.3, preserve_topology=True)
        result.append([np.round(ring.coords, 2).tolist() for ring in [area.exterior, *area.interiors]])
    return result


def backdrop(extent, transform, land_archive):
    x0, z0, x1, z1 = extent
    inverse = np.linalg.inv(np.column_stack((transform, [0, 0, 1])))
    corners = np.array([[x, z, 1] for x in [x0, x1] for z in [z0, z1]]) @ inverse
    lon0, lat0 = np.min(corners, axis=0)[:2] - 1
    lon1, lat1 = np.max(corners, axis=0)[:2] + 1
    coast = atlas.read_land(land_archive, box(lon0, lat0, lon1, lat1), transform)
    cols, rows = round((x1-x0)/6)+1, round((z1-z0)/6)+1
    dry = atlas.paint_mask(coast, (cols, rows), extent)
    distance = distance_transform_edt(dry) - distance_transform_edt(~dry)
    pixels = np.uint8(np.clip(np.round(distance*6)+128, 0, 255))
    return {"extent": extent, "cols": cols, "rows": rows,
            "coast": base64.b64encode(pixels).decode("ascii")}


def join_sheet(geometry, margin):
    pieces = sorted(atlas.polygon_parts(geometry), key=lambda p: p.area, reverse=True)
    sheet = pieces.pop(0)
    while pieces:
        other = min(pieces, key=sheet.distance)
        pieces.remove(other)
        link = LineString(nearest_points(sheet, other)).buffer(margin)
        sheet = sheet.union(other).union(link)
    return sheet


def port_courses(directory, data):
    parcels = atlas.read_constant(directory / "parcel-data.js", "PARCEL_DATA")
    sites = [site for parcel in (parcels.values() if isinstance(parcels, dict) else parcels) for site in parcel["slots"]]
    # Use the game's navigation graph so the coast of the sheet cannot cut a shipping route.
    script = """
const fs=require('node:fs'),vm=require('node:vm');
const {data,sites}=JSON.parse(fs.readFileSync(0,'utf8'));
const [RiverMap,reach]=vm.runInNewContext(fs.readFileSync('dist/rivers.js','utf8')+';[RiverMap,RIVER_PORT_REACH]');
const map=new RiverMap(data);
const courses=sites.flatMap(site=>{
 const hit=map.channelAt(site,reach),course=hit&&map.downstream(hit,hit);
 if(!course)return [];
 const points=course.path.concat(map.systems[course.system].mouth);
 return [points.map(({x,z})=>[x,z])];
});
process.stdout.write(JSON.stringify(courses));
"""
    result = subprocess.run(["node", "-e", script], cwd=atlas.DIST.parent,
                            input=json.dumps({"data": data, "sites": sites}),
                            capture_output=True, encoding="utf-8", check=True)
    return unary_union([LineString(course) for course in json.loads(result.stdout) if len(course) > 1])


def paper_outline(directory, extent, sea, courses):
    regions = atlas.read_constant(directory / "map-data.js", "HISTORICAL_REGIONS")
    provinces = [Polygon(p[0], p[1:]).buffer(0) for region in regions for p in region["polys"]]
    if sea:
        baltic = atlas.read_constant(atlas.DIST / "logic.js", "BALTIC")
        water = [Polygon(baltic).intersection(box(0, 0, 784, 280)),
                 *(Polygon(rings[0], rings[1:]).buffer(0) for rings in sea)]
        margin, grain = 12, 4
    else:
        scenario = directory / "scenario.js"
        bounds = atlas.read_constant(scenario, "MAP_SCENARIO")["bounds"]
        coastline = atlas.read_constant(scenario, "SCENARIO_LAND")
        land = unary_union([Polygon(p[0], p[1:]).buffer(0) for p in coastline])
        water = list(atlas.polygon_parts(box(*bounds).difference(land)))
        margin, grain = 20, 7

    # Join detached islands and waterways to one sheet without filling distant corners.
    shape = unary_union([*provinces, *water, courses]).buffer(margin)
    sheet = join_sheet(shape, margin)
    sheet = sheet.buffer(margin).buffer(-margin).intersection(box(*extent).buffer(-grain))
    outer = max(atlas.polygon_parts(sheet), key=lambda p: p.area).exterior
    line = LineString(outer).simplify(grain*.65)
    count = max(3, round(line.length/grain))
    ring = []
    for i in range(count):
        along = i*line.length/count
        x, z = line.interpolate(along).coords[0]
        x0, z0 = line.interpolate((along-grain*.5) % line.length).coords[0]
        x1, z1 = line.interpolate((along+grain*.5) % line.length).coords[0]
        dx, dz = x1-x0, z1-z0
        length = max(.01, np.hypot(dx, dz))
        tear = (np.sin(i*2.39)*.16 + np.sin(i*.57)*.15 + np.cos(i*1.49)*.065)*grain
        ring.append([round(x-dz/length*tear, 2), round(z+dx/length*tear, 2)])
    outline = join_sheet(Polygon(ring).buffer(0).union(unary_union(provinces).buffer(grain*.75)), margin)
    if outline.geom_type != "Polygon" or not outline.is_valid or any(p.difference(outline).area > .001 for p in provinces):
        raise ValueError(f"Paper outline does not enclose all provinces in {directory}: {outline.geom_type}, {explain_validity(outline)}")
    return np.round(outline.exterior.coords[:-1], 2).tolist()


def write_map(name, directory, transform, records, extent, land_archive, sea=None):
    systems = SYSTEMS[name]
    membership = {river: index for index, (_, _, rivers) in enumerate(systems) for river in rivers}
    delta_channels = {"Meuse", "Nederrijn", "Lek"} if name == "mediterranean" else set()
    major = {record["rivernum"] for record, _ in records
             if record["featurecla"] == "River" and
             (record["scalerank"] <= 6 or record["name_en"] in membership or record["name_en"] in delta_channels)}
    x0, z0, x1, z1 = extent
    navigable_limits = box(x0+4, z0+4, x1-4, z1-4)
    result = []
    for record, points in records:
        name_en = record["name_en"] or record["name"]
        if not name_en or record["featurecla"] not in {"River", "Lake Centerline"}:
            continue
        if name_en not in membership and record["rivernum"] not in major:
            continue
        coords = np.asarray(points)
        xy = np.column_stack((coords, np.ones(len(coords)))) @ transform
        geometries = parts(LineString(xy).intersection(navigable_limits).simplify(.34))
        for line in geometries:
            if line.length < .6:
                continue
            result.append([record["name_ru"] or name_en, membership.get(name_en, -1),
                           record["scalerank"], np.round(line.coords, 2).tolist()])
    outlets = [np.round(np.array([*mouth, 1]) @ transform, 2).tolist() for _, mouth, _ in systems]
    data = {"lines": result, "mouths": outlets}
    paper = paper_outline(directory, extent, sea, port_courses(directory, data))
    limits = Polygon(paper).buffer(3)
    data["lines"] = [[name, system, rank, coordinates]
                     for name, system, rank, points in result
                     for coordinates in ([points] if system >= 0 else
                         [np.round(line.coords, 2).tolist() for line in parts(LineString(points).intersection(limits))])]
    data["paper"] = paper
    data["backdrop"] = backdrop(extent, transform, land_archive)
    if sea:
        data["sea"] = sea
    (directory / "river-data.js").write_text(
        "// Natural Earth 1:10m rivers and lake centerlines. Generated by scripts/build-rivers.py.\n"
        + "const CAMPAIGN_RIVERS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")


def main():
    with shapefile.Reader(sys.argv[1]) as source:
        records = []
        for item in source.iterShapeRecords(bbox=(-42, 12, 68, 72)):
            for start, stop in zip(item.shape.parts, [*item.shape.parts[1:], len(item.shape.points)]):
                if stop - start >= 2:
                    records.append((item.record.as_dict(), item.shape.points[start:stop]))
    baltic, regions = atlas.baltic_projection()
    width = 2100 / 47.1
    depth = width / np.cos(np.radians(38))
    med = np.array([[width, 0], [0, -depth], [50 + 9.7 * width, 130 + 47.1 * depth]])
    write_map("baltic", atlas.DIST, baltic, records, atlas.BALTIC_EXTENT, sys.argv[2],
              extended_seas(baltic, sys.argv[2], regions))
    write_map("mediterranean", atlas.DIST / "maps" / "mediterranean", med, records, atlas.MEDITERRANEAN_EXTENT, sys.argv[2])


if __name__ == "__main__":
    main()
