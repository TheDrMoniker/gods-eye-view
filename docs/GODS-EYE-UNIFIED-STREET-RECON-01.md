# GODS-EYE-UNIFIED-STREET-RECON-01

This additive adapter reuses the existing Street Level `StreetPose` contract in `src/layers/streetLevel/registry.js` without creating a second street-photo provider or downloading imagery. It preserves provenance, coordinate position, orientation, creator, claimed license, and original link. All matches to building and facade remain **unverified** until independently reviewed.

- Street Level already supports Mapillary, KartaView, Panoramax and Google. No provider is replaced.
- Google imagery is always view-only for reconstruction purposes.
- Other provider photos require rights verification, exact building identity and camera calibration before texturing.
- The adapter is currently a pure function with no runtime capture hook or UI integration. It must not be described as a live reconstruction pipeline.
- The geometry-only glTF/GLB, height-datum reconciliation, source-photo approvals and Cesium layer are still HOLD.
- Run `node --test server/reconstruction/streetEvidence.test.mjs`.
- Keep draft PR #1 unmerged until its full integration tests and source-rights gates pass.
