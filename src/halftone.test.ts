import { test } from 'node:test'
import assert from 'node:assert/strict'
import { halftone } from './halftone.ts'
import type { HalftoneSettings } from './halftone.ts'
const settings: HalftoneSettings = { lpi: 30, angle: 22.5, shape: 'circle', size: 100, contrast: 100, brightness: 100, whiteCutoff: 245, preserveColor: true, invert: false, background: 'black', tolerance: 25 }
function image(r: number, g: number, b: number, a = 255) {
  const data = new Uint8ClampedArray(64 * 64 * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, a], i)
  return data
}
test('black and near-black backgrounds are truly transparent', () => {
  for (const tone of [0, 12, 25]) {
    const result = halftone(image(tone, tone, tone), 64, 64, settings)
    assert.equal(result.transparent, 100)
    assert.ok(result.data.every(v => v === 0))
  }
})
test('white detail and saturated red survive black removal', () => {
  for (const rgb of [[255,255,255], [255,0,0]]) {
    const result = halftone(image(rgb[0],rgb[1],rgb[2]), 64, 64, settings)
    assert.equal(result.transparent, 0)
    assert.deepEqual(Array.from(result.data.slice(0,4)), [...rgb,255])
  }
})
test('midtones contain holes and unmatted bright ink', () => {
  const result = halftone(image(110,110,110), 64, 64, settings)
  assert.ok(result.transparent > 10 && result.transparent < 90)
  for (let i=0; i<result.data.length; i+=4) if(result.data[i+3]) assert.equal(result.data[i],255)
})
test('white mode removes white and keeps black', () => {
  const s = {...settings, background: 'white' as const}
  assert.equal(halftone(image(255,255,255),64,64,s).transparent,100)
  assert.equal(halftone(image(0,0,0),64,64,s).transparent,0)
})
test('original transparent pixels never acquire ink', () => {
  assert.equal(halftone(image(255,255,255,0),64,64,settings).transparent,100)
})
test('edge trim deletes outer border without changing canvas size',()=>{
  const result=halftone(image(255,255,255),64,64,{...settings,trimMm:1,featherMm:2})
  assert.equal(result.data.length,64*64*4)
  for(let x=0;x<64;x++)assert.equal(result.data[x*4+3],0)
  assert.equal(result.data[(32*64+32)*4+3],255)
})
test('edge controls only affect selected sides',()=>{
  const result=halftone(image(255,255,255),64,64,{...settings,trimMm:1,edgeSides:[true,false,false,false]})
  assert.equal(result.data[3],0)
  assert.equal(result.data[(63*64)*4+3],255)
})
test('disabled screening and no background removal preserve RGBA',()=>{
  const data=image(125,85,60,128)
  assert.deepEqual(halftone(data,64,64,{...settings,enabled:false,background:'none'}).data,data)
})
test('gamma opens up midtones monotonically for gradients',()=>{
  const source=image(110,110,110)
  const normal=halftone(source,64,64,settings)
  const lifted=halftone(source,64,64,{...settings,gamma:1.25})
  assert.ok(lifted.transparent<normal.transparent)
})
test('additional sharpness leaves flat colors unchanged',()=>{
  const source=image(200,100,50)
  assert.deepEqual(halftone(source,64,64,{...settings,sharpness:100}).data,halftone(source,64,64,settings).data)
})
