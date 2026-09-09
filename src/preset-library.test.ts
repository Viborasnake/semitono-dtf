import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renamePersonalPreset,deletePersonalPreset} from './preset-library.ts'
const library=[{id:'saved:a',name:'Uno',settings:{gamma:1}},{id:'saved:b',name:'Dos',settings:{gamma:1.2}}]
test('renaming keeps stable IDs/settings and does not mutate the library',()=>{
  const next=renamePersonalPreset(library,'saved:a','  Foto suave ')
  assert.equal(next[0].name,'Foto suave');assert.equal(next[0].id,'saved:a')
  assert.deepEqual(next[0].settings,library[0].settings);assert.equal(library[0].name,'Uno')
  assert.throws(()=>renamePersonalPreset(library,'saved:a','dos'))
  assert.throws(()=>renamePersonalPreset(library,'saved:a',' '))
  assert.throws(()=>renamePersonalPreset(library,'default','Nuevo'))
})
test('deleting touches only the selected personal preset',()=>{
  assert.deepEqual(deletePersonalPreset(library,'saved:a'),[library[1]])
  assert.equal(library.length,2)
  assert.throws(()=>deletePersonalPreset(library,'default'))
  assert.throws(()=>deletePersonalPreset(library,'saved:missing'))
})
