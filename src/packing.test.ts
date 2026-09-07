import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pack} from './packing.ts'
test('gang sheet copies respect margins, bounds and do not overlap',()=>{
  const result=pack([{id:'a',widthCm:10,heightCm:15,quantity:8},{id:'b',widthCm:6,heightCm:4,quantity:6}],58,100,.5,true)
  assert.equal(result.missing,0);assert.equal(result.placements.length,14)
  for(const p of result.placements){assert.ok(p.x>=.5&&p.y>=.5&&p.x+p.width<=57.5&&p.y+p.height<=99.5)}
  for(let i=0;i<result.placements.length;i++)for(let j=i+1;j<result.placements.length;j++){
    const a=result.placements[i],b=result.placements[j]
    assert.ok(a.x+a.width+.5<=b.x||b.x+b.width+.5<=a.x||a.y+a.height+.5<=b.y||b.y+b.height+.5<=a.y)
  }
})
test('unfitted copies are counted and invalid quantities rejected',()=>{
  assert.equal(pack([{id:'x',widthCm:20,heightCm:20,quantity:2}],10,10,0,true).missing,2)
  assert.throws(()=>pack([{id:'x',widthCm:2,heightCm:2,quantity:1.5}],10,10,0,true))
})
