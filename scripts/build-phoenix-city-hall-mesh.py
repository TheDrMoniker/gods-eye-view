#!/usr/bin/env python3
"""Build a local neutral Phoenix City Hall candidate mesh from existing sources.

GODS-EYE-UNIFIED-STREET-RECON-01. No copyrighted photo pixels are downloaded,
no unreviewed street photos are textured. The mesh is for LOCAL RESEARCH ONLY;
the source publisher's roof-polygon distribution terms are still under review.
"""
import argparse
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.geometry import GeometryCollection, Polygon, MultiPolygon, shape
from shapely.ops import transform, unary_union
import trimesh

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "phoenix-city-hall-lidar.py"
ROOFS = (606421, 606423, 606426)


def get_source_roof_features():
    spec = importlib.util.spec_from_file_location("phoenix_3dep_source", SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot resolve canonical USGS/GIS source script")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.get_roof_features(), module.GIS_ITEM


def polygon_parts(value):
    if isinstance(value, Polygon):
        if not value.is_empty and value.area > 0.05:
            yield value
    elif isinstance(value, (GeometryCollection, MultiPolygon)):
        for piece in value.geoms:
            yield from polygon_parts(piece)


def build_candidate_scene(features, source_url):
    """Create mutually exclusive roof-level extrusions, never verified facades."""
    source = {int(f["id"]): f for f in features}
    if not set(ROOFS).issubset(source):
        raise ValueError("Required roof IDs absent; manual identity review required")
    to_meters = Transformer.from_crs("EPSG:4326", "EPSG:26912", always_xy=True)
    to_wgs84 = Transformer.from_crs("EPSG:26912", "EPSG:4326", always_xy=True)
    polygons = {}
    heights = {}
    for fid in ROOFS:
        feature = source[fid]
        if int(feature.get("properties", {}).get("BLDGID", -1)) != 52520:
            raise ValueError("Unexpected source building grouping")
        poly = transform(to_meters.transform, shape(feature["geometry"]))
        if not poly.is_valid or poly.is_empty or poly.area <= 1:
            raise ValueError("Invalid building roof polygon " + str(fid))
        height = float(feature["properties"]["HGT_AGL"])
        if not 5 < height < 150:
            raise ValueError("Roof height not plausible: " + str(fid))
        polygons[fid], heights[fid] = poly, height

    # Stable ENU origin from the dominant upper roof candidate, not an invented
    # building centroid. This is ground-relative, NOT an ellipsoidal elevation.
    centre = polygons[606423].centroid
    origin_e, origin_n = centre.x, centre.y
    lon, lat = to_wgs84.transform(origin_e, origin_n)
    scene = trimesh.Scene()
    already = GeometryCollection()
    parts = []
    for fid in sorted(ROOFS, key=lambda key: heights[key], reverse=True):
        roof = polygons[fid]
        # Subtract higher roof plates so stacked inferred massing does not
        # create superimposed, intersecting full extrusions.
        visible = roof.difference(already)
        already = unary_union((already, roof))
        for idx, polygon in enumerate(polygon_parts(visible)):
            local = transform(
                lambda x, y, z=None: (
                    np.asarray(x) - origin_e,
                    np.asarray(y) - origin_n,
                ),
                polygon,
            )
            volume = trimesh.creation.extrude_polygon(
                local, heights[fid], engine="earcut"
            )
            if not volume.is_watertight:
                raise ValueError("Extruded roof section not watertight: " + str(fid))
            vertices = np.asarray(volume.vertices)
            # GLB: X=east, Y=up, Z=south (Y-up right-handed). Source extrusion:
            # X=east, Y=north, Z=up. No vertical datum conversion implied.
            volume.vertices = np.column_stack((
                vertices[:, 0], vertices[:, 2], -vertices[:, 1]
            ))
            volume.visual.vertex_colors = [158, 170, 185, 255]
            scene.add_geometry(
                volume,
                node_name="unverified-roof-" + str(fid) + "-" + str(idx),
                geom_name="roof-part-" + str(fid) + "-" + str(idx),
            )
            parts.append({
                "feature_id": fid,
                "source_height_agl_m": heights[fid],
                "visible_plate_area_m2": round(polygon.area, 2),
                "geometry_quality": "inferred_vertical_prism_from_2014_roof_polygon",
                "texture_status": "none",
            })
    if not parts:
        raise ValueError("No nonoverlapping polygonal sections available")
    metadata = {
        "schema": "gods-eye-reconstruction-research-mesh/1",
        "gate": "GODS-EYE-UNIFIED-STREET-RECON-01",
        "status": "GEOMETRY_CANDIDATE_UNCERTIFIED",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target": "Phoenix City Hall high-roof candidate",
        "sources": [source_url],
        "origin_wgs84_lon_lat": [lon, lat],
        "origin_height_reference": "ground_relative_origin_0m",
        "requires_runtime_terrain_ellipsoidal_height": True,
        "glb_local_axes": "X east, Y up, Z south",
        "source_2014_vertical_datum": "unconfirmed",
        "tower_112m_discrepancy": "unresolved",
        "mesh_part_count": len(parts),
        "parts": parts,
        "meshing_method": "nonoverlapping_prism_extrusion_not_measured_facade",
        "textures": [],
        "rights": {
            "source_polygon_redistribution": "not_reviewed",
            "approved_for_public_release": False,
            "scope": "local research preview only",
        },
    }
    return scene, metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--research-only", action="store_true",
                        help="required acknowledgement: don't publish generated assets")
    parser.add_argument("--out", default="output/reconstruction/phoenix-city-hall-candidate.glb")
    parser.add_argument("--metadata", default=None)
    args = parser.parse_args()
    if not args.research_only:
        parser.error("--research-only required: source geometry rights not cleared")
    destination = Path(args.out)
    if not destination.name.lower().endswith(".glb"):
        parser.error("--out must be a .glb filename")
    geo, url = get_source_roof_features()
    scene, metadata = build_candidate_scene(geo, url)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(scene.export(file_type="glb"))
    sidecar = Path(args.metadata) if args.metadata else destination.with_suffix(".json")
    sidecar.parent.mkdir(parents=True, exist_ok=True)
    sidecar.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf8")
    print(json.dumps({
        "glb": str(destination),
        "metadata": str(sidecar),
        "bytes": destination.stat().st_size,
        "parts": metadata["mesh_part_count"],
        "status": metadata["status"],
    }))


if __name__ == "__main__":
    main()
