"""Generate the campaign land and province polygons from Natural Earth 10m land.

Usage: /usr/bin/python3 scripts/build-mediterranean-campaign.py ne_10m_land.zip
Use build-terrain.py and build-parcels.cjs with dist/maps/mediterranean afterwards.
"""
import json
import math
import sys
from pathlib import Path

from osgeo import ogr
ogr.UseExceptions()

WEST, SOUTH, EAST, NORTH = -9.7, 29.8, 37.4, 47.1
SCALE = 2100 / (EAST-WEST)
ZSCALE = SCALE / math.cos(math.radians(38))
X0, Y0 = 50, 130
MIN_DUCHY_AREA = 3400
# Keep real islands in the coastline, but group them with larger territories.
REGIONAL_UNIONS = {
    'cadiz': 'malaga', 'catania': 'palermo', 'malta': 'palermo',
    'corsica': 'sardinia', 'mallorca': 'valencia', 'fes': 'tangier',
}
REGIONAL_NAMES = {
    'malaga': 'Побережье Андалусии', 'palermo': 'Сицилия и Мальта',
    'sardinia': 'Сардиния и Корсика', 'valencia': 'Валенсия и Балеары', 'tangier': 'Танжер и Фес',
}
LAND_BOUNDS = [X0, Y0, X0+(EAST-WEST)*SCALE, Y0+(NORTH-SOUTH)*ZSCALE]
# Original playable regions use city-centered cells. Final boundaries are clipped to land.
SITES = """lisbon|Лиссабон|Лиссабон|−9.14|38.72|1
algarve|Алгарве|Фару|−7.93|37.07|1
cadiz|Кадис|Кадис|−6.28|36.53|1
sevilla|Севилья|Севилья|−5.99|37.39|0
cordoba|Кордова|Кордова|−4.78|37.88|0
granada|Гранада|Гранада|−3.60|37.18|0
malaga|Малага|Малага|−4.42|36.72|1
murcia|Мурсия|Картахена|−0.98|37.60|1
valencia|Валенсия|Валенсия|−0.38|39.47|1
toledo|Толедо|Толедо|−4.02|39.86|0
madrid|Мадрид|Мадрид|−3.70|40.42|0
zaragoza|Арагон|Сарагоса|−0.88|41.65|0
barcelona|Каталония|Барселона|2.17|41.39|1
mallorca|Мальорка|Пальма|2.65|39.57|1
toulouse|Окситания|Тулуза|1.44|43.60|0
provence|Прованс|Марсель|5.37|43.30|1
lyon|Лион|Лион|4.83|45.76|0
genoa|Лигурия|Генуя|8.93|44.41|1
milan|Ломбардия|Милан|9.19|45.46|0
venice|Венето|Венеция|12.27|45.48|1
florence|Тоскана|Флоренция|11.26|43.77|0
rome|Лацио|Рим|12.49|41.90|1
naples|Кампания|Неаполь|14.27|40.85|1
bari|Апулия|Бари|16.87|41.12|1
calabria|Калабрия|Реджо|15.66|38.11|1
palermo|Западная Сицилия|Палермо|13.36|38.12|1
catania|Восточная Сицилия|Катания|15.08|37.50|1
sardinia|Сардиния|Кальяри|9.11|39.23|1
corsica|Корсика|Аяччо|8.74|41.93|1
malta|Мальта|Валлетта|14.50|35.89|1
split|Далмация|Сплит|16.44|43.51|1
sarajevo|Босния|Сараево|18.41|43.86|0
belgrade|Белград|Белград|20.45|44.81|0
durres|Албания|Дуррес|19.45|41.31|1
sofia|София|София|23.32|42.70|0
thessaloniki|Македония|Салоники|22.94|40.64|1
athens|Аттика|Афины|23.73|37.98|1
patras|Пелопоннес|Патры|21.74|38.25|1
crete|Крит|Ираклион|25.13|35.32|1
rhodes|Родос|Родос|28.21|36.40|1
istanbul|Босфор|Стамбул|28.97|41.01|1
izmir|Иония|Измир|27.15|38.41|1
bursa|Бурса|Бурса|29.06|40.19|0
ankara|Анкара|Анкара|32.86|39.93|0
antalya|Ликия|Анталья|30.71|36.89|1
adana|Киликия|Адана|35.33|37.01|1
cyprus|Кипр|Ларнака|33.62|34.91|1
beirut|Ливан|Бейрут|35.51|33.89|1
gaza|Газа|Газа|34.46|31.50|1
alexandria|Дельта Нила|Александрия|29.92|31.20|1
cairo|Каир|Каир|31.24|30.05|0
tobruk|Тобрук|Тобрук|23.96|32.08|1
benghazi|Киренаика|Бенгази|20.07|32.11|1
sirte|Сирт|Сирт|16.59|31.20|1
tripoli|Триполитания|Триполи|13.19|32.88|1
sfax|Сфакс|Сфакс|10.76|34.73|1
tunis|Тунис|Тунис|10.18|36.80|1
annaba|Аннаба|Аннаба|7.76|36.89|1
algiers|Алжир|Алжир|3.04|36.75|1
oran|Оран|Оран|−0.64|35.68|1
tangier|Танжер|Танжер|−5.81|35.77|1
fes|Фес|Фес|−5.00|34.04|0
rabat|Рабат|Рабат|−6.84|34.02|1"""


