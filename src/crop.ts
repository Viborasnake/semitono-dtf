export type CropRect = {x:number;y:number;width:number;height:number}

// Every nonzero alpha counts as content, including faint edge pixels.
export function contentBounds(data:Uint8ClampedArray,width:number,height:number):CropRect|null {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4) throw new Error('Dimensiones de imagen inválidas.')
  let left=width,top=height,right=-1,bottom=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    if(data[(y*width+x)*4+3]===0)continue
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)
  }
  return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1}
}

export function imageContentBounds(image:HTMLImageElement,area:CropRect):CropRect|null {
  const canvas=document.createElement('canvas')
  canvas.width=area.width;canvas.height=area.height
  try {
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.imageSmoothingEnabled=false
    // Integer translation only. No resampling or new edge alpha.
    ctx.drawImage(image,-area.x,-area.y)
    const bounds=contentBounds(ctx.getImageData(0,0,area.width,area.height).data,area.width,area.height)
    return bounds?{...bounds,x:bounds.x+area.x,y:bounds.y+area.y}:null
  } finally {canvas.width=canvas.height=1}
}
