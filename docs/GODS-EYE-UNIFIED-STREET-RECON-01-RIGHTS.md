# Street evidence adapter review, 2026-10-21

This extends the existing adapter and draft PR #1. No new provider, lookup,
image downloader, map stack or startup hook is introduced.

## Contract and integration inspection

`src/layers/streetLevel/registry.js` owns StreetPose. The existing Mapillary
viewer emits its current viewer point of view, not independently calibrated
camera extrinsics. KartaView and Panoramax reuse the shared photo viewer;
Panoramax supplies per-image licence metadata. Google has its own existing
viewer. The evidence observer still consumes only public enabled/open/loaded
Street Level snapshots, never provider credentials or image URLs/pixels.

`src/maps/catalog.js` owns existing map choices; `src/app/scene.js` constructs
the Cesium viewer and owns scene cleanup. The reconstruction pilot composes
the existing Street Level interface with an explicitly invoked local Model
primitive. It does not alter map startup, map source selection or providers.

## Conservative provider policy

These requirements are project policy, not automatic permission grants.
All records start unapproved; a licence claim never approves a texture.

| Existing provider | Required review | Reference |
| --- | --- | --- |
| Mapillary | Actual image licence, creator attribution, adaptation obligations and API/service terms | [Mapillary guidance](https://help.mapillary.com/hc/en-us/articles/115001770409-CC-BY-SA-license-for-open-data), [terms](https://www.mapillary.com/terms) |
| KartaView | Attribution/share-alike, image rights and service terms | [KartaView terms](https://kartaview.org/terms) |
| Panoramax | Actual image licence AND originating instance terms; do not infer one licence for every federated host | [Panoramax legal information](https://panoramax.fr/mentions-legales) |
| Google | View only; reconstruction and texture reuse blocked even if a record claims an open licence | [Maps Platform terms](https://cloud.google.com/maps-platform/terms) |

References consulted on 2026-10-21. KartaView and Panoramax page bodies were
not fully readable through the web reader; search-index excerpts do not
constitute per-image clearance. The policy therefore requires manual review
and records no inferred licence version. No images were acquired in this work.

`STREET_EVIDENCE_RIGHTS` records immutable provider-specific requirements and
disables automatic downloads. Public texture clearance now also requires a
verified view, approved provider terms and a separate HTTPS terms evidence URL.
Unknown providers fail closed. These predicates validate review declarations;
they do not authenticate reviewers or independently establish legal rights.

Coordinates must be finite WGS84 longitude/latitude in range. Invalid bearings
become unknown; 360 becomes zero. An unknown heading cannot positively suggest
a flat image faces the target. Nearby coordinates across the antimeridian use
the short longitude difference. Altitude datum remains explicitly unknown.
The cardinal facade estimate remains a local heuristic, including for panoramas.

The preview requires boolean `true` research opt-in. Local paths containing
backslashes, whitespace or control characters are rejected before model loading
to prevent browser URL normalization from escaping the intended local path.

## Geometry disposition

The existing 2014 polygon extrusion builder and 2020 USGS LiDAR evidence remain
the independent research path. No Google assets are inputs. Generated meshes
remain ignored local research outputs, untextured and uncertified. The preview
requires separately established ellipsoidal placement. Exact tower identity,
2014/2020 registration, spire/roof height reconciliation, geometry reuse
permissions, calibrated independent photo views and actual browser Cesium QA
remain HOLD. No public mesh or licensed textured reconstruction is certified.

## Actual follow-up validation

Isolated Git clone, starting at `973bb8a62f2d3783628f1cd4cf272dc0eb453c8f`.
Concurrent remote documentation commit
`6234477bf0f8688e065d515be1f7fb3a601d1a86` was fetched and fast-forwarded;
no concurrent changes were overwritten. Node v24.15.0, npm 11.13.0,
Python 3.12.10; Python dependencies installed in a separate virtual environment.

- Focused Node command from the canonical ledger: **27 passed, 0 failed**.
- Python unittest discovery from the ledger: **7 passed**, with existing Shapely
  deprecation warnings. Initial attempts before installing dependencies had
  import errors; the installed-environment run passed.
- Live `build-phoenix-city-hall-mesh.py --research-only`: **45,032 bytes,
  3 parts, GEOMETRY_CANDIDATE_UNCERTIFIED**. Asset and rights sidecar remain in
  ignored local `output/reconstruction/`; no generated asset is published.
- `npm run check:boundaries`: exit **0**.
- `npm run format:check`: exit **0**, **1,454 source files**.
- Pinned Prettier check on all four edited JS/test files: exit **0**.
- `npm run build`: exit **0**, Vite **19.28 s**; existing large-chunk warning.
- `git diff --check` and `git fsck --no-reflogs`: exit **0**.

The first full-suite attempt overlapped `npm ci --ignore-scripts` and failed
with missing-package errors (4,231 passed, 268 failed, 10 skipped). It cannot
serve as a valid regression result. A separate run after successful installation
is reported below. Browser graphical Cesium QA and a fresh full LiDAR point
sampling run were not performed in this follow-up; existing LiDAR measurements
are retained as prior evidence, not re-measured claims.

Installed-environment `npm test`: exit **0**. Main parallel suite: **8,234
passed, 0 failed, 10 skipped** (231.897 s). Both serialized Node-24 allocation
files ran: **1/1 passed** (3.055 s) and **14/14 passed** (117.037 s).
Total: **8,249 passed, 0 failed, 10 skipped**. The skipped tests cover launcher
and symlink/platform behavior; they are not claimed as validated here. These are
local checkout results, not GitHub Actions or graphical certification results.
