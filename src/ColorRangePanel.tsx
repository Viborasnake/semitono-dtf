import {useEffect,useRef,useState} from 'react'
import {X} from 'lucide-react'
import {colorRangeRetention,selectionBrushMask,selectionCoverage,type ColorRange} from './color-range'
import {removeBackground} from './background-stage'
import {processImage} from './process-image'
import type {Settings} from './App'
import type {CropRect} from './CropPanel'

type Props={image:HTMLImageElement;crop:CropRect|null;initial:ColorRange;onApply:(range:ColorRange)=>void;onCancel:()=>void;purpose?:'background'|'isolated'|'affected'|'protected';settings?:Settings&{dpi?:number};outputWidth?:number;processedSource?:HTMLCanvasElement|null}
export default function ColorRangePanel({image,crop,initial,onApply,onCancel,purpose='background',settings,outputWidth,processedSource}:Props){
  const screening=purpose==='affected'||purpose==='protected'
  const [range,setRange]=useState<ColorRange>(()=>structuredClone(initial))
  const [tool,setTool]=useState<'sample'|'paint'|'erase'>(screening&&initial.useColors===false?'paint':'sample')
  const [size,setSize]=useState(36),[zoom,setZoom]=useState(1),[add,setAdd]=useState(false)
  const [view,setView]=useState<'result'|'mask'|'background'>('result')
  const [stats,setStats]=useState({selected:0,visible:0,removed:0,holes:0})
  const [message,setMessage]=useState('')
  const left=useRef<HTMLCanvasElement>(null),right=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLElement>(null)
  const point=useRef<{x:number;y:number;id:number}|null>(null)
  const history=useRef<ColorRange[]>([])
  const baseImage=processedSource?.width?processedSource:image
  const region=processedSource?.width?{x:0,y:0,width:processedSource.width,height:processedSource.height}:crop??{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight}
  // Keep a detailed backing canvas for zoom, while the initial view still fits
  // comfortably in the dialog. The previous 520px bitmap was simply enlarged.
  const displayScale=Math.min(520/region.width,400/region.height,1)
  const renderScale=Math.min(1200/region.width,900/region.height,1)
  const width=Math.max(1,Math.round(region.width*renderScale)),height=Math.max(1,Math.round(region.height*renderScale))
  const displayWidth=Math.max(1,Math.round(region.width*displayScale)),displayHeight=Math.max(1,Math.round(region.height*displayScale))
  const [cursor,setCursor]=useState<{x:number;y:number}|null>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return()=>previous?.focus()},[])
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      const canvas=left.current!,ctx=canvas.getContext('2d')!
      if(canvas.width!==width)canvas.width=width
      if(canvas.height!==height)canvas.height=height
      ctx.clearRect(0,0,width,height);ctx.drawImage(baseImage,region.x,region.y,region.width,region.height,0,0,width,height)
      const original=ctx.getImageData(0,0,width,height)
      const previewSettings=settings?{...settings,separateBackground:true,dpi:(settings.dpi??300)*width/(outputWidth??region.width),
        ...(screening?(purpose==='affected'?{affectedColors:range,screenScope:'all' as const}:{protectedColors:range}):{background:'custom' as const,colorRange:range,enabled:false,solidAlpha:false})}:undefined
      const clean=previewSettings?removeBackground(original.data,width,height,previewSettings):new Uint8ClampedArray(original.data)
      const result=previewSettings?processImage(original.data,width,height,previewSettings).data:new Uint8ClampedArray(original.data)
      const retain=colorRangeRetention(range),brush=selectionBrushMask(range,width,height)
      const mask=new Uint8ClampedArray(original.data.length),overlay=ctx.createImageData(width,height)
      let selected=0,visible=0,removed=0,holes=0
      for(let p=0;p<width*height;p++){
        const i=p*4,selection=selectionCoverage(range,retain(original.data[i],original.data[i+1],original.data[i+2]),brush?.[p])
        if(original.data[i+3]&&!clean[i+3])removed++
        if(clean[i+3]){visible++;if(!result[i+3])holes++}
        const available=screening?clean[i+3]/255:original.data[i+3]/255
        selected+=selection*available
        mask[i]=mask[i+1]=mask[i+2]=selection*available*255;mask[i+3]=255
        if(selection&&available){overlay.data[i]=purpose==='protected'?255:20;overlay.data[i+1]=purpose==='protected'?190:220;overlay.data[i+2]=purpose==='protected'?40:180;overlay.data[i+3]=selection*available*100}
      }
      if(screening){ctx.putImageData(new ImageData(new Uint8ClampedArray(clean),width,height),0,0);const layer=document.createElement('canvas');layer.width=width;layer.height=height;layer.getContext('2d')!.putImageData(overlay,0,0);ctx.drawImage(layer,0,0)}
      const target=right.current!;if(target.width!==width)target.width=width;if(target.height!==height)target.height=height
      target.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(view==='mask'?mask:view==='background'?clean:result),width,height),0,0)
      setStats({selected:Math.round(selected),visible,removed,holes})
    })
    return()=>cancelAnimationFrame(frame)
  },[baseImage,region.x,region.y,region.width,region.height,width,height,range,settings,outputWidth,view,purpose,screening])
  function saveHistory(){history.current=[...history.current.slice(-29),structuredClone(range)]}
  function sample(e:React.MouseEvent<HTMLCanvasElement>){
    if(tool!=='sample')return
    const box=e.currentTarget.getBoundingClientRect()
    const x=region.x+Math.min(region.width-1,Math.max(0,Math.floor((e.clientX-box.left)/box.width*region.width)))
    const y=region.y+Math.min(region.height-1,Math.max(0,Math.floor((e.clientY-box.top)/box.height*region.height)))
    const pixel=document.createElement('canvas');pixel.width=pixel.height=1;const ctx=pixel.getContext('2d')!;ctx.drawImage(baseImage,x,y,1,1,0,0,1,1)
    const rgba=ctx.getImageData(0,0,1,1).data
    if(!rgba[3]){setMessage('Elige un píxel visible.');return}
    const color='#'+Array.from(rgba.slice(0,3),c=>c.toString(16).padStart(2,'0')).join('')
    if(add&&range.useColors!==false&&range.colors.length>=8&&!range.colors.includes(color)){setMessage('Máximo 8 muestras.');return}
    saveHistory();setRange(r=>({...r,useColors:true,colors:add&&r.useColors!==false?[...new Set([...r.colors,color])]:[color]}));setMessage(`Muestra ${color.toUpperCase()} seleccionada.`)
  }
  function moveCursor(e:React.PointerEvent<HTMLCanvasElement>){
    if(tool==='sample')return
    const wrap=e.currentTarget.parentElement
    if(!wrap)return
    const box=wrap.getBoundingClientRect()
    setCursor({x:e.clientX-box.left-wrap.clientLeft+wrap.scrollLeft,y:e.clientY-box.top-wrap.clientTop+wrap.scrollTop})
  }
  function paint(e:React.PointerEvent<HTMLCanvasElement>,start=false){
    if(!screening||tool==='sample'||(start&&e.button!==0)||(!start&&point.current?.id!==e.pointerId))return
    e.preventDefault();const box=e.currentTarget.getBoundingClientRect()
    const x=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))
    if(start){saveHistory();e.currentTarget.setPointerCapture(e.pointerId)}
    const previous=start?{x,y}:point.current!
    setRange(r=>(r.strokes?.length??0)>=20000?r:{...r,strokes:[...(r.strokes??[]),{x:previous.x,y:previous.y,toX:x,toY:y,radius:Math.min(1,size/(2*displayWidth*zoom)),erase:tool==='erase'}]})
    point.current={x,y,id:e.pointerId}
  }
  const title=purpose==='affected'?'Dónde aplicar trama':purpose==='protected'?'Dónde conservar sin trama':'1. Eliminar fondo'
  return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="import-modal color-range-modal" role="dialog" aria-modal="true" aria-labelledby="color-range-title" onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();onCancel()}
    if(e.key==='Tab'){const items=Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select'));const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus()}}
  }}>
    <header><h2 id="color-range-title">{title}</h2><button className="btn" aria-label="Cerrar selección" onClick={onCancel}><X size={18}/></button></header>
    <p className="help-text">{screening?'Trabajas sobre lo que quedó después de borrar el fondo. Pinta a la izquierda o toma un color; comprueba el resultado a la derecha. Proteger tiene prioridad sobre aplicar trama.':'Selecciona el color que quieres borrar. La vista de la derecha muestra únicamente el fondo eliminado, sin semitono. Los colores conservados no se recolorean.'}</p>
    <div className="range-toolbar">
      <div className="segmented" role="group" aria-label="Herramienta de selección">{(screening?[['sample','Gotero'],['paint',purpose==='affected'?'Pintar con trama':'Pintar protegido'],['erase','Excluir zona']]:[['sample','Gotero']]).map(([value,label])=><button key={value} className={tool===value?'active':''} aria-pressed={tool===value} onClick={()=>setTool(value as typeof tool)}>{label}</button>)}</div>
      {screening&&tool!=='sample'&&<label className="field">Tamaño del pincel · {size}<input type="range" min="2" max="120" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>}
      {tool==='sample'&&<label><input type="checkbox" checked={add} onChange={e=>setAdd(e.target.checked)}/> Añadir muestras de color</label>}
      <button className="btn" disabled={!history.current.length} onClick={()=>{const previous=history.current.pop();if(previous)setRange(previous)}}>Deshacer selección</button>
      {screening&&<button className="btn" onClick={()=>{saveHistory();setRange(r=>({...r,useColors:false,strokes:[]}))}}>Empezar selección vacía</button>}
    </div>
    <div className="range-toolbar">
      <div className="segmented" role="group" aria-label="Vista de comprobación"><button className={view==='result'?'active':''} onClick={()=>setView('result')}>{screening?'Resultado con trama':'Fondo eliminado'}</button>{screening&&<button className={view==='background'?'active':''} onClick={()=>setView('background')}>Antes de la trama</button>}<button className={view==='mask'?'active':''} onClick={()=>setView('mask')}>Máscara</button></div>
      <div className="range-zoom"><button className="btn" aria-label="Alejar selección" disabled={zoom===1} onClick={()=>setZoom(z=>z/2)}>−</button><output>{zoom}×</output><button className="btn" aria-label="Acercar selección" disabled={zoom===8} onClick={()=>setZoom(z=>z*2)}>+</button><button className="btn" onClick={()=>setZoom(1)}>Ajustar</button></div>
    </div>
    <div className="range-preview-grid">
      <figure><figcaption>{screening?'Después de borrar fondo · pinta aquí':'Original · toma un color'}</figcaption><div className="range-canvas-wrap range-source-wrap"><canvas ref={left} style={{width:displayWidth*zoom,height:displayHeight*zoom,touchAction:tool==='sample'?'auto':'none',cursor:tool==='sample'?'crosshair':'none'}} onClick={sample} onPointerDown={e=>{moveCursor(e);paint(e,true)}} onPointerMove={e=>{moveCursor(e);paint(e)}} onPointerEnter={moveCursor} onPointerLeave={()=>setCursor(null)} onPointerUp={()=>{point.current=null}} onPointerCancel={()=>{point.current=null;setCursor(null)}} onLostPointerCapture={()=>{point.current=null}} aria-label="Lienzo de selección"/>{screening&&tool!=='sample'&&cursor&&<span className={`brush-cursor ${tool==='erase'?'erase':''}`} style={{width:size,height:size,left:cursor.x,top:cursor.y}} aria-hidden="true"/>}</div></figure>
      <figure><figcaption>{view==='mask'?'Máscara · blanco seleccionado':view==='background'?'Antes de la trama':screening?'Resultado con trama':'Fondo eliminado'}</figcaption><div className="range-canvas-wrap range-source-wrap"><canvas ref={right} style={{width:displayWidth*zoom,height:displayHeight*zoom}} aria-label="Vista previa del resultado"/></div></figure>
    </div>
    {range.useColors!==false&&<><div className="range-swatches">{range.colors.map((color,i)=><label key={i}>Muestra {i+1}<input type="color" value={color} onChange={e=>setRange(r=>({...r,colors:r.colors.map((c,j)=>j===i?e.target.value:c)}))}/><span>{color.toUpperCase()}</span></label>)}{screening&&<button className="text-button" onClick={()=>{saveHistory();setRange(r=>({...r,useColors:false}))}}>Quitar selección por color</button>}</div><div className="dimension-fields">{(['tolerance','softness'] as const).map((key,i)=><label className="range-control" key={key}><span><b>{i?'Transición suave':'Tolerancia de color'}</b><output>{range[key]}%</output></span><input type="range" min="0" max="100" value={range[key]} onChange={e=>setRange(r=>({...r,[key]:Number(e.target.value)}))}/></label>)}</div></>}
    <p className="help-text" role="status">{screening?`${stats.selected.toLocaleString('es-CL')} píxeles seleccionados de ${stats.visible.toLocaleString('es-CL')} visibles en esta vista. ${stats.holes.toLocaleString('es-CL')} huecos de trama.`:`${stats.removed.toLocaleString('es-CL')} píxeles de fondo eliminados en esta vista.`} {message}</p>
    {screening&&!stats.selected&&<p className="help-text warning-inline">No hay zonas visibles seleccionadas. Pinta sobre el diseño o usa el gotero. Las zonas borradas en el paso anterior no se pueden proteger ni tramar.</p>}
    {screening&&stats.selected>0&&!stats.holes&&purpose==='affected'&&<p className="help-text warning-inline">La selección está activa pero no produce huecos con estos tonos y ajustes. Revisa el tamaño máximo y la densidad de trama en el panel.</p>}
    <p className="help-text">Vista reducida para editar; revisa el resultado a escala 100% en el visor principal. Cancelar descarta esta edición.</p>
    <div className="modal-actions"><button className="btn" onClick={onCancel}>Cancelar</button><button className="btn export" onClick={()=>onApply(range)}>{screening?'Guardar selección':'Aplicar borrado de fondo'}</button></div>
  </section></div>
}
