import {test} from 'node:test'
import assert from 'node:assert/strict'
import {absoluteAssetUrl,paddedTileSize,sampleUpscaledEdge,sourceIsNeutral,useNeuralColor} from './neural-upscale.ts'

test('resolves Neural assets to absolute GitHub Pages URLs for workers',()=>{
  assert.equal(
    absoluteAssetUrl('/semitono-dtf/models/real_esrgan_x4.onnx','https://viborasnake.github.io'),
    'https://viborasnake.github.io/semitono-dtf/models/real_esrgan_x4.onnx',
  )
  assert.equal(
    absoluteAssetUrl('https://cdn.example.com/ort.wasm','https://viborasnake.github.io'),
    'https://cdn.example.com/ort.wasm',
  )
})

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

test('neural output gets smooth alpha and uncontaminated source colour at cutout edges',()=>{
  const source=new Uint8ClampedArray([240,20,160,255,0,0,0,0])
  const samples=Array.from({length:8},(_,x)=>sampleUpscaledEdge(source,2,1,x,0,4))
  assert.ok(samples.some(pixel=>pixel.a>0&&pixel.a<255))
  for(const pixel of samples)if(pixel.a>0){
    assert.equal(Math.round(pixel.r),240)
    assert.equal(Math.round(pixel.g),20)
    assert.equal(Math.round(pixel.b),160)
  }
  assert.equal(samples.at(-1)!.a,0)
})

test('near-opaque PNG ink uses Neural while translucent cutout edges retain source colour',()=>{
  for(const alpha of [248,250,251,252,253,254,255])assert.equal(useNeuralColor(alpha),true)
  for(const alpha of [0,1,128,240,247])assert.equal(useNeuralColor(alpha),false)
})
