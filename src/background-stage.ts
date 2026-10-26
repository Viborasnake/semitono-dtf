import {colorRangeRetention,defaultColorRange,type ColorRange} from './color-range.ts'
import {connectedWhiteBackground} from './white-background.ts'

export type BackgroundSettings={background:'none'|'custom'|'black'|'white';colorRange?:ColorRange;tolerance:number;whiteCutoff:number;whiteRemoval?:'all'|'connected'}

/** Removal is independent of screening: change alpha, never recolor retained ink. */
export function removeBackground(data:Uint8ClampedArray,width:number,height:number,s:BackgroundSettings,selectionSource=data){
  if(s.background==='none')return data
  const output=new Uint8ClampedArray(data)
  const connected=s.background==='white'&&s.whiteRemoval==='connected'?connectedWhiteBackground(selectionSource,width,height,s.whiteCutoff):null
  const range=s.background==='custom'?s.colorRange??defaultColorRange:s.background==='black'
    ?{colors:['#000000'],tolerance:s.tolerance/2.55,softness:4}
    :{colors:['#ffffff'],tolerance:(255-s.whiteCutoff)/2.55,softness:4}
  const retain=colorRangeRetention(range)
  for(let p=0;p<width*height;p++){
    const i=p*4
    const alpha=connected?(connected[p]?0:1):retain(selectionSource[i],selectionSource[i+1],selectionSource[i+2])
    output[i+3]=Math.round(data[i+3]*alpha)
    if(!output[i+3])output[i]=output[i+1]=output[i+2]=0
  }
  return output
}
