export type HalftoneSettings = {
  lpi: number; angle: number; shape: 'circle' | 'square' | 'line'; size: number
  contrast: number; brightness: number; whiteCutoff: number
  preserveColor: boolean; invert: boolean
  background: 'black' | 'white' | 'none'; tolerance: number
  dpi?: number; enabled?: boolean; featherMm?: number; trimMm?: number
  edgeSides?: boolean[]
  sharpness?: number; gamma?: number; solidAlpha?: boolean; cornerRadiusMm?: number
}

// Clustered ordered screening: retain the source detail inside each dot.
// Four subpixel samples antialias the mask without blurring the artwork.
export function halftone(data: Uint8ClampedArray, width: number, height: number, s: HalftoneSettings) {
  const output = new Uint8ClampedArray(data.length)
  const dpi = s.dpi ?? 300
  const pitch = dpi / s.lpi
  const feather = (s.featherMm ?? 0) / 25.4 * dpi
  const trim = (s.trimMm ?? 0) / 25.4 * dpi
  const cornerRadius = Math.max(0, (s.cornerRadiusMm ?? 0) / 25.4 * dpi)
  const sides = s.edgeSides ?? [true, true, true, true]
  const circleRanks = Float64Array.from({length: 4097}, (_, i) => {
    const d = i / 2048
    return d <= 1 ? Math.PI * d / 4 : Math.PI * d / 4 - d * Math.acos(1 / Math.sqrt(d)) + Math.sqrt(d - 1)
  })
  const angle = s.angle * Math.PI / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const offsets = [.25, .75]
  let transparent = 0
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    if (!data[i + 3]) { transparent++; continue }
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
    if (s.background === 'black') {
      coverage = max <= s.tolerance / 255 ? 0 : clamp((max - s.tolerance / 255) / (1 - s.tolerance / 255))
      // Remove the black matte so sparse dots do not become dark halos.
      if (max > 0) { r /= max; g /= max; b /= max }
    } else if (s.background === 'white') {
      coverage = min >= s.whiteCutoff / 255 ? 0 : clamp(1 - min / (s.whiteCutoff / 255))
      if (min < 1) { r = (r - min) / (1 - min); g = (g - min) / (1 - min); b = (b - min) / (1 - min) }
    } else coverage = s.enabled === false ? 1 : 1 - (.2126 * r + .7152 * g + .0722 * b)
    const removed = coverage === 0 && s.background !== 'none'
    if (removed) { transparent++; continue }
    coverage = clamp((coverage - .5) * s.contrast / 100 + .5 + (s.brightness - 100) / 100)
    if (s.invert) coverage = 1 - coverage
    coverage = Math.pow(coverage, 1 / (s.gamma ?? 1))
    coverage = clamp(coverage * (s.enabled === false ? 1 : (s.size / 100) ** 2)) * data[i + 3] / 255 * edgeAlpha
    let hits = s.enabled === false ? coverage * 4 : 0
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
    output[i + 3] = (s.solidAlpha === true || (s.enabled !== false && s.solidAlpha !== false)) ? 255 : hits * 255 / 4
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