def xy(lon, lat):
    return ((lon-WEST)*SCALE+X0, (NORTH-lat)*ZSCALE+Y0)


def polygon(points):
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in points:
        ring.AddPoint_2D(x, y)
    ring.CloseRings()
    shape = ogr.Geometry(ogr.wkbPolygon)
    shape.AddGeometry(ring)
    return shape


def polygon_parts(shape):
    if shape.GetGeometryName() == 'POLYGON':
        if shape.GetArea() > 0.006:
            yield shape
    else:
        for i in range(shape.GetGeometryCount()):
            yield from polygon_parts(shape.GetGeometryRef(i))


def compact(geometry):
    return [[[list(map(lambda v: round(v, 4), p[:2])) for p in ring.GetPoints()[:-1]]
             for ring in piece] for piece in polygon_parts(geometry)]


def cut(vertices, a, b, c):
    if not vertices:
        return []
    out = []
    x, y = vertices[-1]
    previous = a*x+b*y-c
    for u, v in vertices:
        current = a*u+b*v-c
        if (previous <= 0) != (current <= 0):
            t = previous/(previous-current)
            out.append((x+t*(u-x), y+t*(v-y)))
        if current <= 0:
            out.append((u,v))
        x, y, previous = u, v, current
    return out


def voronoi(board, sites, index, land):
    x, y = sites[index]
    cell = board
    for j, (u, v) in enumerate(sites):
        if index != j:
            cell = cut(cell, 2*(u-x), 2*(v-y), u*u+v*v-x*x-y*y)
    return polygon(cell).Intersection(land)


def point(x, y):
    p = ogr.Geometry(ogr.wkbPoint)
    p.AddPoint_2D(x, y)
    return p


def interior_sites(shape, anchor, count):
    samples = []
    for piece in polygon_parts(shape):
        if piece.GetArea() < shape.GetArea() * .05:
            continue
        x0, x1, y0, y1 = piece.GetEnvelope()
        edge = piece.Boundary()
        for row in range(20):
            for col in range(20):
                x = x0+(col+.5)*(x1-x0)/20
                y = y0+(row+.5)*(y1-y0)/20
                p = point(x, y)
                if piece.Contains(p):
                    samples.append(((x, y), edge.Distance(p)))
        inside = piece.PointOnSurface()
        samples.append(((inside.GetX(), inside.GetY()), edge.Distance(inside)))

    clearance = max(d for _, d in samples)
    pool = [(p,d) for p,d in samples if d >= clearance * .18]
    if not shape.Contains(point(*anchor)):
        anchor = min(pool, key=lambda entry: math.dist(anchor, entry[0]))[0]
    sites = [anchor]
    for _ in range(count-1):
        p, _ = max(pool, key=lambda entry:
                   min(math.dist(entry[0], other) for other in sites) *
                   (.60 + .40 * entry[1]/clearance))
        sites.append(p)
    return sites


