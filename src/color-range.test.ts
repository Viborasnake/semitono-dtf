import {test} from 'node:test'
import assert from 'node:assert/strict'
import {colorRangeRetention,validColorRange,type ColorRange} from './color-range.ts'
import {halftone} from './halftone.ts'
import {autoAdjust} from './auto-adjust.ts'
import {garmentPresets} from './garment-presets.ts'
import {parseProject,type ProjectFile} from './project-file.ts'
const range:ColorRange={colors:['#f5ecd2'],tolerance:4,softness:5}
const settings={...garmentPresets.lightGarment.values,background:'custom' as const,colorRange:range}
test('color range selects cream and nearby tones, preserves white/red/blue outside range',()=>{
  const retain=colorRangeRetention(range)
  assert.equal(retain(245,236,210),0);assert.equal(retain(250,240,219),0)
  for(const rgb of [[255,255,255],[255,20,10],[20,40,255],[0,0,0]])assert.equal(retain(...rgb as [number,number,number]),1)
  assert.ok(retain(245,236,228)>0&&retain(245,236,228)<1)
  assert.equal(colorRangeRetention({...range,colors:[...range.colors,'#000000']})(0,0,0),0)
})
test('zero tolerance selects exact RGB only; range is monotonic and finite',()=>{
  assert.equal(colorRangeRetention({colors:['#000000'],tolerance:0,softness:0})(0,0,1),1)
  for(let value=0;value<256;value++){
    let prior=1
    for(const tolerance of [0,10,50,100]){
      const result=colorRangeRetention({...range,tolerance})(value,value,value)
      assert.ok(Number.isFinite(result)&&result>=0&&result<=prior);prior=result
    }
  }
})
test('removed colors never return with detail, brightness, inversion, DPI or alpha options',()=>{
  const data=new Uint8ClampedArray(64*64*4);for(let i=0;i<data.length;i+=4)data.set([245,236,210,255],i)
  for(const dpi of [150,300,600])for(const enabled of [true,false])for(const solidAlpha of [true,false]){
    const s={...settings,dpi,enabled,solidAlpha,whiteDetail:100,brightness:140,contrast:180,invert:true,gamma:2,size:125}
    assert.ok(halftone(data,64,64,s).data.every(v=>v===0))
    const adjusted=autoAdjust(data,{...s,autoColor:true,temperature:100,autoTone:true})
    assert.ok(halftone(adjusted,64,64,s,data).data.every(v=>v===0))
  }
})
test('unselected full-color pixels and original transparency survive at neutral settings',()=>{
  const data=new Uint8ClampedArray([255,20,10,255,20,40,255,255,255,255,255,255,245,236,210,255,90,60,30,0])
  for(const enabled of [true,false]){
    const result=halftone(data,5,1,{...settings,enabled,solidAlpha:false}).data
    assert.ok(result.slice(0,8).some(v=>v!==0));assert.ok(result.slice(8,16).every(v=>v===0));assert.ok(result.slice(16).every(v=>v===0))
  }
  const partial=new Uint8ClampedArray([255,0,0,90])
  assert.equal(halftone(partial,1,1,{...settings,enabled:false,solidAlpha:false}).data[3],90)
})
test('custom settings do not change legacy black, white or none output',()=>{
  const data=new Uint8ClampedArray([245,236,210,255,1,2,3,255,255,255,255,255])
  for(const background of ['black','white','none'] as const){
    const s={...garmentPresets.default.values,background}
    assert.deepEqual(halftone(data,3,1,s),halftone(data,3,1,{...s,colorRange:range}))
  }
})
test('color range persists in project documents and rejects malformed configuration',()=>{
  const p:ProjectFile={format:'trama-dtf',version:1,name:'Range',sheet:{width:58,height:100,dpi:300,gap:5,rotate:true},background:'white',items:[],editor:{name:'Test',document:{version:1,original:'data:image/png;base64,AAAA',crop:null,widthCm:10,dpi:300,settings:{...settings,trimMm:0,featherMm:0,cornerRadiusMm:0,edgeSides:[true,true,true,true]}}}}
  assert.deepEqual(parseProject(JSON.stringify(p)).editor?.document.settings.colorRange,range)
  for(const invalid of [null,{}, {...range,colors:[]},{...range,colors:['red']},{...range,colors:Array(9).fill('#ffffff')},{...range,tolerance:101},{...range,softness:-1},{...range,tolerance:'5'}]){
    assert.equal(validColorRange(invalid),false)
    assert.throws(()=>parseProject(JSON.stringify({...p,editor:{...p.editor,document:{...p.editor!.document,settings:{...p.editor!.document.settings,colorRange:invalid}}}})))
  }
})
