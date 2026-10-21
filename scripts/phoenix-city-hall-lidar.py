#!/usr/bin/env python3
"""GODS-EYE-RECONSTRUCTION-01: independent LiDAR + roof evidence.

USGS public Entwine Point Tiles (2020) and 2014 publicly hosted LiDAR-derived
Phoenix roof polygons. No Google data or paid APIs. Outputs preliminary
measurements, not certified building geometry.
"""
import argparse
import io
import json
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import laspy
import numpy as np
from pyproj import Transformer
from shapely import contains_xy
from shapely.geometry import shape
from shapely.ops import transform, unary_union

EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/AZ_MaricopaPinal_1_2020/"
GIS = ("https://services3.arcgis.com/0OPQIK59PJJqLK0A/arcgis/rest/"
       "services/Phoenix_AZ_3D_Building/FeatureServer/0/query")
GIS_ITEM = "https://www.arcgis.com/home/item.html?id=2843e4e02356475fa702322befe23766"
TARGET_BBOX = "-112.0781,33.4482,-112.0765,33.44925"
BUILDING_GROUP = 52520
ROOF_FIDS = (606421, 606423, 606426)
MAX_NODE_BYTES = 8_000_000
MAX_NODE_COUNT = 140
MAX_EXPECTED_POINTS = 5_000_000
AGENT = "GodsEyeReconstruction/0.2 (https://github.com/TheDrMoniker/gods-eye-view)"


def read_bytes(url):
    with urlopen(Request(url, headers={"User-Agent": AGENT}), timeout=35) as response:
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_NODE_BYTES:
            raise ValueError("Remote response exceeds byte budget: " + url)
        contents = response.read(MAX_NODE_BYTES + 1)
        if len(contents) > MAX_NODE_BYTES:
            raise ValueError("Remote response exceeded byte budget: " + url)
        return contents


def read_json(url):
    return json.loads(read_bytes(url))


