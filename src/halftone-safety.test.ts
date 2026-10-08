import test from 'node:test'
import assert from 'node:assert/strict'
import {assessHalftoneSafety} from './halftone-safety.ts'

const base = {dpi:300,sourceDpi:300,lpi:32,size:100,minDotSize:0,solidAlpha:true,enabled:true}

test('accepts a 300 ppp, 32 LPI solid halftone without warnings',()=>{
  const report=assessHalftoneSafety(base)
  assert.equal(report.issues.length,0)
  assert.equal(report.cellPixels,9.375)
  assert.ok(Math.abs(report.recommendedMinimumDotMm-.1693333)<.0001)
})

test('flags a screen whose cells are too small for the selected resolution',()=>{
  const report=assessHalftoneSafety({...base,dpi:150,lpi:65,size:45})
  assert.ok(report.issues.some(issue=>issue.title==='Trama demasiado fina para esta resolución'))
  assert.ok(report.issues.some(issue=>issue.title==='Punto máximo demasiado pequeño'))
})

test('flags a minimum-dot filter that would remove the largest screened dots',()=>{
  const report=assessHalftoneSafety({...base,lpi:65,size:45,minDotSize:2.1})
  assert.ok(report.issues.some(issue=>issue.title==='El filtro puede borrar toda la trama fina'))
})

test('flags an original that is being enlarged beyond its effective resolution',()=>{
  const report=assessHalftoneSafety({...base,sourceDpi:150})
  assert.ok(report.issues.some(issue=>issue.title==='El original se está ampliando'))
})

test('uses Neural-generated pixels when checking available output resolution',()=>{
  const report=assessHalftoneSafety({...base,sourceDpi:161,upscaleFactor:2})
  assert.equal(Math.round(report.sourceDpi),322)
  assert.equal(report.generatedResolution,true)
  assert.ok(!report.issues.some(issue=>issue.title==='El original se está ampliando'))
})

test('explains when the selected Neural method fell back to Lanczos',()=>{
 const report=assessHalftoneSafety({...base,sourceDpi:150,neuralRequested:true})
 assert.ok(report.issues.some(issue=>issue.title==='Neural no se pudo aplicar'))
})

test('does not issue screening warnings for continuous output',()=>{
  assert.equal(assessHalftoneSafety({...base,enabled:false,solidAlpha:false}).issues.length,0)
})
