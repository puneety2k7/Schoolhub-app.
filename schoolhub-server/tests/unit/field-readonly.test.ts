import {describe,expect,it} from 'vitest';
import {assertWritableOperationalFieldKeys} from '../../src/routes/operational-workspaces.js';

describe('operational field write enforcement',()=>{
 it('denies a read-only field even when the caller has reached the tab EDIT path',()=>{
  const fields=[{fieldKey:'editable',configuration:{}},{fieldKey:'locked',configuration:{readOnly:true}}];
  expect(()=>assertWritableOperationalFieldKeys({editable:'ok'},fields)).not.toThrow();
  expect(()=>assertWritableOperationalFieldKeys({locked:'changed'},fields)).toThrowError(expect.objectContaining({code:'CUSTOM_FIELD_NOT_WRITABLE'}));
 });
});
