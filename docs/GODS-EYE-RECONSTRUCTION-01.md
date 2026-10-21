# GODS-EYE-RECONSTRUCTION-01 — building-specific evidence intake

Gate status: EVIDENCE_INTAKE_HOLD. This is a functional metadata intake and a reconstruction work planner, not a generated 3D model or a passed geometry certification.

## Purpose

Start with one real building (Phoenix City Hall) and ask what independently licensed evidence exists for its surfaces before allocating photogrammetry, LiDAR meshing, AI-assisted textures, or full-city processing. The pilot uses latitude 33.4489, longitude -112.0771 as an approximate map reference (https://en.wikipedia.org/wiki/Phoenix_City_Hall); this coordinate is not a surveyed building identifier, footprint or geodetic datum.

## Executable first slice

Run from the gods-eye-view repository root on Node 24 or 26:

    node scripts/building-evidence.mjs --out artifacts/phoenix-city-hall-evidence.json

The script makes a small number of sequential Wikimedia Commons Action API requests for Category:Phoenix City Hall and writes a JSON evidence registry with photo candidate metadata, license and attribution hints, missing building-side views and priority tasks. Without --out, it prints JSON to stdout.

For a focused deterministic test, run:

    node --test server/reconstruction/evidence.test.mjs

Existing npm test discovers server-side .test.mjs tests automatically. The new files do not alter the globe renderer or map sources.

## Rules enforced

- Zero paid API calls. No Google Earth geometry or imagery ingestion, scraping, tracing or derivative meshes.
- All Wikimedia entries begin as PHOTO CANDIDATES. Category membership, geotags and file names do not prove the image shows the intended building or any particular surface.
- Photo copyright, creators, license and attribution must be manually reviewed before download/reconstruction. CC0/CC BY/CC BY-SA text is a hint, not approval. Keep source and derivative attribution; confirm terms for commercial use.
- A photo view counts toward coverage only after explicit building match, rights clearance, face label, named reviewer, review time and reconstruction approval. Camera-pose status is separately tracked and must be calibrated before structure-from-motion.
- Building footprints and LiDAR must come from independently permitted sources; their rights, building identity and spatial datum must be verified before treating them as measured geometry.
- Do not infer accurate window locations, unseen facades, building interiors or surveyed dimensions from single photographs. Any generative completion is an estimated *visual* surface, never a measured one.
- Wikimedia API clients must identify themselves, keep requests sequential, obey 429/Retry-After, and cache rather than repeatedly crawling at scale. The initial path is intentionally limited to at most 5 pages of 10 candidates each.

## Next engineering vertical slices

1. Resolve an actual OSM/Overture building footprint and stable identifier; confirm source and license, CRS, measured versus estimated heights.
2. Find applicable USGS 3DEP LiDAR/elevation and open aerial orthophotos at the same coordinate and dates; confirm downloads and reuse rights.
3. Enrich candidate photos with independently reviewed target matches, facade directions, source rights, camera location/focal metadata when supported. Add Panoramax/KartaView only with provider-specific license/attribution rules; existing Mapillary Street Level support remains a visual source, not automatic reuse permission.
4. Calibrate two or more overlapping licensed image viewpoints; run a controlled COLMAP/OpenDroneMap reconstruction and measured geometry error checks.
5. Export georeferenced glTF/3D Tiles and connect to the existing Cesium renderer as an optional building layer, retaining evidence references, license notices and measured/inferred provenance.
6. Create a Clare bridge only after the separate God's Eye pilot is demonstrated and source/permission constraints are enforced.

## Acceptance for this increment

- Commons lookup returns a bounded list of candidate image records or a transparent API/rate-limit error.
- Each candidate has a source page and review status; no imagery files are downloaded.
- Empty or unreviewed data cannot accidentally certify a building surface.
- A JSON gap report specifies unobserved surfaces, missing independent footprint/LiDAR and the next acquisition tasks.
- The gate remains HOLD until empirical 3D reconstruction and independent geometry tests exist.

This feature is not yet visually integrated into the application.
