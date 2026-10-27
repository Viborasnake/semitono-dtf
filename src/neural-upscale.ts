const PAD = 16

export function paddedTileSize(coreSize: number, scale: 2 | 4) {
  return Math.ceil((coreSize + PAD * 2) / scale) * scale
}

export function sourceIsNeutral(r: number, g: number, b: number) {
  const peak = Math.max(r, g, b)
  return peak < 48 || peak - Math.min(r, g, b) <= 12
}

// Exported PNG artwork often uses 250-253 alpha across otherwise solid ink.
// Treat it as opaque for colour reconstruction; reserve source-colour sampling
// for the actual translucent cutout edge, where the model has no alpha output.
export function useNeuralColor(alpha: number) {
  return alpha >= 248
}

export function absoluteAssetUrl(path: string, assetOrigin: string) {
  if (/^https?:\/\//i.test(path)) return path
  if (!assetOrigin) throw new Error(`No se pudo resolver el recurso Neural: ${path}`)
  return new URL(path, `${assetOrigin.replace(/\/$/, '')}/`).href
}

// Positive bilinear sampling of premultiplied RGB and alpha. Neural models do
// not predict transparency, so the source alpha must be enlarged separately;
// nearest-neighbour alpha produced blocky outlines and exposed invented colour.
export function sampleUpscaledEdge(data:Uint8ClampedArray,width:number,height:number,x:number,y:number,scale:2|4){
  const sx=(x+.5)/scale-.5,sy=(y+.5)/scale-.5
  const x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0
  let alpha=0,red=0,green=0,blue=0
  for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
    const px=Math.max(0,Math.min(width-1,x0+ox)),py=Math.max(0,Math.min(height-1,y0+oy))
    const weight=(ox?fx:1-fx)*(oy?fy:1-fy),i=(py*width+px)*4,a=data[i+3]/255
    alpha+=a*weight;red+=data[i]*a*weight;green+=data[i+1]*a*weight;blue+=data[i+2]*a*weight
  }
  return alpha>1e-8?{r:red/alpha,g:green/alpha,b:blue/alpha,a:alpha*255}:{r:0,g:0,b:0,a:0}
}

// GPU-first path with portable WASM fallback. Tiles keep peak memory bounded
// and the padded overlap prevents visible seams when the model sees a tile boundary.
export async function neuralUpscaleRgba(data: Uint8ClampedArray, width: number, height: number, scale: 2 | 4, onProgress?: (fraction: number) => void,assetOrigin='') {
  const modelUrl = absoluteAssetUrl(`${import.meta.env.BASE_URL}models/real_esrgan_x${scale}.onnx`, assetOrigin)
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const ort = await import('onnxruntime-web/webgpu')
      const {default:wasmUrl}=await import('./ort-webgpu-wasm-url')
      // Inline workers have a blob URL. Configure the GPU runtime before
      // session creation too, otherwise its relative WASM URL fails and the
      // entire image silently falls back to CPU.
      ort.env.wasm.numThreads = 1
      const response=await fetch(absoluteAssetUrl(wasmUrl,assetOrigin))
      if(!response.ok)throw new Error(`No se pudo cargar el motor WebGPU (${response.status}).`)
      ort.env.wasm.wasmBinary=new Uint8Array(await response.arrayBuffer())
      return await runUpscale(ort, 'webgpu', modelUrl, data, width, height, scale, onProgress)
    } catch {
      // WebGPU can be exposed but unavailable for this model/device.
      // Retry with the portable backend below.
    }
  }
  const ort = await import('onnxruntime-web')
  const {default:ortWasmUrl}=await import('./ort-wasm-url')
  ort.env.wasm.numThreads = 1
  // Load the binary ourselves. ONNX Runtime otherwise uses synchronous XHR
  // inside the bundled worker, where a root-relative path is rejected as an
  // invalid URL on GitHub Pages. Passing bytes bypasses URL/XHR resolution.
  const absoluteWasmUrl=absoluteAssetUrl(ortWasmUrl,assetOrigin)
  const wasmResponse=await fetch(absoluteWasmUrl)
  if(!wasmResponse.ok)throw new Error(`No se pudo cargar el motor Neural (${wasmResponse.status}).`)
  ort.env.wasm.wasmBinary=new Uint8Array(await wasmResponse.arrayBuffer())
  return runUpscale(ort, 'wasm', modelUrl, data, width, height, scale, onProgress)
}

