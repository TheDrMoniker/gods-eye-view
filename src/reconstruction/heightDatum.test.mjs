import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateEllipsoidHeight } from './heightDatum.js';

test('documented GEOID18 undulation converts NAVD88 to candidate NAD83 ellipsoid height', () => {
  const a = candidateEllipsoidHeight({ orthometricHeightM: 331.204, geoidUndulationM: -29.928, geoidModel: 'GEOID18', sourceDatum: 'NAVD88' });
  assert.equal(a.candidateNad83EllipsoidHeightM, 301.276);
  assert.equal(a.wgs84TransformCertified, false);
  assert.equal(a.measuredControlPointCertified, false);
});
test('source datum and geoid must match source metadata', () => {
  assert.throws(() => candidateEllipsoidHeight({ orthometricHeightM: 331.204, geoidUndulationM: -29.928, geoidModel: 'EGM96', sourceDatum: 'NAVD88' }));
  assert.throws(() => candidateEllipsoidHeight({ orthometricHeightM: NaN, geoidUndulationM: -29.928, geoidModel: 'GEOID18', sourceDatum: 'NAVD88' }));
});
