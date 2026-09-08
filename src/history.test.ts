import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHistory,recordHistory,moveHistory} from './history.ts'
test('one slider gesture restores the value before dragging',()=>{
 let h=createHistory({sharpness:0})
 h=recordHistory(h,{sharpness:10},1)
 h=recordHistory(h,{sharpness:80},1)
 assert.equal(h.past.length,1)
 h=moveHistory(h,'undo');assert.equal(h.present.sharpness,0)
 h=moveHistory(h,'redo');assert.equal(h.present.sharpness,80)
})
test('new edits after undo replace the redo branch and restore composite state',()=>{
 const initial={size:25,dpi:300,crop:null as null|number}
 let h=recordHistory(createHistory(initial),{size:10,dpi:150,crop:5},1)
 h=moveHistory(h,'undo');assert.deepEqual(h.present,initial)
 h=recordHistory(h,{...initial,size:30},2)
 assert.equal(h.future.length,0)
 assert.deepEqual(moveHistory(h,'undo').present,initial)
})
test('render echoes are not recorded and history stays bounded',()=>{
 let h=createHistory(0)
 assert.equal(recordHistory(h,0,1),h)
 for(let i=1;i<100;i++)h=recordHistory(h,i,i)
 assert.equal(h.past.length,50)
})
