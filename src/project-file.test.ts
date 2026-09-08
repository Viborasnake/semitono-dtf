import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseProject,type ProjectFile} from './project-file.ts'

const fixture=():ProjectFile=>({format:'trama-dtf',version:1,name:'Mi trabajo',sheet:{width:58,height:100,dpi:600,gap:5,rotate:true},background:'black',items:[{id:'a',name:'Diseño',dataUrl:'data:image/png;base64,AAAA',naturalWidth:100,naturalHeight:200,widthCm:2.54,heightCm:5.08,quantity:2}]})
test('project round trip preserves images, dimensions, DPI and copies',()=>{
  const p=fixture();assert.deepEqual(parseProject(JSON.stringify(p)),p)
})
test('project rejects unknown versions, external image URLs and duplicate IDs',()=>{
  const p=fixture();assert.throws(()=>parseProject(JSON.stringify({...p,version:2})))
  p.items[0].dataUrl='https://example.com/image.png';assert.throws(()=>parseProject(JSON.stringify(p)))
  const q=fixture();q.items.push({...q.items[0]});assert.throws(()=>parseProject(JSON.stringify(q)))
})
test('project rejects invalid geometry, resolution and missing editor settings',()=>{
  const p=fixture();p.sheet.dpi=96;assert.throws(()=>parseProject(JSON.stringify(p)))
  const q=fixture();q.items[0].quantity=-1;assert.throws(()=>parseProject(JSON.stringify(q)))
  assert.throws(()=>parseProject(JSON.stringify({...fixture(),editor:{name:'x',document:{version:1,original:'data:image/png;base64,AAAA',widthCm:25,dpi:300}}})))
})
