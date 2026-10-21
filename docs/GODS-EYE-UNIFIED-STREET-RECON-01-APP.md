# Actual application reconstruction preview — development-only

Status: **LOCAL-APP-RESEARCH-PREVIEW PASS / ACCURATE PLACEMENT + TEXTURES HOLD**.

The current God's Eye viewer and Street Level layer remain unchanged. The research integration is lazy-imported only by Vite's development environment if the user explicitly navigates to `/?reconResearch=1`. The production bundle never activates or imports the controller at runtime. It is **not a product feature**, a new provider, a licensed source, a default scene, or a permission to publicly redistribute the candidate model.

## Local setup

1. Install `npm ci`, and `python -m pip install -r scripts/requirements-reconstruction-mesh.txt`.
2. Generate the unlicensed research candidate **on the local workstation only**: `python scripts/build-phoenix-city-hall-mesh.py --research-only --out output/reconstruction/phoenix-city-hall-candidate.glb`.
3. Run `npm run dev` and open `/?reconResearch=1`. A small City Hall research panel appears on the actual existing God’s Eye globe.
4. To load, supply an independently established **WGS84 ellipsoidal ground elevation** for the site, not raw LiDAR NAVD88 Z. Leaving the box empty correctly blocks loading. Entering a number does **not** certify it: the model is for research only. Use Hide and Close to remove owned primitives and subscriptions.

The runtime fetches only same-origin ignored `output/reconstruction` research files and inspects the manifest. It rejects missing files, unexpected state, public-release approval, and any nonempty texture list. No acquired photos are bundled or textured.

## Browser smoke test executed on 2026-10-21

The full application was started in Chrome/Vite with the research query parameter, with its original scene and layer registry active. The panel was present, the actual Cesium canvas existed, an empty elevation was BLOCKED, manually supplied test height was accepted, Hide and Close completed without errors, and the user could return to the normal app. One incidental 404 resource warning occurred. The supplied **300 m** for that smoke test was a deliberately unverified QA value and **must not** be reported as correct elevation or used for publishing. The visible app overlay is real; that does not demonstrate correct building position or camera angle.

Independent isolated browser QA also demonstrated real 45,032-byte City Hall GLB WebGL rendering and disposal. A verified in-product textured facade and placement calibration **have not yet happened**.

## Promotion requirements

- Confirm exact building shape and actual tower identity rather than a 2014 grouped municipal-campus roof polygon.
- Convert USGS NAVD88/GEOID18 orthometric elevations correctly to WGS84 ellipsoidal ground height and register an independently observed control point.
- Identify two or more independent camera baselines for facade photo registration; obtain each photograph's license, author, date, pose and derivative permission.
- Do not create facade textures from Google Street View or presume public photos are redistributable.
- Validate the full application preview against geospatial coordinates, real street-view switching, geometry error bounds and actual photo-facing orientation; only then consider production/default visual integration.

**KEEP PHOTO-TEXTURE AND GEO-REGISTRATION GATES ON HOLD.** Research code is safe to examine and test but its evidence is insufficient for declaring an accurately positioned photorealistic building.
