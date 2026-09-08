import {useEffect, useRef, useState} from 'react'
import type {Placement} from './packing'
import {hitGangAsset} from './gang-selection'

type Props = {width:number;height:number;dpi:number;background:string;placements:Placement[];items:{id:string;img:CanvasImageSource;widthCm:number;heightCm:number}[];selectedId?:string|null;onSelect?:(id:string|null)=>void;onEdit?:(id:string)=>void}

export default function GangPreview({width,height,dpi,background,placements,items,selectedId,onSelect,onEdit}:Props) {
  const viewport=useRef<HTMLDivElement>(null)
  const canvas=useRef<HTMLCanvasElement>(null)
  const [size,setSize]=useState({width:1,height:1})
  const [zoom,setZoom]=useState<number|null>(null)
  const [scroll,setScroll]=useState({x:0,y:0})
  const pixelsW=Math.max(1,Math.round(width/2.54*dpi)||1)
  const pixelsH=Math.max(1,Math.round(height/2.54*dpi)||1)
  const fit=Math.max(.001,Math.min((size.width-48)/pixelsW,(size.height-48)/pixelsH))
  const scale=zoom??fit
  const sheetW=pixelsW*scale,sheetH=pixelsH*scale
  const areaW=Math.max(size.width,sheetW+48),areaH=Math.max(size.height,sheetH+48)
  useEffect(()=>{
    const el=viewport.current!
    const observer=new ResizeObserver(()=>setSize({width:el.clientWidth,height:el.clientHeight}))
    observer.observe(el)
    return ()=>observer.disconnect()
  },[])
  useEffect(()=>{
    const el=canvas.current!
    // Only allocate the visible viewport, even for very large 600 ppp sheets.
    el.width=size.width;el.height=size.height
    const ctx=el.getContext('2d',{colorSpace:'srgb'})!
    ctx.fillStyle='#0d1013';ctx.fillRect(0,0,size.width,size.height)
    ctx.save()
    ctx.translate((areaW-sheetW)/2-scroll.x,(areaH-sheetH)/2-scroll.y)
    ctx.beginPath();ctx.rect(0,0,sheetW,sheetH);ctx.clip()
    if(background==='checker') {
      const tile=document.createElement('canvas');tile.width=tile.height=16
      const t=tile.getContext('2d')!;t.fillStyle='#fff';t.fillRect(0,0,16,16)
      t.fillStyle='#d7d7d7';t.fillRect(0,0,8,8);t.fillRect(8,8,8,8)
      ctx.fillStyle=ctx.createPattern(tile,'repeat')!
    } else ctx.fillStyle=background
    ctx.fillRect(0,0,sheetW,sheetH)
    ctx.imageSmoothingEnabled=false
    for(const p of placements) {
      const item=items.find(i=>i.id===p.id)
      if(!item)continue
      ctx.save()
      ctx.translate(Math.round(p.x/2.54*dpi)*scale,Math.round(p.y/2.54*dpi)*scale)
      const w=Math.round(item.widthCm/2.54*dpi)*scale,h=Math.round(item.heightCm/2.54*dpi)*scale
      if(p.rotated){ctx.translate(h,0);ctx.rotate(Math.PI/2)}
      ctx.drawImage(item.img,0,0,w,h)
      if(p.id===selectedId){ctx.strokeStyle='#20dbc3';ctx.lineWidth=2;ctx.strokeRect(1,1,Math.max(0,w-2),Math.max(0,h-2))}
      ctx.restore()
    }
    ctx.restore()
  },[size,scroll,scale,areaW,areaH,sheetW,sheetH,dpi,background,placements,items,selectedId])
  function pick(clientX:number,clientY:number){
    const rect=canvas.current!.getBoundingClientRect()
    return hitGangAsset((clientX-rect.left-(areaW-sheetW)/2+scroll.x)/scale,(clientY-rect.top-(areaH-sheetH)/2+scroll.y)/scale,placements,items,dpi)
  }
  function changeZoom(next:number|null) {
    setZoom(next===null?null:Math.max(.005,Math.min(4,next)))
    viewport.current?.scrollTo(0,0)
    setScroll({x:0,y:0})
  }
  return <div className="gang-preview-panel">
    <div className="gang-zoom" role="group" aria-label="Zoom del Gang Sheet">
      <button className="btn" aria-label="Alejar Gang Sheet" onClick={()=>changeZoom(scale/1.25)}>−</button>
      <output aria-live="polite">{(scale*100).toFixed(1)}%</output>
      <button className="btn" aria-label="Acercar Gang Sheet" onClick={()=>changeZoom(scale*1.25)}>+</button>
      <button className="btn" aria-pressed={zoom===null} onClick={()=>changeZoom(null)}>Ajustar</button>
      <button className="btn" aria-pressed={zoom===1} onClick={()=>changeZoom(1)}>100%</button>
      <span>100% = 1 píxel de salida por píxel de vista · Desplázate para explorar</span>
    </div>
    <div className="gang-viewport" ref={viewport} tabIndex={0} aria-label="Plancha con desplazamiento horizontal y vertical" onScroll={e=>setScroll({x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop})}>
      <div style={{width:areaW,height:areaH}}><canvas ref={canvas} style={{width:size.width,height:size.height,cursor:'pointer'}} aria-label="Vista previa del Gang Sheet. Clic para seleccionar, doble clic para editar." onClick={e=>onSelect?.(pick(e.clientX,e.clientY))} onDoubleClick={e=>{const id=pick(e.clientX,e.clientY);if(id)onEdit?.(id)}}/></div>
    </div>
    {!items.length&&<div className="empty-gang">Añade tu primer diseño desde el editor o importa un PNG.</div>}
  </div>
}
