import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { inspectPng, printSize, withCanvasPrintProfile } from './print'
import GangSheet, {type ProjectActions} from './GangSheet'
import {parseProject,type ProjectFile,MAX_PROJECT_FILE_BYTES} from './project-file'
import {readActiveProject,writeActiveProject,deleteActiveProject,emptyProject} from './project-storage'
import type {ProjectSaveStatus} from './use-project-autosave'
import {renamePersonalPreset,deletePersonalPreset} from './preset-library'
import {clearActiveProject} from './reset-project'
import type {EditorDocument,GangSource} from './editor-document'
import {migratePresetSettings} from './preset-migration'
import {garmentPresets as presets,presetsFor,type GarmentTone,type PresetMode} from './garment-presets'
import {contentBounds,imageContentBounds} from './crop'
import {createHistory,recordHistory,moveHistory,type History} from './history'
import CropPanel, {type CropRect} from './CropPanel'
import ColorRangePanel from './ColorRangePanel'
import {defaultColorRange,validColorRange,type ColorRange} from './color-range'
import { Check, ChevronDown, CircleDot, Download, FolderOpen, Hand, Image as ImageIcon, Info, Layers3, Minus, Pipette, Plus, RotateCcw, SlidersHorizontal, Sparkles, Trash2, Upload, ZoomIn } from 'lucide-react'

type Shape = 'circle' | 'square' | 'line'
type ViewMode = 'result' | 'split' | 'original'

export type Settings = {
  lpi: number
  angle: number
  shape: Shape
  size: number
  contrast: number
  brightness: number
  whiteCutoff: number
  preserveColor: boolean
  invert: boolean
  background: 'black' | 'white' | 'none' | 'custom'
  colorRange?: ColorRange
  customBase?: 'black' | 'white'
  whiteRemoval?: 'all' | 'connected'
  whiteDetail?: number
  backgroundCleanup?: number
  tolerance: number
  enabled: boolean
  featherMm: number
  cornerRadiusMm: number
  trimMm: number
  edgeSides: boolean[]
  sharpness: number
  gamma: number
  autoTone: boolean
  autoContrast: boolean
  autoColor: boolean
  autoToneStrength: number
  autoContrastStrength: number
  solidAlpha: boolean
  temperature: number
  tint: number
  autoColorStrength: number
}

const defaults: Settings = {
  lpi: 28,
  angle: 22.5,
  shape: 'circle',
  size: 92,
  contrast: 100,
  brightness: 100,
  whiteCutoff: 245,
  preserveColor: true,
  invert: false,
  background: 'black',
  whiteRemoval: 'all',
  whiteDetail: 0,
  backgroundCleanup: 0,
  tolerance: 25,
  enabled: true,
  featherMm: 0,
  cornerRadiusMm: 0,
  trimMm: 0,
  edgeSides: [true, true, true, true],
  sharpness: 0,
  gamma: 1,
  autoTone: false,
  autoContrast: false,
  autoColor: false,
  autoToneStrength: 100,
  autoContrastStrength: 100,
  solidAlpha: true,
  temperature: 0,
  tint: 0,
  autoColorStrength: 100,
}

const initialSettings:Settings = {...defaults,...presets.default.values}

const shapeLabels: Record<Shape, string> = { circle: 'Redondo', square: 'Cuadrado', line: 'Línea' }

