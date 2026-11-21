"""Make the smallest duchies more playable while preserving the coast.

Requires system GDAL/OGR with GEOS. Run once on the original map data, followed
by build-terrain.py and build-parcels.cjs. The transfers are deliberately local;
no duchy or city is removed and no coastline is moved.
"""
import json
from pathlib import Path
from osgeo import ogr

path=Path(__file__).resolve().parent.parent/'dist/map-data.js'
regions=json.loads(path.read_text().split('=',1)[1].strip().rstrip(';'))
by_id={r['id']:r for r in regions}
def read(r):
    return ogr.CreateGeometryFromJson(json.dumps({'type':'MultiPolygon','coordinates':r['polys']}))
def polygon_coords(g):
    obj=json.loads(g.ExportToJson())
    if obj['type']=='Polygon': return [obj['coordinates']]
    if obj['type']=='MultiPolygon': return obj['coordinates']
    raise ValueError('Unexpected geometry: '+obj['type'])
def write(r,g):
    if not g.IsValid(): raise ValueError(r['city']+': invalid resulting geometry')
    r['polys']=polygon_coords(g)

# Refuse to run twice against an already adjusted map.
if any(abs(read(by_id[i]).GetArea()-area)>1 for i,area in [(41,175.795),(42,397.39),(28,187.135),(24,210.28)]):
    raise ValueError('Expected original map; adjustments appear to have already been applied')

# Move only land inside the named neighboring duchy across their shared border.
for small,donor,radius in [(41,9,3),(42,9,2.5),(28,4,3)]:
    a,b=by_id[small],by_id[donor]
    original,neighbor=read(a),read(b)
    expanded=original.Union(original.Buffer(radius,8).Intersection(neighbor))
    remaining=neighbor.Difference(expanded)
    write(a,expanded);write(b,remaining)
    print(a['city'],round(original.GetArea()),'→',round(expanded.GetArea()),';',b['city'],round(neighbor.GetArea()),'→',round(remaining.GetArea()))

# The historical Lubovlya polygon is fragmented, with almost no common edge
# with Krakow. Extend its own land slightly into unassigned inland background;
# clip against every other region so it cannot steal or overlap a neighbor.
r=by_id[24];original=read(r);expanded=original.Buffer(.8,8)
for other in regions:
    if other['id']!=r['id']:
        expanded=expanded.Difference(read(other))
write(r,expanded)
print(r['city'],round(original.GetArea()),'→',round(expanded.GetArea()),'(inland outline)')
path.write_text('const HISTORICAL_REGIONS='+json.dumps(regions,ensure_ascii=False,separators=(',',':'))+';\n')
