# Unified Street Level and reconstruction pilot

Gate: GODS-EYE-UNIFIED-STREET-RECON-01.

This is an opt-in development assembly, not a replacement for the existing
map stacks, Street Level viewer or layer management. It reuses:
- the public Street Level subscribe/getUIState interface and current StreetPose;
- the shared portable street evidence normalizer in src/sources;
- the dedicated local-only Cesium preview helper in src/reconstruction;
- the City Hall 2014 GIS rooftop research GLB generator.

Use createGodsEyeStreetReconPilot from src/reconstruction/pilot.js.
Call startStreetEvidence only when a user has explicitly chosen to
collect metadata from their current public street imagery session.
No pixels, image downloads or credentials are captured. Google Street View
records are excluded by default, while Mapillary/KartaView/Panoramax
metadata remains unverified evidence requiring human license review.

Local (not public) visualization requires an explicitly supplied GLB blob
or same-origin URL, its research manifest, and a separately established WGS84
ellipsoidal ground elevation from a suitable Cesium terrain source.
The 2020 USGS project report identifies NAVD88 (EPSG:5703) with GEOID18;
do not interpret the orthometric LiDAR elevation as Cesium ellipsoidal height.
The 2014 polygon datum and USGS EPT reprojection alignment remain under review.

Official 2020 USGS work unit:
https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/metadata/AZ_MaricopaPinal_2020_B20/USGS_AZ_MaricopaPinal_2020_B20_Project_Report.pdf

The published architectural height of 112.2 m can include a qualifying
spire. Existing LiDAR roof p95 corresponds to about 97.67 m above local
ground, leaving approximately 14.5 m between that percentile and the
published architectural height. Public photos show a spire, but its
geometry has NOT been independently measured or added to the research GLB.

Wikimedia Commons file Phoenix City Hall-3.jpg provides a possible
2013 point-of-view coordinate 33.448416, -112.076829 under CC BY-SA 3.0.
Some photos share the same point-of-view and do not increase independent
camera baselines. No photo has passed face registration or derivative
texture approval. Preserve creator and share-alike attribution when
eventually releasing any adaptations.

Research-source policy: USGS 3DEP primary for United States LiDAR;
OpenTopography as a discovery/processing complement; NAIP and licensed
orthophotos for roofs; NOAA Digital Coast for relevant coastlines; national
LiDAR portals abroad. Sentinel-2 is valuable for regional change but not
per-window facade textures. Google Earth Pro remains a visual reference,
not a source of extractable images, photogrammetry or meshes.

Tests:
- node --test src/reconstruction/*.test.mjs src/sources/streetEvidence.test.mjs server/reconstruction/*.test.mjs
- python -m unittest discover -s scripts -p test_*city_hall*.py
- python scripts/build-phoenix-city-hall-mesh.py --research-only

The pilot does not automatically register or affect current map sources.
Gate stays HOLD for public distribution and for licensed textures until
facade/roof registration, rights reviews and actual Cesium graphical QA pass.
