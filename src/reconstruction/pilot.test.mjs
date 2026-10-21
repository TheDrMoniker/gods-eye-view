import assert from 'node:assert/strict';
import test from 'node:test';
import { createGodsEyeStreetReconPilot } from './pilot.js';

function harness() {
  const listeners = new Set(), models = [];
  const streetLevel = {
    getUIState() {return {enabled:true,street:{open:true,loading:false,
      providerId:'panoramax',imageId:'id-1',position:{lon:-112.07,lat:33.448},
      externalUrl:'https://example.org/p/1'}};},
    subscribe(listener) {listeners.add(listener);return ()=>listeners.delete(listener);},
  };
  const Cesium = {
    Axis:{Y:'Y'},
    Cartesian3:{fromDegrees:(...x)=>x},
    Transforms:{eastNorthUpToFixedFrame:x=>x},
    Model:{fromGltfAsync:async options=>({options})},
  };
  const viewer = {scene:{primitives:{
    add:model=>{models.push(model);return model;},
    remove:model=>{const i=models.indexOf(model);if(i>=0)models.splice(i,1);return true;},
  }}};
  return {streetLevel,Cesium,viewer,listeners,models};
}
const manifest={status:'GEOMETRY_CANDIDATE_UNCERTIFIED',
  rights:{approved_for_public_release:false},textures:[],
  origin_wgs84_lon_lat:[-112.0773,33.44865]};

test('joins real Street Level subscription with optional model and owned cleanup',async()=>{
  const h=harness(), observations=[];
  const pilot=createGodsEyeStreetReconPilot({streetLevel:h.streetLevel,
    viewer:h.viewer,Cesium:h.Cesium,onPhotoCandidate:photo=>observations.push(photo)});
  assert.equal(pilot.startStreetEvidence(),true);
  assert.equal(pilot.startStreetEvidence(),false);
  assert.equal(observations.length,1);
  assert.equal(observations[0].texture_approved,false);
  assert.equal(h.listeners.size,1);
  const model=await pilot.showResearchMassing({
    glbUrl:'blob:local',manifest,originEllipsoidalHeightM:338});
  assert.ok(model);
  assert.equal(h.models.length,1);
  pilot.dispose();
  assert.equal(h.models.length,0);
  assert.equal(h.listeners.size,0);
  assert.throws(()=>pilot.startStreetEvidence(),/disposed/);
});
test('local path never handles textured or publish-ready manifests',async()=>{
  const h=harness();
  const pilot=createGodsEyeStreetReconPilot({streetLevel:h.streetLevel,
    viewer:h.viewer,Cesium:h.Cesium});
  await assert.rejects(pilot.showResearchMassing({
    glbUrl:'blob:local',manifest:{...manifest,textures:[{image:'a'}]},
    originEllipsoidalHeightM:338,
  }),/untextured/);
  await assert.rejects(pilot.showResearchMassing({
    glbUrl:'blob:local',
    manifest:{...manifest,rights:{approved_for_public_release:true}},
    originEllipsoidalHeightM:338,
  }),/untextured/);
  pilot.dispose();
});
test('dispose during asynchronous model creation leaves no orphan primitive',async()=>{
  const h=harness();
  let resolveLoad;
  h.Cesium.Model.fromGltfAsync=()=>new Promise(resolve=>{resolveLoad=resolve;});
  const pilot=createGodsEyeStreetReconPilot({streetLevel:h.streetLevel,
    viewer:h.viewer,Cesium:h.Cesium});
  const request=pilot.showResearchMassing({
    glbUrl:'blob:local',manifest,originEllipsoidalHeightM:338});
  pilot.dispose();
  resolveLoad({model:true});
  assert.equal(await request,null);
  assert.equal(h.models.length,0);
});
