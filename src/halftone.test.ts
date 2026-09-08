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
test('connected white removal preserves enclosed fur, cream details and saturated ink',()=>{
  const data=image(250,248,245)
  // Closed dark border enclosing white fur and a cream highlight.
  for(let y=16;y<48;y++)for(let x=16;x<48;x++)data.set([20,15,10,255],(y*64+x)*4)
  for(let y=20;y<44;y++)for(let x=20;x<44;x++)data.set([255,255,255,255],(y*64+x)*4)
  data.set([245,236,210,255],(32*64+32)*4)
  data.set([235,25,15,255],(20*64+16)*4)
  for(const enabled of [true,false]){
    const out=halftone(data,64,64,{...settings,background:'white',whiteRemoval:'connected',whiteCutoff:242,solidAlpha:false,enabled}).data
    assert.equal(out[3],0)
    for(let y=16;y<48;y++)for(let x=16;x<48;x++)assert.deepEqual(out.slice((y*64+x)*4,(y*64+x)*4+4),data.slice((y*64+x)*4,(y*64+x)*4+4))
  }
  const all=halftone(data,64,64,{...settings,background:'white',whiteRemoval:'all',whiteCutoff:242}).data
  assert.equal(all[(30*64+30)*4+3],0)
})
test('white threshold affects only near-white regions reachable from an edge',()=>{
  const data=image(240,240,240)
  assert.equal(halftone(data,64,64,{...settings,background:'white',whiteRemoval:'connected',whiteCutoff:242}).transparent,0)
  assert.equal(halftone(data,64,64,{...settings,background:'white',whiteRemoval:'connected',whiteCutoff:235}).transparent,100)
  assert.equal(halftone(image(0,0,0,0),64,64,{...settings,background:'white',whiteRemoval:'connected'}).transparent,100)
})
test('connected white removal traverses transparent margins without removing colored interior',()=>{
  const data=image(0,0,0,0)
  for(let y=8;y<56;y++)for(let x=8;x<56;x++)data.set([255,255,255,255],(y*64+x)*4)
  data.set([230,20,15,255],(32*64+32)*4)
  const out=halftone(data,64,64,{...settings,background:'white',whiteRemoval:'connected'}).data
  assert.equal(out[(8*64+8)*4+3],0)
  assert.deepEqual(Array.from(out.slice((32*64+32)*4,(32*64+32)*4+4)),[230,20,15,255])
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
test('solid alpha exports opaque dots and transparent holes',()=>{
  const result=halftone(image(110,110,110),64,64,{...settings,solidAlpha:true})
  const alpha=new Set<number>()
  for(let i=3;i<result.data.length;i+=4)alpha.add(result.data[i])
  assert.ok(alpha.has(0));assert.ok(alpha.has(255));assert.equal([...alpha].some(a=>a>0&&a<255),false)
})
test('fractional alpha remains available when solid alpha is disabled',()=>{
  const result=halftone(image(110,110,110),64,64,{...settings,solidAlpha:false})
  const alpha=new Set<number>()
  for(let i=3;i<result.data.length;i+=4)alpha.add(result.data[i])
  assert.ok([...alpha].some(a=>a>0&&a<255))
})
test('solid alpha handles semitransparent originals with and without screening',()=>{
 for(const enabled of [true,false]){
  const data=image(255,0,0,100);data[3]=0
  const result=halftone(data,64,64,{...settings,enabled,solidAlpha:true})
  const alpha=Array.from(result.data).filter((_,i)=>i%4===3)
  assert.ok(alpha.includes(255));assert.ok(alpha.every(a=>a===0||a===255));assert.equal(alpha[0],0)
 }
 assert.equal(halftone(image(255,0,0,100),64,64,{...settings,enabled:false,solidAlpha:false}).data[3],100)
})
test('rounded corners retain quarter-circle interior instead of cutting squares',()=>{
 const result=halftone(image(255,255,255),64,64,{...settings,enabled:false,dpi:254,cornerRadiusMm:1})
 const alpha=(x:number,y:number)=>result.data[(y*64+x)*4+3]
 assert.equal(alpha(0,0),0);assert.equal(alpha(8,2),255);assert.equal(alpha(32,0),255)
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  assert.equal(alpha(x,y),alpha(63-x,y));assert.equal(alpha(x,y),alpha(x,63-y))
 }
 const count=Array.from(result.data).filter((v,i)=>i%4===3&&v===0).length
 assert.equal(result.transparent,Math.round(count/4096*100))
})
test('radius clamps on small artwork and empty artwork remains empty',()=>{
 assert.equal(halftone(image(255,255,255,0),64,64,{...settings,cornerRadiusMm:50}).transparent,100)
 const result=halftone(image(255,255,255),64,64,{...settings,enabled:false,cornerRadiusMm:50})
 assert.equal(result.data[3],0);assert.equal(result.data[(32*64+32)*4+3],255)
})
