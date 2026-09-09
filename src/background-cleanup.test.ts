import {test} from 'node:test'
import assert from 'node:assert/strict'
import {halftone} from './halftone.ts'
import {garmentPresets} from './garment-presets.ts'
import {parseProject,type ProjectFile} from './project-file.ts'

const side=128
function pixels(rgb:number[],alpha=255){
  const data=new Uint8ClampedArray(side*side*4)
  for(let i=0;i<data.length;i+=4)data.set([...rgb,alpha],i)
  return data
}
function stats(data:Uint8ClampedArray,white=false){
  let ink=0,distance=0
  for(let i=0;i<data.length;i+=4)if(data[i+3]){ink++;distance+=white?765-data[i]-data[i+1]-data[i+2]:data[i]+data[i+1]+data[i+2]}
  return {ink,distance}
}
test('cleanup zero is byte-identical to absent setting for dark and light presets',()=>{
  for(const p of [garmentPresets.darkFine,garmentPresets.lightGarment])for(const rgb of [[1,1,3],[16,8,4],[250,249,252],[255,30,30]]){
    const {backgroundCleanup:_,...s}=p.values
    assert.deepEqual(halftone(pixels(rgb),side,side,s).data,halftone(pixels(rgb),side,side,{...s,backgroundCleanup:0}).data)
  }
})
test('maximum cleanup removes near-black and near-white residue at all output DPIs',()=>{
  for(const [key,rgb]of [['darkFine',[1,1,3]],['darkFine',[8,0,4]],['lightGarment',[252,254,254]],['lightGarment',[247,255,251]]] as const){
    for(const dpi of [150,300,600]){
      const data=pixels([...rgb]),s={...garmentPresets[key].values,dpi}
      assert.ok(stats(halftone(data,side,side,s).data).ink>0)
      assert.equal(stats(halftone(data,side,side,{...s,backgroundCleanup:100}).data).ink,0)
    }
  }
})
test('intensity progressively reduces shadow/highlight speckle without adding pixels',()=>{
  for(const [key,rgb]of [['darkFine',[20,12,8]],['lightGarment',[235,243,247]]] as const){
    const s=garmentPresets[key].values,data=pixels([...rgb])
    let previous=halftone(data,side,side,s).data
    let prior=stats(previous,s.background==='white')
    for(const strength of [25,50,75,100]){
      const result=halftone(data,side,side,{...s,backgroundCleanup:strength}).data
      const next=stats(result,s.background==='white')
      assert.ok(next.ink<=prior.ink);assert.ok(next.distance<prior.distance)
      for(let i=3;i<result.length;i+=4)assert.ok(result[i]<=previous[i])
      previous=result;prior=next
    }
  }
})
test('colors outside the cleanup zone, including saturated red/blue, stay byte-identical',()=>{
  for(const key of ['darkFine','lightGarment'])for(const rgb of [[48,0,0],[0,0,60],[255,20,10],[20,40,255],[128,128,128],[207,255,255]]){
    const s=garmentPresets[key].values,data=pixels(rgb)
    assert.deepEqual(halftone(data,side,side,{...s,backgroundCleanup:100}).data,halftone(data,side,side,s).data)
  }
})
test('cleanup preserves transparent pixels and is inactive for mono, continuous and connected removal',()=>{
  for(const key of ['darkMono','lightMono','darkCutout','whiteCutout','lightOriginal']){
    const s=garmentPresets[key].values,data=pixels([250,252,251])
    assert.deepEqual(halftone(data,side,side,{...s,backgroundCleanup:100}).data,halftone(data,side,side,s).data)
  }
  for(const key of ['darkFine','lightGarment'])assert.ok(halftone(pixels([2,1,3],0),side,side,{...garmentPresets[key].values,backgroundCleanup:100}).data.every(v=>v===0))
})
test('cleanup is portable and invalid strengths are rejected',()=>{
  const settings={...garmentPresets.darkFine.values,backgroundCleanup:60,trimMm:0,featherMm:0,cornerRadiusMm:0,edgeSides:[true,true,true,true]}
  const p:ProjectFile={format:'trama-dtf',version:1,name:'Test',sheet:{width:58,height:100,dpi:300,gap:5,rotate:true},background:'black',items:[],editor:{name:'Image',document:{version:1,original:'data:image/png;base64,AAAA',settings,crop:null,widthCm:5,dpi:300}}}
  assert.equal(parseProject(JSON.stringify(p)).editor?.document.settings.backgroundCleanup,60)
  for(const strength of [-1,101,null,'50'])assert.throws(()=>parseProject(JSON.stringify({...p,editor:{...p.editor,document:{...p.editor!.document,settings:{...settings,backgroundCleanup:strength}}}})))
})
