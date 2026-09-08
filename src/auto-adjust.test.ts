import {test} from 'node:test'
import assert from 'node:assert/strict'
import {autoAdjust} from './auto-adjust.ts'
const settings={background:'none' as const,tolerance:25,whiteCutoff:245}
test('disabled corrections leave original bytes unchanged',()=>{
  const data=new Uint8ClampedArray([40,60,80,127])
  assert.equal(autoAdjust(data,settings),data)
})
test('auto tone stretches each channel independently without modifying alpha or input',()=>{
  const data=new Uint8ClampedArray([50,70,90,255,100,120,140,128,150,170,190,255])
  const before=data.slice(),out=autoAdjust(data,{...settings,autoTone:true})
  assert.deepEqual(Array.from(out),[0,0,0,255,128,128,128,128,255,255,255,255])
  assert.deepEqual(data,before)
})
test('auto contrast uses a shared range rather than neutralizing channels',()=>{
  const out=autoAdjust(new Uint8ClampedArray([50,70,90,255,150,170,190,255]),{...settings,autoContrast:true})
  assert.equal(out[0],0);assert.equal(out[6],255)
  assert.ok(out[0]<out[1]&&out[1]<out[2])
})
test('auto color reduces a warm cast on near-neutral midtones',()=>{
  const out=autoAdjust(new Uint8ClampedArray([150,120,110,255]),{...settings,autoColor:true})
  assert.ok(Math.max(out[0],out[1],out[2])-Math.min(out[0],out[1],out[2])<=1)
})
test('transparent data and removed backgrounds are excluded and preserved',()=>{
  const data=new Uint8ClampedArray([255,0,255,0,10,10,10,255,50,70,90,255,150,170,190,255])
  const out=autoAdjust(data,{...settings,background:'black',autoTone:true,autoContrast:true,autoColor:true})
  assert.deepEqual(out.slice(0,8),data.slice(0,8))
})
test('flat saturated graphics are not treated as neutral color references',()=>{
  const data=new Uint8ClampedArray([255,20,0,255])
  assert.deepEqual(autoAdjust(data,{...settings,autoColor:true,autoTone:true}),data)
})
