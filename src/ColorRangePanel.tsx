import {useEffect,useRef,useState} from 'react'
import {Pipette,Plus,X} from 'lucide-react'
import {colorRangeRetention,type ColorRange} from './color-range'
import type {CropRect} from './CropPanel'

export default function ColorRangePanel({image,crop,initial,onApply,onCancel}:{image:HTMLImageElement;crop:CropRect|null;initial:ColorRange;onApply:(value:ColorRange)=>void;onCancel:()=>void}) {
  const [range,setRange]=useState<ColorRange>(()=>structuredClone(initial))
  const [add,setAdd]=useState(false),[selection,setSelection]=useState(true),[message,setMessage]=useState('')
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
    for(let i=0;i<pixels.data.length;i+=4){
      const alpha=pixels.data[i+3]/255,kept=retain(pixels.data[i],pixels.data[i+1],pixels.data[i+2])
      if(selection){const removed=(1-kept)*alpha*255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=removed;pixels.data[i+3]=255}
      else pixels.data[i+3]*=kept
    }
    target.getContext('2d')!.putImageData(pixels,0,0)
  },[image,region.x,region.y,region.width,region.height,width,height,range,selection])
  function sample(e:React.MouseEvent<HTMLCanvasElement>){
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
  return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="import-modal color-range-modal" role="dialog" aria-modal="true" aria-labelledby="color-range-title" onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();onCancel()}
    if(e.key==='Tab'){
      const items=Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select'))
      const first=items[0],last=items.at(-1)
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus()}
    }
  }}>
    <header><h2 id="color-range-title">Rango de color</h2><button className="btn" aria-label="Cerrar rango de color" onClick={onCancel}><X size={18}/></button></header>
    <p className="help-text">Haz clic en el original para elegir el color que quieres quitar. Las muestras se toman antes de las correcciones de imagen.</p>
    <div className="range-preview-grid">
      <figure><figcaption>Original · haz clic para usar el gotero</figcaption><div className="range-canvas-wrap"><canvas ref={source} onClick={sample} aria-label="Imagen original para muestrear color"/></div></figure>
      <figure><figcaption>{selection?'Selección · blanco = quitar, negro = conservar':'Resultado del recorte · sin semitono'}</figcaption><div className="range-canvas-wrap"><canvas ref={preview}/></div></figure>
    </div>
    <div className="range-toolbar"><div className="segmented"><button className={!add?'active':''} aria-pressed={!add} onClick={()=>setAdd(false)}><Pipette size={16}/> Reemplazar muestra</button><button className={add?'active':''} aria-pressed={add} onClick={()=>setAdd(true)}><Plus size={16}/> Añadir muestra</button></div><label className="field">Vista previa<select value={selection?'mask':'image'} onChange={e=>setSelection(e.target.value==='mask')}><option value="mask">Selección</option><option value="image">Imagen recortada</option></select></label></div>
    <div className="range-swatches">{range.colors.map((color,i)=><div key={i}><input type="color" aria-label={`Color a quitar ${i+1}`} value={color} onChange={e=>setRange(r=>({...r,colors:r.colors.map((c,j)=>j===i?e.target.value:c)}))}/><span>{color.toUpperCase()}</span><button className="btn" disabled={range.colors.length===1} aria-label={`Quitar muestra ${i+1}`} onClick={()=>setRange(r=>({...r,colors:r.colors.filter((_,j)=>j!==i)}))}><X size={14}/></button></div>)}</div>
    <div className="dimension-fields">{(['tolerance','softness'] as const).map((key,i)=><label className="range-control" key={key}><span><b>{i?'Suavidad del rango':'Tolerancia de color'}</b><output>{range[key]}%</output></span><input aria-label={i?'Suavidad del rango':'Tolerancia de color'} type="range" min="0" max="100" value={range[key]} style={{'--progress':`${range[key]}%`} as React.CSSProperties} onChange={e=>setRange(r=>({...r,[key]:Number(e.target.value)}))}/></label>)}</div>
    <p className="help-text">La tolerancia amplía los colores eliminados; la suavidad crea una transición. Afecta todas las zonas del mismo color, incluso detalles interiores. No identifica objetos. Esta escala no equivale a la de Photoshop.</p>
    <p className="help-text" role="status">{message||'Sin cambios en el diseño hasta pulsar Aplicar.'}</p>
    <div className="modal-actions"><button className="btn" onClick={onCancel}>Cancelar</button><button className="btn export" onClick={()=>onApply(range)}>Aplicar rango de color</button></div>
  </section></div>
}
