import type {Settings} from './App'
import type {CropRect} from './crop'
export type EditorDocument={version:1;original:string;settings:Settings;crop:CropRect|null;widthCm:number;dpi:number}
export type GangSource={id:number;blob:Blob;widthCm:number;name:string;document:EditorDocument;replaceId?:string}

export function updateGangAsset<T extends {id:string;quantity:number}>(items:T[],next:T,replaceId?:string):T[] {
  const old=items.find(item=>item.id===replaceId)
  return old?items.map(item=>item.id===old.id?{...next,id:old.id,quantity:old.quantity}:item):[...items,next]
}