type SavedPreset = {id:string;name:string;settings:Settings;garment?:GarmentTone}
const presetStorageKey = 'trama-dtf-presets-v1'
function readSavedPresets(): SavedPreset[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(presetStorageKey) || '[]')
    if (!Array.isArray(data)) return []
    return data.map(p=>p && typeof p==='object' && p.settings && typeof p.settings==='object'?{...p,settings:migratePresetSettings(p.settings,defaults)}:p).filter((p): p is SavedPreset => {
      if (!p || typeof p.id !== 'string' || !p.id.startsWith('saved:') || typeof p.name !== 'string' || !p.name.trim() || !p.settings) return false
      const s = p.settings
      if(p.garment!==undefined&&!['dark','light'].includes(p.garment))return false
      const ranges = {lpi:[12,65],angle:[0,90],size:[45,125],contrast:[50,180],brightness:[60,140],whiteCutoff:[170,255],tolerance:[0,100],featherMm:[0,30],trimMm:[0,15],cornerRadiusMm:[0,50],sharpness:[0,100],gamma:[.5,2],temperature:[-100,100],tint:[-100,100],autoColorStrength:[0,100],autoToneStrength:[0,100],autoContrastStrength:[0,100]}
      return Object.entries(ranges).every(([key,[min,max]]) => Number.isFinite(s[key]) && s[key] >= min && s[key] <= max)
        && ['circle','square','line'].includes(s.shape) && ['black','white','none','custom'].includes(s.background)
        && (s.colorRange===undefined||validColorRange(s.colorRange))
        && (s.background!=='custom'||validColorRange(s.colorRange))
        && (s.customBase===undefined||['black','white'].includes(s.customBase))
        && (s.whiteRemoval===undefined||['all','connected'].includes(s.whiteRemoval))
        && (s.whiteDetail===undefined||(Number.isFinite(s.whiteDetail)&&s.whiteDetail>=0&&s.whiteDetail<=100))
        && (s.backgroundCleanup===undefined||(Number.isFinite(s.backgroundCleanup)&&s.backgroundCleanup>=0&&s.backgroundCleanup<=100))
        && ['enabled','preserveColor','invert'].every(key => typeof s[key] === 'boolean')
        && ['autoTone','autoContrast','autoColor','solidAlpha'].every(key => s[key] === undefined || typeof s[key] === 'boolean')
        && Array.isArray(s.edgeSides) && s.edgeSides.length === 4 && s.edgeSides.every((v:unknown) => typeof v === 'boolean')
    }).map(p=>({...p,settings:{...defaults,...p.settings}}))
  } catch {return []}
}

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100
  return (
    <label className="range-control">
      <span><b>{label}</b><output>{value}{unit}</output></span>
      <input aria-label={label} style={{ '--progress': `${progress}%` } as React.CSSProperties} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`toggle ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button>
}

function App({onNewProject,initialProject,resetting=false}:{onNewProject:()=>void;initialProject:ProjectFile;resetting?:boolean}) {
  const projectActions=useRef<ProjectActions>(null)
  const [projectStatus,setProjectStatus]=useState<ProjectSaveStatus>({name:initialProject.name,message:'Recuperando proyecto…',pending:true,failed:false})
  const originalSnapshot=useRef<{image:HTMLImageElement;data:string}|null>(null)
  const [crop,setCrop]=useState<CropRect|null>(null)
  const [showCrop,setShowCrop]=useState(false)
  const [prepressCollapsed,setPrepressCollapsed]=useState(false)
  const [projectCollapsed,setProjectCollapsed]=useState(true)
  const sourceCanvas = useRef<HTMLCanvasElement>(null)
  const resultCanvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [garment, setGarment] = useState<GarmentTone>(initialProject.editor?.document.garment??(initialProject.background==='white'?'light':'dark'))
  const activeGarment:GarmentTone = settings.background==='white'?'light':settings.background==='black'?'dark':garment
  const presetMode:PresetMode = settings.enabled?'halftone':'continuous'
  const visiblePresets = presetsFor(activeGarment,presetMode)
  const [view, setView] = useState<ViewMode>('split')
  const [zoom, setZoom] = useState(100)
  const [fit, setFit] = useState(true)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [handTool, setHandTool] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{id:number;x:number;y:number;left:number;top:number} | null>(null)
  const handActive = handTool || spaceHeld
  const [viewport, setViewport] = useState({width: 600, height: 600})
  const [tool, setTool] = useState<'design' | 'gang'>('design')
  const [preset, setPreset] = useState('default')
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(readSavedPresets)
  const [savingPreset, setSavingPreset] = useState(false)
  const [renamingPreset,setRenamingPreset]=useState(false)
  const [renameValue,setRenameValue]=useState('')
  const [presetName, setPresetName] = useState('')
  const [presetMessage, setPresetMessage] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [showColorRange,setShowColorRange]=useState(false)
  const [cropMessage,setCropMessage]=useState('')
  const [gangSource, setGangSource] = useState<GangSource>()
  const [editingAssetId,setEditingAssetId]=useState<string>()
  const [split, setSplit] = useState(52)
  const [fileName, setFileName] = useState('')
  const [dimensions, setDimensions] = useState({ width: 1400, height: 1000 })
  const [dragging, setDragging] = useState(false)
  const [widthCm, setWidthCm] = useState('11.8533')
  const [dpi, setDpi] = useState(300)
  const [imageVersion, setImageVersion] = useState(0)
  const [readyKey, setReadyKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [transparent, setTransparent] = useState(0)
  const [previewBg, setPreviewBg] = useState('checker')
  const [error, setError] = useState('')
  const loadId = useRef(0)
  const [collapsedPanels, setCollapsedPanels] = useState({presets:false, size:false, background:false, trama:false, ajustes:false, edges:false})
  const [displaySize,setDisplaySize]=useState<{width:number;height:number}|null>(null)
  type Snapshot = {settings:Settings;widthCm:string;dpi:number;crop:CropRect|null;dimensions:{width:number;height:number};garment:GarmentTone}
  const history=useRef<History<Snapshot>|null>(null)
  const historyImage=useRef(-1)
  const gesture=useRef(0)
  const [historyCounts,setHistoryCounts]=useState({undo:0,redo:0})
  useEffect(()=>{
    if(loading)return
    const snapshot={settings,widthCm,dpi,crop,dimensions,garment:activeGarment}
    if(!history.current || historyImage.current!==imageVersion){history.current=createHistory(snapshot);historyImage.current=imageVersion}
    else history.current=recordHistory(history.current,snapshot,gesture.current)
    setHistoryCounts({undo:history.current.past.length,redo:history.current.future.length})
  },[settings,widthCm,dpi,crop,dimensions,imageVersion,loading,activeGarment])
  const navigateHistory=(direction:'undo'|'redo')=>{
    if(!history.current || loading)return
    const next=moveHistory(history.current,direction)
    if(next===history.current)return
    history.current=next;gesture.current++
    const s=next.present
    setSettings(s.settings);setGarment(s.garment);setWidthCm(s.widthCm);setDpi(s.dpi);setCrop(s.crop);setDimensions(s.dimensions);setPreset('custom')
    setHistoryCounts({undo:next.past.length,redo:next.future.length})
  }

  useEffect(() => {
    const clear = () => {
      setSpaceHeld(false)
      setPanning(false)
      const pan = panStart.current
      panStart.current = null
      if (pan && viewportRef.current?.hasPointerCapture(pan.id)) viewportRef.current.releasePointerCapture(pan.id)
    }
    const keyDown = (e: KeyboardEvent) => {
      if (tool !== 'design' || e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      e.preventDefault()
      setSpaceHeld(true)
    }
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clear)
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', clear); clear() }
  }, [tool])

  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((!handActive && e.button !== 1) || (e.button !== 0 && e.button !== 1)) return
    if (e.target instanceof Element && e.target.closest('.preview-background')) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    panStart.current = {id:e.pointerId,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop}
    el.setPointerCapture(e.pointerId)
    setPanning(true)
  }
  const movePan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panStart.current
    if (!pan || pan.id !== e.pointerId) return
    e.preventDefault()
    e.currentTarget.scrollLeft = pan.left - (e.clientX - pan.x)
    e.currentTarget.scrollTop = pan.top - (e.clientY - pan.y)
  }
  const stopPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panStart.current?.id !== e.pointerId) return
    panStart.current = null
    setPanning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setViewport({width: entry.contentRect.width, height: entry.contentRect.height}))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => { if (key === 'autoTone' || key === 'autoToneStrength' || key === 'autoContrast' || key === 'autoContrastStrength' || key === 'autoColor' || key === 'autoColorStrength') setView('result'); setPreset('custom'); setSettings((s) => ({ ...s, [key]: value })) }

  const applyPreset = (key:string) => {
    const p=presets[key]
    if(!p)return
    setSettings(s=>({...s,...p.values}))
    setGarment(p.garment);setPreset(key);setPresetMessage('')
    setPreviewBg(p.garment==='light'?'white':'black');setView('result')
  }
  const choosePresetGroup = (tone:GarmentTone,mode:PresetMode) => applyPreset(presetsFor(tone,mode)[0][0])

  const savePreset = () => {
    const baseName = presetName.trim().slice(0, 60)
    if (!baseName) return
    const existing = readSavedPresets()
    let name = baseName, suffix = 2
    while (existing.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) name = `${baseName} (${suffix++})`
    const saved: SavedPreset = {id:`saved:${crypto.randomUUID()}`,name,garment:activeGarment,settings:{...settings,edgeSides:[...settings.edgeSides]}}
    try {
      localStorage.setItem(presetStorageKey, JSON.stringify([...existing,saved]))
      setSavedPresets([...existing,saved])
      setPreset(saved.id)
      setSavingPreset(false)
      setPresetName('')
      setPresetMessage(`“${name}” guardado en este navegador.`)
    } catch {setPresetMessage('No se pudo guardar. Revisa que el navegador permita almacenamiento local.')}
  }
  const renamePreset = () => {
    try {
      const next=renamePersonalPreset(readSavedPresets(),preset,renameValue)
      localStorage.setItem(presetStorageKey,JSON.stringify(next));setSavedPresets(next);setRenamingPreset(false)
      setPresetMessage('Nombre actualizado. Los ajustes del preset no cambiaron.')
    }catch(e){setPresetMessage((e as Error).message)}
  }
  const deletePreset = () => {
    const selected=savedPresets.find(p=>p.id===preset)
    if(!selected||!window.confirm(`¿Eliminar el preset «${selected.name}» de tu biblioteca? No se puede deshacer. Los ajustes de la imagen actual se conservarán.`))return
    try {
      const next=deletePersonalPreset(readSavedPresets(),preset)
      localStorage.setItem(presetStorageKey,JSON.stringify(next));setSavedPresets(next);setPreset('custom');setRenamingPreset(false)
      setPresetMessage('Preset eliminado de la biblioteca. Los ajustes actuales se conservan.')
    }catch(e){setPresetMessage((e as Error).message)}
  }

  const ratio = dimensions.width / dimensions.height
  let output: ReturnType<typeof printSize> | undefined
  let sizeError = ''
  try { if(fileName) output = printSize(Number(widthCm), ratio, dpi) } catch (e) { sizeError = (e as Error).message }
  const renderKey = JSON.stringify([imageVersion, output?.width, output?.height, dpi, settings,crop])
  const processing = loading || (!!output && readyKey !== renderKey && !error)
  const visibleSize=displaySize ?? dimensions
  const previewScale = fit ? Math.min((viewport.width - 48) / visibleSize.width, (viewport.height - 48) / visibleSize.height, 1) : zoom / 100
  const shownZoom = Math.max(1, Math.round(previewScale * 100))
  const changeZoom = (factor: number) => { setZoom(Math.max(5, Math.min(400, Math.round(shownZoom * factor)))); setFit(false) }

  const loadImage = (src: string, name: string, sourceDpi=300, physicalWidth?:number, document?:EditorDocument,assetId?:string) => {
    const id = ++loadId.current
    setLoading(true)
    const img = new Image()
    img.onload = () => {
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
      if (id !== loadId.current) return
      if (!img.naturalWidth || !img.naturalHeight) { setError('La imagen no tiene dimensiones válidas.'); setLoading(false); return }
      imageRef.current = img
      setCrop(document?.crop ?? null)
      setEditingAssetId(assetId)
      if(document){setSettings({...document.settings,edgeSides:[...document.settings.edgeSides]});if(document.garment)setGarment(document.garment);setPreset('custom')}
      setShowCrop(false)
      setDimensions({ width: document?.crop?.width ?? img.naturalWidth, height: document?.crop?.height ?? img.naturalHeight })
      setWidthCm((physicalWidth ?? img.naturalWidth / sourceDpi * 2.54).toFixed(4))
      setDpi(sourceDpi)
      setFileName(name)
      setError('')
      setExportMessage('')
      setLoading(false)
      setImageVersion(v => v + 1)
      setFit(true)
    }
    img.onerror = () => { if (id === loadId.current) { setLoading(false); setError('No se pudo abrir la imagen. Prueba con PNG, JPG o WebP.') } if (src.startsWith('blob:')) URL.revokeObjectURL(src) }
    img.src = src
  }

  useEffect(() => () => { loadId.current++ }, [])
  useEffect(() => {
    if (!imageRef.current || !output || loading) return
    let cancelled = false
    let worker: Worker | undefined
    const { width, height } = output
    setError('')
    setExportMessage('')
    const timer = setTimeout(() => {
      try {
        const src = sourceCanvas.current!, out = resultCanvas.current!
        const native = document.createElement('canvas')
        native.width = imageRef.current!.naturalWidth
        native.height = imageRef.current!.naturalHeight
        const ctx = native.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(imageRef.current!, 0, 0)
        const input = ctx.getImageData(crop?.x ?? 0, crop?.y ?? 0, crop?.width ?? native.width, crop?.height ?? native.height)
        worker = new Worker(new URL('./halftone.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }) => {
          if (cancelled) return
          if (data.error) setError(data.error)
          else {
            // Resize only when the replacement is ready: resizing clears canvas pixels.
            const originalPixels=new ImageData(data.original,width,height)
            const resultPixels=new ImageData(data.data,width,height)
            src.width = out.width = width
            src.height = out.height = height
            src.getContext('2d')!.putImageData(originalPixels, 0, 0)
            out.getContext('2d')!.putImageData(resultPixels, 0, 0)
            setDisplaySize({width,height})
            setTransparent(data.transparent)
            setReadyKey(renderKey)
          }
          worker?.terminate()
        }
        worker.onerror = () => { if (!cancelled) setError('No se pudo procesar. Reduce el tamaño e inténtalo nuevamente.'); worker?.terminate() }
        worker.postMessage({ data: input.data, width, height, sourceWidth: input.width, sourceHeight: input.height, settings: { ...settings, dpi } }, [input.data.buffer])
        native.width = native.height = 1
      } catch (e) { if (!cancelled) setError((e as Error).message) }
    }, 120)
    return () => { cancelled = true; clearTimeout(timer); worker?.terminate() }
  }, [renderKey, loading])

  const handleFile = async (file?: File, print?:{widthCm:number;dpi:number}) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecciona una imagen PNG, JPG, WebP o SVG.'); return }
    const request=++loadId.current
    setLoading(true)
    let sourceDpi=300
    try {
      if(file.type==='image/png'){
        const info=inspectPng(new Uint8Array(await file.arrayBuffer()))
        sourceDpi=[150,300,600].find(value=>Math.abs(info.dpi-value)<.02&&Math.abs(info.dpiY-value)<.02) ?? 300
      }
      if(request!==loadId.current)return
      loadImage(URL.createObjectURL(file), file.name, print?.dpi ?? sourceDpi,print?.widthCm)
    } catch(e){if(request===loadId.current){setLoading(false);setError((e as Error).message)}}
  }

  const requestImport = (file?: File) => {
    if (!file) return
    handleFile(file)
    setTool('design')
  }

  const trimToContent=()=>{
    const image=imageRef.current
    if(!image || loading)return
    setCropMessage('')
    try {
      const area=crop ?? {x:0,y:0,width:image.naturalWidth,height:image.naturalHeight}
      let bounds=imageContentBounds(image,area)
      // If the source is an opaque JPG/PNG, the current processing may still
      // have removed its background (for example with the color-range mask).
      // Use that alpha only to find the crop rectangle; the original pixels
      // remain untouched and are rendered again inside the new rectangle.
      if(bounds&&bounds.width===area.width&&bounds.height===area.height&&readyKey===renderKey&&resultCanvas.current?.width&&resultCanvas.current.height){
        const canvas=resultCanvas.current
        const pixels=canvas.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,canvas.width,canvas.height).data
        const processed=contentBounds(pixels,canvas.width,canvas.height)
        if(processed&&!(processed.x===0&&processed.y===0&&processed.width===canvas.width&&processed.height===canvas.height)){
          const x=Math.max(0,Math.floor(processed.x*area.width/canvas.width)),y=Math.max(0,Math.floor(processed.y*area.height/canvas.height))
          const right=Math.min(area.width,Math.ceil((processed.x+processed.width)*area.width/canvas.width)),bottom=Math.min(area.height,Math.ceil((processed.y+processed.height)*area.height/canvas.height))
          if(right>x&&bottom>y)bounds={x:area.x+x,y:area.y+y,width:right-x,height:bottom-y}
        }
      }
      if(!bounds){setCropMessage('La imagen no contiene píxeles visibles.');return}
      if(bounds.width===area.width && bounds.height===area.height){setCropMessage('No hay márgenes transparentes que recortar. Los fondos opacos (JPG o PNG sin alfa) cuentan como contenido.');return}
      setWidthCm((Number(widthCm)*bounds.width/dimensions.width).toFixed(4))
      setDimensions({width:bounds.width,height:bounds.height});setCrop(bounds);setFit(true);setCropMessage(`Recortado a ${bounds.width} × ${bounds.height} px. Puedes deshacerlo.`)
    } catch(e){setError(e instanceof Error?e.message:'No se pudo detectar el contenido.')}
  }

  const exportPng = async () => {
    const canvas = resultCanvas.current
    if (!canvas || !output || readyKey !== renderKey || loading || exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo generar el PNG.')), 'image/png'))
      const bytes = withCanvasPrintProfile(new Uint8Array(await blob.arrayBuffer()), dpi)
      const metadata = inspectPng(bytes)
      if (metadata.width !== output.width || metadata.height !== output.height || Math.abs(metadata.dpi - dpi) > .02 || Math.abs(metadata.dpiY - dpi) > .02 || metadata.profile !== 'sRGB') throw new Error('El PNG no coincide con el tamaño solicitado.')
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
      const link = document.createElement('a')
      link.download = `${fileName.replace(/\.[^.]+$/, '')}-${output.width}x${output.height}-${dpi}ppp.png`
      link.href = url
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setExportMessage(`PNG verificado: ${metadata.width} × ${metadata.height} px · ${dpi} ppp · ${output.widthCm.toFixed(2)} × ${output.heightCm.toFixed(2)} cm. Descarga solicitada.`)
    } catch (e) { setError((e as Error).message) }
    finally { setExporting(false) }
  }

  const snapshotEditor = () => {
    if(loading)throw new Error('Espera a que termine de cargar la imagen antes de guardar.')
    if(!imageRef.current)return undefined
    if(originalSnapshot.current?.image!==imageRef.current){
      const native=document.createElement('canvas')
      native.width=imageRef.current.naturalWidth;native.height=imageRef.current.naturalHeight
      native.getContext('2d',{colorSpace:'srgb'})!.drawImage(imageRef.current,0,0)
      originalSnapshot.current={image:imageRef.current,data:native.toDataURL('image/png')}
      native.width=native.height=1
    }
    const doc:EditorDocument={version:1,original:originalSnapshot.current.data,settings:structuredClone(settings),crop:crop?{...crop}:null,widthCm:Number(widthCm),dpi,garment:activeGarment}
    return {name:fileName,document:doc,assetId:editingAssetId}
  }
  const restoreProjectEditor = (editor:{name:string;document:EditorDocument;assetId?:string}|undefined) => {
    setGangSource(undefined)
    if(editor){loadImage(editor.document.original,editor.name,editor.document.dpi,editor.document.widthCm,editor.document,editor.assetId)}
    else {loadId.current++;imageRef.current=null;setImageVersion(v=>v+1);setFileName('');setEditingAssetId(undefined);setCrop(null);setLoading(false);setDisplaySize(null);setReadyKey('')}
  }
  const sendToGang = () => {
    if (!output || readyKey !== renderKey || loading || exporting || !imageRef.current) return
    const name = fileName
    const width = output.widthCm
    const sourceDpi=dpi
    const native=document.createElement('canvas')
    native.width=imageRef.current.naturalWidth;native.height=imageRef.current.naturalHeight
    native.getContext('2d',{colorSpace:'srgb'})!.drawImage(imageRef.current,0,0)
    const editorDocument:EditorDocument={version:1,original:native.toDataURL('image/png'),settings:structuredClone(settings),crop:crop?{...crop}:null,widthCm:width,dpi:sourceDpi,garment:activeGarment}
    native.width=native.height=1
    const replaceId=editingAssetId
    setExporting(true)
    resultCanvas.current?.toBlob(async blob => {
      try {if(!blob)throw new Error('No se pudo generar el diseño.');const tagged=new Blob([withCanvasPrintProfile(new Uint8Array(await blob.arrayBuffer()),sourceDpi)],{type:'image/png'});setGangSource({id: Date.now(), blob:tagged, widthCm: width, name,document:editorDocument,replaceId});setTool('gang')}
      catch(e){setError((e as Error).message)}finally{setExporting(false)}
    }, 'image/png')
  }

  const editGangDocument = (document:EditorDocument,name:string,id:string) => {
    loadImage(document.original,name,document.dpi,document.widthCm,document,id)
    setTool('design')
  }

  return (
    <div className="app-shell" inert={resetting} onPointerDownCapture={()=>{gesture.current++}} onKeyDownCapture={e=>{
      if(!e.repeat)gesture.current++
      if(tool!=='design' || showCrop || showColorRange || !(e.metaKey||e.ctrlKey))return
      if(e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable=true]'))return
      if(e.key.toLowerCase()==='z'){e.preventDefault();navigateHistory(e.shiftKey?'redo':'undo')}
      else if(e.key.toLowerCase()==='y'){e.preventDefault();navigateHistory('redo')}
    }}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><CircleDot size={23} /><i /></div><span>TRAMA</span><small>DTF LAB</small></div>
        <div className={`project-status ${projectStatus.failed?'save-failed':''}`}>
          <button type="button" className="project-disclosure" aria-expanded={!projectCollapsed} aria-controls="project-details project-actions" aria-label={projectCollapsed?'Mostrar detalles y acciones del proyecto':'Ocultar detalles y acciones del proyecto'} onClick={()=>setProjectCollapsed(value=>!value)}><strong title={`${projectStatus.name}.trama.json`}>{projectStatus.name}.trama.json</strong><ChevronDown size={16} aria-hidden="true"/></button>
          <span role="status">{projectStatus.message}</span>
          <div className="project-details" id="project-details" hidden={projectCollapsed}>
          <span className="project-file-size" title="Tamaño del JSON completo, incluidas las imágenes. El espacio interno del navegador puede diferir.">{projectStatus.bytes===undefined?'Peso: calculando…':`Peso del proyecto: ${projectStatus.bytes<1_000_000?`${(projectStatus.bytes/1_000).toLocaleString('es-CL',{maximumFractionDigits:1})} KB`:`${(projectStatus.bytes/1_000_000).toLocaleString('es-CL',{maximumFractionDigits:2})} MB`}`}</span>
          <small className="project-location" title={`Autoguardado en el almacenamiento de ${window.location.origin}. Las copias descargadas se guardan en la carpeta que elijas en tu navegador.`}>Ubicación: este navegador · {window.location.host}</small>
          {fileName&&<small title={fileName}>{fileName} · {dimensions.width} × {dimensions.height} px</small>}
          </div>
        </div>
        <div className="top-actions">
          {fileName && tool === 'design' && <><button className="btn gang-send" title="Añadir el diseño procesado y abrir la plancha" disabled={processing || exporting || !output || readyKey !== renderKey} onClick={sendToGang}><Layers3 size={16}/><span>{editingAssetId?'Actualizar en Gang Sheet':'Enviar a Gang Sheet'}</span></button><button className="btn export" disabled={processing || exporting || !output || readyKey !== renderKey} onClick={exportPng}><Download size={17} /> {exporting ? 'Exportando…' : 'Exportar PNG'}</button></>}
        </div>
      </header>
      <div className="project-toolbar" id="project-actions" role="group" aria-label="Acciones del proyecto" hidden={projectCollapsed}>
        <span className="project-toolbar-label">Proyecto</span>
        <button className="btn ghost" disabled={loading||projectStatus.pending} onClick={()=>projectActions.current?.open()}><FolderOpen size={15} aria-hidden="true"/>Abrir proyecto</button>
        <button className="btn ghost" disabled={loading} onClick={()=>projectActions.current?.save()}><Download size={15} aria-hidden="true"/>Descargar proyecto</button>
        <button className="btn project-delete" disabled={loading||exporting||projectStatus.pending||resetting} onClick={onNewProject} title="Eliminar el proyecto guardado en este navegador y volver al inicio"><Trash2 size={15} aria-hidden="true"/>{resetting?'Eliminando…':'Eliminar proyecto y empezar de cero'}</button>
        {fileName && tool === 'design' && <button className="btn ghost reset-adjustments" onClick={() => {setSettings(initialSettings); setGarment('dark'); setPreset('default');setPreviewBg('black')}}><RotateCcw size={15} /> Restablecer ajustes</button>}
      </div>

      <nav className="tool-tabs"><button className={tool === 'design' ? 'active' : ''} onClick={() => setTool('design')}>Editor de semitonos</button><button className={tool === 'gang' ? 'active' : ''} onClick={() => setTool('gang')}>Gang Sheet</button><span>Todo se procesa en tu equipo</span></nav>
      <div className="gang-container" style={{display: tool === 'gang' ? 'block' : 'none'}}><GangSheet source={gangSource} onImportFile={requestImport} onEditDocument={editGangDocument} previewColor={previewBg} onPreviewColorChange={setPreviewBg} getEditor={snapshotEditor} restoreEditor={restoreProjectEditor} initialProject={initialProject} editorRevision={JSON.stringify([renderKey,fileName,editingAssetId,activeGarment])} editorLoading={loading} onSaveStatus={setProjectStatus} actionsRef={projectActions}/></div>
      <main className={`workspace ${prepressCollapsed || !fileName ? 'prepress-collapsed' : ''} ${!fileName ? 'empty-editor' : ''}`} style={{display: tool === 'design' ? undefined : 'none'}}>
        <aside className="sidebar" id="prepress-panel" hidden={prepressCollapsed || !fileName}>
          <div className="sidebar-title"><div><Sparkles size={18} /><span>Pre-prensa</span></div><button aria-label="Información" aria-expanded={showInfo} onClick={() => setShowInfo(v => !v)}><Info size={17} /></button></div>
          {showInfo && <div className="tip-card"><p>1. Carga tu imagen y define tamaño y ppp. 2. Elige el fondo a eliminar, preset y bordes. 3. Revisa al 100% y sobre la prenda. 4. Exporta PNG o añade a una plancha. El tamaño se graba en el PNG; comprueba que tu RIP respete los centímetros indicados.</p></div>}

          <section className={`control-card ${collapsedPanels.presets ? '' : 'open'}`}><button className="section-heading" aria-expanded={!collapsedPanels.presets} aria-controls="preset-controls" onClick={()=>setCollapsedPanels(s=>({...s,presets:!s.presets}))}><span>Presets</span><ChevronDown size={17}/></button><div className="section-body" id="preset-controls" hidden={collapsedPanels.presets}>
            <div className="preset-group"><span className="preset-group-label">Prenda</span><div className="segmented preset-segments" role="group" aria-label="Tono de prenda">{([['dark','Prenda oscura'],['light','Prenda clara']] as const).map(([tone,label])=><button key={tone} type="button" className={activeGarment===tone?'active':''} aria-pressed={activeGarment===tone} onClick={()=>{if(activeGarment!==tone)choosePresetGroup(tone,presetMode)}}>{label}</button>)}</div></div>
            <div className="preset-group"><span className="preset-group-label">Acabado</span><div className="segmented preset-segments" role="group" aria-label="Acabado">{([['halftone','Semitono'],['continuous','Sin semitono']] as const).map(([mode,label])=><button key={mode} type="button" className={presetMode===mode?'active':''} aria-pressed={presetMode===mode} onClick={()=>{if(presetMode!==mode)choosePresetGroup(activeGarment,mode)}}>{label}</button>)}</div></div>
            <label className="field">Preset<select aria-label="Preset" value={preset.startsWith('saved:')||visiblePresets.some(([key])=>key===preset)?preset:'custom'} onChange={e => {
              const key = e.target.value
              const saved = savedPresets.find(p => p.id === key)
              setPresetMessage('');setRenamingPreset(false)
              if(saved){setSettings({...saved.settings,edgeSides:[...saved.settings.edgeSides]});if(saved.garment)setGarment(saved.garment);setPreset(key);setView('result');if(saved.settings.background!=='none')setPreviewBg(saved.settings.background);else if(saved.garment)setPreviewBg(saved.garment==='light'?'white':'black')}
              else applyPreset(key)
            }}><option value="custom" disabled>Personalizado</option><optgroup label={`${activeGarment==='dark'?'Prenda oscura':'Prenda clara'} · ${presetMode==='halftone'?'Semitono':'Sin semitono'}`}>{visiblePresets.map(([key,p]) => <option key={key} value={key}>{p.label}</option>)}</optgroup>{savedPresets.length>0 && <optgroup label="Mis presets">{savedPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}</select></label>
            <p className="help-text">{preset in presets ? presets[preset].description : preset.startsWith('saved:') ? 'Preset guardado: trama, nitidez, fondo y bordes. El tamaño de impresión se mantiene.' : 'Ajustes personalizados.'}</p>
            <p className="help-text preset-note">Cambiar de categoría aplica su primer preset. Los incluidos conservan tamaño, ppp, recorte y bordes. Negro y blanco son los fondos de referencia: sobre otras prendas de color el resultado puede variar. Revisa la vista previa y haz una prueba de impresión.</p>
            <button className="btn save-preset" aria-expanded={savingPreset} onClick={() => {setSavingPreset(v=>!v);setPresetMessage('')}}>Guardar preset</button>
            {preset.startsWith('saved:')&&<div className="preset-library-actions"><button className="btn" onClick={()=>{setRenameValue(savedPresets.find(p=>p.id===preset)?.name||'');setRenamingPreset(true);setSavingPreset(false);setPresetMessage('')}}>Renombrar preset</button><button className="btn danger" onClick={deletePreset}>Eliminar preset</button></div>}
            {renamingPreset&&preset.startsWith('saved:')&&<form className="save-preset-form" onSubmit={e=>{e.preventDefault();renamePreset()}}><label className="field">Nuevo nombre<input autoFocus aria-label="Nuevo nombre del preset" maxLength={60} value={renameValue} onChange={e=>setRenameValue(e.target.value)}/></label><button className="btn export" disabled={!renameValue.trim()}>Guardar nombre</button><button type="button" className="btn" onClick={()=>setRenamingPreset(false)}>Cancelar</button></form>}
            {savingPreset && <form className="save-preset-form" onSubmit={e=>{e.preventDefault();savePreset()}}><label className="field">Nombre del preset<input autoFocus aria-label="Nombre del preset" type="text" maxLength={60} placeholder="Ej. DTF negro fino" value={presetName} onChange={e=>setPresetName(e.target.value)} /></label><button className="btn export" type="submit" disabled={!presetName.trim()}>Guardar mis ajustes</button><p className="help-text">Se guarda en este navegador. Incluye trama, color, fondo, nitidez y bordes; excluye tamaño y zoom.</p></form>}
            {presetMessage && <p className="help-text" role="status">{presetMessage}</p>}
          </div></section>

          <section className={`control-card ${collapsedPanels.size ? '' : 'open'}`}><button className="section-heading" aria-expanded={!collapsedPanels.size} aria-controls="size-controls" onClick={()=>setCollapsedPanels(s=>({...s,size:!s.size}))}><span>Tamaño de impresión</span><ChevronDown size={17}/></button><div className="section-body" id="size-controls" hidden={collapsedPanels.size}>
            <button className="btn" disabled={loading} onClick={()=>setShowCrop(true)}>Recortar imagen (Crop)</button>
            <button className="btn" disabled={loading||!fileName||!output} onClick={trimToContent}>Recortar al contenido</button>
            <p className="help-text">Quita márgenes transparentes del original, sin ampliar el diseño. Conserva los huecos internos. Puedes deshacer el recorte.</p>{cropMessage&&<p className="help-text" role="status">{cropMessage}</p>}
            <details className="advanced-controls"><summary>Escala por porcentaje</summary><div className="advanced-body">
            <label className="field">Escala del original (%)<input aria-label="Escala del original en porcentaje" type="number" min="1" max="2000" step="25" value={widthCm && Number(widthCm) > 0 ? Number((Number(widthCm) / 2.54 * dpi / dimensions.width * 100).toFixed(1)) : ''} onChange={e => setWidthCm(e.target.value ? (dimensions.width * Number(e.target.value) / 100 / dpi * 2.54).toFixed(4) : '')} /></label>
            <div className="scale-presets">{[100,200,300,400].map(percent => <button key={percent} onClick={() => setWidthCm((dimensions.width * percent / 100 / dpi * 2.54).toFixed(4))}>{percent}%</button>)}</div>
            </div></details>
            <div className="dimension-fields"><label>Ancho (cm)<input aria-label="Ancho en centímetros" type="number" min="0.1" step="0.1" value={widthCm} onChange={e => setWidthCm(e.target.value)} /></label><label>Alto (cm)<input aria-label="Alto en centímetros" type="number" min="0.1" step="0.1" value={widthCm && Number(widthCm) > 0 ? (Number(widthCm) / ratio).toFixed(2) : ''} onChange={e => setWidthCm(e.target.value ? String(Number(e.target.value) * ratio) : '')} /></label></div>
            <label className="field">Resolución<select aria-label="Resolución de impresión" value={dpi} onChange={e => setDpi(Number(e.target.value))}><option value="150">150 ppp</option><option value="300">300 ppp</option><option value="600">600 ppp</option></select></label>
            <p className="help-text">Salida PNG sRGB, 8 bits por canal. Comprueba los ppp requeridos por tu RIP. Aumentarlos no recupera detalle del original.</p>
            <p className="help-text">Proporciones bloqueadas. {output ? `${output.width} × ${output.height} px de salida.` : ''}</p>
            <p className="help-text">Ampliación Lanczos · La trama se genera después de escalar.</p>
            <RangeControl label="Nitidez adicional" value={settings.sharpness} min={0} max={100} unit="%" onChange={v => update('sharpness', v)} />
            {output && output.width > dimensions.width * 1.05 && <p className="help-text">Ampliación de {(output.width / dimensions.width).toFixed(1)}×. El tamaño aumenta, pero no recupera detalle del original.</p>}
            {sizeError && <p className="error-text" role="alert">{sizeError}</p>}
          </div></section>

          <section className={`control-card ${collapsedPanels.background ? '' : 'open'}`}><button className="section-heading" aria-expanded={!collapsedPanels.background} aria-controls="background-controls" onClick={()=>setCollapsedPanels(s=>({...s,background:!s.background}))}><span>Eliminar fondo</span><ChevronDown size={17}/></button><div className="section-body" id="background-controls" hidden={collapsedPanels.background}>
            <div className="segmented"><button className={settings.background === 'black' ? 'active' : ''} onClick={() => update('background', 'black')}>Negro</button><button className={settings.background === 'white' ? 'active' : ''} onClick={() => update('background', 'white')}>Blanco</button><button className={settings.background === 'none' ? 'active' : ''} onClick={() => update('background', 'none')}>Ninguno</button></div>
            <button className={`btn color-range-trigger ${settings.background==='custom'?'active':''}`} disabled={!fileName||loading} onClick={()=>setShowColorRange(true)}><Pipette size={16}/><span>{settings.background==='custom'?'Editar rango de color…':'Gotero · Rango de color…'}</span></button>
            {settings.background==='custom'&&<p className="help-text">Color personalizado activo · {settings.colorRange?.colors.join(', ')}. Tolerancia {settings.colorRange?.tolerance}%. Primero se elimina la selección y después se aplica el semitono normal sobre los colores restantes, para prenda {settings.customBase==='black'?'oscura':'clara'}.</p>}
            {settings.background === 'black' && <RangeControl label="Eliminar sombras" value={settings.tolerance} min={0} max={100} onChange={(v) => update('tolerance', v)} />}
            {settings.background==='black'&&settings.enabled&&settings.preserveColor&&<><RangeControl label="Limpiar ruido en sombras" value={settings.backgroundCleanup??0} min={0} max={100} unit="%" onChange={v=>{update('backgroundCleanup',v);setView('result')}}/><p className="help-text">0%: apagado. Reduce puntos brillantes de color en zonas casi negras, sin desaturar el diseño completo. Puede oscurecer o quitar detalle oscuro real: compara antes de exportar. No afecta los tonos fuera de esa zona.</p></>}
            {settings.background==='white'&&settings.whiteRemoval!=='connected'&&settings.enabled&&settings.preserveColor&&<><RangeControl label="Limpiar ruido en blancos" value={settings.backgroundCleanup??0} min={0} max={100} unit="%" onChange={v=>{update('backgroundCleanup',v);setView('result')}}/><p className="help-text">0%: apagado. Reduce puntos residuales de color en zonas casi blancas. Puede aclarar o quitar detalles claros reales, incluido el pelaje: compara antes de exportar. No afecta los tonos fuera de esa zona.</p></>}
            {settings.background === 'white' && <><RangeControl label="Umbral de blancos" value={settings.whiteCutoff} min={170} max={255} onChange={(v) => update('whiteCutoff', v)} />{settings.enabled&&(settings.size>100||settings.gamma>1||settings.brightness>100)&&<p className="help-text warning-inline">Estos ajustes aumentan la cobertura de tinta y pueden oscurecer el resultado sobre blanco. Tamaño 100%, gamma 1 y densidad 100% son el punto de partida neutro.</p>}</>}
            {settings.background==='white' && <p className="help-text">El blanco de la prenda se conserva como base. Para quitar un color específico del fondo, usa el gotero; así puedes seleccionar tonos crema sin eliminar automáticamente los detalles interiores.</p>}
            <p className="help-text">«Vista sobre» cambia solo la previsualización. La eliminación de fondo se elige aquí.</p>
          </div></section>

          <section hidden={!settings.enabled} className={`control-card ${collapsedPanels.trama ? '' : 'open'}`}>
            <button className="section-heading" aria-expanded={!collapsedPanels.trama} aria-controls="trama-controls" onClick={() => setCollapsedPanels(s=>({...s,trama:!s.trama}))}><span><CircleDot size={17} /> Semitono</span><ChevronDown size={17} /></button>
            <div className="section-body" id="trama-controls" hidden={collapsedPanels.trama}>
              <RangeControl label="Frecuencia" value={settings.lpi} min={12} max={65} unit=" LPI" onChange={(v) => update('lpi', v)} />
              <RangeControl label="Ángulo" value={settings.angle} min={0} max={90} step={0.5} unit="°" onChange={(v) => update('angle', v)} />
              <div className="field"><span>Forma del punto</span><div className="segmented shapes">
                {(['circle', 'square', 'line'] as Shape[]).map((shape) => <button key={shape} className={settings.shape === shape ? 'active' : ''} onClick={() => update('shape', shape)}><i className={`shape-${shape}`} />{shapeLabels[shape]}</button>)}
              </div></div>
              <RangeControl label="Tamaño máximo" value={settings.size} min={45} max={125} unit="%" onChange={(v) => update('size', v)} />
              <div className="row-label"><span>Alfa sólido (DTF)</span><Toggle checked={settings.solidAlpha} onChange={v => update('solidAlpha', v)} /></div>
              <p className="help-text">Cada punto exportado es opaco; los huecos permanecen transparentes. Desactívalo para conservar alfa parcial en los bordes.</p>
              <div className="row-label"><span>Conservar color</span><Toggle checked={settings.preserveColor} onChange={(v) => update('preserveColor', v)} /></div>
              <p className="help-text">Mantiene el color original en los puntos. Desactívalo para generar una tinta única según la prenda.</p>
              <div className="row-label"><span>Invertir trama</span><Toggle checked={settings.invert} onChange={v => update('invert', v)} /></div>
              <p className="help-text">Invierte las zonas de tinta y transparencia del semitono.</p>
              {settings.background==='white'&&settings.whiteRemoval!=='connected'&&settings.enabled&&settings.preserveColor&&<><RangeControl label="Conservar detalle" value={settings.whiteDetail??0} min={0} max={100} unit="%" onChange={v=>update('whiteDetail',v)}/><p className="help-text">0%: trama tonal sin refuerzo. Aumentarlo refuerza la cobertura según el tono, sin convertir toda la imagen en color continuo. Compensa el color para conservar aproximadamente el tono medio sobre blanco con ajustes neutros. Para quitar la trama, elige «Sin semitono».</p></>}
            </div>
          </section>

          <section className={`control-card ${collapsedPanels.ajustes ? '' : 'open'}`}>
            <button className="section-heading" aria-expanded={!collapsedPanels.ajustes} aria-controls="image-controls" onClick={() => setCollapsedPanels(s=>({...s,ajustes:!s.ajustes}))}><span><SlidersHorizontal size={17} /> Ajustes de imagen</span><ChevronDown size={17} /></button>
            <div className="section-body" id="image-controls" hidden={collapsedPanels.ajustes}>
              <div className="auto-adjustments">
                <span className="field">Correcciones automáticas</span>
                {([['autoTone','Tono automático','Amplía el rango de cada canal de color.'],['autoContrast','Contraste automático','Amplía el rango con el mismo ajuste para los tres canales.'],['autoColor','Color automático','Reduce dominantes usando los tonos casi neutros.']] as const).map(([key,label,description]) => <div className="auto-adjust-item" key={key}><button className={`auto-adjust-button ${settings[key] ? 'active' : ''}`} type="button" aria-pressed={settings[key]} title={description} onClick={()=>update(key,!settings[key])}><Sparkles size={14}/><span>{label}</span>{settings[key] && <Check size={14}/>}</button>{settings[key]&&<RangeControl label={`Intensidad ${label.toLowerCase()}`} value={key==='autoTone'?settings.autoToneStrength:key==='autoContrast'?settings.autoContrastStrength:settings.autoColorStrength} min={0} max={100} unit="%" onChange={v=>update(key==='autoTone'?'autoToneStrength':key==='autoContrast'?'autoContrastStrength':'autoColorStrength',v)} />}</div>)}
                <p className="help-text">Pulsa para activar o desactivar. Puedes combinarlas; se calculan desde el original antes de la trama y se incluyen al guardar un preset.</p>
              </div>
              {(settings.autoTone||settings.autoContrast)&&<p className="help-text">0% conserva el tono original; 100% aplica toda la corrección automática.</p>}
              <details className="advanced-controls"><summary>Ajustes avanzados de imagen</summary><div className="advanced-body">
              <RangeControl label="Contraste" value={settings.contrast} min={50} max={180} unit="%" onChange={(v) => update('contrast', v)} />
              <RangeControl label={settings.background==='white'?'Densidad de tinta':'Brillo'} value={settings.brightness} min={60} max={140} unit="%" onChange={(v) => update('brightness', v)} />
              <RangeControl label="Degradados (gamma)" value={settings.gamma} min={0.5} max={2} step={0.05} onChange={v => update('gamma', v)} />
              <div className="white-balance-title"><span>Balance de blancos</span><button className="text-button" onClick={()=>{update('temperature',0);update('tint',0);update('autoColorStrength',100)}}>Reiniciar</button></div>
              <RangeControl label="Temperatura" value={settings.temperature} min={-100} max={100} onChange={v => update('temperature', v)} />
              <RangeControl label="Tinte magenta / verde" value={settings.tint} min={-100} max={100} onChange={v => update('tint', v)} />
              <p className="help-text">Temperatura negativa enfría hacia azul; positiva calienta hacia amarillo. Tinte negativo va a verde; positivo a magenta.</p>
              </div></details>
            </div>
          </section>

          <section className={`control-card ${collapsedPanels.edges ? '' : 'open'}`}><button className="section-heading" aria-expanded={!collapsedPanels.edges} aria-controls="edge-controls" onClick={()=>setCollapsedPanels(s=>({...s,edges:!s.edges}))}><span>Suavizar bordes</span><ChevronDown size={17}/></button><div className="section-body" id="edge-controls" hidden={collapsedPanels.edges}>
            <button className="text-button" onClick={() => setSettings(s => ({...s, featherMm: 0, trimMm: 0, cornerRadiusMm: 0, edgeSides: [true,true,true,true]}))}>Reiniciar bordes</button>
            <RangeControl label="Borrar margen" value={settings.trimMm} min={0} max={15} step={0.5} unit=" mm" onChange={v => update('trimMm', v)} />
            <RangeControl label="Desvanecido hacia dentro" value={settings.featherMm} min={0} max={30} step={0.5} unit=" mm" onChange={v => update('featherMm', v)} />
            <RangeControl label="Radio de esquinas" value={settings.cornerRadiusMm} min={0} max={50} step={0.5} unit=" mm" onChange={v => update('cornerRadiusMm', v)} />
            <div className="edge-sides">{['Arriba', 'Derecha', 'Abajo', 'Izquierda'].map((label, index) => <label key={label}><input type="checkbox" checked={settings.edgeSides[index]} onChange={e => update('edgeSides', settings.edgeSides.map((v, i) => i === index ? e.target.checked : v))} />{label}</label>)}</div>
            <p className="help-text">Borra el contorno rectangular, suaviza los lados y permite redondear las cuatro esquinas. El tamaño del lienzo se conserva.</p>
          </div></section>
          <div className="tip-card"><div><Check size={14} /> {processing ? 'ACTUALIZANDO…' : `${transparent}% TRANSPARENTE`}</div><p>{settings.background==='custom'?'Se quitan los colores muestreados en toda la imagen. Puedes revisar o modificar la selección con el gotero.':settings.background === 'black' ? 'El negro lo aporta la prenda. Se eliminan los tonos oscuros del diseño completo.' : settings.background === 'white' ? settings.whiteRemoval==='connected'?'Se quita el fondo claro conectado al borde; se conservan los detalles interiores.':'Se eliminan los blancos del diseño completo.' : settings.enabled?'Se conserva el color y se perfora con la trama.':'Se conserva la imagen sin generar puntos.'} El fondo de vista previa no se exporta.</p></div>
          {error && <p className="error-text" role="alert">{error}</p>}
          {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
        </aside>

        <section className={`stage ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}>
          <div className="stage-toolbar" hidden={!fileName}>
            <button className="btn prepress-toggle" aria-expanded={!prepressCollapsed} aria-controls="prepress-panel" onClick={()=>setPrepressCollapsed(v=>!v)} title={prepressCollapsed?'Mostrar controles de Pre-prensa':'Ocultar controles de Pre-prensa'}><SlidersHorizontal size={15}/>{prepressCollapsed?'Mostrar Pre-prensa':'Ocultar Pre-prensa'}</button>
            <div className="history-controls" role="group" aria-label="Historial de ajustes">
              <button className="btn" disabled={loading||!historyCounts.undo} onClick={()=>navigateHistory('undo')} title="Deshacer (⌘/Ctrl Z)">↶ Deshacer</button>
              <button className="btn" disabled={loading||!historyCounts.redo} onClick={()=>navigateHistory('redo')} title="Rehacer (⌘/Ctrl Shift Z)">↷ Rehacer</button>
            </div>
            <div className="view-switch">
              <button className={view === 'original' ? 'active' : ''} onClick={() => setView('original')}><ImageIcon size={15} /> Original</button>
              <button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}><Layers3 size={15} /> Comparar</button>
              <button className={view === 'result' ? 'active' : ''} onClick={() => setView('result')}><CircleDot size={15} /> Resultado</button>
            </div>
            <div className="preview-background"><span>Vista sobre</span><select aria-label="Fondo de vista previa" value={previewBg} onChange={(e) => setPreviewBg(e.target.value)}><option value="checker">Transparencia</option><option value="black">Prenda negra</option><option value="white">Prenda blanca</option><option value="#596778">Prenda gris</option><option value="#304b70">Prenda azul marino</option><option value="#7b2931">Prenda roja</option></select></div>
            <button className="upload-mini" onClick={() => fileInput.current?.click()}><Upload size={15} /> Cambiar imagen</button>
            <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { requestImport(e.target.files?.[0]); e.target.value='' }} />
          </div>

          <div className={`canvas-area ${handActive ? 'hand-active' : ''} ${panning ? 'is-panning' : ''}`} ref={viewportRef} onPointerDownCapture={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={stopPan}>
            {!fileName && <div className="start-upload"><Upload size={36}/><h2>Arrastra tu imagen aquí</h2><p>PNG, JPG, WebP o SVG</p><button className="btn export" disabled={loading} onClick={()=>fileInput.current?.click()}>{loading?'Abriendo imagen…':'Abrir imagen'}</button>{error && <p className="error-text" role="alert">{error}</p>}</div>}
            <div className="artboard" hidden={!fileName} style={{ width: Math.max(1, visibleSize.width * previewScale), height: Math.max(1, visibleSize.height * previewScale), aspectRatio: `${visibleSize.width} / ${visibleSize.height}`, ...(previewBg !== 'checker' ? { backgroundImage: 'none', backgroundColor: previewBg } : {}) }}>
              <canvas ref={sourceCanvas} className="art-canvas" style={{ clipPath: view === 'split' ? `inset(0 ${100 - split}% 0 0)` : 'none', visibility: view === 'result' ? 'hidden' : 'visible' }} />
              <div className="result-layer" style={{ clipPath: view === 'split' ? `inset(0 0 0 ${split}%)` : 'none', visibility: view === 'original' ? 'hidden' : 'visible' }}><canvas ref={resultCanvas} className="art-canvas" /></div>
              {view === 'split' && <><div className="split-line" style={{ left: `${split}%` }}><span><Minus /><Minus /></span></div><input className="split-input" aria-label="Divisor de comparación" type="range" min="0" max="100" value={split} onChange={(e) => setSplit(Number(e.target.value))} /></>}
              {processing && <div className="processing"><span /> Procesando trama…</div>}
            </div>
            {dragging && <div className="drop-overlay"><Upload size={32} /><b>Suelta tu imagen aquí</b><span>PNG, JPG, WebP o SVG</span></div>}
          </div>

          <div className="statusbar" hidden={!fileName}>
            <div><span className="status-dot" /> Vista previa en tiempo real</div>
            <div className="zoom-control"><button className={`hand-button ${handActive ? 'active' : ''}`} aria-label="Mano para mover imagen" aria-pressed={handTool} title="Mano: arrastra para mover. También puedes mantener Espacio o usar el botón central del ratón." onClick={() => setHandTool(v => !v)}><Hand size={16} /></button><ZoomIn size={15} /><button aria-label="Reducir zoom" onClick={() => changeZoom(.8)}><Minus size={14} /></button><span>{shownZoom}%</span><button aria-label="Aumentar zoom" onClick={() => changeZoom(1.25)}><Plus size={14} /></button><button className="zoom-text" onClick={() => setFit(true)}>Ajustar</button><button className="zoom-text" onClick={() => {setFit(false);setZoom(100)}}>100%</button></div>
            <div>PNG · Fondo transparente</div>
          </div>
        </section>
      </main>
      {showCrop && imageRef.current && <CropPanel image={imageRef.current} initial={crop ?? {x:0,y:0,width:dimensions.width,height:dimensions.height}} onCancel={()=>setShowCrop(false)} onApply={rect=>{setWidthCm((Number(widthCm)*rect.width/dimensions.width).toFixed(4));setDimensions({width:rect.width,height:rect.height});setCrop(rect);setShowCrop(false);setFit(true)}}/>}
      {showColorRange&&imageRef.current&&<ColorRangePanel image={imageRef.current} crop={crop} initial={settings.colorRange??{...defaultColorRange,colors:[settings.background==='black'?'#000000':'#ffffff']}} onCancel={()=>setShowColorRange(false)} onApply={colorRange=>{const base=settings.background==='black'||settings.background==='white'?settings.background:activeGarment==='dark'?'black':'white';setGarment(activeGarment);setSettings(s=>({...s,background:'custom',customBase:base,colorRange,preserveColor:true}));setPreset('custom');setView('result');setShowColorRange(false)}}/>}
    </div>
  )
}