async function runUpscale(
  ort: typeof import('onnxruntime-web'),
  provider: 'webgpu' | 'wasm',
  modelUrl: string,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scale: 2 | 4,
  onProgress?: (fraction: number) => void,
) {
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: [provider],
    graphOptimizationLevel: 'all',
  })
  const outputWidth = width * scale, outputHeight = height * scale
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  const inputName = session.inputNames[0], outputName = session.outputNames[0]
  // Larger tiles avoid paying the model/session overhead once per tiny block.
  // x4 keeps a slightly smaller tile because its intermediate tensor is four
  // times wider and taller than the source; 256 made large images needlessly
  // expensive in the single-threaded WASM backend.
  const tile = scale === 4 ? 384 : 512
  const tileCount = Math.ceil(width / tile) * Math.ceil(height / tile)
  let finished = 0
  for (let y = 0; y < height; y += tile) for (let x = 0; x < width; x += tile) {
    const coreWidth = Math.min(tile, width - x), coreHeight = Math.min(tile, height - y)
    const paddedWidth = paddedTileSize(coreWidth, scale), paddedHeight = paddedTileSize(coreHeight, scale)
    const input = new Float32Array(3 * paddedWidth * paddedHeight)
    for (let py = 0; py < paddedHeight; py++) for (let px = 0; px < paddedWidth; px++) {
      const sx = Math.min(width - 1, Math.max(0, x + px - PAD))
      const sy = Math.min(height - 1, Math.max(0, y + py - PAD))
      const source = (sy * width + sx) * 4
      const target = py * paddedWidth + px
      input[target] = data[source] / 255
      input[paddedWidth * paddedHeight + target] = data[source + 1] / 255
      input[2 * paddedWidth * paddedHeight + target] = data[source + 2] / 255
    }
    const inputTensor = new ort.Tensor('float32', input, [1, 3, paddedHeight, paddedWidth])
    const result = await session.run({[inputName]: inputTensor})
    const tensor = result[outputName]
    const values = tensor.data as Float32Array
    const modelWidth = paddedWidth * scale, modelHeight = paddedHeight * scale
    const plane = modelWidth * modelHeight
    for (let py = 0; py < coreHeight; py++) for (let px = 0; px < coreWidth; px++) {
      const ox = (x + px) * scale, oy = (y + py) * scale
      const modelX = (px + PAD) * scale, modelY = (py + PAD) * scale
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const source = (modelY + dy) * modelWidth + modelX + dx
        const target = ((oy + dy) * outputWidth + ox + dx) * 4
        const sx = x + px, sy = y + py
        const original = (sy * width + sx) * 4
        const red = Math.max(0, Math.min(255, Math.round(values[source] * 255)))
        const green = Math.max(0, Math.min(255, Math.round(values[plane + source] * 255)))
        const blue = Math.max(0, Math.min(255, Math.round(values[plane * 2 + source] * 255)))
        const edge=sampleUpscaledEdge(data,width,height,ox+dx,oy+dy,scale)
        if(!useNeuralColor(edge.a)){
          output[target]=edge.r;output[target+1]=edge.g;output[target+2]=edge.b
        } else if (sourceIsNeutral(data[original], data[original + 1], data[original + 2])) {
          output[target] = output[target + 1] = output[target + 2] = Math.round((red + green + blue) / 3)
        } else {
          output[target] = red; output[target + 1] = green; output[target + 2] = blue
        }
        output[target + 3] = edge.a
      }
    }
    tensor.dispose()
    inputTensor.dispose()
    onProgress?.(++finished / tileCount)
  }
  await session.release()
  return output
}
