/** Geoid-based candidate placement; not surveyed registration. */
export function candidateEllipsoidHeight({
  orthometricHeightM,
  geoidUndulationM,
  geoidModel,
  sourceDatum,
}) {
  if (
    !Number.isFinite(orthometricHeightM) ||
    !Number.isFinite(geoidUndulationM)
  )
    throw new TypeError(
      'Finite orthometric height and geoid undulation required',
    );
  if (geoidModel !== 'GEOID18' || sourceDatum !== 'NAVD88')
    throw new TypeError('Only documented NAVD88/GEOID18 conversion supported');
  return Object.freeze({
    candidateNad83EllipsoidHeightM:
      Math.round((orthometricHeightM + geoidUndulationM) * 1000) / 1000,
    equation: 'h = H + N',
    from: 'NAVD88 orthometric height with GEOID18 (NAD83(2011) reference)',
    wgs84TransformCertified: false,
    measuredControlPointCertified: false,
    // i18n-ignore: research state, not UI.
    status: 'UNVERIFIED_RESEARCH_ESTIMATE',
  });
}
