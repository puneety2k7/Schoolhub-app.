import {describe,expect,it} from 'vitest';
import {DEFAULT_EXPERIMENTAL_FEATURES,gridTabAvailable,mayManageExperimentalFeatures,normalizeExperimentalFeatures} from '../../src/services/experimental-features.js';

describe('experimental features',()=>{
 it('keeps Grid tabs off by default and accepts only an explicit true value',()=>{
  expect(normalizeExperimentalFeatures(undefined)).toEqual(DEFAULT_EXPERIMENTAL_FEATURES);
  expect(normalizeExperimentalFeatures({gridTabs:'true',version:4})).toEqual({gridTabs:false,version:4});
  expect(normalizeExperimentalFeatures({gridTabs:true,version:2})).toEqual({gridTabs:true,version:2});
 });
 it('always permits Main while gating every Grid tab',()=>{
  expect(gridTabAvailable({gridTabs:false},'MAIN')).toBe(true);
  for(const tab of ['GRID_1','GRID_2','GRID_3'])expect(gridTabAvailable({gridTabs:false},tab)).toBe(false);
  for(const tab of ['MAIN','GRID_1','GRID_2','GRID_3'])expect(gridTabAvailable({gridTabs:true},tab)).toBe(true);
 });
 it('allows only the exact System Administrator recovery principal to manage the toggle',()=>{
  expect(mayManageExperimentalFeatures({systemRecovery:true})).toBe(true);
  expect(mayManageExperimentalFeatures({systemRecovery:false})).toBe(false);
  expect(mayManageExperimentalFeatures({systemRecovery:undefined})).toBe(false);
 });
});
