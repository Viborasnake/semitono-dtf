export type AutoAdjustSettings = {
  autoTone?: boolean; autoContrast?: boolean; autoColor?: boolean
  temperature?: number; tint?: number; autoColorStrength?: number; autoToneStrength?: number; autoContrastStrength?: number
  background: 'black' | 'white' | 'none'; tolerance: number; whiteCutoff: number
}

// Deterministic, non-destructive corrections. Always derive them from the
// input image, never from a previously corrected preview.
export function autoAdjust(input: Uint8ClampedArray, settings: AutoAdjustSettings) {
  if (!settings.autoTone && !settings.autoContrast && !settings.autoColor) return input
  const result = input.slice()
  const eligible = (i: number) => {
    if (!input[i + 3]) return false
    if (settings.background === 'black' && Math.max(input[i], input[i+1], input[i+2]) <= settings.tolerance) return false
    if (settings.background === 'white' && Math.min(input[i], input[i+1], input[i+2]) >= settings.whiteCutoff) return false
    return true
  }
  function histogram() {
    const channels = [new Float64Array(256),new Float64Array(256),new Float64Array(256)]
    for(let i=0;i<result.length;i+=4) if(eligible(i)) {
      const weight=input[i+3]/255
      for(let c=0;c<3;c++) channels[c][result[i+c]]+=weight
    }
    return channels
  }
  function endpoints(hist: Float64Array) {
    const total=hist.reduce((a,b)=>a+b,0)
    let low=0,high=255,sum=0
    if(!total)return [0,255]
    for(let v=0;v<256;v++){sum+=hist[v];if(sum>total*.005){low=v;break}}
    sum=0
    for(let v=255;v>=0;v--){sum+=hist[v];if(sum>total*.005){high=v;break}}
    // Uniform artwork has no meaningful tonal range to stretch.
    return high-low<8 ? [0,255] : [low,high]
  }
  function stretch(ranges: number[][]) {
    for(let i=0;i<result.length;i+=4) if(eligible(i)) for(let c=0;c<3;c++) {
      const [low,high]=ranges[c]
      result[i+c]=(result[i+c]-low)*255/(high-low)
    }
  }
  if(settings.autoTone) {
    const beforeTone = result.slice()
    stretch(histogram().map(endpoints))
    const strength = Math.max(0, Math.min(100, settings.autoToneStrength ?? 100)) / 100
    if (strength < 1) for (let i=0;i<result.length;i+=4) if (eligible(i)) {
      result[i] = beforeTone[i] + (result[i] - beforeTone[i]) * strength
      result[i+1] = beforeTone[i+1] + (result[i+1] - beforeTone[i+1]) * strength
      result[i+2] = beforeTone[i+2] + (result[i+2] - beforeTone[i+2]) * strength
    }
  }
  if(settings.autoContrast) {
    const beforeContrast = result.slice()
    const hist=histogram()
    const common=Float64Array.from(hist[0],(v,i)=>v+hist[1][i]+hist[2][i])
    const range=endpoints(common)
    stretch([range,range,range])
    const strength = Math.max(0, Math.min(100, settings.autoContrastStrength ?? 100)) / 100
    if (strength < 1) for (let i=0;i<result.length;i+=4) if (eligible(i)) for (let c=0;c<3;c++) result[i+c] = beforeContrast[i+c] + (result[i+c] - beforeContrast[i+c]) * strength
  }
  if(settings.autoColor) {
    // Estimate a neutral reference from low-saturation midtones. Saturated
    // logos and flat-color artwork are not suitable white-balance references.
    const sums=[0,0,0]
    let weight=0
    for(let i=0;i<result.length;i+=4) if(eligible(i)) {
      const max=Math.max(result[i],result[i+1],result[i+2]),min=Math.min(result[i],result[i+1],result[i+2])
      const lum=.2126*result[i]+.7152*result[i+1]+.0722*result[i+2]
      if(lum<25 || lum>230 || (max-min)/Math.max(1,max)>.4)continue
      const alpha=input[i+3]/255
      for(let c=0;c<3;c++)sums[c]+=result[i+c]*alpha
      weight+=alpha
    }
    if(weight) {
      const target=(sums[0]+sums[1]+sums[2])/3
      const strength=(settings.autoColorStrength ?? 100)/100
      const gains=sums.map(sum=>1+(Math.max(.75,Math.min(1.33,target/Math.max(sum,1)))-1)*strength)
      for(let i=0;i<result.length;i+=4)if(eligible(i))for(let c=0;c<3;c++)result[i+c]*=gains[c]
    }
  }
  const temp=(settings.temperature ?? 0)/100
  const tint=(settings.tint ?? 0)/100
  if(temp || tint) for(let i=0;i<result.length;i+=4) if(eligible(i)) {
    result[i] += temp * 30 + tint * 8
    result[i+1] += -tint * 18
    result[i+2] += -temp * 30 + tint * 8
  }
  return result
}
