"""Build the Central Mediterranean chart from Natural Earth ne_10m_land.zip.

Run with Python 3 and GDAL's osgeo package:
    /usr/bin/python3 scripts/build-mediterranean.py /path/to/ne_10m_land.zip
"""
import json
import math
import sys
from pathlib import Path

from osgeo import ogr

WEST, SOUTH, EAST, NORTH = 6.4, 34.1, 19.3, 42.2
LONGITUDE_KM = 111.195 * math.cos(math.radians((SOUTH + NORTH) / 2))
LATITUDE_KM = 111.195
PORTS = [
    ('cagliari', 'Кальяри', 9.097, 39.206, 9.14, 39.16),
    ('olbia', 'Ольбия', 9.524, 40.922, 9.68, 40.945),
    ('tunis', 'Тунис', 10.307, 36.817, 10.40, 36.85),
    ('bizerte', 'Бизерта', 9.881, 37.275, 9.93, 37.31),
    ('sousse', 'Сус', 10.642, 35.829, 10.68, 35.85),
    ('trapani', 'Трапани', 12.49, 38.013, 12.45, 37.986),
    ('palermo', 'Палермо', 13.369, 38.134, 13.405, 38.16),
    ('milazzo', 'Милаццо', 15.241, 38.219, 15.261, 38.23),
    ('messina', 'Мессина', 15.565, 38.195, 15.585, 38.192),
    ('catania', 'Катания', 15.097, 37.492, 15.131, 37.485),
    ('reggio', 'Реджо', 15.646, 38.121, 15.621, 38.125),
    ('naples', 'Неаполь', 14.273, 40.838, 14.277, 40.803),
    ('taranto', 'Таранто', 17.23, 40.47, 17.17, 40.432),
    ('malta', 'Валлетта', 14.516, 35.895, 14.565, 35.909),
    ('annaba', 'Аннаба', 7.772, 36.901, 7.826, 36.924),
]
LABELS = [
    ('САРДИНИЯ', 9.02, 40.10, 'land'), ('КОРСИКА', 9.06, 41.89, 'land'),
    ('СИЦИЛИЯ', 13.85, 37.58, 'land'), ('ИТАЛИЯ', 15.68, 41.27, 'land'),
    ('ТУНИС', 9.47, 35.68, 'land'), ('АЛЖИР', 7.97, 35.21, 'land'),
    ('ТИРРЕНСКОЕ МОРЕ', 11.97, 40.18, 'water'),
    ('СИЦИЛИЙСКИЙ ПРОЛИВ', 12.36, 36.72, 'water'),
    ('ИОНИЧЕСКОЕ МОРЕ', 17.34, 37.30, 'water'),
]


def xy(lon, lat):
    return [round((lon - WEST) * LONGITUDE_KM, 3), round((NORTH - lat) * LATITUDE_KM, 3)]


def polygons(geom):
    if geom.GetGeometryName() == 'POLYGON':
        if geom.GetArea() > 0.000005:
            yield [[xy(lon, lat) for lon, lat, *_ in ring.GetPoints()] for ring in geom]
    else:
        for j in range(geom.GetGeometryCount()):
            yield from polygons(geom.GetGeometryRef(j))


def main():
    source = Path(sys.argv[1]).resolve()
    dataset = ogr.Open(f'/vsizip/{source}/ne_10m_land.shp')
    if dataset is None:
        raise SystemExit('Cannot open Natural Earth land archive')
    layer = dataset.GetLayer()
    layer.SetSpatialFilterRect(WEST, SOUTH, EAST, NORTH)
    clip = ogr.CreateGeometryFromWkt(f'POLYGON (({WEST} {SOUTH},{EAST} {SOUTH},{EAST} {NORTH},{WEST} {NORTH},{WEST} {SOUTH}))')
    parts = ogr.Geometry(ogr.wkbMultiPolygon)
    for feature in layer:
        geometry = feature.GetGeometryRef().Intersection(clip)
        if geometry.IsEmpty():
            continue
        if geometry.GetGeometryName() == 'POLYGON':
            parts.AddGeometry(geometry)
        else:
            for piece in geometry:
                if piece.GetGeometryName() == 'POLYGON':
                    parts.AddGeometry(piece)
    land = list(polygons(parts.UnionCascaded().SimplifyPreserveTopology(0.00055)))
    data = {
        'version': 1,
        'name': 'Центральное Средиземноморье',
        'source': 'Natural Earth ne_10m_land v5.1.1',
        'size': xy(EAST, SOUTH),
        'bounds': [WEST, SOUTH, EAST, NORTH],
        'gridKm': 1,
        'land': land,
        'ports': [{'id': key, 'name': name, 'city': xy(lon, lat), 'berth': xy(wlon, wlat)} for key, name, lon, lat, wlon, wlat in PORTS],
        'labels': [{'name': name, 'point': xy(lon, lat), 'kind': kind} for name, lon, lat, kind in LABELS],
        'trials': [
            {'name': 'Мессинский пролив', 'from': 'milazzo', 'to': 'catania'},
            {'name': 'Вокруг Сицилии', 'from': 'trapani', 'to': 'catania'},
            {'name': 'Из Туниса в Палермо', 'from': 'tunis', 'to': 'palermo'},
        ],
    }
    out = Path(__file__).resolve().parents[1] / 'dist' / 'mediterranean' / 'chart.json'
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(land)} polygons, {sum(len(ring) for poly in land for ring in poly)} points, {out.stat().st_size} bytes')


if __name__ == '__main__':
    main()
