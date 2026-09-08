import {test} from 'node:test'
import assert from 'node:assert/strict'
import {contentBounds} from './crop.ts'
test('trims transparent margins preserving faint pixels, internal holes and input',()=>{
 const data=new Uint8ClampedArray(7*6*4)
 data[(2*7+1)*4+3]=1;data[(4*7+5)*4+3]=255
 // RGB in fully transparent pixels must not expand bounds.
 data[0]=255
 const original=data.slice()
 assert.deepEqual(contentBounds(data,7,6),{x:1,y:2,width:5,height:3})
 assert.deepEqual(data,original)
 assert.equal(data[(3*7+3)*4+3],0)
})
test('empty, full and single pixel content are handled without zero-sized crops',()=>{
 assert.equal(contentBounds(new Uint8ClampedArray(16),2,2),null)
 assert.deepEqual(contentBounds(new Uint8ClampedArray(16).fill(255),2,2),{x:0,y:0,width:2,height:2})
 const data=new Uint8ClampedArray(16);data[15]=255
 assert.deepEqual(contentBounds(data,2,2),{x:1,y:1,width:1,height:1})
})
