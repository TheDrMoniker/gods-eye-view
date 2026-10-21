import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('reconstruction LiDAR sampler declares independent sources and gated identity', async () => {
  const code = await readFile(
    new URL('../../scripts/phoenix-city-hall-lidar.py', import.meta.url),
    'utf8',
  );
  assert.match(code, /AZ_MaricopaPinal_1_2020/);
  assert.match(code, /gods-eye-roof-lidar-evidence\/1/);
  assert.match(code, /EPSG:26912/);
  assert.match(code, /EPSG:3857/);
  assert.match(code, /MAX_NODE_COUNT = 140/);
  assert.match(code, /LIDAR_EVIDENCE_MEASURED_HOLD/);
  assert.match(code, /BUILDING_GROUP = 52520/);
  assert.doesNotMatch(code, /googleapis\.com|maps\.google\.com|earth\.google\.com/);
});
