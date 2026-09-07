import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { inspectPng, printSize, withPngDpi } from './print'
import GangSheet from './GangSheet'
import { Check, ChevronDown, CircleDot, Download, Hand, Image as ImageIcon, Info, Layers3, Minus, Plus, RotateCcw, SlidersHorizontal, Sparkles, Upload, ZoomIn } from 'lucide-react'

type Shape = 'circle' | 'square' | 'line'
type ViewMode = 'result' | 'split' | 'original'

type Settings = {
  lpi: number
  angle: number
  shape: Shape
  size: number
  contrast: number
  brightness: number
  whiteCutoff: number
  preserveColor: boolean
  invert: boolean
  background: 'black' | 'white' | 'none'
  tolerance: number
  enabled: boolean
  featherMm: number
  trimMm: number
  edgeSides: boolean[]
  sharpness: number
  gamma: number
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
  tolerance: 25,
  enabled: true,
  featherMm: 0,
  trimMm: 0,
  edgeSides: [true, true, true, true],
  sharpness: 0,
  gamma: 1,
}

const presets = {
  default: { label: 'Default', description: 'Punto equilibrado, sin enfoque adicional.', values: { lpi: 28, size: 92, contrast: 100, brightness: 100, sharpness: 0, gamma: 1 } },
  sharp: { label: 'Nitidez', description: 'Trama fina y enfoque moderado para detalles.', values: { lpi: 45, size: 100, contrast: 106, brightness: 100, sharpness: 45, gamma: 1 } },
  gradients: { label: 'Full Gradients', description: 'Más presencia en tonos suaves y transiciones.', values: { lpi: 50, size: 100, contrast: 100, brightness: 100, sharpness: 0, gamma: 1.25 } },
  value: { label: 'Best Value', description: 'Menor cobertura de tinta con una trama abierta.', values: { lpi: 30, size: 82, contrast: 100, brightness: 100, sharpness: 15, gamma: 1 } },
}

const shapeLabels: Record<Shape, string> = { circle: 'Redondo', square: 'Cuadrado', line: 'Línea' }

