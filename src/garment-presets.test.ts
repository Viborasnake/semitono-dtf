import {test} from 'node:test'
import assert from 'node:assert/strict'
import {garmentPresets,presetsFor} from './garment-presets.ts'
import {halftone} from './halftone.ts'

test('each garment has five halftone and three continuous presets, including one monochrome per finish',()=>{
  for(const garment of ['dark','light'] as const)for(const mode of ['halftone','continuous'] as const){
    const entries=presetsFor(garment,mode)
    assert.equal(entries.length,mode==='halftone'?5:3)
    assert.equal(entries.filter(([,p])=>!p.values.preserveColor).length,1)
    for(const [,p]of entries){
      assert.equal(p.values.enabled,mode==='halftone')
      assert.equal(p.values.solidAlpha,mode==='halftone')
      assert.equal(p.values.autoTone,false);assert.equal(p.values.autoContrast,false)
      assert.equal(p.values.autoColor,false);assert.equal(p.values.sharpness,0)
      for(const key of ['dpi','widthCm','crop','trimMm','featherMm','cornerRadiusMm','edgeSides'])assert.equal(key in p.values,false)
    }
  }
})

test('one-color presets never output chromatic pixels, at every DPI and finish',()=>{
  const side=96,data=new Uint8ClampedArray(side*side*4)
  const colors=[[1,1,3,255],[3,1,1,255],[64,96,128,255],[128,128,128,255],[255,255,255,255],[0,0,0,255],[200,30,80,0]]
  for(let i=0;i<data.length;i+=4)data.set(colors[(i/4)%colors.length],i)
  for(const key of ['darkMono','darkMonoContinuous','lightMono','lightMonoContinuous'])for(const dpi of [150,300,600]){
    const p=garmentPresets[key],tone=p.garment==='dark'?255:0
    const output=halftone(data,side,side,{...p.values,dpi}).data
    let count=0,partial=0
    for(let i=0;i<output.length;i+=4){
      if(!data[i+3])assert.equal(output[i+3],0)
      if(output[i+3]){count++;assert.deepEqual(Array.from(output.slice(i,i+3)),[tone,tone,tone]);if(output[i+3]<255)partial++}
    }
    assert.ok(count>0)
    if(p.mode==='halftone')assert.equal(partial,0)
    else assert.ok(partial>0)
  }
})
test('category switches overwrite every processing value, not geometry or edges',()=>{
  for(const from of Object.values(garmentPresets))for(const to of Object.values(garmentPresets)){
    const previous={...from.values,dpi:600,widthCm:25,trimMm:2,featherMm:3,cornerRadiusMm:4,edgeSides:[true,false,true,false]}
    const next={...previous,...to.values}
    for(const [key,value]of Object.entries(to.values))assert.deepEqual(next[key as keyof typeof next],value)
    assert.equal(next.dpi,600);assert.equal(next.widthCm,25);assert.equal(next.trimMm,2)
    assert.equal(next.featherMm,3);assert.equal(next.cornerRadiusMm,4)
    assert.deepEqual(next.edgeSides,previous.edgeSides)
  }
})
test('continuous original presets preserve RGBA exactly on both garment tones',()=>{
  const data=new Uint8ClampedArray([0,0,0,255,255,255,255,255,123,85,43,128,25,180,215,0])
  for(const key of ['darkOriginal','lightOriginal'])assert.deepEqual(halftone(data,4,1,garmentPresets[key].values).data,data.map((v,i)=>i>=12?0:v))
})
test('fine white preset keeps mean tone while retaining more pixels than soft detail',()=>{
  const side=256,data=new Uint8ClampedArray(side*side*4)
  for(let i=0;i<data.length;i+=4)data.set([128,128,128,255],i)
  const stats=(key:string)=>{
    const out=halftone(data,side,side,{...garmentPresets[key].values,dpi:300}).data
    let holes=0,sum=0
    for(let i=0;i<out.length;i+=4){if(!out[i+3])holes++;sum+=out[i+3]?out[i]:255}
    return {holes,mean:sum/(side*side)}
  }
  const soft=stats('lightGarment'),fine=stats('lightFine')
  assert.ok(fine.holes<soft.holes);assert.ok(Math.abs(fine.mean-128)<2)
})
