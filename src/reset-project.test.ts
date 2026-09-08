import {test} from 'node:test'
import assert from 'node:assert/strict'
import {clearActiveProject} from './reset-project.ts'

test('new project clears only active sheet data and preserves presets',()=>{
  const values=new Map(['trama-dtf-gang-sheet-v1','trama-dtf-sheet-settings','trama-dtf-project-name','presets','other-app'].map(key=>[key,'saved']))
  clearActiveProject({removeItem:key=>{values.delete(key)}})
  assert.deepEqual([...values.keys()],['presets','other-app'])
  clearActiveProject({removeItem:key=>{values.delete(key)}})
  assert.equal(values.size,2)
})
test('storage errors propagate so the session is not silently reset',()=>{
  assert.throws(()=>clearActiveProject({removeItem:()=>{throw new Error('Denied')}}))
})
