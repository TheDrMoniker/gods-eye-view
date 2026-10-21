/** Adapt existing StreetPose metadata without acquiring provider imagery. */
const PROVIDERS = new Set(['mapillary','kartaview','panoramax','google']);
export function normalizeStreetPoseEvidence(pose) {
  if (!pose || !PROVIDERS.has(pose.providerId)) throw new TypeError('Unknown street provider');
  const lon = pose.position?.lon, lat = pose.position?.lat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon)>180 || Math.abs(lat)>90)
    throw new TypeError('Invalid street-photo coordinates');
  if (typeof pose.imageId !== 'string' || !pose.imageId.trim()) throw new TypeError('Missing image ID');
  const angle = (value, low, high) => Number.isFinite(value) && value >= low && value <= high ? value : null;
  const url = typeof pose.externalUrl === 'string' && /^https:\/\//.test(pose.externalUrl) ? pose.externalUrl : null;
  return Object.freeze({
    schema: 'gods-eye-street-photo-evidence/1',
    provider: pose.providerId, image_id: pose.imageId,
    location: { lon, lat }, bearing_deg: angle(pose.bearing, 0, 360),
    tilt_deg: angle(pose.tilt, -90, 90),
    altitude_m: Number.isFinite(pose.altitude) ? pose.altitude : null,
    captured_at_ms: Number.isFinite(pose.capturedAt) ? pose.capturedAt : null,
    is_panorama: pose.isPano === true, creator: pose.creator || null,
    license_claim: pose.license || null, source_url: url,
    target_building_id: null, facade_id: null, camera_calibration: 'unverified',
    review: { identity: 'unverified', rights: 'unreviewed', view: 'unverified' },
    texture_approved: false, geometry_approved: false,
    // Google Street View is view-only, regardless of displayed image license text.
    policy: pose.providerId === 'google' ? 'view_only_no_reconstruction' : 'manual_license_review',
  });
}
export function mayTextureFromStreetEvidence(evidence) {
  return Boolean(evidence && evidence.provider !== 'google' &&
    evidence.texture_approved === true && evidence.review?.rights === 'approved' &&
    evidence.review?.identity === 'verified' && evidence.facade_id &&
    evidence.camera_calibration === 'verified');
}
