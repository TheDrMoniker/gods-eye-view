import * as Cesium from 'cesium';
import { addLocalResearchBuildingPreview } from '../src/reconstruction/preview.js';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const status = document.querySelector('#status');
const setStatus = (value) => {
  status.textContent = value;
};
function makeGlb() {
  // Research smoke test only: synthetic 20m x 16m x 94.71m cuboid. No source geometry.
  const vert = new Float32Array([
    -10, 0, -8, 10, 0, -8, 10, 0, 8, -10, 0, 8, -10, 94.71, -8, 10, 94.71, -8,
    10, 94.71, 8, -10, 94.71, 8,
  ]);
  const index = new Uint16Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
    3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]);
  const binary = new Uint8Array(vert.byteLength + index.byteLength);
  binary.set(new Uint8Array(vert.buffer), 0);
  binary.set(new Uint8Array(index.buffer), vert.byteLength);
  const doc = {
    asset: { version: '2.0', generator: 'GodsEye-QA-Synthetic' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.75, 0.05, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        doubleSided: true,
      },
    ],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vert.byteLength, target: 34962 },
      {
        buffer: 0,
        byteOffset: vert.byteLength,
        byteLength: index.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
        min: [-10, 0, -8],
        max: [10, 94.71, 8],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: index.length,
        type: 'SCALAR',
      },
    ],
  };
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const jlen = Math.ceil(json.length / 4) * 4;
  const blen = Math.ceil(binary.length / 4) * 4;
  const glb = new Uint8Array(12 + 8 + jlen + 8 + blen);
  const dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, glb.byteLength, true);
  dv.setUint32(12, jlen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glb.fill(32, 20, 20 + jlen);
  glb.set(json, 20);
  const offset = 20 + jlen;
  dv.setUint32(offset, blen, true);
  dv.setUint32(offset + 4, 0x004e4942, true);
  glb.set(binary, offset + 8);
  return glb;
}
try {
  Cesium.Ion.defaultAccessToken = '';
  const viewer = new Cesium.Viewer('map', {
    baseLayer: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    baseLayerPicker: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: false,
    requestRenderMode: false,
  });
  viewer.scene.globe.show = false;
  const lon = -112.0773,
    lat = 33.44865,
    height = 331.2;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      lon - 0.0014,
      lat - 0.0014,
      height + 280,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(45),
      pitch: Cesium.Math.toRadians(-22),
      roll: 0,
    },
  });
  const real = new URLSearchParams(location.search).get('fixture') === 'real';
  const manifest = real
    ? await (
        await fetch('/output/reconstruction/phoenix-city-hall-candidate.json')
      ).json()
    : null;
  if (
    real &&
    (manifest.status !== 'GEOMETRY_CANDIDATE_UNCERTIFIED' ||
      manifest.rights?.approved_for_public_release !== false ||
      manifest.textures?.length !== 0)
  )
    throw new Error('Unsafe real GLB manifest');
  const modelBytes = real
    ? new Uint8Array(
        await (
          await fetch('/output/reconstruction/phoenix-city-hall-candidate.glb')
        ).arrayBuffer(),
      )
    : makeGlb();
  const actualLon = real ? manifest.origin_wgs84_lon_lat[0] : lon;
  const actualLat = real ? manifest.origin_wgs84_lon_lat[1] : lat;
  const url = URL.createObjectURL(
    new Blob([modelBytes], { type: 'model/gltf-binary' }),
  );
  const preview = await addLocalResearchBuildingPreview({
    Cesium,
    viewer,
    glbUrl: url,
    originLon: actualLon,
    originLat: actualLat,
    originEllipsoidalHeightM: height,
    localResearchOnly: true,
  });
  viewer.camera.lookAt(
    Cesium.Cartesian3.fromDegrees(actualLon, actualLat, height + 50),
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(35),
      Cesium.Math.toRadians(-18),
      320,
    ),
  );
  const result = {
    loading: true,
    ready: preview.model.ready,
    globe: viewer.scene.globe.show,
    scene: viewer.scene.primitives.length,
    modelMatrix: Cesium.Matrix4.toArray(preview.model.modelMatrix),
    glbBytes: modelBytes.byteLength,
    fixture: real ? 'local_unverified_source_geometry' : 'synthetic',
    heightPlacement: 'test_only_not_verified',
  };
  window.__reconQa = {
    viewer,
    preview,
    url,
    result,
    dispose() {
      preview.dispose();
      URL.revokeObjectURL(url);
      viewer.destroy();
    },
  };
  setStatus('Model inserted: ' + JSON.stringify(result));
} catch (err) {
  window.__reconQa = { error: String(err), stack: err?.stack };
  setStatus('ERROR ' + String(err));
  console.error(err);
}
