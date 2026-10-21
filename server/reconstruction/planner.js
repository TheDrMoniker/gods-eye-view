/**
 * GODS-EYE-RECONSTRUCTION-01 evidence ledger. The intake is not a mesh.
 * Only manually reviewed assets and independently sourced geometry count.
 */
export const REQUIRED_SURFACES = Object.freeze([
  'north',
  'east',
  'south',
  'west',
  'roof',
]);

export const PHOENIX_CITY_HALL = Object.freeze({
  id: 'phoenix-city-hall-pilot',
  name: 'Phoenix City Hall',
  lat: 33.4489,
  lon: -112.0771,
  address: '200 W Washington St, Phoenix, AZ',
  coordinate_quality: 'approximate_reference_only',
  coordinate_source: 'https://en.wikipedia.org/wiki/Phoenix_City_Hall',
  commons_category: 'Category:Phoenix City Hall',
  building_footprint_id: null,
});

/** Licensing and target review must be explicit; photo titles are not evidence. */
export function isReviewedPhoto(photo) {
  const review = photo?.review;
  return (
    review?.target_identity === 'verified' &&
    review?.rights === 'approved' &&
    REQUIRED_SURFACES.includes(review?.view) &&
    typeof review?.reviewed_by === 'string' &&
    review.reviewed_by.trim().length > 0 &&
    typeof review?.reviewed_at === 'string' &&
    Number.isFinite(Date.parse(review.reviewed_at)) &&
    photo?.reconstruction_approved === true
  );
}

/** A geometry source is evidence only after identity, rights and datum review. */
export function isReviewedGeometry(evidence) {
  return (
    evidence?.building_match === 'verified' &&
    evidence?.rights === 'approved' &&
    evidence?.datum === 'verified' &&
    typeof evidence?.source_url === 'string' &&
    evidence.source_url.startsWith('https://') &&
    typeof evidence?.reviewed_by === 'string' &&
    evidence.reviewed_by.trim().length > 0
  );
}

export function makeBuildingEvidenceRegistry({
  target = PHOENIX_CITY_HALL,
  discovery,
  footprint = null,
  lidar = null,
} = {}) {
  if (
    !target ||
    !Number.isFinite(target.lat) ||
    !Number.isFinite(target.lon) ||
    target.lat < -90 ||
    target.lat > 90 ||
    target.lon < -180 ||
    target.lon > 180
  )
    throw new TypeError('Target must have valid lat/lon coordinates');
  const candidates = Array.isArray(discovery?.candidates)
    ? discovery.candidates
    : [];
  const approved = candidates.filter(isReviewedPhoto);
  const observed = new Set(approved.map((photo) => photo.review.view));
  const missing = REQUIRED_SURFACES.filter((view) => !observed.has(view));
  const footprintReady = isReviewedGeometry(footprint);
  const lidarReady = isReviewedGeometry(lidar);
  const plan = [];
  if (!footprintReady)
    plan.push({
      priority: 1,
      task: 'verify_footprint',
      why: 'Obtain independent georeferenced footprint, building ID, datum and rights',
    });
  if (!lidarReady)
    plan.push({
      priority: 2,
      task: 'verify_lidar',
      why: 'Obtain and validate measured heights and roof geometry',
    });
  if (candidates.length)
    plan.push({
      priority: 3,
      task: 'review_photo_candidates',
      count: candidates.length,
      why: 'Match each image to the building; verify creator, license and reuse rights',
    });
  else
    plan.push({
      priority: 3,
      task: 'find_photo_candidates',
      why: 'Find independently licensed photographs of this exact building',
    });
  for (const view of missing)
    plan.push({
      priority: 4,
      task: 'cover_missing_surface',
      view,
      why: 'Find a licensed photo/view with verified building identity',
    });
  plan.push({
    priority: 5,
    task: 'calibrate_and_reconstruct',
    why: 'Only after source review, camera calibration and overlapping views; no AI inference may be labeled measured',
  });

  return {
    schema: 'gods-eye-building-evidence/1',
    gate: 'GODS-EYE-RECONSTRUCTION-01',
    status: 'EVIDENCE_INTAKE_HOLD',
    generated_at: new Date().toISOString(),
    target,
    sources: {
      photographs: discovery?.provider || null,
      category: discovery?.category || null,
      data_truncated: discovery?.truncated === true,
      footprint: footprintReady ? footprint : null,
      lidar: lidarReady ? lidar : null,
    },
    summary: {
      discovered_photo_candidates: candidates.length,
      verified_licensed_photos: approved.length,
      measured_footprint_available: footprintReady,
      measured_lidar_available: lidarReady,
      observed_surfaces: REQUIRED_SURFACES.filter((view) => observed.has(view)),
      missing_surfaces: missing,
      reconstructed_mesh_exists: false,
      google_earth_derived_assets: false,
    },
    candidates,
    next_actions: plan,
  };
}
