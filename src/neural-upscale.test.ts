import {test} from 'node:test'
import assert from 'node:assert/strict'
import {paddedTileSize,sourceIsNeutral} from './neural-upscale.ts'

test('neural color cleanup applies to monochrome artwork but preserves colored ink',()=>{
  assert.equal(sourceIsNeutral(255,255,255),true)
  assert.equal(sourceIsNeutral(63,58,60),true)
  assert.equal(sourceIsNeutral(25,5,3),true)
  assert.equal(sourceIsNeutral(255,0,0),false)
  assert.equal(sourceIsNeutral(80,20,10),false)
})

test('neural edge tiles have model-compatible dimensions without shrinking their content',()=>{
  for(const scale of [2,4] as const)for(const core of [1,239,255,256,257,512]){
    const padded=paddedTileSize(core,scale)
    assert.equal(padded%scale,0)
    assert.ok(padded>=core+32)
    assert.ok(padded<core+32+scale)
  }
})