def district_name(anchor, site, used):
    directions = ('Восточный', 'Юго-восточный', 'Южный', 'Юго-западный',
                  'Западный', 'Северо-западный', 'Северный', 'Северо-восточный')
    angle = math.atan2(site[1]-anchor[1], site[0]-anchor[0]) / (math.pi/4)
    for offset in (0, 1, -1):
        direction = directions[(round(angle)+offset) % len(directions)]
        if direction not in used:
            used.add(direction)
            return direction + ' округ'


def main():
    dataset=ogr.Open(f'/vsizip/{Path(sys.argv[1]).resolve()}/ne_10m_land.shp')
    layer=dataset.GetLayer()
    layer.SetSpatialFilterRect(WEST,SOUTH,EAST,NORTH)
    clip=polygon([(WEST,SOUTH),(EAST,SOUTH),(EAST,NORTH),(WEST,NORTH)])
    parts=ogr.Geometry(ogr.wkbMultiPolygon)
    for feature in layer:
        clipped=feature.GetGeometryRef().Intersection(clip)
        if clipped.IsEmpty():
            continue
        for piece in polygon_parts_geo(clipped):
            parts.AddGeometry(piece)
    geographic=parts.UnionCascaded().SimplifyPreserveTopology(0.00075)
    land=ogr.Geometry(ogr.wkbMultiPolygon)
    for part in geographic:
        projected=polygon([xy(*p[:2]) for p in part.GetGeometryRef(0).GetPoints()])
        for i in range(1,part.GetGeometryCount()):
            hole=ogr.Geometry(ogr.wkbLinearRing)
            for p in part.GetGeometryRef(i).GetPoints():
                hole.AddPoint_2D(*xy(*p[:2]))
            projected.AddGeometry(hole)
        land.AddGeometry(projected)
    seeds=[]
    for line in SITES.replace('−','-').splitlines():
        key,name,city,lon,lat,coast=line.split('|')
        seeds.append((key,name,city,*xy(float(lon),float(lat)),coast=='1'))
    x0,y0,x1,y1=LAND_BOUNDS
    board=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
    centers=[(x,y) for _,_,_,x,y,_ in seeds]
    coastline=land.Boundary().Difference(polygon(board).Boundary().Buffer(.02)).Buffer(.012)
    # Partition each continuous landmass using its own cities, so opposite
    # shores of a strait never receive a spurious shared land border.
    landmasses=list(polygon_parts(land))
    points=[point(*location) for location in centers]
    assigned=[min(range(len(landmasses)),key=lambda i:landmasses[i].Distance(p)) for p in points]
    zones=[ogr.Geometry(ogr.wkbMultiPolygon) for _ in seeds]
    for i,landmass in enumerate(landmasses):
        owners=[j for j,part in enumerate(assigned) if part==i]
        if not owners:
            nearest=min(range(len(seeds)),key=lambda j:landmass.Distance(points[j]))
            zones[nearest].AddGeometry(landmass)
            continue
        positions=[centers[j] for j in owners]
        for index,j in enumerate(owners):
            zone=voronoi(board,positions,index,landmass)
            for piece in polygon_parts(zone):
                zones[j].AddGeometry(piece)
    provinces={}
    for i,(key,name,city,x,y,_) in enumerate(seeds):
        provinces[key]=(name,city,(x,y),zones[i].UnionCascaded())
    grouped=set(REGIONAL_UNIONS.values())
    for small,large in REGIONAL_UNIONS.items():
        name,city,anchor,shape=provinces[large]
        provinces[large]=(REGIONAL_NAMES[large],city,anchor,shape.Union(provinces.pop(small)[3]))
    while True:
        smallest=min(provinces,key=lambda k: provinces[k][3].GetArea())
        shape=provinces[smallest][3]
        if shape.GetArea()>=MIN_DUCHY_AREA:
            break
        boundary=shape.Boundary()
        candidates=[]
        for key,(_,_,_,other) in provinces.items():
            if key==smallest:
                continue
            gap=shape.Distance(other)
            shared=boundary.Intersection(other.Buffer(.006)).Length() if gap<.003 else 0
            candidates.append((shared,gap,key))
        # Prefer a real shared frontier. Isolated islands join the nearest territory.
        shared,gap,neighbor=min(candidates,key=lambda t:(-t[0],t[1],t[2]))
        name,city,anchor,other=provinces[neighbor]
        provinces[neighbor]=(name,city,anchor,other.Union(shape))
        grouped.add(neighbor)
        del provinces[smallest]

    original=[]; additional=[]
    for key,(name,city,anchor,zone) in provinces.items():
        max_sites=1 if key in grouped or key in ('sevilla','cordoba') else 3
        count=min(max_sites,int(zone.GetArea()/MIN_DUCHY_AREA))
        while count>=1:
            sites=interior_sites(zone,anchor,count)
            pieces=[voronoi(board,sites,i,zone) for i in range(count)] if count>1 else [zone]
            if all(piece.GetArea()>=MIN_DUCHY_AREA for piece in pieces):
                break
            count-=1
        used=set()
        for j,(shape,(u,v)) in enumerate(zip(pieces,sites)):
            polys=compact(shape)
            if not polys:
                raise ValueError(key)
            coast=shape.Boundary().Intersection(coastline).Length()>.12
            if j:
                direction=district_name(sites[0],(u,v),used)
                entry=dict(key=f'{key}-district-{j}',name=f'{name} · {direction.lower()}',
                           city=f'{city} · {direction.lower()}')
            else:
                entry=dict(key=key,name=name,city=city)
            entry.update(x=round(u,4),y=round(v,4),coast=coast,adj=[],polys=polys)
            (additional if j else original).append((entry,shape))
    regions,shapes=map(list,zip(*(original+additional)))
    for i,region in enumerate(regions):
        region['id']=i
    for i,shape in enumerate(shapes):
        boundary=shape.Boundary()
        for j in range(i):
            other=shapes[j]
            if shape.Distance(other) > .003:
                continue
            if boundary.Intersection(other.Buffer(.006)).Length() > .6:
                regions[i]['adj'].append(j)
                regions[j]['adj'].append(i)
    scenario=dict(id='mediterranean',name='Средиземноморье',bounds=LAND_BOUNDS,world=[2200,1420],
                  label=[*xy(12.5,35.5),'СРЕДИЗЕМНОЕ МОРЕ'],camera=dict(x=1100,z=(y1+y0)/2,scale=.001175),
                  ridges=[[*xy(lon,lat),size*2,elevation] for lon,lat,size,elevation in
                    [(10,45.7,55,55),(-4,37.2,35,38),(2,42.75,46,38),(14,41.9,50,36),(18.1,43.8,46,38),
                     (23.2,39.6,40,30),(31.5,37.8,48,45),(4.2,35.5,65,45),(-5.7,32.5,60,46)]])
    # Normalize topology for ear clipping and routing. SeaNavigator uses closed rings.
    water_land=[[[*ring,ring[0]] for ring in poly] for poly in compact(land)]
    out=Path(__file__).resolve().parents[1]/'dist'/'maps'/'mediterranean'
    out.mkdir(parents=True,exist_ok=True)
    dump=lambda value: json.dumps(value,ensure_ascii=False,separators=(',',':'))
    (out/'scenario.js').write_text('const MAP_SCENARIO='+dump(scenario)+';\nconst SCENARIO_LAND='+dump(water_land)+';\n',encoding='utf-8')
    (out/'map-data.js').write_text('const HISTORICAL_REGIONS='+dump(regions)+';\n',encoding='utf-8')
    print(len(regions),'regions',sum(len(r['adj']) for r in regions)//2,'land links')


def polygon_parts_geo(geometry):
    if geometry.GetGeometryName()=='POLYGON':
        if geometry.GetArea()>0.000001:
            yield geometry
    else:
        for i in range(geometry.GetGeometryCount()):
            yield from polygon_parts_geo(geometry.GetGeometryRef(i))


if __name__=='__main__':
    main()
