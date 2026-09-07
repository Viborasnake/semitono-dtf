import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resizeRgba} from './resample.ts'
test('200/300/400 percent resize keeps flat color and exact dimensions',()=>{
  const source=new Uint8ClampedArray(8*12*4)
  for(let i=0;i<source.length;i+=4)source.set([120,70,230,255],i)
  for(const n of [2,3,4]){
    const out=resizeRgba(source,8,12,8*n,12*n)
    assert.equal(out.length,8*12*n*n*4)
    for(let i=0;i<out.length;i+=4)assert.deepEqual(Array.from(out.slice(i,i+4)),[120,70,230,255])
  }
})
test('transparent black does not darken colored edges when enlarged',()=>{
  const source=new Uint8ClampedArray([255,30,20,255,0,0,0,0])
  const out=resizeRgba(source,2,1,8,4)
  for(let i=0;i<out.length;i+=4)if(out[i+3])assert.equal(out[i],255)
})
