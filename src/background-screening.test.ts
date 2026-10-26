import {test} from 'node:test'
import assert from 'node:assert/strict'
import {halftone,type HalftoneSettings} from './halftone.ts'
import {removeBackground} from './background-stage.ts'

const settings:HalftoneSettings={separateBackground:true,screenBase:'white',lpi:25,angle:22.5,shape:'circle',size:100,contrast:100,brightness:100,whiteCutoff:245,preserveColor:true,invert:false,background:'custom',customBase:'white',tolerance:25,colorRange:{colors:['#eeeecc'],tolerance:0,softness:0},enabled:true,solidAlpha:false}
function fixture(){const data=new Uint8ClampedArray(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++)data.set(x<16?[238,238,204,255]:x<32?[255,255,255,255]:[110,70,35,255],(y*64+x)*4);return data}
test('custom removal does not implicitly delete white or recolor retained ink when screening is off',()=>{
  const input=fixture(),out=halftone(input,64,64,{...settings,enabled:false,contrast:180,brightness:140,gamma:2,invert:true}).data
  assert.equal(out[3],0)
  for(let y=0;y<64;y++)for(let x=16;x<64;x++){const i=(y*64+x)*4;assert.deepEqual(out.slice(i,i+4),input.slice(i,i+4))}
})
test('explicit painted selection produces tonal dots even when the old scope was transitions',()=>{
  const input=fixture(),selected={colors:['#ffffff'],tolerance:0,softness:0,useColors:false,strokes:[{x:.7,y:0,toX:.7,toY:1,radius:.1,erase:false}]}
  const out=halftone(input,64,64,{...settings,screenScope:'transitions',affectedColors:selected}).data
  let holes=0
  for(let y=0;y<64;y++)for(let x=40;x<48;x++)if(!out[(y*64+x)*4+3])holes++
  assert.ok(holes>0)
  for(let y=0;y<64;y++){const i=(y*64+60)*4;assert.deepEqual(out.slice(i,i+4),input.slice(i,i+4))}
})
test('protection wins but never restores deleted background or expands a softened alpha',()=>{
  const input=fixture(),range={colors:['#000000'],tolerance:100,softness:0}
  const protectedResult=halftone(input,64,64,{...settings,affectedColors:range,protectedColors:range}).data
  assert.equal(protectedResult[3],0)
  assert.deepEqual(protectedResult.slice(60*4,60*4+4),input.slice(60*4,60*4+4))
  const partial=new Uint8ClampedArray([128,128,128,90])
  assert.equal(halftone(partial,1,1,{...settings,background:'none',protectedColors:range}).data[3],90)
})
test('background stage is identical for screening on/off and either substrate',()=>{
  const input=fixture()
  const expected=removeBackground(input,64,64,settings)
  for(const screenBase of ['black','white'] as const)for(const enabled of [false,true])assert.deepEqual(removeBackground(input,64,64,{...settings,screenBase,enabled} as typeof settings),expected)
  assert.deepEqual(halftone(input,64,64,{...settings,enabled:false}).data,expected)
})
