import test from 'node:test';
import assert from 'node:assert/strict';
import { addLocalResearchBuildingPreview } from './preview.js';

function harness() {
  const calls = [];
  const Cesium = {
    Axis: { Y: 'Y' },
    Cartesian3: {
      fromDegrees(...args) {
        calls.push(['fromDegrees', ...args]);
        return args;
      },
    },
    Transforms: {
      eastNorthUpToFixedFrame(position) {
        return { position };
      },
    },
    Model: {
      async fromGltfAsync(options) {
        calls.push(['load', options]);
        return options;
      },
    },
  };
  const viewer = {
    scene: {
      primitives: {
        add(value) {
          calls.push(['add', value]);
          return value;
        },
        remove(value) {
          calls.push(['remove', value]);
          return true;
        },
      },
    },
  };
  return { calls, Cesium, viewer };
}
test('never loads unreviewed geometry by default', async () => {
  const h = harness();
  await assert.rejects(
    addLocalResearchBuildingPreview({
      Cesium: h.Cesium,
      viewer: h.viewer,
      glbUrl: '/local/candidate.glb',
      originLon: -112.077,
      originLat: 33.448,
      originEllipsoidalHeightM: 300,
    }),
    /explicit research preview/,
  );
  assert.deepEqual(h.calls, []);
});
test('explicit local preview installs only one owned model and disposes once', async () => {
  const h = harness();
  const result = await addLocalResearchBuildingPreview({
    Cesium: h.Cesium,
    viewer: h.viewer,
    glbUrl: 'blob:local-preview',
    originLon: -112.077,
    originLat: 33.448,
    originEllipsoidalHeightM: 340,
    localResearchOnly: true,
  });
  assert.equal(h.calls[0][0], 'fromDegrees');
  assert.equal(h.calls[1][1].upAxis, 'Y');
  assert.equal(h.calls[2][0], 'add');
  result.dispose();
  result.dispose();
  assert.equal(h.calls.filter((x) => x[0] === 'remove').length, 1);
});
test('requires actual ellipsoidal terrain placement and blocks remote models', async () => {
  const h = harness();
  const base = {
    Cesium: h.Cesium,
    viewer: h.viewer,
    originLon: -112.077,
    originLat: 33.448,
    localResearchOnly: true,
  };
  await assert.rejects(
    addLocalResearchBuildingPreview({
      ...base,
      originEllipsoidalHeightM: null,
      glbUrl: '/candidate.glb',
    }),
    /terrain height/,
  );
  await assert.rejects(
    addLocalResearchBuildingPreview({
      ...base,
      originEllipsoidalHeightM: 300,
      glbUrl: 'https://example.org/mesh.glb',
    }),
    /local GLB/,
  );
});

test('protocol-relative URLs cannot bypass local-only asset policy', async () => {
  const h = harness();
  await assert.rejects(
    addLocalResearchBuildingPreview({
      Cesium: h.Cesium,
      viewer: h.viewer,
      glbUrl: '//outside.example/mesh.glb',
      originLon: -112.077,
      originLat: 33.448,
      originEllipsoidalHeightM: 340,
      localResearchOnly: true,
    }),
    /local GLB/,
  );
});
