import type {Placement} from './packing'
export function hitGangAsset(x:number,y:number,placements:Placement[],items:{id:string;widthCm:number;heightCm:number}[],dpi:number):string|null {
  for(let i=placements.length-1;i>=0;i--){
    const p=placements[i],asset=items.find(a=>a.id===p.id)
    if(!asset)continue
    const w=Math.round(asset.widthCm/2.54*dpi),h=Math.round(asset.heightCm/2.54*dpi)
    const left=Math.round(p.x/2.54*dpi),top=Math.round(p.y/2.54*dpi)
    if(x>=left&&y>=top&&x<left+(p.rotated?h:w)&&y<top+(p.rotated?w:h))return p.id
  }
  return null
}
