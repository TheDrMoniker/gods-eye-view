/** Adapt existing StreetPose metadata without acquiring provider imagery. */
const PROVIDERS = new Set(['mapillary', 'kartaview', 'panoramax', 'google']);
export function normalizeStreetPoseEvidence(pose) {
  if (!pose || !PROVIDERS.has(pose.providerId))
    throw new TypeError('Unknown street provider');
  const lon = pose.position?.lon,
    lat = pose.position?.lat;
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lon) > 180 ||
    Math.abs(lat) > 90
  )
    throw new TypeError('Invalid street-photo coordinates');
  if (typeof pose.imageId !== 'string' || !pose.imageId.trim())
    throw new TypeError('Missing image ID');
  const angle = (value, low, high) =>
    Number.isFinite(value) && value >= low && value <= high ? value : null;
  const url =
    typeof pose.externalUrl === 'string' && /^https:\/\//.test(pose.externalUrl)
      ? pose.externalUrl
      : null;
  return Object.freeze({
    schema: 'gods-eye-street-photo-evidence/1',
    provider: pose.providerId,
    image_id: pose.imageId,
    location: { lon, lat },
    bearing_deg: angle(pose.bearing, 0, 360),
    tilt_deg: angle(pose.tilt, -90, 90),
    altitude_m: Number.isFinite(pose.altitude) ? pose.altitude : null,
    captured_at_ms: Number.isFinite(pose.capturedAt) ? pose.capturedAt : null,
    is_panorama: pose.isPano === true,
    creator: pose.creator || null,
    license_claim: pose.license || null,
    source_url: url,
    target_building_id: null,
    facade_id: null,
    camera_calibration: 'unverified',
    review: {
      identity: 'unverified',
      rights: 'unreviewed',
      view: 'unverified',
    },
    texture_approved: false,
    geometry_approved: false,
    // Google Street View is view-only, regardless of displayed image license text.
    policy:
      pose.providerId === 'google'
        ? 'view_only_no_reconstruction'
        : 'manual_license_review',
  });
}
export function mayTextureFromStreetEvidence(evidence) {
  return Boolean(
    evidence &&
    evidence.provider !== 'google' &&
    evidence.texture_approved === true &&
    evidence.review?.rights === 'approved' &&
    evidence.review?.identity === 'verified' &&
    evidence.facade_id &&
    evidence.camera_calibration === 'verified',
  );
}

/**
 * Opt-in bridge from the existing Street Level layer's public snapshot API.
 * No API calls, image downloads, storage, UI mutations or provider substitutions.
 * Google's pose is excluded by default due to Google Maps usage restrictions.
 * Unsubscribing removes the observer; each image is observed at most once.
 */
export function captureStreetLevelEvidence(
  layer,
  consumer,
  { includeViewOnly = false, dedupeLimit = 128 } = {},
) {
  if (
    !layer ||
    typeof layer.subscribe !== 'function' ||
    typeof layer.getUIState !== 'function' ||
    typeof consumer !== 'function'
  )
    throw new TypeError(
      'Street Level layer, subscription and evidence consumer required',
    );
  if (!Number.isInteger(dedupeLimit) || dedupeLimit < 1 || dedupeLimit > 5000)
    throw new RangeError('dedupeLimit must be 1..5000');
  const seen = new Set();
  let stopped = false;

  function onSnapshot(snapshot) {
    if (
      stopped ||
      snapshot?.enabled !== true ||
      !snapshot.street?.open ||
      snapshot.street?.loading ||
      !snapshot.street.imageId ||
      !snapshot.street.position
    )
      return;
    const photo = snapshot.street;
    // Compose the existing StreetPose contract (not a second provider lookup).
    let evidence;
    try {
      evidence = normalizeStreetPoseEvidence({
        providerId: photo.providerId,
        imageId: photo.imageId,
        position: photo.position,
        bearing: photo.bearing,
        tilt: photo.tilt,
        altitude: photo.altitude,
        capturedAt: photo.capturedAt,
        isPano: photo.isPano,
        creator: photo.creator,
        license: photo.license,
        externalUrl: photo.externalUrl,
      });
    } catch {
      return; // Half-loaded or malformed provider snapshots are never evidence.
    }
    if (!includeViewOnly && evidence.policy === 'view_only_no_reconstruction')
      return;
    const key = evidence.provider + ':' + evidence.image_id;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > dedupeLimit) seen.delete(seen.values().next().value);
    // Never convert UI observer errors into street-view failures.
    try {
      consumer(evidence);
    } catch (error) {
      console.warn('[GODS-EYE-STREET-RECON] evidence observer error', error);
    }
  }
  const unsubscribe = layer.subscribe(onSnapshot);
  onSnapshot(layer.getUIState());
  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    seen.clear();
  };
}

function normalizedHeading(value) {
  if (!Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

/** Heuristic only: a cardinal face is NOT a surveyed facade nor pose calibration. */
export function proposeStreetFacade(
  evidence,
  target,
  { maxDistanceMeters = 600 } = {},
) {
  const camera = evidence?.location;
  if (
    !Number.isFinite(camera?.lon) ||
    !Number.isFinite(camera?.lat) ||
    !Number.isFinite(target?.lon) ||
    !Number.isFinite(target?.lat) ||
    Math.abs(target.lon) > 180 ||
    Math.abs(target.lat) > 90
  )
    throw new TypeError('Valid camera evidence and target lon/lat required');
  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 0)
    throw new TypeError('Positive maxDistanceMeters required');
  const radians = Math.PI / 180;
  const north = (target.lat - camera.lat) * 111195;
  const east =
    (target.lon - camera.lon) *
    111195 *
    Math.cos(((target.lat + camera.lat) / 2) * radians);
  const distance = Math.hypot(east, north);
  const toward = normalizedHeading(Math.atan2(east, north) / radians);
  const bearing = normalizedHeading(evidence.bearing_deg);
  const delta =
    bearing === null ? null : Math.abs(((bearing - toward + 540) % 360) - 180);
  const fromNorth = -north;
  const fromEast = -east;
  const face =
    Math.abs(fromNorth) >= Math.abs(fromEast)
      ? fromNorth > 0
        ? 'north'
        : 'south'
      : fromEast > 0
        ? 'east'
        : 'west';
  const facing =
    distance <= maxDistanceMeters &&
    (evidence.is_panorama === true || delta === null || delta <= 35);
  return {
    target_id: target.id ?? null,
    candidate_facade: distance < 2 ? null : face,
    distance_m: Math.round(distance * 100) / 100,
    azimuth_to_target_deg: Math.round(toward * 100) / 100,
    camera_angular_offset_deg:
      delta === null ? null : Math.round(delta * 100) / 100,
    might_show_target: Boolean(facing && distance >= 2),
    review: 'unverified_heuristic',
    texture_approved: false,
  };
}

/**
 * Stricter public-texture release gate than the preliminary eligibility check.
 * Requires independent human review, a stable target ID and source attribution.
 */
export function isReleaseClearedStreetTexture(photo) {
  if (
    !mayTextureFromStreetEvidence(photo) ||
    typeof photo.target_building_id !== 'string' ||
    photo.target_building_id.trim().length === 0 ||
    !/^https:\/\//.test(photo.source_url || '') ||
    !photo.creator ||
    !photo.license_claim ||
    !photo.review?.reviewed_by ||
    !Number.isFinite(Date.parse(photo.review?.reviewed_at || '')) ||
    !photo.review?.rights_evidence_url ||
    !/^https:\/\//.test(photo.review.rights_evidence_url)
  )
    return false;
  return true;
}
