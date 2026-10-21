/**
 * Research-only, explicit opt-in UI inside the actual God's Eye app.
 * Neither estimated geoid offset nor photo/geometry permission is inferred.
 * No third-party source geometry or image assets are bundled or published.
 */
import * as Cesium from 'cesium';
import { createGodsEyeStreetReconPilot } from './pilot.js';

export function createApplicationResearchPreview({
  application,
  document: doc = globalThis.document,
  fetchImpl = (...args) => globalThis.fetch(...args),
  CesiumLib = Cesium,
} = {}) {
  if (!application?.getComponents || !doc?.createElement)
    throw new TypeError('A live application and document are required');
  const components = application.getComponents();
  const viewer = components.scene?.viewer;
  const streetLevel = components.data?.catalog?.get?.('street-level');
  if (!viewer || !streetLevel)
    throw new Error('Actual application scene and Street Level must be ready');

  const panel = doc.createElement('section');
  panel.id = 'gev-reconstruction-research';
  // i18n-ignore: development-only research panel.
  panel.setAttribute('aria-label', 'City Hall research reconstruction');
  Object.assign(panel.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    zIndex: '2147483000',
    padding: '14px',
    width: '330px',
    maxWidth: 'calc(100vw - 48px)',
    background: 'rgba(4,18,32,.96)',
    color: '#e5f0ff',
    border: '1px solid #b0c0d0',
    borderRadius: '10px',
    font: '13px/1.5 system-ui',
    boxShadow: '0 8px 25px #0009',
  });
  // i18n-ignore: development-only research panel.
  panel.innerHTML = `<strong>God's Eye · City Hall research</strong>
    <div style="font-size:11px;color:#f6c76b">UNVERIFIED 2014 MASSING · NO LICENSED TEXTURES</div>
    <label for="gev-recon-height">Verified WGS84 ellipsoidal site height (m)</label>
    <input id="gev-recon-height" type="number" step="0.01" placeholder="Requires surveyed/geoid value" style="width:100%;box-sizing:border-box" />
    <div style="display:flex;gap:6px;margin-top:8px">
      <button type="button" data-action="load">Preview local GLB</button>
      <button type="button" data-action="hide">Hide</button>
      <button type="button" data-action="close">Close</button>
    </div>
    <div role="status" aria-live="polite" data-status style="font-size:11px;padding-top:8px">No model loaded. Review location and rights before public use.</div>`;
  doc.body.appendChild(panel);
  const status = panel.querySelector('[data-status]');
  const height = panel.querySelector('#gev-recon-height');
  const photos = [];
  const pilot = createGodsEyeStreetReconPilot({
    streetLevel,
    Cesium: CesiumLib,
    viewer,
    onPhotoCandidate: (record) => photos.push(record),
  });
  pilot.startStreetEvidence();
  let disposed = false;
  let currentBlobUrl = null;
  let generation = 0;
  const update = (message) => {
    if (!disposed) status.textContent = message;
  };
  function clearBlob() {
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
  async function previewLocalGLB() {
    if (disposed) throw new Error('Research panel disposed');
    const ellipsoidal = height.value.trim() === '' ? NaN : Number(height.value);
    if (!Number.isFinite(ellipsoidal)) {
      update('BLOCKED: independently established ellipsoidal height required.');
      return null;
    }
    const ticket = ++generation;
    update('Loading local rights-gated research model…');
    try {
      const [meta, modelFile] = await Promise.all([
        fetchImpl('/output/reconstruction/phoenix-city-hall-candidate.json'),
        fetchImpl('/output/reconstruction/phoenix-city-hall-candidate.glb'),
      ]);
      if (!meta.ok || !modelFile.ok)
        throw new Error(
          'Local GLB files unavailable; build --research-only first',
        );
      const manifest = await meta.json();
      if (
        manifest?.status !== 'GEOMETRY_CANDIDATE_UNCERTIFIED' ||
        manifest?.rights?.approved_for_public_release !== false ||
        !Array.isArray(manifest.textures) ||
        manifest.textures.length !== 0
      )
        throw new Error('Unsafe model rights manifest');
      const buffer = await modelFile.blob();
      if (buffer.size < 20 || buffer.size > 15000000)
        throw new Error('Invalid or oversized research model');
      if (disposed || ticket !== generation) return null;
      clearBlob();
      const url = URL.createObjectURL(
        new Blob([buffer], { type: 'model/gltf-binary' }),
      );
      currentBlobUrl = url;
      const model = await pilot.showResearchMassing({
        glbUrl: url,
        manifest,
        originEllipsoidalHeightM: ellipsoidal,
      });
      if (disposed || ticket !== generation || !model) return null;
      const [lon, lat] = manifest.origin_wgs84_lon_lat;
      viewer.camera.flyTo({
        destination: CesiumLib.Cartesian3.fromDegrees(
          lon,
          lat,
          ellipsoidal + 280,
        ),
        orientation: {
          heading: CesiumLib.Math.toRadians(12),
          pitch: CesiumLib.Math.toRadians(-45),
          roll: 0,
        },
        duration: 0,
      });
      update(
        'Research GLB visible in actual app. Height supplied, NOT independently certified.',
      );
      return model;
    } catch (error) {
      update('BLOCKED: ' + error.message);
      return null;
    }
  }
  const hide = () => {
    ++generation;
    pilot.hideResearchMassing();
    clearBlob();
    update('Model hidden.');
  };
  panel
    .querySelector('[data-action=load]')
    .addEventListener('click', previewLocalGLB);
  panel.querySelector('[data-action=hide]').addEventListener('click', hide);
  panel
    .querySelector('[data-action=close]')
    .addEventListener('click', () => api.dispose());
  const api = Object.freeze({
    panel,
    photos,
    previewLocalGLB,
    dispose() {
      if (disposed) return;
      disposed = true;
      ++generation;
      pilot.dispose();
      clearBlob();
      panel.remove();
    },
  });
  return api;
}
