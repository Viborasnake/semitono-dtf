import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hitGangAsset} from './gang-selection.ts'
test('selects normal and rotated copies using output pixel coordinates',()=>{
  const items=[{id:'a',widthCm:2.54,heightCm:5.08}]
  const normal={id:'a',x:2.54,y:2.54,width:2.54,height:5.08,rotated:false}
  assert.equal(hitGangAsset(150,250,[normal],items,100),'a')
  assert.equal(hitGangAsset(250,150,[normal],items,100),null)
  assert.equal(hitGangAsset(250,150,[{...normal,rotated:true}],items,100),'a')
  assert.equal(hitGangAsset(0,0,[normal],items,100),null)
  assert.equal(hitGangAsset(200,150,[normal],items,100),null)
})
