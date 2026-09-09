import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyProject} from './project-storage.ts'
import {parseProject} from './project-file.ts'
test('named empty projects are valid portable projects before importing artwork',()=>{
  const p=emptyProject('  Mi trabajo.trama.json  ')
  assert.equal(p.name,'Mi trabajo');assert.deepEqual(parseProject(JSON.stringify(p)),p)
  assert.equal(p.sheet.dpi,300);assert.deepEqual(p.items,[])
  assert.throws(()=>emptyProject(' .trama.json '))
})
