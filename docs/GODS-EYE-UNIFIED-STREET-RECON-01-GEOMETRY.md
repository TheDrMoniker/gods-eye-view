# Local candidate geometry — City Hall (research-only)

This is an additive **geometry-only** development preview for
GODS-EYE-UNIFIED-STREET-RECON-01. It does not claim facade textures or a
licensed redistributable mesh. The 2014 LiDAR-derived source warns that
building polygons are unvalidated; confirm reuse terms before public release.

The generator reuses the existing Python GIS fetcher from
scripts/phoenix-city-hall-lidar.py, extracts upper part IDs 606421, 606423
and 606426, projects to UTM zone 12N (metres), removes overlapping roof
plates, and extrudes them as separate closed 3D solids to the source's
provisional reported heights above ground. This is **candidate massing**,
not measured wall/window surfaces. It writes a neutral glTF-binary mesh
and a provenance JSON sidecar into ignored output/, not public/models/.

    python -m pip install -r scripts/requirements-reconstruction-mesh.txt
    python scripts/build-phoenix-city-hall-mesh.py --research-only
    python -m unittest scripts/test_city_hall_mesh.py -v

- glTF right-handed axes: X east, Y up, Z south.
- Origin comes from the high-roof candidate's projected centroid.
- Origin height is ground-relative. It is NOT an ellipsoidal WGS84 height.
- Public GIS roof group 52520 is not definitively an independently surveyed
  high-rise. The published ~112 m height discrepancy remains OPEN.
- No street photography or textures are bundled, copied or rendered.
- Local Cesium preview helper: src/reconstruction/preview.js. A consumer
  explicitly supplies a same-origin/blob GLB URL, origin lon/lat from the
  sidecar, and an independently established ellipsoidal ground elevation.
  The helper does not register itself, change map source, publish an asset or
  intercept the active Street Level viewer.

This partial gate may be marked **GEOMETRY_CANDIDATE_UNCERTIFIED** only after
the Python tests and an actual GLB sample run pass. The remaining texture
and evidence certification gate stays HOLD.
