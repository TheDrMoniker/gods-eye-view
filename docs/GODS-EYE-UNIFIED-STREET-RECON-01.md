# GODS-EYE-UNIFIED-STREET-RECON-01 — canonical gate ledger

**Checkpoint: 2026-10-21.** Development branch: `feature/gods-eye-reconstruction-01-evidence-r1`; draft PR #1. This file is the short canonical gate ledger. Detailed measurements and procedures live in the linked reports below. **Do not merge for public release yet.**

Follow-up: the existing adapter now records distinct per-provider rights review
requirements, rejects unknown providers at texture gates, labels viewer direction
and unknown altitude datum explicitly, and handles invalid headings and dateline
coordinates conservatively. The opt-in local preview rejects non-boolean flags
and browser-normalized remote paths. See the [rights and validation follow-up](GODS-EYE-UNIFIED-STREET-RECON-01-RIGHTS.md)
for current test results; the table below preserves the earlier checkpoint.

## One architecture, existing providers retained

- Original God's Eye Cesium map stacks, imagery sources, camera, geospatial data, and Street Level viewers are authoritative. No duplicate street-data provider, map-source switcher, street-camera model or second default map is introduced.
- `src/sources/streetEvidence.js` adapts the existing Street Level `StreetPose` and provides an **explicit opt-in** `captureStreetLevelEvidence(layer, consumer)` subscription to public `subscribe/getUIState` snapshots; neither pixels nor credentials are collected. The thin compatibility re-export is `server/reconstruction/streetEvidence.js`.
- Existing Mapillary, KartaView, Panoramax and Google Street View metadata can be represented. Google Street View is **view-only / never a texture source**. All other photos are *unverified candidates* until target identity, creator/license permissions, camera calibration and derivative rights pass review. The cardinal-facade proposal is a heuristic, not survey evidence.
- `src/reconstruction/pilot.js` joins this metadata observer to `src/reconstruction/preview.js`. This is a **developer opt-in assembly API**, not a production menu item or automatic enabled layer. It accepts local blob/same-origin GLB URLs, a research-only manifest and independently established WGS84 **ellipsoidal** ground elevation. It destroys its owned primitive and observer upon dispose.
- Source rights gates prevent image pixels from being silently imported and block automatic promotion to approved textures. Google Earth/Google Maps geometry and textures are not acquired.

## Completed evidence and tests (this branch checkout)

| Gate | Evidence | Result |
| --- | --- | --- |
| Wikimedia Commons category metadata | 22 candidates, some unrelated; zero face/rights-approved images | DISCOVERY PASS / TEXTURES HOLD |
| Independently sourced Phoenix rooftop polygons | 2014 roof-part IDs 606421, 606423 and 606426; geometry and exact building identity unvalidated | RESEARCH EVIDENCE |
| USGS 3DEP EPT point samples | 21 LAZ nodes, 230,619 cropped returns, ground median Z 331.204 m; high-roof FID 606423 p95 Z 428.873 m | MEASURED SAMPLE / DATUM HOLD |
| Neutral geometry-only candidate mesh | Real ArcGIS roof polygons extruded as 3 local GLB solids; 45,032-byte output, watertight on GLB reload; no photos/textures | GEOMETRY_CANDIDATE_UNCERTIFIED |
| Focused Node tests | 23/23 passing | PASS |
| Python mesh/LiDAR tests | 7/7 passing | PASS |
| Full `npm test` on Node v26.12.1 | 8,239 passed, 0 failed, 1 skipped; two Node-24-only allocation microbenchmarks not executed | PASS WITH CALIBRATION EXCEPTION |
| `npm run check:boundaries` | Import and package boundaries passed | PASS |
| `npm run format:check` | 1,454 source files checked | PASS |
| `npm run build` | Vite production bundle compiled | PASS |
| Cesium graphical registration, texture rights and public release | Not tested or cleared | HOLD |

The full repository validation used an isolated archive of GitHub commit `973bb8a62f2d3783628f1cd4cf272dc0eb453c8f`. It is **not a GitHub Actions result**, an installation test on Clare, or a guarantee that the in-browser Cesium preview renders correctly. Node v26.12.1 cannot certify the two Node-24-calibrated allocation microbenchmarks; run those on the pinned runtime before release. A Shapely deprecation warning exists in the research generator.

## Important physical uncertainties

- Source 2014 building part polygons are unvalidated; municipal campus groups are not guaranteed to be the tower's independent footprint. Do not infer facade details from a roof extruded to ground.
- The 2020–21 LiDAR data use an orthometric height reference documented in the USGS project report, whereas Cesium uses ellipsoidal placement. The preview **requires externally verified ellipsoidal ground placement**, never the raw LiDAR Z field.
- The 2014 high-roof feature reports 94.71 m above ground; 2020–21 sampled upper-roof p95 minus sampled site-ground median is 97.669 m. The published ~112 m architectural height may include a spire but this hypothesis has **not** been independently measured or modeled.
- The 45 kB GLB is generated for local research, not committed to `public/models`. Source-derived redistribution terms and exact tower identity still require review.
- Photo-derived window/facade materials are *not* present. A CC or provider license claim alone cannot certify a texture.

## Reproduce and inspect

From the God’s Eye fork root:

```bash
node --test src/reconstruction/*.test.mjs src/sources/streetEvidence.test.mjs server/reconstruction/*.test.mjs
python -m pip install -r scripts/requirements-reconstruction-mesh.txt
python -m unittest discover -s scripts -p 'test_*city_hall*.py'
python scripts/build-phoenix-city-hall-mesh.py --research-only
```

Full checkout regression: `npm test`, `npm run check:boundaries`, `npm run format:check`, `npm run build`.

## Next production gates

1. **Source permission gate:** individually validate photo usage, share-alike consequences, and redistribution rights for the GIS-derived geometries; retain credits and license change notices.
2. **Identity and datum gate:** establish the exact tower footprint and NAVD88-to-ellipsoid transform from the survey report, with independent calibration and a measured spire or a documented unresolved height difference.
3. **Street/photo coverage:** review actual images and source positions to verify face identity, independent baselines and capture dates; use existing Street Level viewers, not a new provider.
4. **Graphical QA:** run the optional research assembly in a real Cesium browser against a local GLB; inspect alignment, axis/scale, overlays, provider switches, cleanup and fallback without modifying default map behavior.
5. **Public release:** only after geometry error bounds, provenance and rights are measured and approved; then connect Clare through its governed bridge rather than importing Google assets or bypassing the current runtime.

Details: [LiDAR evidence](GODS-EYE-RECONSTRUCTION-01-LIDAR.md), [geometry research](GODS-EYE-UNIFIED-STREET-RECON-01-GEOMETRY.md), [unified development design](GODS-EYE-UNIFIED-STREET-RECON-01-UNIFIED.md), [adapter contract](GODS-EYE-UNIFIED-STREET-RECON-01-ADAPTER.md).
