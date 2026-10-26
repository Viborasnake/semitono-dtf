import {halftone} from './halftone.ts'
import {autoAdjust} from './auto-adjust.ts'
import {removeBackground} from './background-stage.ts'
import {applyColorCorrection,flattenSelectedColor,smoothRgba,removeTinyDots,removeSmallParticles,restoreProtectedPixels} from './refine.ts'
import {applyEdgeMask} from './edge-mask.ts'
import type {Settings} from './App'

/** Shared by export worker and interactive preview: one rendering pipeline. */
export function processImage(resized:Uint8ClampedArray,width:number,height:number,settings:Settings&{dpi?:number},correction?:Uint8Array,includeBackground=false){
  const corrected=correction?applyColorCorrection(resized,correction,settings.flattenColorValue,100):resized
  const flattened=settings.flattenColor?flattenSelectedColor(corrected,settings.flattenColorValue,settings.flattenColorTolerance):corrected
  const softened=smoothRgba(flattened,width,height,settings.preSmooth??0)
  const adjusted=autoAdjust(softened,settings)
  const result=halftone(adjusted,width,height,settings,softened,flattened)
  for(let p=0;p<result.protectedMask.length;p++)if(result.protectedMask[p])result.data.fill(0,p*4,p*4+4)
  removeTinyDots(result.data,width,height,settings.minDotSize??0)
  removeSmallParticles(result.data,width,height,settings.particleMinSize??0)
  restoreProtectedPixels(result.data,flattened,resized,result.protectedMask,settings.solidAlpha,settings.protectSmoothEdge!==false)
  applyEdgeMask(result.data,width,height,{style:settings.edgeMask??'none',sizeMm:settings.edgeMaskSizeMm??5,dpi:settings.dpi??300,sides:settings.edgeSides,solidAlpha:settings.solidAlpha})
  let transparent=0
  for(let i=3;i<result.data.length;i+=4)if(!result.data[i])transparent++
  return {...result,transparent:Math.round(transparent/(width*height)*100),background:includeBackground?new Uint8ClampedArray(removeBackground(adjusted,width,height,settings,softened)):undefined}
}
