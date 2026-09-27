export type ResizeMethod = 'lanczos3' | 'bicubic' | 'bilinear' | 'nearest'

// Alpha-aware unsharp mask. Colors from transparent neighbors are ignored so
// sharpening a cutout cannot pull a black/white matte into its visible edge.
export function sharpenRgba(data: Uint8ClampedArray, width: number, height: number, amount = 0) {
  if (!amount) return data
  const strength = Math.max(0, Math.min(1, amount / 100)) * .8
  const result = new Uint8ClampedArray(data)
  const index = (x: number, y: number) => (y * width + x) * 4
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const center = index(x, y), alpha = data[center + 3] / 255
    if (!alpha) continue
    const blur = [0, 0, 0], weights = [0, 0, 0]
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const p = index(Math.min(width - 1, Math.max(0, x + ox)), Math.min(height - 1, Math.max(0, y + oy)))
      const w = data[p + 3] / 255
      if (!w) continue
      for (let channel = 0; channel < 3; channel++) { blur[channel] += data[p + channel] * w; weights[channel] += w }
    }
    for (let channel = 0; channel < 3; channel++) {
      const average = weights[channel] ? blur[channel] / weights[channel] : data[center + channel]
      result[center + channel] = Math.max(0, Math.min(255, data[center + channel] + (data[center + channel] - average) * strength))
    }
  }
  return result
}

// Separable resampling with alpha-weighted colors to avoid dark fringes.
export function resizeRgba(data: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number, method: ResizeMethod = 'lanczos3') {
  if (sw === dw && sh === dh) return data
  const sinc = (x: number) => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
  const cubic = (x: number) => {
    const a = -0.5
    const d = Math.abs(x)
    if (d <= 1) return (a + 2) * d * d * d - (a + 3) * d * d + 1
    if (d < 2) return a * d * d * d - 5 * a * d * d + 8 * a * d - 4 * a
    return 0
  }
  function table(source: number, dest: number) {
    if (method === 'nearest') return Array.from({length:dest}, (_, x) => [{index:Math.min(source-1,Math.max(0,Math.floor((x + .5) * source / dest))),weight:1}])
    const scale = Math.min(1, dest / source)
    const radius = method === 'lanczos3' ? 3 / scale : method === 'bicubic' ? 2 / scale : 1 / scale
    return Array.from({length:dest}, (_, x) => {
      const center = (x + .5) * source / dest - .5
      const taps: {index:number;weight:number}[] = []
      for(let p=Math.ceil(center-radius);p<=Math.floor(center+radius);p++){
        const distance=(center-p)*scale
        const weight = method === 'lanczos3' ? (Math.abs(distance) >= 3 ? 0 : sinc(distance) * sinc(distance / 3)) : method === 'bicubic' ? cubic(distance) : Math.max(0, 1 - Math.abs(distance))
        if (weight) taps.push({index:Math.min(source-1,Math.max(0,p)),weight})
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
