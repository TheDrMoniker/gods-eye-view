import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverCommonsPhotos,
  licenseHint,
  normalizeCommonsPhoto,
} from './commons.js';
import {
  PHOENIX_CITY_HALL,
  isReviewedPhoto,
  makeBuildingEvidenceRegistry,
} from './planner.js';

const file = (id, title, license = 'CC BY-SA 4.0') => ({
  pageid: id,
  ns: 6,
  title: 'File:' + title,
  imageinfo: [{
    width: 5760,
    height: 3840,
    timestamp: '2020-01-01T00:00:00Z',
    extmetadata: {
      LicenseShortName: { value: license },
      LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      Artist: { value: '<a href="/wiki/User:Example">Example</a>' },
    },
  }],
});

test('Commons category discovery is bounded, sequential and metadata only', async () => {
  const calls = [];
  const payloads = [
    { query: { pages: [file(1, 'Phoenix_City_Hall_A.jpg')] },
      continue: { continue: 'gcmcontinue||', gcmcontinue: 'continue-1' } },
    { query: { pages: [file(2, 'Phoenix_City_Hall_B.jpg')] } },
  ];
  const discovery = await discoverCommonsPhotos({
    category: PHOENIX_CITY_HALL.commons_category,
    maxPages: 2,
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return new Response(JSON.stringify(payloads[calls.length - 1]), { status: 200 });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.hostname, 'commons.wikimedia.org');
  assert.equal(calls[0].url.searchParams.get('gcmtitle'),
    'Category:Phoenix City Hall');
  assert.equal(calls[0].url.searchParams.get('gcmlimit'), '10');
  assert.equal(calls[1].url.searchParams.get('gcmcontinue'), 'continue-1');
  assert.match(calls[0].options.headers['User-Agent'], /gods-eye-view/);
  assert.equal(discovery.total_candidates, 2);
  assert.equal(discovery.truncated, false);
  assert.equal(discovery.candidates[0].creator, 'Example');
  assert.equal(discovery.candidates[0].license.hint, 'potentially_reusable');
  assert.equal(discovery.candidates[0].license.status, 'needs_human_review');
  assert.equal(discovery.candidates[0].download_approved, false);
  assert.equal(discovery.candidates[0].reconstruction_approved, false);
  assert.equal(discovery.candidates[0].review.target_identity, 'unverified');
});

test('CC licenses are only hints; NC and missing licenses do not pass', () => {
  assert.equal(licenseHint('CC0'), 'potentially_reusable');
  assert.equal(licenseHint('CC BY 2.0'), 'potentially_reusable');
  assert.equal(licenseHint('CC BY-SA 3.0'), 'potentially_reusable');
  assert.equal(licenseHint('CC BY-NC-SA 4.0'), 'unknown_or_restricted');
  assert.equal(licenseHint(''), 'unknown_or_restricted');
  assert.equal(normalizeCommonsPhoto({ ns: 14, title: 'Category:Buildings' }), null);
});

test('rate limits surface Retry-After without hidden automatic retry', async () => {
  let calls = 0;
  await assert.rejects(
    () => discoverCommonsPhotos({
      category: PHOENIX_CITY_HALL.commons_category,
      fetchImpl: async () => {
        calls += 1;
        return new Response('rate limit', {
          status: 429,
          headers: { 'retry-after': '60' },
        });
      },
    }),
    (error) => error.status === 429 && error.retryAfter === '60',
  );
  assert.equal(calls, 1);
});

test('pagination truncation is explicit; malformed categories are rejected', async () => {
  const d = await discoverCommonsPhotos({
    category: PHOENIX_CITY_HALL.commons_category,
    maxPages: 1,
    fetchImpl: async () => new Response(JSON.stringify({
      query: { pages: [file(1, 'One.jpg')] },
      continue: { continue: 'gcmcontinue||', gcmcontinue: 'later' },
    }), { status: 200 }),
  });
  assert.equal(d.truncated, true);
  await assert.rejects(
    () => discoverCommonsPhotos({ category: 'Phoenix City Hall' }),
    /Category:/,
  );
});

test('a discovered image never counts as a verified building view', () => {
  const registry = makeBuildingEvidenceRegistry({
    discovery: {
      provider: 'wikimedia_commons',
      category: PHOENIX_CITY_HALL.commons_category,
      candidates: [normalizeCommonsPhoto(file(1, 'City_Hall.jpg'))],
    },
  });
  assert.equal(registry.status, 'EVIDENCE_INTAKE_HOLD');
  assert.equal(registry.summary.discovered_photo_candidates, 1);
  assert.equal(registry.summary.verified_licensed_photos, 0);
  assert.deepEqual(registry.summary.missing_surfaces,
    ['north', 'east', 'south', 'west', 'roof']);
  assert.equal(registry.summary.measured_footprint_available, false);
  assert.equal(registry.summary.reconstructed_mesh_exists, false);
});

test('only explicitly reviewed images and measured geometry update gaps', () => {
  const candidate = normalizeCommonsPhoto(file(2, 'Hall.jpg'));
  candidate.review = {
    target_identity: 'verified',
    rights: 'approved',
    view: 'north',
    camera_pose: 'unverified',
    reviewed_by: 'human-reviewer',
    reviewed_at: '2026-10-21T00:00:00Z',
  };
  assert.equal(isReviewedPhoto(candidate), false);
  candidate.reconstruction_approved = true;
  assert.equal(isReviewedPhoto(candidate), true);
  const registry = makeBuildingEvidenceRegistry({
    discovery: { provider: 'wikimedia_commons', candidates: [candidate] },
    footprint: {
      building_match: 'verified',
      rights: 'approved',
      datum: 'verified',
      source_url: 'https://example.org/footprint',
      reviewed_by: 'human-reviewer',
    },
  });
  assert.equal(registry.summary.verified_licensed_photos, 1);
  assert.deepEqual(registry.summary.observed_surfaces, ['north']);
  assert.deepEqual(registry.summary.missing_surfaces,
    ['east', 'south', 'west', 'roof']);
  assert.equal(registry.summary.measured_footprint_available, true);
  assert.equal(registry.summary.measured_lidar_available, false);
  assert.equal(registry.status, 'EVIDENCE_INTAKE_HOLD');
});
