import {useEffect,useRef,useState} from 'react'
import {Pipette,Plus,X} from 'lucide-react'
import {colorRangeRetention,selectionBrushMask,selectionCoverage,type ColorRange} from './color-range'
import type {CropRect} from './CropPanel'

export default function ColorRangePanel({image,crop,initial,onApply,onCancel,purpose='background'}:{image:HTMLImageElement;crop:CropRect|null;initial:ColorRange;onApply:(value:ColorRange)=>void;onCancel:()=>void;purpose?:'background'|'isolated'|'affected'|'protected'}) {
  const screening=purpose==='affected'||purpose==='protected'
  const [range,setRange]=useState<ColorRange>(()=>structuredClone(initial))
  const [brush,setBrush]=useState<'sample'|'paint'|'erase'>('sample')
  const [brushSize,setBrushSize]=useState(30)
  const strokePoint=useRef<{x:number;y:number;id:number}|null>(null)
  const brushHistory=useRef<ColorRange[]>([])
  const [add,setAdd]=useState(false),[selection,setSelection]=useState(true),[message,setMessage]=useState(''),[sourceZoom,setSourceZoom]=useState(1)
  const source=useRef<HTMLCanvasElement>(null),preview=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLElement>(null)
  const region=crop??{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight}
  const scale=Math.min(520/region.width,460/region.height,1)
  const width=Math.max(1,Math.round(region.width*scale)),height=Math.max(1,Math.round(region.height*scale))
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    dialog.current?.focus()
    return ()=>previous?.focus()
  },[])
  useEffect(()=>{
    const canvas=source.current!,ctx=canvas.getContext('2d')!
    canvas.width=width;canvas.height=height
    ctx.imageSmoothingEnabled=false
    ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,width,height)
    const pixels=ctx.getImageData(0,0,width,height)
    const target=preview.current!;target.width=width;target.height=height
    const retain=colorRangeRetention(range)
    const mask=screening?selectionBrushMask(range,width,height):null
    for(let i=0;i<pixels.data.length;i+=4){
      const alpha=pixels.data[i+3]/255,retention=retain(pixels.data[i],pixels.data[i+1],pixels.data[i+2])
      const kept=screening?1-selectionCoverage(range,retention,mask?.[i/4]):retention
      if(selection){const removed=(1-kept)*alpha*255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=removed;pixels.data[i+3]=255}
      else pixels.data[i+3]*=screening?1-kept:kept
    }
    target.getContext('2d')!.putImageData(pixels,0,0)
    if(screening&&mask){
      const overlay=ctx.createImageData(width,height)
      for(let p=0;p<mask.length;p++)if(mask[p]){overlay.data[p*4]=mask[p]===1?255:0;overlay.data[p*4+1]=mask[p]===2?220:60;overlay.data[p*4+2]=120;overlay.data[p*4+3]=100}
      const layer=document.createElement('canvas');layer.width=width;layer.height=height;layer.getContext('2d')!.putImageData(overlay,0,0);ctx.drawImage(layer,0,0)
    }
  },[image,region.x,region.y,region.width,region.height,width,height,range,selection,screening])
  function sample(e:React.MouseEvent<HTMLCanvasElement>){
    if(brush!=='sample')return
    const box=e.currentTarget.getBoundingClientRect()
    const x=region.x+Math.min(region.width-1,Math.max(0,Math.floor((e.clientX-box.left)/box.width*region.width)))
    const y=region.y+Math.min(region.height-1,Math.max(0,Math.floor((e.clientY-box.top)/box.height*region.height)))
    const pixel=document.createElement('canvas');pixel.width=pixel.height=1
    const ctx=pixel.getContext('2d')!;ctx.drawImage(image,x,y,1,1,0,0,1,1)
    const rgba=ctx.getImageData(0,0,1,1).data
    if(!rgba[3]){setMessage('Ese píxel ya es transparente. Elige un color visible.');return}
    const color='#'+Array.from(rgba.slice(0,3),c=>c.toString(16).padStart(2,'0')).join('')
    if(add&&range.colors.length>=8&&!range.colors.includes(color)){setMessage('Máximo 8 muestras. Quita una para añadir otra.');return}
    setRange(r=>({...r,colors:add?[...new Set([...r.colors,color])]:[color]}));setMessage(`Color muestreado: ${color.toUpperCase()}`)
  }
  function paint(e:React.PointerEvent<HTMLCanvasElement>,start=false){
    if(!screening||brush==='sample')return
    if(!start&&strokePoint.current?.id!==e.pointerId)return
    e.preventDefault()
    const box=e.currentTarget.getBoundingClientRect()
    const x=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))
    if(start){brushHistory.current=[...brushHistory.current.slice(-29),structuredClone(range)];e.currentTarget.setPointerCapture(e.pointerId)}
    const previous=start?{x,y}:strokePoint.current!
    setRange(r=>(r.strokes?.length??0)>=20000?r:{...r,strokes:[...(r.strokes??[]),{x:previous.x,y:previous.y,toX:x,toY:y,radius:Math.min(1,brushSize/(2*width)),erase:brush==='erase'}]})
    strokePoint.current={x,y,id:e.pointerId}
  }
  return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="import-modal color-range-modal" role="dialog" aria-modal="true" aria-labelledby="color-range-title" onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();onCancel()}
    if(e.key==='Tab'){
      const items=Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select'))
      const first=items[0],last=items.at(-1)
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus()}
    }
  }}>
    <header><h2 id="color-range-title">{screening?(purpose==='affected'?'Colores con trama':'Colores protegidos'):purpose==='isolated'?'Color del sustrato':'Rango de color'}</h2><button className="btn" aria-label="Cerrar rango de color" onClick={onCancel}><X size={18}/></button></header>
    {screening&&<p className="help-text">Elige muestras en el original. En la máscara, blanco = seleccionado, negro = fuera de la selección y gris = transición. Esta selección {purpose==='affected'?'limita dónde aparece la trama':'conserva las zonas seleccionadas sin trama'}.</p>}
    {screening&&<div className="range-toolbar">
      <div className="segmented" role="group" aria-label="Herramienta de selección">{([['sample','Gotero'],['paint','Pincel · añadir'],['erase','Pincel · excluir']] as const).map(([value,label])=><button key={value} aria-pressed={brush===value} className={brush===value?'active':''} onClick={()=>setBrush(value)}>{label}</button>)}</div>
      <label className="field">Tamaño del pincel<input type="range" min="2" max="120" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}/></label>
      <label><input type="checkbox" checked={range.useColors!==false} onChange={e=>setRange(r=>({...r,useColors:e.target.checked}))}/> Incluir selección por color</label>
      <button className="btn" disabled={!brushHistory.current.length} onClick={()=>{const previous=brushHistory.current.pop();if(previous)setRange(previous)}}>Deshacer pincel</button>
      <button className="btn" disabled={!range.strokes?.length} onClick={()=>{brushHistory.current.push(structuredClone(range));setRange(r=>({...r,strokes:[]}))}}>Limpiar pincel</button>
      <p className="help-text">Pinta sobre el original: verde añade y rojo excluye. Desactiva «Incluir selección por color» para seleccionar sólo con pincel. Los trazos se ajustan al tamaño de salida.</p>
    </div>}
    {!screening&&<p className="help-text">{purpose==='isolated'?'Elige con el gotero el color de la prenda o sustrato que quieres restar. El semitono aislado actuará únicamente en la transición creada por la tolerancia y la suavidad; el diseño sólido permanecerá intacto.':'Haz clic en el original para elegir el color que quieres quitar. Las muestras se toman antes de las correcciones de imagen.'}</p>}
    <div className="range-toolbar"><div className="segmented" aria-label="Modo de muestreo"><button className={!add?'active':''} aria-pressed={!add} onClick={()=>setAdd(false)}><Pipette size={16}/> Reemplazar muestra</button><button className={add?'active':''} aria-pressed={add} onClick={()=>setAdd(true)}><Plus size={16}/> Añadir muestra</button></div><label className="field">Vista previa<select value={selection?'mask':'image'} onChange={e=>setSelection(e.target.value==='mask')}><option value="mask">Selección</option><option value="image">Imagen recortada</option></select></label></div>
    <div className="range-preview-grid">
      <figure><div className="range-figure-head"><figcaption>Original <span>· {brush==='sample'?'haz clic para usar el gotero':'arrastra para pintar la selección'}</span></figcaption><div className="range-zoom" aria-label="Zoom del gotero"><span>Zoom</span><button className="btn" disabled={sourceZoom===1} onClick={()=>setSourceZoom(z=>Math.max(1,z/2))} aria-label="Alejar el gotero">−</button><output>{sourceZoom}×</output><button className="btn" disabled={sourceZoom===8} onClick={()=>setSourceZoom(z=>Math.min(8,z*2))} aria-label="Acercar el gotero">+</button><button className="btn" disabled={sourceZoom===1} onClick={()=>setSourceZoom(1)}>Ajustar</button></div></div><div className="range-canvas-wrap range-source-wrap"><canvas ref={source} className="range-source-canvas" style={{width:`${width*sourceZoom}px`,height:`${height*sourceZoom}px`,touchAction:brush==='sample'?'auto':'none'}} onClick={sample} onPointerDown={e=>paint(e,true)} onPointerMove={e=>paint(e)} onPointerUp={()=>{strokePoint.current=null}} onPointerCancel={()=>{strokePoint.current=null}} onLostPointerCapture={()=>{strokePoint.current=null}} aria-label="Imagen original para muestrear color y pintar selección"/></div></figure>
      <figure><div className="range-figure-head"><figcaption>{selection?'Selección':'Imagen recortada'} <span>{screening?'· blanco = seleccionado, negro = fuera':'· blanco = quitar, negro = conservar'}</span></figcaption></div><div className="range-canvas-wrap"><canvas ref={preview}/></div></figure>
    </div>
    <div className="range-swatches">{range.colors.map((color,i)=><div key={i}><input type="color" aria-label={`Color a quitar ${i+1}`} value={color} onChange={e=>setRange(r=>({...r,colors:r.colors.map((c,j)=>j===i?e.target.value:c)}))}/><span>{color.toUpperCase()}</span><button className="btn" disabled={range.colors.length===1} aria-label={`Quitar muestra ${i+1}`} onClick={()=>setRange(r=>({...r,colors:r.colors.filter((_,j)=>j!==i)}))}><X size={14}/></button></div>)}</div>
    <div className="dimension-fields">{(['tolerance','softness'] as const).map((key,i)=><label className="range-control" key={key}><span><b>{i?'Suavidad del rango':'Tolerancia de color'}</b><output>{range[key]}%</output></span><input aria-label={i?'Suavidad del rango':'Tolerancia de color'} type="range" min="0" max="100" value={range[key]} style={{'--progress':`${range[key]}%`} as React.CSSProperties} onChange={e=>setRange(r=>({...r,[key]:Number(e.target.value)}))}/></label>)}</div>
    <p className="help-text">La tolerancia amplía la selección; la suavidad crea una transición. Afecta todas las zonas del mismo color, incluso detalles interiores. No identifica objetos.</p>
    <p className="help-text" role="status">{message||'Sin cambios en el diseño hasta pulsar Aplicar.'}</p>
    <div className="modal-actions"><button className="btn" onClick={onCancel}>Cancelar</button><button className="btn export" onClick={()=>onApply(range)}>{screening?'Aplicar selección':purpose==='isolated'?'Quitar color y aplicar aislado':'Aplicar rango de color'}</button></div>
  </section></div>
}
