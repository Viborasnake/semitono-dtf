import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectionBrushMask,selectionCoverage,validColorRange,type ColorRange} from './color-range.ts'
import {halftone} from './halftone.ts'

test('brush segments stay connected across resolutions and exclusions override earlier paint',()=>{
  const range:ColorRange={colors:['#ffffff'],tolerance:0,softness:0,useColors:false,strokes:[
    {x:.2,y:.5,toX:.8,toY:.5,radius:.08,erase:false},
    {x:.5,y:.5,toX:.5,toY:.5,radius:.1,erase:true},
  ]}
  assert.ok(validColorRange(JSON.parse(JSON.stringify(range))))
  assert.equal(validColorRange({...range,strokes:[{...range.strokes![0],radius:NaN}]}),false)
  for(const width of [100,200]){
    const mask=selectionBrushMask(range,width,width)!
    assert.equal(mask[width*.5*width+width*.3],2)
    assert.equal(mask[width*.5*width+width*.5],1)
    assert.equal(mask[0],0)
  }
  assert.equal(selectionCoverage(range,0,0),0)
  assert.equal(selectionCoverage(range,1,2),1)
  assert.equal(selectionCoverage(range,0,1),0)
})

test('brush-only protection keeps one region solid without protecting the same color elsewhere',()=>{
  const width=100,data=new Uint8ClampedArray(width*width*4)
  for(let i=0;i<data.length;i+=4)data.set([128,128,128,255],i)
  const range:ColorRange={colors:['#ffffff'],tolerance:0,softness:0,useColors:false,strokes:[{x:.25,y:.5,toX:.25,toY:.5,radius:.2,erase:false}]}
  const result=halftone(data,width,width,{lpi:30,angle:22.5,shape:'circle',size:100,contrast:100,brightness:100,whiteCutoff:245,preserveColor:true,invert:false,background:'none',tolerance:0,protectedColors:range})
  let holes=0
  for(let y=40;y<60;y++)for(let x=15;x<35;x++)assert.equal(result.data[(y*width+x)*4+3],255)
  for(let y=40;y<60;y++)for(let x=65;x<85;x++)if(!result.data[(y*width+x)*4+3])holes++
  assert.ok(holes>0)
})