export default function ProjectSession() {
  const [session,setSession]=useState(0)
  const [project,setProject]=useState<ProjectFile|null>(null)
  const [checking,setChecking]=useState(true)
  const [recoveryFailed,setRecoveryFailed]=useState(false)
  const [name,setName]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [legacy,setLegacy]=useState(false)
  const [resetting,setResetting]=useState(false)
  const input=useRef<HTMLInputElement>(null)
  const recover=async()=>{
    setChecking(true);setError('');setRecoveryFailed(false)
    try {
      const saved=await readActiveProject()
      if(saved)setProject(saved.project)
      else {
        const legacyName=localStorage.getItem('trama-dtf-project-name')||''
        setName(legacyName)
        setLegacy(!!localStorage.getItem('trama-dtf-gang-sheet-v1'))
      }
    }catch(e){setRecoveryFailed(true);setError('No se pudo leer el guardado. No se sobrescribió. '+(e as Error).message)}
    finally{setChecking(false)}
  }
  useEffect(()=>{void recover()},[])
  async function start(imported?:ProjectFile) {
    if(recoveryFailed)return
    setBusy(true);setError('')
    try {
      let next=imported??emptyProject(name)
      if(!imported&&legacy){
        const items=JSON.parse(localStorage.getItem('trama-dtf-gang-sheet-v1')||'[]')
        const sheet=JSON.parse(localStorage.getItem('trama-dtf-sheet-settings')||'null')
        next=parseProject(JSON.stringify({...next,items,sheet:sheet??next.sheet}))
      }
      await writeActiveProject(next)
      // Request durable browser storage where supported; not a disk-file write.
      void navigator.storage?.persist?.().catch(()=>false)
      setProject(next)
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function newProject() {
    if(resetting||!window.confirm(`¿Eliminar el proyecto «${project?.name??''}» y empezar de cero?\n\nSe borrarán su autoguardado, las imágenes del editor y la plancha de este navegador. Esta acción no se puede deshacer.\n\nTus presets y los archivos descargados se conservan. Descarga el proyecto antes si quieres poder recuperarlo.`))return
    setResetting(true)
    try {clearActiveProject(localStorage);await deleteActiveProject();setProject(null);setName('');setLegacy(false);setError('');setRecoveryFailed(false);setSession(s=>s+1)}
    catch(e){window.alert('No se pudo eliminar el proyecto: '+(e as Error).message)}
    finally{setResetting(false)}
  }
  if(project)return <App key={session} initialProject={project} resetting={resetting} onNewProject={()=>{void newProject()}}/>
  return <main className="project-start"><section className="project-start-card">
    <span className="eyebrow">TRAMA · DTF LAB</span><h1>{checking?'Buscando tu proyecto…':'Nombra tu proyecto'}</h1>
    <p>Un nombre para guardar y continuar tu trabajo.</p>
    {!checking&&<><form onSubmit={e=>{e.preventDefault();void start()}}>
      <label className="field">Nombre del archivo<input autoFocus aria-label="Nombre del archivo de proyecto" maxLength={80} placeholder="Ej. Poleras septiembre" value={name} onChange={e=>setName(e.target.value)}/></label>
      <small>.trama.json</small>
      <p className="help-text">Los cambios se guardan automáticamente en este navegador. Al volver, se recupera el último proyecto. Para conservar una copia fuera del navegador, usa «Descargar proyecto». No se sobrescribe un archivo del disco automáticamente.</p>
      {legacy&&<p className="help-text">Se encontró una plancha anterior: se conservará dentro de este proyecto.</p>}
      <button className="btn export" disabled={busy||recoveryFailed||!name.trim()}>{busy?'Guardando…':'Crear y comenzar'}</button>
    </form><button className="btn ghost" disabled={busy||recoveryFailed} onClick={()=>input.current?.click()}>Abrir proyecto .trama.json</button>
    <input hidden ref={input} type="file" accept=".json,.trama.json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>MAX_PROJECT_FILE_BYTES)throw new Error('El proyecto supera el límite de 1 GB.');await start(parseProject(await file.text()))}catch(err){setError((err as Error).message)}}}/></>}
    {error&&<div role="alert"><p className="error-text">{error}</p><button className="btn" onClick={()=>{void recover()}}>Volver a comprobar guardado</button></div>}
  </section></main>
}
