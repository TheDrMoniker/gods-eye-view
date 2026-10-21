"""Small offline checks for bounded EPT indexing and source-plane geometry."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
MODULE = ROOT / "phoenix-city-hall-lidar.py"
spec = importlib.util.spec_from_file_location("phoenix_lidar", MODULE)
lidar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lidar)


class LiDARContractTests(unittest.TestCase):
    def test_depth_bounds(self):
        meta = {"bounds": [0, 0, 0, 128, 128, 128]}
        with self.assertRaisesRegex(ValueError, "Depth"):
            lidar.list_ept_nodes(meta, (1, 1, 2, 3), 13, lambda _: {})

    def test_index_clamps(self):
        self.assertEqual(list(lidar.index_range(-50, 150, 0, 128, 2)),
                         [0, 1, 2, 3])
        self.assertEqual(list(lidar.index_range(40, 45, 0, 128, 3)),
                         [2])

    def test_distribution_empty(self):
        self.assertEqual(lidar.distribution([]), {"points": 0})

    def test_distribution_median(self):
        self.assertEqual(lidar.distribution([331.0, 333.0, 335.0])["median_m"],
                         333.0)

    def test_missing_ept_is_fail_closed(self):
        meta = {"bounds": [0, 0, 0, 128, 128, 128]}
        with self.assertRaisesRegex(ValueError, "Unexpected EPT node coverage"):
            lidar.list_ept_nodes(meta, (10, 10, 20, 20), 1,
                                  lambda _: {})


if __name__ == "__main__":
    unittest.main()
