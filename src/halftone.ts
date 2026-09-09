import {connectedWhiteBackground} from './white-background.ts'
import {colorRangeRetention,defaultColorRange,type ColorRange} from './color-range.ts'
export type HalftoneSettings = {
  lpi: number; angle: number; shape: 'circle' | 'square' | 'line'; size: number
  contrast: number; brightness: number; whiteCutoff: number
  preserveColor: boolean; invert: boolean
  background: 'black' | 'white' | 'none' | 'custom'; tolerance: number
  colorRange?: ColorRange
  customBase?: 'black' | 'white'
  dpi?: number; enabled?: boolean; featherMm?: number; trimMm?: number
  edgeSides?: boolean[]
  sharpness?: number; gamma?: number; solidAlpha?: boolean; cornerRadiusMm?: number
  whiteRemoval?: 'all' | 'connected'
  whiteDetail?: number
  backgroundCleanup?: number
}

// Clustered ordered screening: retain the source detail inside each dot.
// Partial alpha uses four subpixel samples; solid alpha samples the pixel
// center. Promoting ANY subpixel hit to opaque would dilate every dot.
export function halftone(data: Uint8ClampedArray, width: number, height: number, s: HalftoneSettings, selectionSource=data) {
  const output = new Uint8ClampedArray(data.length)
  const retain=s.background==='custom'?colorRangeRetention(s.colorRange??defaultColorRange):null
  // A custom range is a removal mask layered over the normal black/white
  // screening path selected before sampling. It is not a third screening mode.
  const processingBackground=s.background==='custom'?(s.customBase??'white'):s.background
  const dpi = s.dpi ?? 300
  const pitch = dpi / s.lpi
  const feather = (s.featherMm ?? 0) / 25.4 * dpi
  const trim = (s.trimMm ?? 0) / 25.4 * dpi
  const cornerRadius = Math.max(0, (s.cornerRadiusMm ?? 0) / 25.4 * dpi)
  const sides = s.edgeSides ?? [true, true, true, true]
  const whiteMask=processingBackground==='white'&&s.background!=='custom'&&s.whiteRemoval==='connected'?connectedWhiteBackground(data,width,height,s.whiteCutoff):null
  const whiteDetail=s.enabled!==false&&s.preserveColor?Math.max(0,Math.min(100,s.whiteDetail??0))/100:0
  const backgroundCleanup=s.enabled!==false&&s.preserveColor?Math.max(0,Math.min(100,s.backgroundCleanup??0))/100:0
  const circleRanks = Float64Array.from({length: 4097}, (_, i) => {
    const d = i / 2048
    return d <= 1 ? Math.PI * d / 4 : Math.PI * d / 4 - d * Math.acos(1 / Math.sqrt(d)) + Math.sqrt(d - 1)
  })
  const angle = s.angle * Math.PI / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const solidAlpha=s.solidAlpha === true || (s.enabled !== false && s.solidAlpha !== false)
  const offsets = solidAlpha ? [.5] : [.25, .75]
  const samples = offsets.length ** 2
  let transparent = 0
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    if (!data[i + 3]) { transparent++; continue }
    // Sample unadjusted source colors. Apply this mask independently of tonal
    // controls, so brightness, inversion or detail cannot bring removals back.
    const colorAlpha=retain?retain(selectionSource[i],selectionSource[i+1],selectionSource[i+2]):1
    if(!colorAlpha){transparent++;continue}
    if(whiteMask?.[y*width+x]){transparent++;continue}
    const distance = Math.min(sides[0] ? y : Infinity, sides[1] ? width - 1 - x : Infinity, sides[2] ? height - 1 - y : Infinity, sides[3] ? x : Infinity) - trim
    const t = feather > 0 ? clamp(distance / feather) : distance < 0 ? 0 : 1
    const edgeAlpha = t * t * (3 - 2 * t)
    if (!edgeAlpha) { transparent++; continue }
    let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
    const left = (y * width + Math.max(0, x - 1)) * 4
    const right = (y * width + Math.min(width - 1, x + 1)) * 4
    const top = (Math.max(0, y - 1) * width + x) * 4
    const bottom = (Math.min(height - 1, y + 1) * width + x) * 4
    if (s.sharpness) {
      const sharpen = (value: number, channel: number) => {
        let sum = 0, weights = 0
        for (const j of [left, right, top, bottom]) { const alpha = data[j + 3] / 255; sum += data[j + channel] / 255 * alpha; weights += alpha }
        return clamp(value + (value - (weights ? sum / weights : value)) * s.sharpness! / 100 * 6)
      }
      r = sharpen(r, 0); g = sharpen(g, 1); b = sharpen(b, 2)
    }
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let coverage: number
    if (processingBackground === 'black') {
      coverage = max <= s.tolerance / 255 ? 0 : clamp((max - s.tolerance / 255) / (1 - s.tolerance / 255))
      // Remove the black matte so sparse dots do not become dark halos.
      if (max > 0) { r /= max; g /= max; b /= max }
      if(backgroundCleanup>0 && max>0 && max<48/255){
        // Near-black residues become very bright when divided by their tiny
        // peak channel. Suppress their coverage and limit that gain locally.
        // Smoothly leave shadows between peak 8 and 48; never change brighter
        // colors or their channel ratios. This is not semantic noise detection.
        const t=clamp((max-8/255)/(40/255))
        const amount=backgroundCleanup*(1-t*t*(3-2*t))
        coverage*=1-amount
        const gainReduction=max/(max+(48/255-max)*amount)
        r*=gainReduction;g*=gainReduction;b*=gainReduction
      }
    } else if (processingBackground === 'white' && whiteMask) {
      // Interior colors (including white fur and pale details) stay intact.
      coverage=1
    } else if (processingBackground === 'white') {
      coverage = min >= s.whiteCutoff / 255 ? 0 : clamp(1 - min / (s.whiteCutoff / 255))
      if (min < 1) { r = (r - min) / (1 - min); g = (g - min) / (1 - min); b = (b - min) / (1 - min) }
      if(coverage>0&&whiteDetail>0){
        // Print more pixels with a lighter ink color instead of just enlarging
        // dark dots. Preserve their composite on white at neutral settings:
        // (1 - newInk) * newCoverage = (1 - oldInk) * oldCoverage.
        // A coverage-independent floor made high detail look like a uniformly
        // perforated photograph. Keep both endpoints and tonal ordering, even
        // for projects saved with detail at 90–100%.
        const detailedCoverage=coverage+coverage*(1-coverage)*whiteDetail
        const ratio=coverage/detailedCoverage
        r=1-(1-r)*ratio;g=1-(1-g)*ratio;b=1-(1-b)*ratio
        coverage=detailedCoverage
      }
      if(backgroundCleanup>0 && min>207/255 && min<1){
        // Mirror the near-black cleanup around white, after detail compensation
        // so whiteDetail cannot refill the coverage removed here. Move ink
        // toward white rather than toward black to avoid dark fringes.
        const peak=1-min
        const t=clamp((peak-8/255)/(40/255))
        const amount=backgroundCleanup*(1-t*t*(3-2*t))
        coverage*=1-amount
        const gainReduction=peak/(peak+(48/255-peak)*amount)
        r=1-(1-r)*gainReduction;g=1-(1-g)*gainReduction;b=1-(1-b)*gainReduction
      }
    } else coverage = s.enabled === false ? 1 : 1 - (.2126 * r + .7152 * g + .0722 * b)
    const removed = coverage === 0 && s.background !== 'none'
    if (removed) { transparent++; continue }
    coverage = clamp((coverage - .5) * s.contrast / 100 + .5 + (s.brightness - 100) / 100)
    if (s.invert) coverage = 1 - coverage
    coverage = Math.pow(coverage, 1 / (s.gamma ?? 1))
    coverage = clamp(coverage * (s.enabled === false ? 1 : (s.size / 100) ** 2)) * data[i + 3] / 255 * edgeAlpha * colorAlpha
    let hits = s.enabled === false ? coverage * samples : 0
    if (s.enabled !== false) for (const oy of offsets) for (const ox of offsets) {
      const rx = ((x + ox) * cos + (y + oy) * sin) / pitch
      const ry = (-(x + ox) * sin + (y + oy) * cos) / pitch
      const u = Math.abs(rx - Math.floor(rx) - .5) * 2
      const v = Math.abs(ry - Math.floor(ry) - .5) * 2
      // Circular dots join smoothly into solids in highlights.
      const threshold = s.shape === 'line' ? v : s.shape === 'square' ? Math.max(u, v) ** 2 : circleRanks[Math.min(4096, Math.round((u * u + v * v) * 2048))]
      if (coverage > threshold) hits++
    }
    if (!hits) { transparent++; continue }
    const mono = s.background === 'black' ? 255 : 0
    output[i] = s.preserveColor ? r * 255 : mono
    output[i + 1] = s.preserveColor ? g * 255 : mono
    output[i + 2] = s.preserveColor ? b * 255 : mono
    output[i + 3] = solidAlpha ? 255 : hits * 255 / samples
  }
  // Apply the corner radius to the final alpha mask as a second pass. Doing
  // this after screening/background removal guarantees that the visible design
  // (rather than the source canvas or matte) gets rounded corners.
  if (cornerRadius > 0) {
    let ox=width, oy=height, ex=-1, ey=-1
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      if (output[(y*width+x)*4+3] > 0) { ox=Math.min(ox,x); oy=Math.min(oy,y); ex=Math.max(ex,x); ey=Math.max(ey,y) }
    }
    if (ex >= ox && ey >= oy) {
      const rx=Math.min(cornerRadius,(ex-ox+1)/2), ry=Math.min(cornerRadius,(ey-oy+1)/2)
      for (let y=oy;y<=ey;y++) for (let x=ox;x<=ex;x++) {
        const cx=Math.max(ox+rx,Math.min(ex+1-rx,x+.5))
        const cy=Math.max(oy+ry,Math.min(ey+1-ry,y+.5))
        const i=(y*width+x)*4
        if (output[i+3] && ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2>1) { output[i]=output[i+1]=output[i+2]=output[i+3]=0; transparent++ }
      }
    }
  }
  return { data: output, transparent: Math.round(transparent / (width * height) * 100) }
}
