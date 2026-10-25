export type SelectionStroke={x:number;y:number;toX:number;toY:number;radius:number;erase:boolean}
export type ColorRange = {colors:string[]; tolerance:number; softness:number;useColors?:boolean;strokes?:SelectionStroke[]}
export const defaultColorRange:ColorRange = {colors:['#ffffff'],tolerance:8,softness:4}

export function validColorRange(value:unknown):value is ColorRange {
  if(!value||typeof value!=='object')return false
  const v=value as ColorRange
  return Array.isArray(v.colors)&&v.colors.length>0&&v.colors.length<=8
    &&v.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))
    &&[v.tolerance,v.softness].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)
    &&(v.useColors===undefined||typeof v.useColors==='boolean')
    &&(v.strokes===undefined||(Array.isArray(v.strokes)&&v.strokes.length<=20000&&v.strokes.every(s=>s&&typeof s.erase==='boolean'&&[s.x,s.y,s.toX,s.toY,s.radius].every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&s.radius>0)))
}

// Rasterize normalized brush segments once per render, independent of output
// resolution. 0 = no override, 1 = erase selection, 2 = add selection.
export function selectionBrushMask(range:ColorRange,width:number,height:number){
  if(!range.strokes?.length)return null
  const mask=new Uint8Array(width*height)
  for(const s of range.strokes){
    const ax=s.x*width,ay=s.y*height,bx=s.toX*width,by=s.toY*height,r=s.radius*width
    const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy
    for(let y=Math.max(0,Math.floor(Math.min(ay,by)-r));y<Math.min(height,Math.ceil(Math.max(ay,by)+r));y++)
      for(let x=Math.max(0,Math.floor(Math.min(ax,bx)-r));x<Math.min(width,Math.ceil(Math.max(ax,bx)+r));x++){
        const t=length?Math.max(0,Math.min(1,((x+.5-ax)*dx+(y+.5-ay)*dy)/length)):0
        if((x+.5-ax-t*dx)**2+(y+.5-ay-t*dy)**2<=r*r)mask[y*width+x]=s.erase?1:2
      }
  }
  return mask
}
export function selectionCoverage(range:ColorRange,retention:number,override:number=0){
  return override===2?1:override===1?0:range.useColors===false?0:1-retention
}

// RGB maximum-channel distance: tolerance is a percentage of 255, not an
// emulation of Adobe's proprietary Color Range scale. Compile once per frame.
export function colorRangeRetention(range:ColorRange) {
  const colors=range.colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)))
  const radius=range.tolerance*2.55, feather=range.softness*2.55
  return (r:number,g:number,b:number)=>{
    let distance=255
    for(const c of colors)distance=Math.min(distance,Math.max(Math.abs(r-c[0]),Math.abs(g-c[1]),Math.abs(b-c[2])))
    if(distance<=radius)return 0
    if(!feather||distance>=radius+feather)return 1
    const t=(distance-radius)/feather
    return t*t*(3-2*t)
  }
}
