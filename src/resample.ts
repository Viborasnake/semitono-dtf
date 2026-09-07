// Separable Lanczos-3, with alpha-weighted colors to avoid dark fringes.
export function resizeRgba(data: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number) {
  if (sw === dw && sh === dh) return data
  const sinc = (x: number) => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
  function table(source: number, dest: number) {
    const scale = Math.min(1, dest / source), radius = 3 / scale
    return Array.from({length:dest}, (_, x) => {
      const center = (x + .5) * source / dest - .5
      const taps: {index:number;weight:number}[] = []
      for(let p=Math.ceil(center-radius);p<=Math.floor(center+radius);p++){
        const distance=(center-p)*scale
        if(Math.abs(distance)>=3)continue
        taps.push({index:Math.min(source-1,Math.max(0,p)),weight:sinc(distance)*sinc(distance/3)})
      }
      return taps
    })
  }
  const tx=table(sw,dw),ty=table(sh,dh)
  const horizontal=new Uint8ClampedArray(dw*sh*4)
  const result=new Uint8ClampedArray(dw*dh*4)
  function sample(input:Uint8ClampedArray,output:Uint8ClampedArray,out:number,taps:{index:number;weight:number}[],index:(p:number)=>number){
    let r=0,g=0,b=0,a=0,total=0
    for(const tap of taps){const i=index(tap.index),aw=input[i+3]/255*tap.weight;total+=tap.weight;a+=aw;r+=input[i]*aw;g+=input[i+1]*aw;b+=input[i+2]*aw}
    if(a>1e-8 && total>1e-8){output[out]=r/a;output[out+1]=g/a;output[out+2]=b/a;output[out+3]=Math.max(0,Math.min(1,a/total))*255}
  }
  for(let y=0;y<sh;y++)for(let x=0;x<dw;x++)sample(data,horizontal,(y*dw+x)*4,tx[x],p=>(y*sw+p)*4)
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)sample(horizontal,result,(y*dw+x)*4,ty[y],p=>(p*dw+x)*4)
  return result
}
