/**
 * Research-only visual preview for a locally generated City Hall candidate GLB.
 * Never registers a map source or changes God's Eye default provider.
 * Caller supplies a verified ellipsoidal terrain placement; LiDAR Z is not
 * silently interpreted as WGS84 ellipsoidal elevation.
 */
export async function addLocalResearchBuildingPreview({
  Cesium,
  viewer,
  glbUrl,
  originLon,
  originLat,
  originEllipsoidalHeightM,
  localResearchOnly = false,
} = {}) {
  if (localResearchOnly !== true)
    throw new Error(
      'Unreviewed building geometry: explicit research preview only',
    );
  if (
    typeof glbUrl !== 'string' ||
    /[\\\s\u0000-\u001f]/.test(glbUrl) ||
    !(
      glbUrl.startsWith('blob:') ||
      (glbUrl.startsWith('/') &&
        !glbUrl.startsWith('//') &&
        !glbUrl.includes('..'))
    )
  )
    throw new TypeError('Use a local GLB Blob URL or same-origin path');
  if (
    !Number.isFinite(originLon) ||
    Math.abs(originLon) > 180 ||
    !Number.isFinite(originLat) ||
    Math.abs(originLat) > 90 ||
    !Number.isFinite(originEllipsoidalHeightM)
  )
    throw new TypeError(
      'Valid lon/lat and ellipsoidal terrain height required',
    );
  if (
    !viewer?.scene?.primitives?.add ||
    !viewer?.scene?.primitives?.remove ||
    !Cesium?.Transforms?.eastNorthUpToFixedFrame ||
    !Cesium?.Cartesian3?.fromDegrees ||
    !Cesium?.Model?.fromGltfAsync
  )
    throw new TypeError(
      'Cesium viewer with a Model primitive collection required',
    );

  // GLB was authored with X=east, Y=up, Z=south; Cesium applies its Y-up
  // GLTF-to-fixed-frame transform before the ENU modelMatrix.
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(
      originLon,
      originLat,
      originEllipsoidalHeightM,
    ),
  );
  const model = await Cesium.Model.fromGltfAsync({
    url: glbUrl,
    modelMatrix,
    upAxis: Cesium.Axis?.Y,
  });
  viewer.scene.primitives.add(model);
  let closed = false;
  return {
    model,
    dispose() {
      if (closed) return;
      closed = true;
      viewer.scene.primitives.remove(model);
    },
  };
}
