export type PackItem = { id: string; widthCm: number; heightCm: number; quantity: number }
export type Placement = { id: string; x: number; y: number; width: number; height: number; rotated: boolean }
export function pack(items: PackItem[], width: number, height: number, gap: number, rotate: boolean) {
  if (![width,height,gap].every(Number.isFinite) || width <= 0 || height <= 0 || gap < 0) throw new Error('Dimensiones de plancha inválidas.')
  const expanded = items.flatMap(item => {
    if (![item.widthCm,item.heightCm,item.quantity].every(Number.isFinite) || item.widthCm <= 0 || item.heightCm <= 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 200) throw new Error('Cada diseño necesita tamaño positivo y entre 1 y 200 copias.')
    return Array.from({length:item.quantity}, () => item)
  })
  if (expanded.length > 200) throw new Error('Máximo 200 copias por plancha.')
  expanded.sort((a,b) => Math.max(b.heightCm,b.widthCm) - Math.max(a.heightCm,a.widthCm))
  const placements: Placement[] = []
  let x = gap, y = gap, rowHeight = 0, missing = 0
  for (const item of expanded) {
    const options = [{w:item.widthCm,h:item.heightCm,r:false}, ...(rotate ? [{w:item.heightCm,h:item.widthCm,r:true}] : [])]
    const fits = (xx:number, yy:number) => options.filter(o => xx + o.w <= width - gap + 1e-8 && yy + o.h <= height - gap + 1e-8).sort((a,b) => a.h-b.h)
    let candidates = fits(x,y)
    if (!candidates.length && x > gap) { x = gap; y += rowHeight + gap; rowHeight = 0; candidates = fits(x,y) }
    if (!candidates.length) { missing++; continue }
    const o = candidates[0]
    placements.push({id:item.id,x,y,width:o.w,height:o.h,rotated:o.r})
    x += o.w + gap
    rowHeight = Math.max(rowHeight,o.h)
  }
  return {placements,missing,usedHeight: placements.length ? Math.max(...placements.map(p=>p.y+p.height)) + gap : 0}
}
