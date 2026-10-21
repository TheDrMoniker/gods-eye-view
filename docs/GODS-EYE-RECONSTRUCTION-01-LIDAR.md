# GODS-EYE-RECONSTRUCTION-01 — actual photo, footprint, LiDAR evidence

**2026-10-21 checkpoint:** six focused Node tests PASS, live Wikimedia Commons query PASS (22 metadata candidates), and independent Phoenix building/USGS point-cloud sampling completed. **Certification remains HOLD:** image rights, exact tower footprint, elevation datum and full-resolution mesh are not yet established.

## Public image candidate query

- API: https://commons.wikimedia.org/w/api.php
- Category: "Category:Phoenix City Hall". The bounded query returned 22 file records.
- Several images relate to surrounding memorials and the downtown area. Do **not** count 22 photos as 22 verified building views. Licenses and target matches still need human review.
- To reproduce: run \`node scripts/building-evidence.mjs --out artifacts/phoenix-city-hall-evidence.json\`.
- The Commons script downloads only image metadata, not pixels, and does not approve copyright or inferred facades.

## Independently acquired 2014 building polygons

- Publisher's item: https://www.arcgis.com/home/item.html?id=2843e4e02356475fa702322befe23766
- Service: https://services3.arcgis.com/0OPQIK59PJJqLK0A/arcgis/rest/services/Phoenix_AZ_3D_Building/FeatureServer/0/query
- Title: **LiDAR-Derived 3D Building Footprints - metro-Phoenix, Arizona (2014)**. Credited to NGA/USGS/Woolpert; published by mapgeohub. Source documents **2014** collection, 2017 release, and explicit warning that feature locations were **not validated**.
- GIS query: \`where=BLDGID=52520\`, \`geometry=-112.0781,33.4482,-112.0765,33.44925\`, \`geometryType=esriGeometryEnvelope\`, \`inSR=4326\`, \`returnGeometry=true\`, \`outSR=4326\`, \`f=geojson\`.
- The site query yielded **19** overlapping part-polygons; the dominant upper candidates are:

| FID | 2014 HGT_AGL m | 2014 top elevation m | Geometry |
| --- | ---: | ---: | --- |
| 606421 | 85.29 | 416.47 | flat polygon |
| 606423 | 94.71 | 426.03 | flat polygon |
| 606426 | 94.29 | 425.74 | pitched polygon |

These parts have the same \`BLDGID\` but are **not** individually certified as the entire 20-floor tower; a different OSM name match may refer to adjacent low structures. Do not use generic OSM name matches as height truth. Source usage rights/attribution must be reviewed before republishing any individual geometries. This repo does not check in copied polygons.

## 2020 USGS point-cloud data actually sampled

- USGS 3DEP **AZ_MaricopaPinal_1_2020**, public no-subscription Entwine Point Tiles (EPT): https://s3-us-west-2.amazonaws.com/usgs-lidar-public/AZ_MaricopaPinal_1_2020/ept.json
- Source 3DEP download index also shows adjacent USGS_LPC_AZ_MaricopaPinal_2020_B20 **w0399n3701** and **w0400n3701** LAZ products.
- Preliminary run fetched **21 EPT octree nodes, 5,534,298 compressed bytes**, depth \`<=12\`, cropped **230,619 3D points** around high-roof candidates. This is a bounded sampled point-cloud, **not** all full-density returns.
- Ground class 2: 41,541 returns, median vertical value **331.204 m**.
- 2014 polygon FID 606423 overlaid on the newer EPT points: 14,849 returns; median **425.212 m**, p95 **428.873 m**, p99 **429.483 m**, maximum **433.352 m**.
- Provisional difference: roof p95 minus area ground median **97.669 m**; not a surveyed building height. Some roof polygon returns represent lower portions and facade features. The expected **112 m / 20-floor** published tower specification is NOT reconciled with these measurements. The vertical datum and exact top-of-building definition require independent checks.
- GIS source polygons in EPSG:4326; EPT horizontal CRS EPSG:3857; the script reprojects to EPSG:3857 for point-in-polygon and **EPSG:26912 (UTM zone 12N)** for meaningful area estimates. Do not treat Web Mercator polygon area as square metres.

## Reproduce the measurements

Python 3.11+ and accessible public sources:

\`\`\`bash
python -m pip install -r scripts/requirements-reconstruction.txt
python scripts/phoenix-city-hall-lidar.py --out artifacts/phoenix-city-hall-lidar-measured.json
\`\`\`

To additionally obtain the individual 3 roof polygons as *candidate*, unvalidated GeoJSON for local analysis:

\`\`\`bash
python scripts/phoenix-city-hall-lidar.py --geojson-out artifacts/phoenix-city-hall-roof-candidates.geojson
\`\`\`

Do not publish that polygon export until you have confirmed and implemented source terms. The scripts do not use Google Earth, Google Maps, paid 3D Tiles, Google imagery reconstruction, or a paid API.

## Next certification gates

1. Verify the 2020 3DEP acquisition/vertical datum report and align it to the 2014 derived polygons. Exclude LiDAR returns from neighboring structures and ground-penetrating voids. Investigate the difference from published 112 m.
2. Match and rights-clear individual Commons images with actual north/east/south/west facade labels and calibrated camera poses; reject irrelevant category matches.
3. Build the pilot mesh from measured points (actual roof transitions) and independently licensed photo textures. Keep procedurally inferred unseen features separately marked.
4. Run an actual Cesium 3D Tiles pilot with independent geometry error measurements before merging the draft PR or changing God’s Eye’s map-source defaults.

The new components are research-only and do not impact the existing globe renderer or Clare runtime.