def get_roof_features():
    """A building group is a candidate identity; restrict it to the pilot bbox."""
    params = {
        "where": "BLDGID=" + str(BUILDING_GROUP),
        "geometry": TARGET_BBOX,
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    payload = read_json(GIS + "?" + urlencode(params))
    if payload.get("type") != "FeatureCollection":
        raise ValueError("GIS response must be a GeoJSON FeatureCollection")
    features = payload.get("features", [])
    if not isinstance(features, list) or len(features) < 3:
        raise ValueError("Missing Phoenix City Hall building candidates")
    ids = {int(f.get("id", -1)) for f in features}
    if not set(ROOF_FIDS).issubset(ids):
        raise ValueError("High-roof identities changed: human review required")
    for feature in features:
        if int(feature["properties"].get("BLDGID", -1)) != BUILDING_GROUP:
            raise ValueError("Unexpected building group in GIS response")
    return features


def index_range(low, high, origin, edge, level):
    spacing = edge / (2**level)
    first = max(0, int(math.floor((low - origin) / spacing)))
    last = min(2**level - 1, int(math.floor((high - origin) / spacing)))
    return range(first, last + 1)


def list_ept_nodes(meta, roi, max_depth=12, json_loader=None):
    """Resolve EPT hierarchy chunks, five octree levels per chunk here."""
    if max_depth < 0 or max_depth > 12:
        raise ValueError("Depth 0..12 only; revalidate budgets before widening")
    loader = json_loader or read_json
    bounds = meta["bounds"]
    edge = bounds[3] - bounds[0]
    root = loader(EPT + "ept-hierarchy/0-0-0-0.json")
    hierarchy = {"0-0-0-0": root}

    def count(depth, x, y, z):
        key = f"{depth}-{x}-{y}-{z}"
        if depth <= 5:
            return root.get(key, 0)
        parent_depth = 5 if depth <= 10 else 10
        shift = depth - parent_depth
        anchor = f"{parent_depth}-{x >> shift}-{y >> shift}-{z >> shift}"
        if depth <= 10 and root.get(anchor, 0) != -1:
            return 0
        if depth > 10 and count(10, x >> (depth - 10),
                                y >> (depth - 10),
                                z >> (depth - 10)) != -1:
            return 0
        if anchor not in hierarchy:
            hierarchy[anchor] = loader(EPT + "ept-hierarchy/" + anchor + ".json")
        return hierarchy[anchor].get(key, 0)

    selected = []
    by_depth = {}
    for depth in range(max_depth + 1):
        xs = index_range(roi[0], roi[2], bounds[0], edge, depth)
        ys = index_range(roi[1], roi[3], bounds[1], edge, depth)
        zs = index_range(320, 455, bounds[2], edge, depth)
        hits = 0
        for x in xs:
            for y in ys:
                for z in zs:
                    points = count(depth, x, y, z)
                    if points > 0:
                        selected.append((f"{depth}-{x}-{y}-{z}", points))
                        hits += 1
        by_depth[str(depth)] = hits
    if not selected or len(selected) > MAX_NODE_COUNT:
        raise ValueError("Unexpected EPT node coverage: manual review required")
    if sum(n for _, n in selected) > MAX_EXPECTED_POINTS:
        raise ValueError("EPT point budget exceeded")
    return selected, by_depth


def decode_node(entry, roi):
    key, expected = entry
    raw = read_bytes(EPT + "ept-data/" + key + ".laz")
    las = laspy.read(io.BytesIO(raw))
    if len(las.x) != expected:
        raise ValueError("EPT hierarchy/LAZ count mismatch: " + key)
    x, y, z = np.asarray(las.x), np.asarray(las.y), np.asarray(las.z)
    inside = ((x >= roi[0]) & (x <= roi[2]) &
              (y >= roi[1]) & (y <= roi[3]) &
              (z >= 320) & (z <= 455))
    cropped = np.column_stack((
        x[inside], y[inside], z[inside],
        np.asarray(las.classification)[inside],
    ))
    return len(raw), cropped


def distribution(values):
    if not len(values):
        return {"points": 0}
    return {
        "points": len(values),
        "min_m": round(float(np.min(values)), 3),
        "p05_m": round(float(np.quantile(values, .05)), 3),
        "median_m": round(float(np.median(values)), 3),
        "p95_m": round(float(np.quantile(values, .95)), 3),
        "p99_m": round(float(np.quantile(values, .99)), 3),
        "max_m": round(float(np.max(values)), 3),
    }


def sample_pilot(depth=12, workers=6):
    features = get_roof_features()
    mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    local_area = Transformer.from_crs("EPSG:4326", "EPSG:26912", always_xy=True)
    polygons = {int(f["id"]): transform(mercator.transform, shape(f["geometry"]))
                for f in features}
    area_polygons = {int(f["id"]): transform(local_area.transform, shape(f["geometry"]))
                     for f in features}
    lo_x, lo_y, hi_x, hi_y = unary_union([polygons[i] for i in ROOF_FIDS]).bounds
    roi = (lo_x - 32, lo_y - 32, hi_x + 32, hi_y + 32)
    meta = read_json(EPT + "ept.json")
    if meta.get("srs", {}).get("horizontal") != "3857":
        raise ValueError("Unexpected EPT horizontal reference system")
    nodes, by_depth = list_ept_nodes(meta, roi, depth)

    blocks = []
    downloaded = 0
    with ThreadPoolExecutor(max_workers=max(1, min(workers, 6))) as pool:
        futures = [pool.submit(decode_node, node, roi) for node in nodes]
        for completed in as_completed(futures):
            size, block = completed.result()
            downloaded += size
            if len(block):
                blocks.append(block)
    if not blocks:
        raise ValueError("EPT returned no sampled points")
    cloud = np.concatenate(blocks, axis=0)
    x, y, z, cls = cloud[:, 0], cloud[:, 1], cloud[:, 2], cloud[:, 3].astype(int)
    ground = distribution(z[cls == 2])
    if ground["points"] < 100:
        raise ValueError("Insufficient ground-class returns for baseline")

    roofs = {}
    for fid in ROOF_FIDS:
        mask = contains_xy(polygons[fid], x, y)
        stats = distribution(z[mask])
        if stats["points"] < 100:
            raise ValueError("Insufficient returns for roof FID " + str(fid))
        feature = next(f for f in features if int(f["id"]) == fid)
        props = feature["properties"]
        roofs[str(fid)] = {
            "2014_reported_height_agl_m": props["HGT_AGL"],
            "2014_reported_top_elevation_m": props["TOPELEV_M"],
            "roof_part_area_utm12_m2": round(area_polygons[fid].area, 2),
            "2020_21_lidar_all_returns": stats,
            "2020_21_lidar_upper_returns_above_410m":
                distribution(z[mask & (z > 410)]),
            "p95_minus_local_ground_m":
                round(stats["p95_m"] - ground["median_m"], 3),
        }

    report = {
        "schema": "gods-eye-roof-lidar-evidence/1",
        "gate": "GODS-EYE-RECONSTRUCTION-01",
        "status": "LIDAR_EVIDENCE_MEASURED_HOLD",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target": "Phoenix City Hall (candidate building group)",
        "building_group_id_2014": BUILDING_GROUP,
        "building_parts_2014": len(features),
        "group_union_area_utm12_m2":
            round(unary_union(list(area_polygons.values())).area, 1),
        "roof_part_ids": list(ROOF_FIDS),
        "source_2014": {
            "gis_query": GIS,
            "public_item": GIS_ITEM,
            "title": "LiDAR-Derived 3D Building Footprints - metro-Phoenix, Arizona (2014)",
            "publisher": "mapgeohub; credits NGA / USGS / Woolpert",
            "license_review": "publisher offers data as-is; check terms before public redistribution",
        },
        "source_2020_21": {
            "ept": EPT + "ept.json",
            "collection": "USGS 3DEP AZ_MaricopaPinal_1_2020",
            "horizontal_crs": "EPSG:3857",
            "z_units": "metres according to source schema",
            "vertical_datum": "requires independent project metadata verification",
            "sample_max_octree_depth": depth,
            "full_density": False,
        },
        "data_acquisition": {
            "ept_node_count": len(nodes),
            "node_counts_by_depth": by_depth,
            "downloaded_ept_bytes": downloaded,
            "cropped_point_count": len(cloud),
            "roi_epsg3857": [round(float(q), 2) for q in roi],
        },
        "ground_class_2_near_site": ground,
        "all_returns_near_site": distribution(z),
        "roofs": roofs,
        "limitations": [
            "2014 roof parts not yet independently certified as one exact tower",
            "EPT sampled to depth 12, not the full point cloud density",
            "vertical datum and cross-source registration require validation",
            "roof points include facades and clutter; maxima are not surveyed building heights",
            "published 112 m height may refer to a different roof or structural reference",
            "source attribution and terms require review before public mesh distribution",
        ],
    }
    roof_candidates = {
        "type": "FeatureCollection",
        "name": "Phoenix City Hall high-roof candidates (2014 source)",
        "source": GIS_ITEM,
        "crs": "EPSG:4326",
        "license_review": "not cleared for public bundle",
        "features": [
            {
                "type": "Feature",
                "id": f["id"],
                "geometry": f["geometry"],
                "properties": {
                    "BLDGID": f["properties"]["BLDGID"],
                    "HGT_AGL": f["properties"]["HGT_AGL"],
                    "TOPELEV_M": f["properties"]["TOPELEV_M"],
                    "quality": "unvalidated candidate",
                },
            }
            for f in features if int(f["id"]) in ROOF_FIDS
        ],
    }
    return report, roof_candidates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="artifacts/phoenix-city-hall-lidar-measured.json")
    parser.add_argument("--geojson-out", default=None,
                        help="Optional candidate polygons; check source rights before publishing")
    parser.add_argument("--depth", type=int, default=12)
    args = parser.parse_args()
    report, candidates = sample_pilot(depth=args.depth)
    destination = Path(args.out)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.geojson_out:
        candidate_path = Path(args.geojson_out)
        candidate_path.parent.mkdir(parents=True, exist_ok=True)
        candidate_path.write_text(json.dumps(candidates, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "wrote": str(destination),
        "sampled": report["data_acquisition"]["cropped_point_count"],
        "nodes": report["data_acquisition"]["ept_node_count"],
        "ground_median_m": report["ground_class_2_near_site"]["median_m"],
        "roof_606423_p95_m": report["roofs"]["606423"]["2020_21_lidar_all_returns"]["p95_m"],
        "status": report["status"],
    }, indent=2))


if __name__ == "__main__":
    main()
