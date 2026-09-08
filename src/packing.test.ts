import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pack} from './packing.ts'
test('uses the full inner sheet including trailing margins',()=>{
  const result=pack([{id:'exact',widthCm:57,heightCm:99,quantity:1}],58,100,.5,false)
  assert.equal(result.missing,0)
  assert.equal(result.usedHeight,100)
})
test('fits mixed poster sizes from the gang sheet without resizing',()=>{
  const items=[{id:'a',widthCm:25,heightCm:37.51,quantity:2},{id:'b',widthCm:25,heightCm:37.57,quantity:1},{id:'c',widthCm:19.7,heightCm:35.01,quantity:2}]
  const result=pack(items,58,100,.5,true)
  assert.equal(result.missing,0)
  assert.equal(result.placements.length,5)
  for(const p of result.placements) {
    assert.ok(p.x>=.5 && p.y>=.5 && p.x+p.width<=57.5+1e-8 && p.y+p.height<=99.5+1e-8)
  }
  for(let i=0;i<result.placements.length;i++)for(let j=i+1;j<result.placements.length;j++){
    const a=result.placements[i],b=result.placements[j]
    assert.ok(a.x+a.width+.5<=b.x+1e-8||b.x+b.width+.5<=a.x+1e-8||a.y+a.height+.5<=b.y+1e-8||b.y+b.height+.5<=a.y+1e-8)
  }
})
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
test('mixed designs reuse side gaps instead of stopping at the first row',()=>{
  const result=pack([{id:'large',widthCm:30,heightCm:35,quantity:2},{id:'small',widthCm:12,heightCm:12,quantity:5}],58,100,.5,true)
  assert.equal(result.missing,0)
  assert.equal(result.placements.length,7)
})
