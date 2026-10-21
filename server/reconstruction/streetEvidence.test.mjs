import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStreetPoseEvidence, mayTextureFromStreetEvidence } from './streetEvidence.js';
const pose = {providerId:'mapillary', imageId:'img-1',position:{lon:-112.077,lat:33.448},bearing:91,tilt:0,altitude:null,isPano:false,creator:'Photographer',license:'CC BY-SA 4.0',externalUrl:'https://www.mapillary.com/app/?pKey=img-1'};
test('StreetPose becomes evidence with no implicit texture rights',()=>{
 const x=normalizeStreetPoseEvidence(pose);
 assert.equal(x.location.lon,-112.077);assert.equal(x.bearing_deg,91);
 assert.equal(x.texture_approved,false);assert.equal(mayTextureFromStreetEvidence(x),false);
});
test('Google is always blocked for texture reuse',()=>{
 const x=normalizeStreetPoseEvidence({...pose,providerId:'google'});
 assert.equal(x.policy,'view_only_no_reconstruction');
 assert.equal(mayTextureFromStreetEvidence({...x,texture_approved:true,facade_id:'south',camera_calibration:'verified',review:{rights:'approved',identity:'verified'}}),false);
});
test('unknown provider and invalid coordinate fail closed',()=>{
 assert.throws(()=>normalizeStreetPoseEvidence({...pose,providerId:'other'}));
 assert.throws(()=>normalizeStreetPoseEvidence({...pose,position:{lon:190,lat:33}}));
});
test('only independently reviewed, calibrated non-Google facade evidence qualifies',()=>{
 const x=normalizeStreetPoseEvidence(pose);
 assert.equal(mayTextureFromStreetEvidence({...x,texture_approved:true,facade_id:'south',camera_calibration:'verified',review:{rights:'approved',identity:'verified'}}),true);
});
