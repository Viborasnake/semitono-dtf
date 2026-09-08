import {test} from 'node:test'
import assert from 'node:assert/strict'
import {updateGangAsset} from './editor-document.ts'
test('editing a design replaces it, retains copies and persists original separately',()=>{
 const original={original:'data:image/png;base64,original',settings:{lpi:30},dpi:150,widthCm:25,crop:{x:1,y:2,width:50,height:80}}
 const old={id:'design',quantity:4,render:'old-screened',document:original}
 const edited={id:'temporary',quantity:1,render:'new-screened',document:{...original,dpi:300,settings:{lpi:45}}}
 const updated=updateGangAsset([old],edited,'design')
 assert.equal(updated.length,1);assert.equal(updated[0].id,'design');assert.equal(updated[0].quantity,4)
 const restored=JSON.parse(JSON.stringify(updated))[0]
 assert.equal(restored.document.original,original.original)
 assert.equal(restored.render,'new-screened');assert.equal(restored.document.dpi,300)
 assert.deepEqual(restored.document.crop,original.crop)
 assert.equal(old.render,'old-screened');assert.equal(old.document.settings.lpi,30)
})
test('missing replacement target adds the edited design rather than discarding it',()=>{
 const next={id:'new',quantity:1}
 assert.deepEqual(updateGangAsset([],next,'removed'),[next])
})