type SavedPreset = {id:string;name:string;settings:Settings}
const presetStorageKey = 'trama-dtf-presets-v1'
function readSavedPresets(): SavedPreset[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(presetStorageKey) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((p): p is SavedPreset => {
      if (!p || typeof p.id !== 'string' || !p.id.startsWith('saved:') || typeof p.name !== 'string' || !p.name.trim() || !p.settings) return false
      const s = p.settings
      const ranges = {lpi:[12,65],angle:[0,90],size:[45,125],contrast:[50,180],brightness:[60,140],whiteCutoff:[170,255],tolerance:[0,100],featherMm:[0,30],trimMm:[0,15],sharpness:[0,100],gamma:[.5,2]}
      return Object.entries(ranges).every(([key,[min,max]]) => Number.isFinite(s[key]) && s[key] >= min && s[key] <= max)
        && ['circle','square','line'].includes(s.shape) && ['black','white','none'].includes(s.background)
        && ['enabled','preserveColor','invert'].every(key => typeof s[key] === 'boolean')
        && Array.isArray(s.edgeSides) && s.edgeSides.length === 4 && s.edgeSides.every((v:unknown) => typeof v === 'boolean')
    })
  } catch {return []}
}

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100
  return (
    <label className="range-control">
      <span><b>{label}</b><output>{value}{unit}</output></span>
      <input style={{ '--progress': `${progress}%` } as React.CSSProperties} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`toggle ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button>
}

function App() {
  const sourceCanvas = useRef<HTMLCanvasElement>(null)
  const resultCanvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [settings, setSettings] = useState(defaults)
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
  const [presetName, setPresetName] = useState('')
  const [presetMessage, setPresetMessage] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [gangSource, setGangSource] = useState<{ id: number; blob: Blob; widthCm: number; name: string }>()
  const [split, setSplit] = useState(52)
  const [fileName, setFileName] = useState('demo-trama-dtf.svg')
  const [dimensions, setDimensions] = useState({ width: 1400, height: 1000 })
  const [dragging, setDragging] = useState(false)
  const [widthCm, setWidthCm] = useState('11.8533')
  const [dpi, setDpi] = useState(300)
  const [imageVersion, setImageVersion] = useState(0)
  const [readyKey, setReadyKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [transparent, setTransparent] = useState(0)
  const [previewBg, setPreviewBg] = useState('checker')
  const [error, setError] = useState('')
  const loadId = useRef(0)
  const [activePanel, setActivePanel] = useState<'trama' | 'ajustes'>('trama')

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

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => { setPreset('custom'); setSettings((s) => ({ ...s, [key]: value })) }

  const savePreset = () => {
    const baseName = presetName.trim().slice(0, 60)
    if (!baseName) return
    const existing = readSavedPresets()
    let name = baseName, suffix = 2
    while (existing.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) name = `${baseName} (${suffix++})`
    const saved: SavedPreset = {id:`saved:${crypto.randomUUID()}`,name,settings:{...settings,edgeSides:[...settings.edgeSides]}}
    try {
      localStorage.setItem(presetStorageKey, JSON.stringify([...existing,saved]))
      setSavedPresets([...existing,saved])
      setPreset(saved.id)
      setSavingPreset(false)
      setPresetName('')
      setPresetMessage(`“${name}” guardado en este navegador.`)
    } catch {setPresetMessage('No se pudo guardar. Revisa que el navegador permita almacenamiento local.')}
  }

  const ratio = dimensions.width / dimensions.height
  let output: ReturnType<typeof printSize> | undefined
  let sizeError = ''
  try { output = printSize(Number(widthCm), ratio, dpi) } catch (e) { sizeError = (e as Error).message }
  const renderKey = JSON.stringify([imageVersion, output?.width, output?.height, dpi, settings])
  const processing = loading || (!!output && readyKey !== renderKey && !error)
  const previewScale = fit ? Math.min((viewport.width - 48) / (output?.width || dimensions.width), (viewport.height - 48) / (output?.height || dimensions.height), 1) : zoom / 100
  const shownZoom = Math.max(1, Math.round(previewScale * 100))
  const changeZoom = (factor: number) => { setZoom(Math.max(5, Math.min(400, Math.round(shownZoom * factor)))); setFit(false) }

  const loadImage = (src: string, name: string) => {
    const id = ++loadId.current
    setLoading(true)
    const img = new Image()
    img.onload = () => {
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
      if (id !== loadId.current) return
      if (!img.naturalWidth || !img.naturalHeight) { setError('La imagen no tiene dimensiones válidas.'); setLoading(false); return }
      imageRef.current = img
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      setWidthCm((img.naturalWidth / 300 * 2.54).toFixed(4))
      setDpi(300)
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

  useEffect(() => { loadImage('/sample.svg', 'demo-trama-dtf.svg'); return () => { loadId.current++ } }, [])
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
        src.width = out.width = width
        src.height = out.height = height
        const native = document.createElement('canvas')
        native.width = imageRef.current!.naturalWidth
        native.height = imageRef.current!.naturalHeight
        const ctx = native.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(imageRef.current!, 0, 0)
        const input = ctx.getImageData(0, 0, native.width, native.height)
        worker = new Worker(new URL('./halftone.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }) => {
          if (cancelled) return
          if (data.error) setError(data.error)
          else {
            src.getContext('2d')!.putImageData(new ImageData(data.original, width, height), 0, 0)
            out.getContext('2d')!.putImageData(new ImageData(data.data, width, height), 0, 0)
            setTransparent(data.transparent)
            setReadyKey(renderKey)
          }
          worker?.terminate()
        }
        worker.onerror = () => { if (!cancelled) setError('No se pudo procesar. Reduce el tamaño e inténtalo nuevamente.'); worker?.terminate() }
        worker.postMessage({ data: input.data, width, height, sourceWidth: native.width, sourceHeight: native.height, settings: { ...settings, dpi } }, [input.data.buffer])
        native.width = native.height = 1
      } catch (e) { if (!cancelled) setError((e as Error).message) }
    }, 120)
    return () => { cancelled = true; clearTimeout(timer); worker?.terminate() }
  }, [renderKey, loading])

  const handleFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecciona una imagen PNG, JPG, WebP o SVG.'); return }
    const url = URL.createObjectURL(file)
    loadImage(url, file.name)
  }

  const exportPng = async () => {
    const canvas = resultCanvas.current
    if (!canvas || !output || readyKey !== renderKey || loading || exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo generar el PNG.')), 'image/png'))
      const bytes = withPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi)
      const metadata = inspectPng(bytes)
      if (metadata.width !== output.width || metadata.height !== output.height || Math.abs(metadata.dpi - dpi) > .02 || Math.abs(metadata.dpiY - dpi) > .02) throw new Error('El PNG no coincide con el tamaño solicitado.')
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

  const sendToGang = () => {
    if (!output || readyKey !== renderKey || loading) return
    const name = fileName
    const width = output.widthCm
    resultCanvas.current?.toBlob(blob => {
      if (blob) { setGangSource({id: Date.now(), blob, widthCm: width, name}); setTool('gang') }
    }, 'image/png')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><CircleDot size={23} /><i /></div><span>TRAMA</span><small>DTF LAB</small></div>
        <div className="file-pill"><span className="status-dot" /> <span>{fileName}</span><small>{dimensions.width} × {dimensions.height} px</small></div>
        <div className="top-actions">
          {tool === 'design' && <button className="btn ghost" onClick={() => {setSettings(defaults); setPreset('default')}}><RotateCcw size={17} /> Restablecer</button>}
          {tool === 'design' && <><button className="btn gang-send" title="Añadir el diseño procesado y abrir la plancha" disabled={processing || !output || readyKey !== renderKey} onClick={sendToGang}><Layers3 size={16}/><span>Enviar a Gang Sheet</span></button><button className="btn export" disabled={processing || exporting || !output || readyKey !== renderKey} onClick={exportPng}><Download size={17} /> {exporting ? 'Exportando…' : 'Exportar PNG'}</button></>}
        </div>
      </header>

      <nav className="tool-tabs"><button className={tool === 'design' ? 'active' : ''} onClick={() => setTool('design')}>Editor de semitonos</button><button className={tool === 'gang' ? 'active' : ''} onClick={() => setTool('gang')}>Gang Sheet</button><span>Todo se procesa en tu equipo</span></nav>
      <div style={{display: tool === 'gang' ? 'block' : 'none'}}><GangSheet source={gangSource} /></div>
      <main className="workspace" style={{display: tool === 'design' ? undefined : 'none'}}>
        <aside className="sidebar">
          <div className="sidebar-title"><div><Sparkles size={18} /><span>Pre-prensa</span></div><button aria-label="Información" aria-expanded={showInfo} onClick={() => setShowInfo(v => !v)}><Info size={17} /></button></div>
          {showInfo && <div className="tip-card"><p>1. Carga tu imagen y define tamaño y ppp. 2. Elige el fondo a eliminar, preset y bordes. 3. Revisa al 100% y sobre la prenda. 4. Exporta PNG o añade a una plancha. El tamaño se graba en el PNG; comprueba que tu RIP respete los centímetros indicados.</p></div>}

          <section className="control-card open"><div className="section-heading"><span>Presets</span></div><div className="section-body">
            <select aria-label="Preset" value={preset} onChange={e => {
              const key = e.target.value
              const saved = savedPresets.find(p => p.id === key)
              setPresetMessage('')
              if(saved){setSettings({...saved.settings,edgeSides:[...saved.settings.edgeSides]});setPreset(key)}
              else if(key in presets){setSettings(s => ({...s,...presets[key as keyof typeof presets].values}));setPreset(key)}
            }}><option value="custom" disabled>Personalizado</option><optgroup label="Incluidos">{Object.entries(presets).map(([key,p]) => <option key={key} value={key}>{p.label}</option>)}</optgroup>{savedPresets.length>0 && <optgroup label="Mis presets">{savedPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}</select>
            <p className="help-text">{preset in presets ? `${presets[preset as keyof typeof presets].description} Conserva el tamaño, fondo y bordes elegidos.` : preset.startsWith('saved:') ? 'Preset guardado: trama, nitidez, fondo y bordes. El tamaño de impresión se mantiene.' : 'Ajustes personalizados.'}</p>
            <button className="btn save-preset" aria-expanded={savingPreset} onClick={() => {setSavingPreset(v=>!v);setPresetMessage('')}}>Guardar preset</button>
            {savingPreset && <form className="save-preset-form" onSubmit={e=>{e.preventDefault();savePreset()}}><label className="field">Nombre del preset<input autoFocus aria-label="Nombre del preset" type="text" maxLength={60} placeholder="Ej. DTF negro fino" value={presetName} onChange={e=>setPresetName(e.target.value)} /></label><button className="btn export" type="submit" disabled={!presetName.trim()}>Guardar mis ajustes</button><p className="help-text">Se guarda en este navegador. Incluye trama, color, fondo, nitidez y bordes; excluye tamaño y zoom.</p></form>}
            {presetMessage && <p className="help-text" role="status">{presetMessage}</p>}
          </div></section>

          <section className="control-card open"><div className="section-heading"><span>Tamaño de impresión</span></div><div className="section-body">
            <label className="field">Escala del original (%)<input aria-label="Escala del original en porcentaje" type="number" min="1" max="2000" step="25" value={widthCm && Number(widthCm) > 0 ? Number((Number(widthCm) / 2.54 * dpi / dimensions.width * 100).toFixed(1)) : ''} onChange={e => setWidthCm(e.target.value ? (dimensions.width * Number(e.target.value) / 100 / dpi * 2.54).toFixed(4) : '')} /></label>
            <div className="scale-presets">{[100,200,300,400].map(percent => <button key={percent} onClick={() => setWidthCm((dimensions.width * percent / 100 / dpi * 2.54).toFixed(4))}>{percent}%</button>)}</div>
            <div className="dimension-fields"><label>Ancho (cm)<input aria-label="Ancho en centímetros" type="number" min="0.1" step="0.1" value={widthCm} onChange={e => setWidthCm(e.target.value)} /></label><label>Alto (cm)<input aria-label="Alto en centímetros" type="number" min="0.1" step="0.1" value={widthCm && Number(widthCm) > 0 ? (Number(widthCm) / ratio).toFixed(2) : ''} onChange={e => setWidthCm(e.target.value ? String(Number(e.target.value) * ratio) : '')} /></label></div>
            <label className="field">Resolución<select aria-label="Resolución de impresión" value={dpi} onChange={e => setDpi(Number(e.target.value))}><option value="150">150 ppp</option><option value="300">300 ppp</option><option value="600">600 ppp</option></select></label>
            <p className="help-text">Proporciones bloqueadas. {output ? `${output.width} × ${output.height} px de salida.` : ''}</p>
            <p className="help-text">Ampliación Lanczos · La trama se genera después de escalar.</p>
            <RangeControl label="Nitidez adicional" value={settings.sharpness} min={0} max={100} unit="%" onChange={v => update('sharpness', v)} />
            {output && output.width > dimensions.width * 1.05 && <p className="help-text">Ampliación de {(output.width / dimensions.width).toFixed(1)}×. El tamaño aumenta, pero no recupera detalle del original.</p>}
            {sizeError && <p className="error-text" role="alert">{sizeError}</p>}
          </div></section>

          <section className="control-card open"><div className="section-heading"><span>Eliminar fondo</span></div><div className="section-body">
            <div className="segmented"><button className={settings.background === 'black' ? 'active' : ''} onClick={() => update('background', 'black')}>Negro</button><button className={settings.background === 'white' ? 'active' : ''} onClick={() => update('background', 'white')}>Blanco</button><button className={settings.background === 'none' ? 'active' : ''} onClick={() => update('background', 'none')}>Ninguno</button></div>
            {settings.background === 'black' && <RangeControl label="Eliminar sombras" value={settings.tolerance} min={0} max={100} onChange={(v) => update('tolerance', v)} />}
            {settings.background === 'white' && <RangeControl label="Umbral de blancos" value={settings.whiteCutoff} min={170} max={255} onChange={(v) => update('whiteCutoff', v)} />}
          </div></section>

          <section className={`control-card ${activePanel === 'trama' ? 'open' : ''}`}>
            <button className="section-heading" onClick={() => setActivePanel('trama')}><span><CircleDot size={17} /> Semitono</span><ChevronDown size={17} /></button>
            {activePanel === 'trama' && <div className="section-body">
              <div className="row-label"><span>Activar semitono</span><Toggle checked={settings.enabled} onChange={(v) => update('enabled', v)} /></div>
              <RangeControl label="Frecuencia" value={settings.lpi} min={12} max={65} unit=" LPI" onChange={(v) => update('lpi', v)} />
              <RangeControl label="Ángulo" value={settings.angle} min={0} max={90} step={0.5} unit="°" onChange={(v) => update('angle', v)} />
              <div className="field"><span>Forma del punto</span><div className="segmented shapes">
                {(['circle', 'square', 'line'] as Shape[]).map((shape) => <button key={shape} className={settings.shape === shape ? 'active' : ''} onClick={() => update('shape', shape)}><i className={`shape-${shape}`} />{shapeLabels[shape]}</button>)}
              </div></div>
              <RangeControl label="Tamaño máximo" value={settings.size} min={45} max={125} unit="%" onChange={(v) => update('size', v)} />
            </div>}
          </section>

          <section className={`control-card ${activePanel === 'ajustes' ? 'open' : ''}`}>
            <button className="section-heading" onClick={() => setActivePanel('ajustes')}><span><SlidersHorizontal size={17} /> Ajustes de imagen</span><ChevronDown size={17} /></button>
            {activePanel === 'ajustes' && <div className="section-body">
              <RangeControl label="Contraste" value={settings.contrast} min={50} max={180} unit="%" onChange={(v) => update('contrast', v)} />
              <RangeControl label="Brillo" value={settings.brightness} min={60} max={140} unit="%" onChange={(v) => update('brightness', v)} />
              <RangeControl label="Degradados (gamma)" value={settings.gamma} min={0.5} max={2} step={0.05} onChange={v => update('gamma', v)} />
              <div className="row-label"><span>Conservar color</span><Toggle checked={settings.preserveColor} onChange={(v) => update('preserveColor', v)} /></div>
              <div className="row-label"><span>Invertir trama</span><Toggle checked={settings.invert} onChange={(v) => update('invert', v)} /></div>
            </div>}
          </section>

          <section className="control-card open"><div className="section-heading"><span>Suavizar bordes</span><button className="text-button" onClick={() => setSettings(s => ({...s, featherMm: 0, trimMm: 0, edgeSides: [true,true,true,true]}))}>Reiniciar</button></div><div className="section-body">
            <RangeControl label="Borrar margen" value={settings.trimMm} min={0} max={15} step={0.5} unit=" mm" onChange={v => update('trimMm', v)} />
            <RangeControl label="Desvanecido hacia dentro" value={settings.featherMm} min={0} max={30} step={0.5} unit=" mm" onChange={v => update('featherMm', v)} />
            <div className="edge-sides">{['Arriba', 'Derecha', 'Abajo', 'Izquierda'].map((label, index) => <label key={label}><input type="checkbox" checked={settings.edgeSides[index]} onChange={e => update('edgeSides', settings.edgeSides.map((v, i) => i === index ? e.target.checked : v))} />{label}</label>)}</div>
            <p className="help-text">Borra el contorno rectangular en los lados elegidos. El desvanecido se convierte en puntos para DTF; conserva el tamaño del lienzo.</p>
          </div></section>
          <div className="tip-card"><div><Check size={14} /> {processing ? 'ACTUALIZANDO…' : `${transparent}% TRANSPARENTE`}</div><p>{settings.background === 'black' ? 'El negro lo aporta la prenda. Se eliminan los tonos oscuros del diseño completo.' : settings.background === 'white' ? 'Se eliminan los blancos del diseño completo.' : 'Se conserva el color y se perfora con la trama.'} El fondo de vista previa no se exporta.</p></div>
          {error && <p className="error-text" role="alert">{error}</p>}
          {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
        </aside>

        <section className={`stage ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}>
          <div className="stage-toolbar">
            <div className="view-switch">
              <button className={view === 'original' ? 'active' : ''} onClick={() => setView('original')}><ImageIcon size={15} /> Original</button>
              <button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}><Layers3 size={15} /> Comparar</button>
              <button className={view === 'result' ? 'active' : ''} onClick={() => setView('result')}><CircleDot size={15} /> Resultado</button>
            </div>
            <button className="upload-mini" onClick={() => fileInput.current?.click()}><Upload size={15} /> Cambiar imagen</button>
            <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          <div className={`canvas-area ${handActive ? 'hand-active' : ''} ${panning ? 'is-panning' : ''}`} ref={viewportRef} onPointerDownCapture={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={stopPan}>
            <div className="preview-background"><span>Vista sobre</span><select aria-label="Fondo de vista previa" value={previewBg} onChange={(e) => setPreviewBg(e.target.value)}><option value="checker">Transparencia</option><option value="black">Prenda negra</option><option value="white">Prenda blanca</option><option value="#596778">Prenda gris</option></select></div>
            <div className="artboard" style={{ width: Math.max(1, (output?.width || dimensions.width) * previewScale), height: Math.max(1, (output?.height || dimensions.height) * previewScale), aspectRatio: `${dimensions.width} / ${dimensions.height}`, ...(previewBg !== 'checker' ? { backgroundImage: 'none', backgroundColor: previewBg } : {}) }}>
              <canvas ref={sourceCanvas} className="art-canvas" style={{ clipPath: view === 'split' ? `inset(0 ${100 - split}% 0 0)` : 'none', visibility: view === 'result' ? 'hidden' : 'visible' }} />
              <div className="result-layer" style={{ clipPath: view === 'split' ? `inset(0 0 0 ${split}%)` : 'none', visibility: view === 'original' ? 'hidden' : 'visible' }}><canvas ref={resultCanvas} className="art-canvas" /></div>
              {view === 'split' && <><div className="split-line" style={{ left: `${split}%` }}><span><Minus /><Minus /></span></div><input className="split-input" aria-label="Divisor de comparación" type="range" min="0" max="100" value={split} onChange={(e) => setSplit(Number(e.target.value))} /></>}
              {processing && <div className="processing"><span /> Procesando trama…</div>}
            </div>
            {dragging && <div className="drop-overlay"><Upload size={32} /><b>Suelta tu imagen aquí</b><span>PNG, JPG, WebP o SVG</span></div>}
          </div>

          <div className="statusbar">
            <div><span className="status-dot" /> Vista previa en tiempo real</div>
            <div className="zoom-control"><button className={`hand-button ${handActive ? 'active' : ''}`} aria-label="Mano para mover imagen" aria-pressed={handTool} title="Mano: arrastra para mover. También puedes mantener Espacio o usar el botón central del ratón." onClick={() => setHandTool(v => !v)}><Hand size={16} /></button><ZoomIn size={15} /><button aria-label="Reducir zoom" onClick={() => changeZoom(.8)}><Minus size={14} /></button><span>{shownZoom}%</span><button aria-label="Aumentar zoom" onClick={() => changeZoom(1.25)}><Plus size={14} /></button><button className="zoom-text" onClick={() => setFit(true)}>Ajustar</button><button className="zoom-text" onClick={() => {setFit(false);setZoom(100)}}>100%</button></div>
            <div>PNG · Fondo transparente</div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
