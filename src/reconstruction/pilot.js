/**
 * Opt-in God’s Eye street-and-building research pilot.
 * Joins the existing Street Level layer snapshot interface to a local-only
 * neutral geometry preview. Does not add map sources or download imagery.
 */
import { captureStreetLevelEvidence } from '../sources/streetEvidence.js';
import { addLocalResearchBuildingPreview } from './preview.js';

export function createGodsEyeStreetReconPilot({
  streetLevel,
  Cesium,
  viewer,
  onPhotoCandidate = () => {},
} = {}) {
  if (!streetLevel?.subscribe || !streetLevel?.getUIState)
    throw new TypeError('Existing Street Level layer is required');
  if (typeof onPhotoCandidate !== 'function')
    throw new TypeError('Photo candidate receiver must be a function');
  let captureStop = null;
  let installedModel = null;
  let disposed = false;
  let generation = 0;

  return {
    startStreetEvidence() {
      if (disposed) throw new Error('Pilot disposed');
      if (captureStop) return false;
      captureStop = captureStreetLevelEvidence(streetLevel, onPhotoCandidate);
      return true;
    },
    stopStreetEvidence() {
      captureStop?.();
      captureStop = null;
    },
    async showResearchMassing({
      glbUrl,
      manifest,
      originEllipsoidalHeightM,
    } = {}) {
      if (disposed) throw new Error('Pilot disposed');
      if (manifest?.status !== 'GEOMETRY_CANDIDATE_UNCERTIFIED' ||
          manifest?.rights?.approved_for_public_release !== false ||
          (manifest?.textures?.length ?? 0) !== 0 ||
          !Array.isArray(manifest?.origin_wgs84_lon_lat) ||
          manifest.origin_wgs84_lon_lat.length !== 2)
        throw new Error('Only an uncertified untextured local massing manifest is allowed');
      const ticket = ++generation;
      const newModel = await addLocalResearchBuildingPreview({
        Cesium, viewer, glbUrl,
        originLon: manifest.origin_wgs84_lon_lat[0],
        originLat: manifest.origin_wgs84_lon_lat[1],
        originEllipsoidalHeightM,
        localResearchOnly: true,
      });
      if (disposed || generation !== ticket) {
        newModel.dispose();
        return null;
      }
      installedModel?.dispose();
      installedModel = newModel;
      return newModel.model;
    },
    hideResearchMassing() {
      generation += 1;
      installedModel?.dispose();
      installedModel = null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      captureStop?.();
      captureStop = null;
      installedModel?.dispose();
      installedModel = null;
    },
  };
}
