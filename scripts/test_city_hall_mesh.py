"""Offline geometry consistency tests: no external requests or source photos."""
import importlib.util
from pathlib import Path
import io
import unittest
import numpy as np
import trimesh

SRC = Path(__file__).with_name("build-phoenix-city-hall-mesh.py")
spec = importlib.util.spec_from_file_location("phoenix_candidate_mesh", SRC)
mesh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mesh)


def feature(fid, height, box):
    minx, miny, maxx, maxy = box
    ring = [[minx, miny], [maxx, miny], [maxx, maxy],
            [minx, maxy], [minx, miny]]
    return {"id": fid, "type": "Feature",
            "properties": {"BLDGID": 52520, "HGT_AGL": height},
            "geometry": {"type": "Polygon", "coordinates": [ring]}}


def fixture():
    return [
        feature(606421, 85.29, (-112.07760, 33.44837,
                                -112.07705, 33.44893)),
        feature(606423, 94.71, (-112.07753, 33.44850,
                                -112.07717, 33.44878)),
        feature(606426, 94.29, (-112.07739, 33.44854,
                                -112.07729, 33.44865)),
    ]


class TestCandidateMesh(unittest.TestCase):
    def test_geometry_without_images_or_verified_rights(self):
        scene, manifest = mesh.build_candidate_scene(fixture(),
                                                       "https://example.org/data")
        self.assertGreater(len(scene.geometry), 0)
        self.assertFalse(manifest["rights"]["approved_for_public_release"])
        self.assertEqual(manifest["textures"], [])
        self.assertEqual(manifest["status"], "GEOMETRY_CANDIDATE_UNCERTIFIED")
        self.assertTrue(all(obj.is_watertight
                            for obj in scene.geometry.values()))
        low, high = scene.bounds
        self.assertAlmostEqual(float(high[1] - low[1]), 94.71, delta=.02)
        self.assertLess(scene.bounds[1][0] - scene.bounds[0][0], 250)
        glb = scene.export(file_type="glb")
        self.assertGreater(len(glb), 1000)
        parsed = trimesh.load(io.BytesIO(glb), file_type="glb", force="scene")
        self.assertGreater(len(parsed.geometry), 0)

    def test_identity_and_geometry_are_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Required roof IDs"):
            mesh.build_candidate_scene(fixture()[:-1], "https://example.org")
        broken = fixture()
        broken[0]["properties"]["BLDGID"] = 999
        with self.assertRaisesRegex(ValueError, "building grouping"):
            mesh.build_candidate_scene(broken, "https://example.org")


if __name__ == "__main__":
    unittest.main()
