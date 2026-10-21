# GODS-EYE-UNIFIED-STREET-RECON-01 — real Cesium browser render gate

**2026-10-21: ISOLATED BROWSER RENDER PASS; PUBLIC GEOMETRY AND TEXTURES HOLD.**

The browser QA uses God's Eye existing Cesium 1.124 integration and `src/reconstruction/preview.js` in a Vite development page. It does **not** alter the application's primary map stack, street viewer, startup or third-party data providers.

## Actual checks performed

On an isolated checkout of the draft reconstruction branch, Chromium with a WebGL2 SwiftShader context loaded both cases and rendered their GLB pixels. The script captures a model-visible screenshot, disposes the preview, and captures a model-removed screenshot; it measures a real pixel delta, checks the GLB model's ready state, verifies the WebGL context has not been lost, and verifies the Cesium primitive collection is empty after cleanup.

| Scene | GLB bytes | WebGL2 | Bounding-sphere radius | Visibly changed pixels after removal | Large-color-difference pixels | Result |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Synthetic 20 × 16 × 94.71 m cuboid | 876 | True | 49.06 m | 27,939 | 27,598 | PASS |
| Actual local City Hall **untextured candidate** | 45,032 | True | 56.56 m | 69,608 | 22,355 | PASS |

For both scenarios: `Model.ready === true`, one primitive present while visible, zero primitives after cleanup, zero browser page errors, no lost WebGL context. The QA screenshot/report artifacts are written under ignored `qa-artifacts/reconstruction/` and not published with licensed source geometry.

**What this test is not:** It is not a complete God's Eye UI session, does not enable the map provider switcher, and does not prove geographic registration. The preview intentionally uses a test-only `originEllipsoidalHeightM` placeholder and hides the globe so that the GLB render/cleanup can be tested independently of datum conversion. The actual geometry comes from a 2014 third-party roof dataset whose redistribution rights and footprint identity remain unverified; **the research GLB is never bundled as a public model.** No facade photographs or textures are included.

## Reproduce

Use Node 24 or 26, install dependencies with `npm ci`, and make Chrome available (`PUPPETEER_EXECUTABLE_PATH=/path/to/chrome` if needed). Run from repo root:

```bash
node scripts/qa-reconstruction-browser.mjs
python -m pip install -r scripts/requirements-reconstruction-mesh.txt
python scripts/build-phoenix-city-hall-mesh.py --research-only
node scripts/qa-reconstruction-browser.mjs --real
```

The default mode uses a **synthetic source-free GLB**, generated inside the browser script. `--real` reads the locally generated unvalidated City Hall GLB and rights manifest under `output/reconstruction/` (not checked into Git). It refuses unexpected manifest status, authorized-for-release flags or nonempty textures. The Node QA script starts/stops its own Vite server and Chrome browser and checks actual rendered pixel differences. The browser fixture is only a QA tool; it is not a production layer or a new data provider.

## Remaining gates

1. Independently verify tower footprint identity, USGS orthometric-to-Cesium ellipsoidal conversion, rooftop/architectural spire and true model placement.
2. Human clearance and camera-pose calibration of multiple actual street-photo views, preserving required creator and license attribution.
3. Full God’s Eye application graphical QA (camera, map source switch, Street Level interactions, fallback and teardown) and measured geometry-error tests.
4. First approved textured GLB and in-product preview, only after all source rights and validations pass.

**Gate remains `GEOMETRY_CANDIDATE_UNCERTIFIED / LICENSED_TEXTURE_AND_GEOGRAPHIC_PLACEMENT_HOLD`.** Only the narrow standalone browser render sub-gate advances to PASS.
