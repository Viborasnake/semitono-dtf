export const MAX_PIXELS = 40_000_000

export function printSize(widthCm: number, ratio: number, dpi: number) {
  if (![widthCm, ratio, dpi].every(Number.isFinite) || widthCm <= 0 || ratio <= 0 || dpi < 72 || dpi > 1200) {
    throw new Error('Introduce un ancho mayor que cero y una resolución válida.')
  }
  const width = Math.max(1, Math.round(widthCm / 2.54 * dpi))
  const height = Math.max(1, Math.round(width / ratio))
  if (width > 12000 || height > 12000 || width * height > MAX_PIXELS) {
    throw new Error('El tamaño supera 40 megapíxeles o 12.000 px por lado. Reduce los centímetros o los ppp.')
  }
  return { width, height, widthCm: width / dpi * 2.54, heightCm: height / dpi * 2.54 }
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunks(bytes: Uint8Array) {
  if (bytes.length < 33 || bytes.slice(0, 8).some((v, i) => v !== [137,80,78,71,13,10,26,10][i])) throw new Error('PNG inválido.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const result: { start: number; end: number; type: string }[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + length + 12
    if (end > bytes.length) throw new Error('PNG incompleto.')
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) throw new Error('PNG con error de integridad.')
    result.push({ start: offset, end, type })
    offset = end
  }
  if (offset !== bytes.length || result[0]?.type !== 'IHDR' || result.at(-1)?.type !== 'IEND') throw new Error('Estructura PNG inválida.')
  return result
}

// Canvas normally emits 96 DPI. Write explicit physical resolution without
// modifying IDAT pixels or the alpha channel, replacing any existing pHYs.
export function withPngDpi(bytes: Uint8Array, dpi: number) {
  if(!Number.isFinite(dpi)||dpi<72||dpi>1200) throw new Error('Resolución PNG inválida.')
  const parts = chunks(bytes)
  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([112,72,89,115], 4)
  view.setUint32(8, Math.round(dpi / .0254))
  view.setUint32(12, Math.round(dpi / .0254))
  chunk[16] = 1
  view.setUint32(17, crc32(chunk.subarray(4, 17)))
  const size = 8 + 21 + parts.filter(p => p.type !== 'pHYs').reduce((n, p) => n + p.end - p.start, 0)
  const result = new Uint8Array(size)
  result.set(bytes.subarray(0, 8))
  let offset = 8
  for (const p of parts) {
    if (p.type === 'pHYs') continue
    result.set(bytes.subarray(p.start, p.end), offset)
    offset += p.end - p.start
    if (p.type === 'IHDR') { result.set(chunk, offset); offset += chunk.length }
  }
  return result
}

// Only for pixels already rendered into an sRGB canvas, not arbitrary source files.
export function withCanvasPrintProfile(bytes:Uint8Array,dpi:number) {
  const tagged=withPngDpi(bytes,dpi)
  const parts=chunks(tagged).filter(p=>!['sRGB','iCCP','gAMA','cHRM','cICP','mDCV','cLLI'].includes(p.type))
  const srgb=new Uint8Array(13),view=new DataView(srgb.buffer)
  view.setUint32(0,1);srgb.set([115,82,71,66],4);srgb[8]=0
  view.setUint32(9,crc32(srgb.subarray(4,9)))
  const result=new Uint8Array(8+srgb.length+parts.reduce((n,p)=>n+p.end-p.start,0))
  result.set(tagged.subarray(0,8));let offset=8
  for(const p of parts){result.set(tagged.subarray(p.start,p.end),offset);offset+=p.end-p.start;if(p.type==='IHDR'){result.set(srgb,offset);offset+=srgb.length}}
  return result
}

export function resolutionCheck(item:{naturalWidth:number;naturalHeight:number;widthCm:number;heightCm:number},dpi:number) {
  const width=Math.round(item.widthCm/2.54*dpi),height=Math.round(item.heightCm/2.54*dpi)
  return {width,height,effectiveDpi:item.naturalWidth/item.widthCm*2.54,
    matches:width===item.naturalWidth&&height===item.naturalHeight}
}

export function inspectPng(bytes: Uint8Array) {
  const parts = chunks(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const phys = parts.find(p => p.type === 'pHYs')
  return {
    width: view.getUint32(16), height: view.getUint32(20), colorType: bytes[25],
    profile: parts.some(p=>p.type==='sRGB')?'sRGB':parts.some(p=>p.type==='iCCP')?'ICC':'sin etiqueta',
    dpi: phys && bytes[phys.start + 16] === 1 ? view.getUint32(phys.start + 8) * .0254 : 0,
    dpiY: phys && bytes[phys.start + 16] === 1 ? view.getUint32(phys.start + 12) * .0254 : 0,
  }
}
