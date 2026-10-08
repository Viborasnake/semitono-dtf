import GangPreview from './GangPreview'
import {parseProject,type ProjectFile,MAX_PROJECT_FILE_BYTES} from './project-file'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import {useProjectAutosave,type ProjectSaveStatus} from './use-project-autosave'
import { pack } from './packing'
import { inspectPng, withCanvasPrintProfile, resolutionCheck } from './print'
import type {EditorDocument,GangSource} from './editor-document'
import {updateGangAsset} from './editor-document'
import {createHistory,recordHistory,moveHistory,type History} from './history'
import {ChevronDown,Copy,Pencil,Trash2} from 'lucide-react'

type Asset = {id:string;name:string;img:CanvasImageSource;naturalWidth:number;naturalHeight:number;widthCm:number;heightCm:number;quantity:number;document?:EditorDocument}
export type ProjectActions={save:()=>void;open:()=>void}
type Props = {source?:GangSource; onImportFile?:(file:File)=>void; onEditDocument?:(document:EditorDocument,name:string,id:string)=>void; previewColor?:string; onPreviewColorChange?:(value:string)=>void; getEditor?:()=>ProjectFile['editor']; restoreEditor?:(editor:ProjectFile['editor'])=>void; initialProject:ProjectFile;editorRevision:string;editorLoading:boolean;onSaveStatus:(s:ProjectSaveStatus)=>void;actionsRef?:Ref<ProjectActions>}
type SavedAsset = {id:string;name:string;dataUrl:string;naturalWidth:number;naturalHeight:number;widthCm:number;heightCm:number;quantity:number;document?:EditorDocument}
type GangSnapshot = {items:Asset[];projectName:string;width:number;height:number;dpi:number;gap:number;rotate:boolean;previewBg:string}
type SheetPreset = {id:string;name:string;width:number;height:number}
const sheetStorageKey = 'trama-dtf-gang-sheet-v1'
const sheetPresetsStorageKey = 'trama-dtf-gang-sheet-presets-v1'
function readSheetPresets():SheetPreset[] {
  try {
    const parsed=JSON.parse(localStorage.getItem(sheetPresetsStorageKey)||'[]')
    return Array.isArray(parsed)?parsed.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.width)&&p.width>0&&Number.isFinite(p.height)&&p.height>0):[]
  } catch { return [] }
}
function savedSheetSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem('trama-dtf-sheet-settings') || '{}')
    return {width:Number.isFinite(parsed.width)&&parsed.width>0?parsed.width:58,height:Number.isFinite(parsed.height)&&parsed.height>0?parsed.height:100,dpi:[150,300,600].includes(parsed.dpi)?parsed.dpi:300,gap:Number.isFinite(parsed.gap)&&parsed.gap>=0?parsed.gap:5,rotate:typeof parsed.rotate==='boolean'?parsed.rotate:true}
  } catch { return {width:58,height:100,dpi:300,gap:5,rotate:true} }
}

