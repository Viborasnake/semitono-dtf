export const edgeMaskStyles = [
  {id:'torn',name:'Papel rasgado'},
  {id:'brush',name:'Pincel seco'},
  {id:'grunge',name:'Desgastado'},
  {id:'ink',name:'Tinta orgánica'},
  {id:'watercolor',name:'Acuarela'},
  {id:'splatter',name:'Salpicado'},
  {id:'zigzag',name:'Dientes'},
  {id:'scallop',name:'Ondas'},
  {id:'flame',name:'Llamas'},
  {id:'pixel',name:'Pixel roto'},
] as const
export type EdgeMaskStyle = 'none' | (typeof edgeMaskStyles)[number]['id']
export const isEdgeMaskStyle = (value: unknown): value is EdgeMaskStyle => value === 'none' || edgeMaskStyles.some(style => style.id === value)

type Options = {style:EdgeMaskStyle; sizeMm:number; dpi:number; sides?:boolean[]; solidAlpha?:boolean}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
const hash=(n:number)=>{const v=Math.sin(n*127.1+78.233)*43758.5453;return v-Math.floor(v)}
const noise=(t:number,seed:number)=>{const a=Math.floor(t),f=t-a,u=f*f*(3-2*f);return hash(a+seed)*(1-u)+hash(a+seed+1)*u}
function profile(style:EdgeMaskStyle,t:number,side:number):number {
  const n=(frequency:number,seed:number)=>noise(t*frequency,seed+side*101)
  switch(style){
    case 'torn': return .32+.43*n(.045,11)+.2*n(.28,17)+.05*n(1.4,23)
    case 'brush': return .22+.44*n(.027,31)+.17*n(.16,37)+.17*n(.9,43)
    case 'grunge': return .22+.28*n(.04,51)+.3*n(.3,57)+.2*n(1.8,61)
    case 'ink': return .38+.35*n(.018,71)+.16*Math.sin(t*.13+side)+.1*n(.4,73)
    case 'watercolor': return .3+.35*n(.025,81)+.2*n(.1,83)+.15*n(.55,89)
    case 'splatter': return .2+.25*n(.035,91)+.45*n(.38,97)
    case 'zigzag': return .2+.65*(1-Math.abs((t*.11%2+2)%2-1))
    case 'scallop': return .3+.5*(.5+.5*Math.cos(t*.13+side*.8))
    case 'flame': return .16+.78*Math.pow(n(.07,111),5)
    case 'pixel': return .18+.72*hash(Math.floor(t/7)+side*101+121)
    default: return 0
  }
}
/** Cuts only existing ink, measured inward from its visible bounds. */
export function applyEdgeMask(data:Uint8ClampedArray,width:number,height:number,options:Options):void {
  const {style,sides=[true,true,true,true]}=options
  if(style==='none'||!Number.isFinite(options.sizeMm)||options.sizeMm<=0||!sides.some(Boolean))return
  let left=width,top=height,right=-1,bottom=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  if(right<left)return
  const depth=Math.max(1,Math.min(options.sizeMm*options.dpi/25.4,(right-left+1)/3,(bottom-top+1)/3))
  const soft=options.solidAlpha?0:1.25
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const i=(y*width+x)*4
    if(!data[i+3])continue
    let alpha=1
    const distances=[y-top,right-x,bottom-y,x-left]
    for(let side=0;side<4;side++){
      if(!sides[side]||distances[side]>depth+soft)continue
      const along=side%2===0?x-left:y-top
      const cut=depth*profile(style,along,side)
      let keep=soft?clamp((distances[side]-cut)/soft+.5):distances[side]>=cut?1:0
      if(style==='grunge'||style==='brush'||style==='splatter'||style==='watercolor'){
        const grain=hash(x*73+y*173+side*911)
        const reach=clamp((depth*1.12-distances[side])/Math.max(1,depth))
        const chance=(style==='splatter'?.23:style==='grunge'?.15:style==='brush'?.11:.06)*reach
        if(grain<chance)keep=0
      }
      alpha=Math.min(alpha,keep)
      if(alpha===0)break
    }
    if(alpha<1){data[i+3]=Math.round(data[i+3]*alpha);if(!data[i+3])data[i]=data[i+1]=data[i+2]=0}
  }
}
