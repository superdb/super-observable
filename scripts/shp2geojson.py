#!/usr/bin/env python3
"""Minimal shapefile (polygons, lon/lat) → GeoJSON, with Douglas-Peucker simplification.

usage: shp2geojson.py file.shp tolerance_degrees [field,field,...] > out.geojson
       shp2geojson.py file.shp --fields   (lists the DBF fields and the first record)
"""
import json, struct, sys


def read_dbf(path, encoding):
    with open(path, "rb") as f:
        data = f.read()
    n, header_len, record_len = struct.unpack("<IHH", data[4:12])
    fields, pos = [], 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b"\0")[0].decode("ascii")
        fields.append((name, chr(data[pos + 11]), data[pos + 16]))
        pos += 32
    records = []
    for i in range(n):
        rec, off, row = data[header_len + i * record_len:header_len + (i + 1) * record_len], 1, {}
        for name, typ, length in fields:
            raw = rec[off:off + length].decode(encoding, "replace").strip()
            off += length
            if typ in "NF":
                row[name] = (float(raw) if "." in raw else int(raw)) if raw else None
            else:
                row[name] = raw or None
        records.append(row)
    return fields, records


def read_shp(path):
    with open(path, "rb") as f:
        data = f.read()
    pos, shapes = 100, []
    while pos < len(data):
        length = struct.unpack(">I", data[pos + 4:pos + 8])[0] * 2
        content, pos = data[pos + 8:pos + 8 + length], pos + 8 + length
        if struct.unpack("<i", content[:4])[0] == 0:
            shapes.append([])
            continue
        nparts, npoints = struct.unpack("<ii", content[36:44])
        parts = list(struct.unpack(f"<{nparts}i", content[44:44 + 4 * nparts])) + [npoints]
        pts = struct.unpack(f"<{2 * npoints}d", content[44 + 4 * nparts:44 + 4 * nparts + 16 * npoints])
        shapes.append([[(pts[2 * j], pts[2 * j + 1]) for j in range(parts[k], parts[k + 1])] for k in range(nparts)])
    return shapes


def simplify(points, tol):
    if len(points) < 4:
        return points
    keep, stack, tol2 = {0, len(points) - 1}, [(0, len(points) - 1)], tol * tol
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a], points[b]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if d2 == 0:
                dist = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                dist = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if dist > best:
                best, idx = dist, i
        if best > tol2:
            keep.add(idx)
            stack += [(a, idx), (idx, b)]
    return [points[i] for i in sorted(keep)]


def area(ring):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])) / 2


def to_geometry(rings, tol):
    # Shapefile: outer rings clockwise (negative area here), holes counter-clockwise.
    polygons = []
    for ring in rings:
        ring = simplify(ring, tol)
        if len(ring) < 4 or abs(area(ring)) < tol * tol * 2:
            continue
        coords = [[round(x, 4), round(y, 4)] for x, y in ring]
        # GeoJSON/d3: d3-geo wants outer rings clockwise in lon/lat as well, which matches the shapefile.
        if area(ring) <= 0 or not polygons:
            polygons.append([coords])
        else:
            polygons[-1].append(coords)
    if not polygons:
        return None
    return {"type": "MultiPolygon", "coordinates": polygons}


def main():
    shp = sys.argv[1]
    base = shp[:-4]
    try:
        encoding = open(base + ".cpg").read().strip() or "utf-8"
    except OSError:
        encoding = "latin-1"
    encoding = {"UTF-8": "utf-8", "UTF8": "utf-8"}.get(encoding.upper(), encoding)
    fields, records = read_dbf(base + ".dbf", encoding)
    if sys.argv[2] == "--fields":
        print(fields)
        print(records[0] if records else None)
        print(len(records), "records")
        return
    tol = float(sys.argv[2])
    keep = sys.argv[3].split(",") if len(sys.argv) > 3 else [f[0] for f in fields]
    # Records sharing the same properties (e.g. a municipality made of several islands) become one feature.
    features = {}
    for rec, rings in zip(records, read_shp(shp)):
        geometry = to_geometry(rings, tol)
        if geometry:
            props = {k: rec[k] for k in keep}
            key = json.dumps(props, sort_keys=True)
            if key in features:
                features[key]["geometry"]["coordinates"] += geometry["coordinates"]
            else:
                features[key] = {"type": "Feature", "properties": props, "geometry": geometry}
    json.dump({"type": "FeatureCollection", "features": list(features.values())}, sys.stdout, separators=(",", ":"))


main()
