export type ColorRange = {colors:string[]; tolerance:number; softness:number}
export const defaultColorRange:ColorRange = {colors:['#ffffff'],tolerance:8,softness:4}

export function validColorRange(value:unknown):value is ColorRange {
  if(!value||typeof value!=='object')return false
  const v=value as ColorRange
  return Array.isArray(v.colors)&&v.colors.length>0&&v.colors.length<=8
    &&v.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))
    &&[v.tolerance,v.softness].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)
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
