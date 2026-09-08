import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deflateSync,inflateSync} from 'node:zlib'
import {printSize,withPngDpi,inspectPng,withCanvasPrintProfile,resolutionCheck} from './print.ts'
function crc(bytes:Uint8Array){let v=~0;for(const b of bytes){v^=b;for(let k=0;k<8;k++)v=(v>>>1)^(-(v&1)&0xedb88320)}return (~v)>>>0}
function chunk(type:string,data:Uint8Array){const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length);b.write(type,4);b.set(data,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
const pixels=Buffer.from([0,255,0,0,0,0,255,0,255]) // one transparent and one opaque pixel
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',new Uint8Array())])
test('physical size uses DPI, proportional height and nearest pixel',()=>{
  assert.deepEqual(printSize(25.4,2,300),{width:3000,height:1500,widthCm:25.4,heightCm:12.7})
  assert.equal(printSize(30,2/3,300).height,5315)
  assert.equal(printSize(1024*4/300*2.54,2/3,300).height,6144)
  for(const n of [0,-1,NaN,Infinity,10000])assert.throws(()=>printSize(n,1,300))
})
test('PNG metadata supports 150/300/600 ppp without touching RGBA pixels',()=>{
  for(const dpi of [150,300,600]){
    const out=withPngDpi(png,dpi),info=inspectPng(out)
    assert.equal(info.width,2);assert.equal(info.height,1);assert.equal(info.colorType,6)
    assert.ok(Math.abs(info.dpi-dpi)<.02);assert.ok(Math.abs(info.dpiY-dpi)<.02)
    const b=Buffer.from(out),p=b.indexOf('IDAT'),len=b.readUInt32BE(p-4)
    assert.deepEqual(inflateSync(b.subarray(p+4,p+4+len)),pixels)
  }
})
test('existing DPI is replaced, corrupt PNG rejected',()=>{
  const out=withPngDpi(withPngDpi(png,96),300)
  assert.equal(Buffer.from(out).toString('latin1').split('pHYs').length-1,1)
  const bad=out.slice();bad[17]^=1;assert.throws(()=>inspectPng(bad))
})
test('sRGB print exports preserve pixels and replace conflicting profile labels',()=>{
 const profiled=Buffer.concat([png.subarray(0,33),chunk('iCCP',new Uint8Array([1,2,3])),png.subarray(33)])
 for(const dpi of [150,300,600]){
  const out=withCanvasPrintProfile(withCanvasPrintProfile(profiled,150),dpi)
  assert.equal(inspectPng(out).profile,'sRGB')
  assert.ok(Math.abs(inspectPng(out).dpiY-dpi)<.02)
  const b=Buffer.from(out),p=b.indexOf('IDAT'),length=b.readUInt32BE(p-4)
  assert.deepEqual(inflateSync(b.subarray(p+4,p+4+length)),pixels)
  assert.equal(b.includes(Buffer.from('iCCP')),false)
  assert.equal(b.toString('latin1').split('sRGB').length-1,1)
 }
})
test('all cross-DPI handoffs and changed print sizes require resampling warning',()=>{
 for(const source of [150,300,600])for(const target of [150,300,600]){
  const item={naturalWidth:source*10,naturalHeight:source*5,widthCm:25.4,heightCm:12.7}
  assert.equal(resolutionCheck(item,target).matches,source===target)
  assert.equal(resolutionCheck({...item,widthCm:50.8,heightCm:25.4},source).matches,false)
 }
 const item={naturalWidth:2953,naturalHeight:4430,widthCm:2953/300*2.54,heightCm:4430/300*2.54}
 assert.equal(resolutionCheck(item,300).matches,true)
})
