import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeStreetPoseEvidence,
  captureStreetLevelEvidence,
  proposeStreetFacade,
  isReleaseClearedStreetTexture,
} from './streetEvidence.js';

const initial = () => ({
  enabled: true,
  street: { open: false, loading: false, imageId: null, providerId: null },
});
function streetLayer() {
  let snapshot = initial();
  const observers = new Set();
  return {
    getUIState: () => snapshot,
    subscribe(listener) {
      observers.add(listener);
      return () => observers.delete(listener);
    },
    set(value) {
      snapshot = value;
      for (const callback of observers) callback(value);
    },
    listeners: () => observers.size,
  };
}
function opened(providerId = 'mapillary', imageId = 'img-1') {
  return {
    enabled: true,
    street: {
      open: true,
      loading: false,
      providerId,
      imageId,
      position: { lon: -112.0773, lat: 33.4481 },
      bearing: 0,
      tilt: 10,
      capturedAt: 1600000000000,
      creator: 'Example',
      license: 'CC BY-SA 4.0',
      externalUrl: 'https://example.org/photo/1',
    },
  };
}

test('subscribes to existing Street Level and observes only opened images', () => {
  const layer = streetLayer(),
    received = [];
  const close = captureStreetLevelEvidence(layer, (e) => received.push(e));
  assert.equal(layer.listeners(), 1);
  layer.set({ ...opened(), street: { ...opened().street, loading: true } });
  layer.set(opened());
  layer.set(opened()); // not a duplicate evidence record
  layer.set(opened('panoramax', 'img-2'));
  assert.equal(received.length, 2);
  assert.equal(received[0].provider, 'mapillary');
  assert.equal(received[0].texture_approved, false);
  close();
  close();
  assert.equal(layer.listeners(), 0);
  layer.set(opened('kartaview', 'img-3'));
  assert.equal(received.length, 2);
});
test('view-only Google poses are filtered by default, even while previewed', () => {
  const layer = streetLayer(),
    seen = [];
  const stop = captureStreetLevelEvidence(layer, (e) => seen.push(e));
  layer.set(opened('google', 'g-1'));
  assert.equal(seen.length, 0);
  stop();
  const stop2 = captureStreetLevelEvidence(layer, (e) => seen.push(e), {
    includeViewOnly: true,
  });
  assert.equal(seen[0].policy, 'view_only_no_reconstruction');
  assert.equal(isReleaseClearedStreetTexture(seen[0]), false);
  stop2();
});
test('cardinal facade suggestion is deliberately unverified', () => {
  const record = normalizeStreetPoseEvidence({
    providerId: 'mapillary',
    imageId: 'x',
    position: { lon: -112.0773, lat: 33.4481 },
    bearing: 0,
    externalUrl: 'https://example.org/one',
  });
  const result = proposeStreetFacade(record, {
    id: 'pilot',
    lon: -112.0773,
    lat: 33.44865,
  });
  assert.equal(result.candidate_facade, 'south');
  assert.equal(result.might_show_target, true);
  assert.equal(result.review, 'unverified_heuristic');
  assert.equal(result.texture_approved, false);
  const away = proposeStreetFacade(
    { ...record, bearing_deg: 180 },
    {
      id: 'pilot',
      lon: -112.0773,
      lat: 33.44865,
    },
  );
  assert.equal(away.might_show_target, false);
});
test('public texture clearance needs independent rights evidence and review', () => {
  const record = normalizeStreetPoseEvidence({
    providerId: 'panoramax',
    imageId: 'p-1',
    position: { lon: -112.08, lat: 33.448 },
    externalUrl: 'https://panoramax.example/photo/1',
    creator: 'author',
    license: 'CC BY-SA 4.0',
  });
  const candidate = {
    ...record,
    target_building_id: 'phoenix-city-hall-pilot',
    facade_id: 'south',
    camera_calibration: 'verified',
    texture_approved: true,
    review: {
      identity: 'verified',
      rights: 'approved',
      view: 'verified',
      provider_terms: 'approved',
      provider_terms_evidence_url: 'https://panoramax.example/terms',
      reviewed_by: 'reviewer',
      reviewed_at: '2026-10-21T00:00:00Z',
      rights_evidence_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  };
  assert.equal(isReleaseClearedStreetTexture(record), false);
  assert.equal(isReleaseClearedStreetTexture(candidate), true);
  for (const provider of ['other', undefined, 'google']) {
    assert.equal(
      isReleaseClearedStreetTexture({ ...candidate, provider }),
      false,
    );
  }
  for (const field of [
    'view',
    'provider_terms',
    'provider_terms_evidence_url',
  ]) {
    assert.equal(
      isReleaseClearedStreetTexture({
        ...candidate,
        review: { ...candidate.review, [field]: null },
      }),
      false,
    );
  }
  assert.equal(
    isReleaseClearedStreetTexture({ ...candidate, creator: null }),
    false,
  );
});

test('all existing providers carry distinct review requirements without inferred licences', () => {
  const records = ['mapillary', 'kartaview', 'panoramax', 'google'].map(
    (providerId) =>
      normalizeStreetPoseEvidence({
        ...opened().street,
        providerId,
        license: null,
      }),
  );
  assert.equal(
    new Set(records.map((e) => e.rights_policy.requirement)).size,
    4,
  );
  for (const record of records) {
    assert.equal(record.license_claim, null);
    assert.equal(record.rights_policy.automatic_download, false);
    assert.equal(record.altitude_reference, 'unknown');
    assert.ok(Object.isFrozen(record.rights_policy));
  }
});

test('invalid heading is unknown and cannot suggest a flat image sees the target', () => {
  for (const bearing of [null, NaN, Infinity, -1, 361, '90']) {
    const record = normalizeStreetPoseEvidence({ ...opened().street, bearing });
    assert.equal(record.bearing_deg, null);
    assert.equal(
      proposeStreetFacade(record, { lon: -112.0773, lat: 33.44865 })
        .might_show_target,
      false,
    );
  }
  assert.equal(
    normalizeStreetPoseEvidence({ ...opened().street, bearing: 360 })
      .bearing_deg,
    0,
  );
  assert.throws(() =>
    proposeStreetFacade({ location: { lon: 181, lat: 0 } }, { lon: 0, lat: 0 }),
  );
});

test('dateline neighbours remain near and malformed source links remain unknown', () => {
  const evidence = normalizeStreetPoseEvidence({
    ...opened().street,
    position: { lon: 179.999, lat: 0 },
    bearing: 90,
  });
  const proposal = proposeStreetFacade(evidence, { lon: -179.999, lat: 0 });
  assert.equal(proposal.might_show_target, true);
  assert.ok(proposal.distance_m < 225);
  for (const externalUrl of [
    'https://',
    'https://user:password@example.org/a',
    'http://example.org',
  ]) {
    assert.equal(
      normalizeStreetPoseEvidence({ ...opened().street, externalUrl })
        .source_url,
      null,
    );
  }
});
