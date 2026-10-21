## Unified street-data capture contract (additional implementation)

The canonical client-side interface is now `src/sources/streetEvidence.js`.
The server-side `server/reconstruction/streetEvidence.js` is a compatibility re-export so the mapping and server layers cannot diverge.

`captureStreetLevelEvidence(layer, receiver)` subscribes *opt-in* to the
existing Street Level `subscribe/getUIState` API without modifying the viewer.
It observes only opened, loaded imagery and emits deduplicated
metadata-only `StreetPose` records. No image pixels, photo thumbnails,
account credentials or visitor location history are stored. It ignores Google
Street View by default; a view-only consumer may explicitly request transient
Google metadata, which is always disallowed for texture publication.

`proposeStreetFacade` uses approximate camera and building positions
to produce a directional **candidate only**. It does not claim true facade
registration, field of view, camera calibration or rights clearance.
`isReleaseClearedStreetTexture` requires human-reviewed building ID,
source attribution, rights evidence and camera calibration before a texture
could be admitted to a future mesh build; this is not a license-verification service.

Standalone unit tests:
`node --test src/sources/streetEvidence.test.mjs server/reconstruction/streetEvidence.test.mjs`.

There is deliberately no auto-start wiring or new street provider.
