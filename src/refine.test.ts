import test from 'node:test'
import assert from 'node:assert/strict'
import {applyColorCorrection,flattenSelectedColor,removeSmallParticles, removeTinyDots, smoothRgba} from './refine.ts'

test('removes only alpha islands smaller than the configured area', () => {
  const data = new Uint8ClampedArray(5 * 3 * 4)
  const ink = (x:number,y:number) => { const i=(y*5+x)*4; data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=255 }
  ink(0,0); ink(1,0); ink(4,2)
  removeSmallParticles(data,5,3,2)
  assert.equal(data[3],255)
  assert.equal(data[(2*5+4)*4+3],0)
})

test('removes tiny dots but keeps a larger opaque dot', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (const p of [0, 1, 4, 5]) { data[p*4]=255; data[p*4+1]=255; data[p*4+2]=255; data[p*4+3]=255 }
  data[15]=255
  removeTinyDots(data,4,4,2)
  assert.equal(data[3],255)
  assert.equal(data[15],0)
})

test('zero-radius smoothing returns the original buffer', () => {
  const data = new Uint8ClampedArray([1,2,3,255])
  assert.equal(smoothRgba(data,1,1,0),data)
})

test('flattens only colors inside the selected tolerance and preserves alpha', () => {
  const data = new Uint8ClampedArray([250,250,250,90, 210,190,180,140])
  const out = flattenSelectedColor(data, '#ffffff', 12)
  assert.deepEqual(Array.from(out), [255,255,255,90, 210,190,180,140])
})

test('color correction brush changes only its mask and preserves alpha', () => {
  const data = new Uint8ClampedArray([10,20,30,80, 40,50,60,120])
  const out = applyColorCorrection(data, new Uint8Array([1,0]), '#ffffff', 100)
  assert.deepEqual(Array.from(out), [255,255,255,80, 40,50,60,120])
})