export default function GangSheet({source,onImportFile,onEditDocument,previewColor,onPreviewColorChange,getEditor,restoreEditor,initialProject,editorRevision,editorLoading,onSaveStatus,actionsRef}: Props) {
  const [items,setItems] = useState<Asset[]>([])
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const [renamingId,setRenamingId]=useState<string|null>(null)
  const [renameValue,setRenameValue]=useState('')
  const [expandedAssets,setExpandedAssets]=useState<Set<string>>(new Set())
  const [sheetOpen,setSheetOpen]=useState(true)
  const selectedAsset=items.find(a=>a.id===selectedId)
  function editAsset(id:string){
    setSelectedId(id)
    const item=items.find(a=>a.id===id)
    if(item?.document&&onEditDocument)onEditDocument({...item.document,widthCm:item.widthCm},item.name,item.id)
    else setError('Este diseño no tiene el original editable guardado. Importa el original al editor para evitar volver a tramar un PNG procesado.')
  }
  function startRename(item:Asset){
    setRenamingId(item.id)
    setRenameValue(item.name)
  }
  function finishRename(){
    if(!renamingId)return
    const name=renameValue.trim()
    if(!name)return
    setItems(all=>all.map(item=>item.id===renamingId?{...item,name}:item))
    setRenamingId(null)
    setRenameValue('')
  }
  function duplicateAsset(item:Asset){
    const names=new Set(items.map(asset=>asset.name))
    const base=`${item.name} (copia)`
    let name=base, index=2
    while(names.has(name))name=`${item.name} (copia ${index++})`
    const clone:Asset={...item,id:crypto.randomUUID(),name,quantity:1,document:item.document?structuredClone(item.document):undefined}
    setItems(all=>[...all,clone])
    setSelectedId(clone.id)
    setExpandedAssets(all=>new Set(all).add(clone.id))
    setMessage(`Diseño duplicado: ${name}.`)
  }
  function toggleAsset(id:string){
    if(expandedAssets.has(id)&&renamingId===id)setRenamingId(null)
    setExpandedAssets(all=>{const next=new Set(all);if(next.has(id))next.delete(id);else next.add(id);return next})
  }
  const [hydrated,setHydrated]=useState(false)
  const initial=useRef(initialProject.sheet)
  const [width,setWidth] = useState(initial.current.width)
  const [height,setHeight] = useState(initial.current.height)
  const [dpi,setDpi] = useState(initial.current.dpi)
  const [gap,setGap] = useState(initial.current.gap)
  const [rotate,setRotate] = useState(initial.current.rotate)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [previewBg,setPreviewBg] = useState(previewColor || 'checker')
  const [busy,setBusy] = useState(false)
  const [saveState,setSaveState]=useState('Cargando guardado…')
  const [acceptedResolution,setAcceptedResolution]=useState('')
  const [projectName,setProjectName] = useState(initialProject.name)
  const [sheetPresets,setSheetPresets]=useState<SheetPreset[]>(readSheetPresets)
  const [sheetPresetName,setSheetPresetName]=useState('')
  const input = useRef<HTMLInputElement>(null)
  const projectInput=useRef<HTMLInputElement>(null)
  const [projectBusy,setProjectBusy]=useState(false)
  const [assetLoading,setAssetLoading]=useState(0)
  const gangHistory=useRef<History<GangSnapshot>|null>(null)
  const historyApplying=useRef(false)
  const [historyCounts,setHistoryCounts]=useState({undo:0,redo:0})
  const serializedImages=useRef(new WeakMap<object,string>())
  function projectSnapshot():ProjectFile {
    const editor=getEditor?.()
    if(editor?.assetId&&!items.some(a=>a.id===editor.assetId))delete editor.assetId
    const project:ProjectFile={format:'trama-dtf',version:1,name:projectName.trim(),sheet:{width,height,dpi,gap,rotate},background:previewBg,editor,items:items.map(({img,...a})=>{
      let dataUrl=serializedImages.current.get(img as object)
      if(!dataUrl){dataUrl=(img as HTMLCanvasElement).toDataURL('image/png');serializedImages.current.set(img as object,dataUrl)}
      return {...a,dataUrl}
    })}
    if(!project.name)throw new Error('El proyecto necesita un nombre.')
    return project
  }
  useProjectAutosave(projectSnapshot,[items,projectName,width,height,dpi,gap,rotate,previewBg,editorRevision],hydrated&&!projectBusy&&!editorLoading&&assetLoading===0,status=>{setSaveState(status.message);onSaveStatus({...status,name:status.name||projectName})})
  useEffect(()=>{
    if(!hydrated)return
    if(historyApplying.current){historyApplying.current=false;return}
    const snapshot:GangSnapshot={items:[...items],projectName,width,height,dpi,gap,rotate,previewBg}
    if(!gangHistory.current)gangHistory.current=createHistory(snapshot)
    else gangHistory.current=recordHistory(gangHistory.current,snapshot,0)
    setHistoryCounts({undo:gangHistory.current.past.length,redo:gangHistory.current.future.length})
  },[hydrated,items,projectName,width,height,dpi,gap,rotate,previewBg])
  function navigateHistory(direction:'undo'|'redo'){
    if(!gangHistory.current)return
    const next=moveHistory(gangHistory.current,direction)
    if(next===gangHistory.current)return
    gangHistory.current=next;historyApplying.current=true
    const s=next.present
    setItems(s.items);setProjectName(s.projectName);setWidth(s.width);setHeight(s.height);setDpi(s.dpi);setGap(s.gap);setRotate(s.rotate);setPreviewBg(s.previewBg);onPreviewColorChange?.(s.previewBg)
    setHistoryCounts({undo:next.past.length,redo:next.future.length})
  }
  function saveSheetPreset(){
    const name=sheetPresetName.trim()
    if(!name||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return
    const next=[...sheetPresets.filter(p=>p.name.toLocaleLowerCase()!==name.toLocaleLowerCase()),{id:crypto.randomUUID(),name,width,height}]
    setSheetPresets(next);localStorage.setItem(sheetPresetsStorageKey,JSON.stringify(next));setSheetPresetName('');setMessage(`Preset de plancha «${name}» guardado.`)
  }
  function deleteSheetPreset(id:string){
    const next=sheetPresets.filter(p=>p.id!==id)
    setSheetPresets(next);localStorage.setItem(sheetPresetsStorageKey,JSON.stringify(next))
  }
  useImperativeHandle(actionsRef,()=>({save:()=>{void saveProject()},open:()=>projectInput.current?.click()}))
  async function saveProject() {
    setProjectBusy(true);setError('')
    try {
      const project=projectSnapshot()
      const text=JSON.stringify(project);parseProject(text)
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}))
      const link=document.createElement('a');link.href=url;link.download=`${projectName.replace(/[^\p{L}\p{N}_-]+/gu,'-')||'proyecto'}.trama.json`;link.click()
      setTimeout(()=>URL.revokeObjectURL(url),60000)
      setMessage('Descarga del proyecto solicitada: imágenes y configuración incluidas.')
    }catch(e){setError((e as Error).message)}finally{setProjectBusy(false)}
  }
  async function openProject(file:File) {
    if(!window.confirm('Abrir reemplazará el Gang Sheet y el editor actuales. Guarda primero el proyecto si quieres conservarlos. ¿Continuar?'))return
    setProjectBusy(true);setError('')
    try {
      if(file.size>MAX_PROJECT_FILE_BYTES)throw new Error('El proyecto supera el límite de 1 GB.')
      const p=parseProject(await file.text())
      const loaded=await decodeProject(p)
      applyProject(p,loaded)
      setMessage('Proyecto abierto. Resoluciones conservadas; revisa los avisos antes de exportar.')
    }catch(e){setError((e as Error).message)}finally{setProjectBusy(false)}
  }
  const imported = useRef(0)
  const importMode = useRef<'adjust'|'raw'>('raw')
  const normalizeImage = (img:HTMLImageElement|HTMLCanvasElement) => {
    const normalized = document.createElement('canvas')
    normalized.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width
    normalized.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height
    const nctx = normalized.getContext('2d', {willReadFrequently:true,colorSpace:'srgb'})!
    nctx.drawImage(img, 0, 0)
    // Preserve the editor's alpha choice.
    return normalized
  }
  async function decodeProject(p:ProjectFile) {
      async function decode(src:string){const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Una imagen del proyecto está dañada.'));img.src=src});if(img.naturalWidth*img.naturalHeight>100_000_000)throw new Error('Imagen demasiado grande.');return img}
      async function validateOriginal(d:EditorDocument){const img=await decode(d.original);if(d.crop&&(d.crop.x+d.crop.width>img.naturalWidth||d.crop.y+d.crop.height>img.naturalHeight))throw new Error('Recorte fuera de la imagen original.')}
      const loaded:Asset[]=[]
      for(const a of p.items){const img=await decode(a.dataUrl);if(img.naturalWidth!==a.naturalWidth||img.naturalHeight!==a.naturalHeight)throw new Error('Dimensiones de imagen inconsistentes.');if(a.document)await validateOriginal(a.document);loaded.push({...a,img:normalizeImage(img)})}
      if(p.editor)await validateOriginal(p.editor.document)

    return loaded
  }
  function applyProject(p:ProjectFile,loaded:Asset[]) {
    setItems(loaded);setProjectName(p.name);setWidth(p.sheet.width);setHeight(p.sheet.height);setDpi(p.sheet.dpi);setGap(p.sheet.gap);setRotate(p.sheet.rotate);setPreviewBg(p.background);onPreviewColorChange?.(p.background);setAcceptedResolution('');restoreEditor?.(p.editor)
  }
  useEffect(() => {
    let cancelled=false
    void decodeProject(initialProject).then(loaded=>{
      if(!cancelled){applyProject(initialProject,loaded);setHydrated(true)}
    }).catch(e=>{
      if(!cancelled){setError(e.message);setSaveState('No se pudo recuperar; guardado pausado');onSaveStatus({name:initialProject.name,message:'No se pudo recuperar el proyecto. Guardado pausado.',pending:false,failed:true})}
    })
    return ()=>{cancelled=true}
  },[])
  useEffect(()=>{if(previewColor && previewColor !== previewBg) setPreviewBg(previewColor)},[previewColor])

  async function add(blob:Blob,name:string,widthCm?:number,document?:EditorDocument,replaceId?:string) {
    setAssetLoading(n=>n+1)
    const img = new Image()
    const url = URL.createObjectURL(blob)
    try {
      await new Promise<void>((resolve,reject) => {img.onload=()=>resolve();img.onerror=()=>reject(new Error(`No se pudo abrir ${name}.`));img.src=url})
      let nativeDpi = 300
      if (blob.type === 'image/png' && !widthCm) {
        try {const info = inspectPng(new Uint8Array(await blob.arrayBuffer())); if(info.dpi > 0) nativeDpi = info.dpi} catch { /* Images without print metadata assume 300 ppp. */ }
      }
      const w = widthCm || img.naturalWidth / nativeDpi * 2.54
      // Keep source pixels and alpha at native resolution.
      const normalized = normalizeImage(img)
      setItems(previous => {
        const next:Asset={id:crypto.randomUUID(),name,img:normalized,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,widthCm:w,heightCm:w*img.naturalHeight/img.naturalWidth,quantity:1,document}
        return updateGangAsset(previous,next,replaceId)
      })
    } finally {URL.revokeObjectURL(url);setAssetLoading(n=>n-1)}
  }
  useEffect(() => {
    if (!source || imported.current === source.id) return
    imported.current = source.id
    add(source.blob,source.name,source.widthCm,source.document,source.replaceId).catch(e=>setError(e.message))
  },[source])

  let layout: ReturnType<typeof pack> = {placements:[],missing:0,usedHeight:0}
  let layoutError = ''
  try {layout=pack(items,width,height,gap/10,rotate)} catch(e){layoutError=(e as Error).message}
  const pxW=Math.round(width/2.54*dpi), pxH=Math.round(height/2.54*dpi)
  const tooBig = pxW*pxH>100_000_000 || pxW>16000 || pxH>16000
  const resolutionIssues=items.filter(item=>!resolutionCheck(item,dpi).matches)
  const resolutionKey=JSON.stringify([dpi,items.map(i=>[i.id,i.widthCm,i.heightCm,i.naturalWidth,i.naturalHeight])])
  const matchingDpi=[300,150,600].find(candidate=>items.length>0&&items.every(item=>resolutionCheck(item,candidate).matches))
  const resolutionBlocked=resolutionIssues.length>0 && acceptedResolution!==resolutionKey
  const invalid = !!layoutError || tooBig || pxW<1 || pxH<1 || !items.length || layout.missing>0 || resolutionBlocked
  function correctResolution(){
    if(matchingDpi){setDpi(matchingDpi);setAcceptedResolution('');return}
    const changes=resolutionIssues.map(a=>`${a.name}: ${a.widthCm.toFixed(2)} × ${a.heightCm.toFixed(2)} → ${(a.naturalWidth/dpi*2.54).toFixed(2)} × ${(a.naturalHeight/dpi*2.54).toFixed(2)} cm`)
    if(!window.confirm(`Para conservar todos los píxeles a ${dpi} ppp, cambiarán los tamaños de impresión:\n\n${changes.join('\n')}\n\nSe redistribuirá la plancha; algunas copias podrían dejar de caber. No se modifica la trama ni se recupera detalle. Si necesitas mantener los centímetros, cancela y vuelve al original. ¿Aplicar?`))return
    setItems(all=>all.map(a=>resolutionCheck(a,dpi).matches?a:{...a,widthCm:a.naturalWidth/dpi*2.54,heightCm:a.naturalHeight/dpi*2.54}))
    setAcceptedResolution('')
  }

  function draw(canvas:HTMLCanvasElement,w:number,h:number,forExport=false) {
    canvas.width=w;canvas.height=h
    const ctx=canvas.getContext('2d',{colorSpace:'srgb'})!
    ctx.clearRect(0,0,w,h)
    // Keep the alpha mask binary while placing halftone PNGs. Browser
    // interpolation creates translucent halos around otherwise solid dots.
    ctx.imageSmoothingEnabled=false
    const scaleX=w/width,scaleY=h/height
    for(const p of layout.placements) {
      const asset=items.find(i=>i.id===p.id)!
      ctx.save()
      const target=resolutionCheck(asset,dpi)
      const dw=forExport?target.width:asset.widthCm*scaleX
      const dh=forExport?target.height:asset.heightCm*scaleY
      ctx.translate(forExport?Math.round(p.x/2.54*dpi):p.x*scaleX,forExport?Math.round(p.y/2.54*dpi):p.y*scaleY)
      if(p.rotated){ctx.translate(dh,0);ctx.rotate(Math.PI/2)}
      ctx.drawImage(asset.img,0,0,dw,dh)
      ctx.restore()
    }
  }
  useEffect(()=>{setMessage('')},[items,width,height,gap,rotate])

  async function exportSheet() {
    if(invalid || busy) return
    setBusy(true);setError('');setMessage('')
    const canvas=document.createElement('canvas')
    try{
      draw(canvas,pxW,pxH,true)
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo exportar. Reduce el tamaño de plancha.')),'image/png'))
      const bytes=withCanvasPrintProfile(new Uint8Array(await blob.arrayBuffer()),dpi)
      const check=inspectPng(bytes)
      if(check.width!==pxW || check.height!==pxH || Math.abs(check.dpi-dpi)>.02 || Math.abs(check.dpiY-dpi)>.02 || check.profile!=='sRGB')throw new Error('La exportación no coincide con las medidas.')
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}))
      const link=document.createElement('a');link.href=url;link.download=`gang-sheet-${width}x${height}cm-${dpi}ppp.png`;document.body.append(link);link.click();link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),60000)
      setMessage(`PNG verificado: ${pxW} × ${pxH} px · ${dpi} ppp. Descarga solicitada.`)
    }catch(e){setError((e as Error).message)}finally{canvas.width=canvas.height=1;setBusy(false)}
  }

  return <section className="workspace gang-workspace"><aside className="sidebar">
    <div className="sidebar-title">Gang Sheet <span className="save-indicator" role="status">● {saveState}</span></div>
    <div className={`control-card ${sheetOpen?'open':''}`}><button type="button" className="section-heading" aria-expanded={sheetOpen} aria-controls="gang-sheet-settings" onClick={()=>setSheetOpen(open=>!open)}><span>Plancha de impresión</span><ChevronDown size={18} aria-hidden="true"/></button><div className="section-body" id="gang-sheet-settings" hidden={!sheetOpen}>
      <label className="field">Nombre del trabajo<input aria-label="Nombre del trabajo" value={projectName} maxLength={80} onChange={e=>setProjectName(e.target.value)}/></label>
      <div className="field"><span>Mis presets de plancha</span>{sheetPresets.length>0&&<div className="sheet-presets">{sheetPresets.map(p=><div className="sheet-preset" key={p.id}><button type="button" aria-pressed={width===p.width&&height===p.height} onClick={()=>{setWidth(p.width);setHeight(p.height)}}>{p.name}<small>{p.width} × {p.height} cm</small></button><button type="button" className="sheet-preset-delete" aria-label={`Eliminar preset ${p.name}`} title="Eliminar preset" onClick={()=>deleteSheetPreset(p.id)}><Trash2 size={14}/></button></div>)}</div>}<div className="sheet-preset-save"><input aria-label="Nombre del preset de plancha" placeholder="Nombre del preset" value={sheetPresetName} onChange={e=>setSheetPresetName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveSheetPreset()}}}/><button type="button" className="btn" disabled={!sheetPresetName.trim()} onClick={saveSheetPreset}>Guardar</button></div></div>
      <div className="dimension-fields"><label>Ancho (cm)<input type="number" aria-label="Ancho de plancha" min="1" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><label>Alto (cm)<input type="number" aria-label="Alto de plancha" min="1" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label></div>
      <p className="help-text" role="status">Insumo DTF seleccionado: {width} × {height} cm</p>
      <input hidden ref={projectInput} type="file" accept=".json,.trama.json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void openProject(file)}}/>
      <div className="dimension-fields compact-fields"><label>Resolución<select aria-label="Resolución de plancha" value={dpi} onChange={e=>setDpi(Number(e.target.value))}><option value="150">150 ppp</option><option value="300">300 ppp</option><option value="600">600 ppp</option></select></label>
      <label>Separación (mm)<input aria-label="Separación de diseños" type="number" min="0" max="50" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label></div>
      {resolutionIssues.length>0 && <div className="resolution-warning" role="alert"><strong>Revisar resolución antes de exportar</strong><button className="btn" onClick={correctResolution}>Corregir resolución sin remuestrear</button><p>La plancha usa {dpi} ppp. Estos diseños cambiarían de píxeles al tamaño elegido:</p><ul>{resolutionIssues.map(item=><li key={item.id}>{item.name}: {Math.round(resolutionCheck(item,dpi).effectiveDpi)} ppp efectivos → {dpi} ppp.</li>)}</ul><p>Reducir puede perder detalle; ampliar no recupera detalle y puede alterar la trama. Para cambiar los ppp, vuelve al original y genera la trama en el editor.</p>{matchingDpi && matchingDpi!==dpi && <button className="btn" onClick={()=>setDpi(matchingDpi)}>Igualar plancha a {matchingDpi} ppp</button>}<label><input type="checkbox" checked={acceptedResolution===resolutionKey} onChange={e=>setAcceptedResolution(e.target.checked?resolutionKey:'')}/> Acepto reescalar estos diseños para esta exportación.</label></div>}
      <label className="help-text"><input type="checkbox" checked={rotate} onChange={e=>setRotate(e.target.checked)}/> Permitir giro de 90°</label>
      <button className="btn" onClick={()=>{importMode.current='raw';input.current?.click()}}>Añadir diseños PNG / imágenes</button>
      <input hidden ref={input} type="file" accept="image/png,image/webp,image/jpeg" multiple onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(importMode.current==='adjust' && files[0] && onImportFile){onImportFile(files[0]);return}for(const file of files){try{await add(file,file.name)}catch(err){setError((err as Error).message)}}}}/>
    </div></div>
    {items.map(item=>{
      const expanded=expandedAssets.has(item.id)
      const effectiveDpi=Math.round(resolutionCheck(item,dpi).effectiveDpi)
      return <div className={`control-card asset-card ${selectedId===item.id?'asset-selected':''}`} key={item.id}>
        <button type="button" className="asset-heading" aria-expanded={expanded} aria-controls={`asset-details-${item.id}`} title={item.name} onClick={()=>{setSelectedId(item.id);toggleAsset(item.id)}}>
          <span className="asset-heading-copy"><span className="asset-heading-name">{item.name}</span><span className="asset-heading-meta" aria-label={`Ancho ${item.widthCm.toFixed(2)} centímetros, alto ${item.heightCm.toFixed(2)} centímetros, ${effectiveDpi} puntos por pulgada`}>{item.widthCm.toFixed(1)} × {item.heightCm.toFixed(1)} cm <i aria-hidden="true">·</i> {effectiveDpi} ppp</span></span>
          <ChevronDown size={18} aria-hidden="true"/>
        </button>
        <div className="section-body asset-details" id={`asset-details-${item.id}`} hidden={!expanded}>
          {renamingId===item.id ? <form className="asset-rename" onSubmit={e=>{e.preventDefault();finishRename()}}>
            <input autoFocus onFocus={e=>e.currentTarget.select()} aria-label="Nuevo nombre del diseño" maxLength={120} value={renameValue} onChange={e=>setRenameValue(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setRenamingId(null);setRenameValue('')}}}/>
            <div className="asset-rename-actions"><button type="submit" className="btn" disabled={!renameValue.trim()}>Guardar</button><button type="button" className="btn" onClick={()=>{setRenamingId(null);setRenameValue('')}}>Cancelar</button></div>
          </form> : <div className="asset-actions">
            <button type="button" className="btn" title="Renombrar diseño" onClick={()=>startRename(item)}><Pencil size={14} aria-hidden="true"/><span>Renombrar</span></button>
            <button type="button" className="btn asset-duplicate" title="Duplicar diseño" onClick={()=>duplicateAsset(item)}><Copy size={14} aria-hidden="true"/><span>Duplicar</span></button>
            <button type="button" className="btn danger" aria-label={`Quitar ${item.name}`} title="Quitar diseño" onClick={()=>setItems(all=>all.filter(i=>i.id!==item.id))}><Trash2 size={14} aria-hidden="true"/><span>Quitar</span></button>
          </div>}
          <div className="dimension-fields"><label>Ancho (cm)<input type="number" min="0.1" step="0.1" value={Number(item.widthCm.toFixed(2))} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,widthCm:Number(e.target.value),heightCm:Number(e.target.value)*i.naturalHeight/i.naturalWidth}:i))}/></label><label>Copias<input aria-label={`Copias de ${item.name}`} type="number" min="1" max="200" value={item.quantity} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,quantity:Number(e.target.value)}:i))}/></label></div>
          <p className="help-text">Alto proporcional: {item.heightCm.toFixed(2)} cm</p>
          {item.document && onEditDocument ? <button className="btn" onClick={()=>editAsset(item.id)}>Editar original</button> : <p className="help-text">Original no disponible. Importa el original al editor para generar una nueva trama.</p>}
        </div>
      </div>
    })}
    {layoutError && <p role="alert" className="error-text">{layoutError}</p>}
    {tooBig && <p role="alert" className="error-text">Máximo 100 megapíxeles y 16.000 px por lado. Reduce la plancha o los ppp.</p>}
    {layout.missing>0 && <p role="alert" className="error-text">{layout.missing} copias no caben. Amplía la plancha o reduce copias/tamaños para exportar todo.</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </aside><div className="gang-stage"><div className="gang-toolbar"><div className="gang-toolbar-left"><div className="history-controls gang-history" role="group" aria-label="Historial del Gang Sheet"><button className="btn" disabled={!historyCounts.undo||projectBusy||busy} onClick={()=>navigateHistory('undo')} title="Deshacer (⌘/Ctrl Z)">↶ Deshacer</button><button className="btn" disabled={!historyCounts.redo||projectBusy||busy} onClick={()=>navigateHistory('redo')} title="Rehacer (⌘/Ctrl Shift Z)">↷ Rehacer</button></div><span>Vista sobre</span><select aria-label="Seleccionar diseño" value={selectedAsset?.id??''} onChange={e=>setSelectedId(e.target.value||null)}><option value="">Seleccionar diseño…</option>{items.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn" disabled={!selectedAsset} onClick={()=>selectedAsset&&editAsset(selectedAsset.id)}>Editar seleccionado</button><select aria-label="Fondo de vista previa del Gang Sheet" value={previewBg} onChange={e=>{setPreviewBg(e.target.value);onPreviewColorChange?.(e.target.value)}}><option value="checker">Transparencia</option><optgroup label="Neutros"><option value="white">Blanco · claro</option><option value="#596778">Gris · normal</option><option value="black">Negro · oscuro</option></optgroup><optgroup label="Azules"><option value="#8ecae6">Celeste · claro</option><option value="#2563eb">Azul rey · normal</option><option value="#304b70">Azul marino · oscuro</option><option value="#102a43">Azul oscuro · oscuro</option></optgroup><optgroup label="Verdes"><option value="#86efac">Verde menta · claro</option><option value="#16a34a">Verde · normal</option><option value="#166534">Verde botella · oscuro</option><option value="#808000">Verde olivo · normal</option><option value="#4b5320">Verde militar · oscuro</option></optgroup><optgroup label="Morados"><option value="#c4b5fd">Lavanda · claro</option><option value="#7c3aed">Morado · normal</option><option value="#4c1d95">Morado oscuro · oscuro</option></optgroup><optgroup label="Rojos"><option value="#fda4af">Rosado · claro</option><option value="#c1121f">Rojo fuerte · normal</option><option value="#7b2931">Rojo oscuro · oscuro</option></optgroup><optgroup label="Amarillos y naranjas"><option value="#fde68a">Amarillo · claro</option><option value="#f59e0b">Mostaza · normal</option><option value="#ea580c">Naranjo · oscuro</option></optgroup><optgroup label="Cafés"><option value="#e7d3b0">Beige · claro</option><option value="#a16207">Café · normal</option><option value="#3b2418">Café oscuro · oscuro</option></optgroup></select><span>Insumo: {width} × {height} cm · {layout.placements.length} diseños · {layout.usedHeight.toFixed(1)} cm de alto ocupado</span></div><button className="btn export" disabled={invalid||busy} onClick={exportSheet}>{busy?'Exportando…':'Exportar Gang Sheet'}</button></div><GangPreview width={width} height={height} dpi={dpi} background={previewBg} placements={layoutError?[]:layout.placements} items={items} selectedId={selectedAsset?.id} onSelect={setSelectedId} onEdit={editAsset} status={message}/></div></section>
}
