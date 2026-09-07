import { useEffect, useRef, useState } from 'react'
import { pack } from './packing'
import { inspectPng, withPngDpi } from './print'

type Asset = {id:string;name:string;img:HTMLImageElement;widthCm:number;heightCm:number;quantity:number}
type Props = {source?:{id:number;blob:Blob;widthCm:number;name:string}}

export default function GangSheet({source}: Props) {
  const [items,setItems] = useState<Asset[]>([])
  const [width,setWidth] = useState(58)
  const [height,setHeight] = useState(100)
  const [dpi,setDpi] = useState(300)
  const [gap,setGap] = useState(5)
  const [rotate,setRotate] = useState(true)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const preview = useRef<HTMLCanvasElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const imported = useRef(0)

  async function add(blob:Blob,name:string,widthCm?:number) {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    try {
      await new Promise<void>((resolve,reject) => {img.onload=()=>resolve();img.onerror=()=>reject(new Error(`No se pudo abrir ${name}.`));img.src=url})
      let nativeDpi = 300
      if (blob.type === 'image/png' && !widthCm) {
        try {const info = inspectPng(new Uint8Array(await blob.arrayBuffer())); if(info.dpi > 0) nativeDpi = info.dpi} catch { /* Images without print metadata assume 300 ppp. */ }
      }
      const w = widthCm || img.naturalWidth / nativeDpi * 2.54
      setItems(previous => [...previous,{id:crypto.randomUUID(),name,img,widthCm:w,heightCm:w*img.naturalHeight/img.naturalWidth,quantity:1}])
    } finally {URL.revokeObjectURL(url)}
  }
  useEffect(() => {
    if (!source || imported.current === source.id) return
    imported.current = source.id
    add(source.blob,source.name,source.widthCm).catch(e=>setError(e.message))
  },[source])

  let layout: ReturnType<typeof pack> = {placements:[],missing:0,usedHeight:0}
  let layoutError = ''
  try {layout=pack(items,width,height,gap/10,rotate)} catch(e){layoutError=(e as Error).message}
  const pxW=Math.round(width/2.54*dpi), pxH=Math.round(height/2.54*dpi)
  const tooBig = pxW*pxH>100_000_000 || pxW>16000 || pxH>16000
  const invalid = !!layoutError || tooBig || pxW<1 || pxH<1 || !items.length || layout.missing>0

  function draw(canvas:HTMLCanvasElement,w:number,h:number) {
    canvas.width=w;canvas.height=h
    const ctx=canvas.getContext('2d')!
    ctx.clearRect(0,0,w,h)
    ctx.imageSmoothingQuality='high'
    const scaleX=w/width,scaleY=h/height
    for(const p of layout.placements) {
      const asset=items.find(i=>i.id===p.id)!
      ctx.save()
      ctx.translate(p.x*scaleX,p.y*scaleY)
      if(p.rotated){ctx.translate(p.width*scaleX,0);ctx.rotate(Math.PI/2);ctx.drawImage(asset.img,0,0,p.height*scaleY,p.width*scaleX)}
      else ctx.drawImage(asset.img,0,0,p.width*scaleX,p.height*scaleY)
      ctx.restore()
    }
  }
  useEffect(()=>{
    if(!preview.current || layoutError || width<=0 || height<=0) return
    const scale=Math.min(1400/width,1400/height)
    draw(preview.current,Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)))
    setMessage('')
  },[items,width,height,gap,rotate])

  async function exportSheet() {
    if(invalid || busy) return
    setBusy(true);setError('');setMessage('')
    const canvas=document.createElement('canvas')
    try{
      draw(canvas,pxW,pxH)
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo exportar. Reduce el tamaño de plancha.')),'image/png'))
      const bytes=withPngDpi(new Uint8Array(await blob.arrayBuffer()),dpi)
      const check=inspectPng(bytes)
      if(check.width!==pxW || check.height!==pxH || Math.abs(check.dpi-dpi)>.02)throw new Error('La exportación no coincide con las medidas.')
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}))
      const link=document.createElement('a');link.href=url;link.download=`gang-sheet-${width}x${height}cm-${dpi}ppp.png`;document.body.append(link);link.click();link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),60000)
      setMessage(`PNG verificado: ${pxW} × ${pxH} px · ${dpi} ppp. Descarga solicitada.`)
    }catch(e){setError((e as Error).message)}finally{canvas.width=canvas.height=1;setBusy(false)}
  }

  return <section className="workspace gang-workspace"><aside className="sidebar">
    <div className="sidebar-title">Gang Sheet</div>
    <div className="control-card open"><div className="section-heading">Plancha de impresión</div><div className="section-body">
      <div className="dimension-fields"><label>Ancho (cm)<input type="number" aria-label="Ancho de plancha" min="1" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><label>Alto (cm)<input type="number" aria-label="Alto de plancha" min="1" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label></div>
      <label className="field">Resolución<select aria-label="Resolución de plancha" value={dpi} onChange={e=>setDpi(Number(e.target.value))}><option value="150">150 ppp</option><option value="300">300 ppp</option><option value="600">600 ppp</option></select></label>
      <label className="field">Separación y margen (mm)<input aria-label="Separación de diseños" type="number" min="0" max="50" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label>
      <label className="help-text"><input type="checkbox" checked={rotate} onChange={e=>setRotate(e.target.checked)}/> Permitir giro de 90°</label>
      <p className="help-text">Distribución automática por filas. {pxW} × {pxH} px.</p>
      <button className="btn" onClick={()=>input.current?.click()}>Añadir diseños PNG / imágenes</button>
      <input hidden ref={input} type="file" accept="image/png,image/webp,image/jpeg" multiple onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';for(const file of files){try{await add(file,file.name)}catch(err){setError((err as Error).message)}}}}/>
      <p className="help-text">Usa “Enviar a Gang Sheet” en el editor para añadir el resultado con transparencia. Los archivos importados se colocan tal como están; PNG sin resolución usa 300 ppp.</p>
    </div></div>
    {items.map(item=><div className="control-card" key={item.id}><div className="section-body"><div className="asset-title"><span>{item.name}</span><button aria-label={`Quitar ${item.name}`} onClick={()=>setItems(all=>all.filter(i=>i.id!==item.id))}>×</button></div><div className="dimension-fields"><label>Ancho (cm)<input type="number" min="0.1" step="0.1" value={Number(item.widthCm.toFixed(2))} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,widthCm:Number(e.target.value),heightCm:Number(e.target.value)*i.img.naturalHeight/i.img.naturalWidth}:i))}/></label><label>Copias<input aria-label={`Copias de ${item.name}`} type="number" min="1" max="200" value={item.quantity} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,quantity:Number(e.target.value)}:i))}/></label></div><p className="help-text">Alto proporcional: {item.heightCm.toFixed(2)} cm</p></div></div>)}
    {layoutError && <p role="alert" className="error-text">{layoutError}</p>}
    {tooBig && <p role="alert" className="error-text">Máximo 100 megapíxeles y 16.000 px por lado. Reduce la plancha o los ppp.</p>}
    {layout.missing>0 && <p role="alert" className="error-text">{layout.missing} copias no caben. Amplía la plancha o reduce copias/tamaños para exportar todo.</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </aside><div className="gang-stage"><div className="gang-toolbar"><span>{layout.placements.length} diseños · {layout.usedHeight.toFixed(1)} cm de alto ocupado</span><button className="btn export" disabled={invalid||busy} onClick={exportSheet}>{busy?'Exportando…':'Exportar Gang Sheet'}</button></div><div className="gang-preview"><canvas ref={preview}/>{!items.length && <div className="empty-gang">Añade tu primer diseño desde el editor o importa un PNG.</div>}</div><div className="gang-status" role="status">{message || 'Plancha transparente · El damero no se exporta'}</div></div></section>
}
