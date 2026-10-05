import { halftone } from './halftone'
import { resizeRgba, sharpenRgba } from './resample'
import { autoAdjust } from './auto-adjust'
import { neuralUpscaleRgba } from './neural-upscale'
import { applyColorCorrection, flattenSelectedColor, removeSmallParticles, removeTinyDots, smoothRgba } from './refine'

self.onmessage = async (event) => {
  try {
    const { data, preprocessed, width, height, sourceWidth, sourceHeight, settings } = event.data
    const progress = (value: number) => self.postMessage({ type: 'progress', progress: value })
    progress(8)
    let resized: Uint8ClampedArray
    let warning: string | undefined
    if (preprocessed) {
      resized = new Uint8ClampedArray(data)
      progress(72)
    } else {
    const neuralScale = settings.resampleMethod === 'neural4' ? 4 : 2
    const neuralRequested = settings.resampleMethod === 'neural2' || settings.resampleMethod === 'neural4'
    let neural: Uint8ClampedArray | null = null
    if (neuralRequested) {
      if (sourceWidth * sourceHeight > 4_000_000) {
        warning = 'La imagen es demasiado grande para Neural; se usó Lanczos-3 para evitar un error de memoria.'
      } else {
        try { neural = await neuralUpscaleRgba(data, sourceWidth, sourceHeight, neuralScale) }
        catch { warning = 'Neural no pudo procesar esta imagen; se usó Lanczos-3 como respaldo.' }
      }
    }
      progress(neural ? 62 : 42)
      const neuralWidth = sourceWidth * neuralScale, neuralHeight = sourceHeight * neuralScale
      resized = sharpenRgba(neural ? resizeRgba(neural, neuralWidth, neuralHeight, width, height, 'lanczos3') : resizeRgba(data, sourceWidth, sourceHeight, width, height, 'lanczos3'), width, height, settings.sharpness)
    }
    progress(76)
    const corrected = event.data.colorCorrection ? applyColorCorrection(resized, event.data.colorCorrection, settings.flattenColorValue, 100) : resized
    const flattened = settings.flattenColor ? flattenSelectedColor(corrected, settings.flattenColorValue, settings.flattenColorTolerance) : corrected
    const softened = smoothRgba(flattened, width, height, settings.preSmooth ?? 0)
    const result = halftone(autoAdjust(softened, settings), width, height, settings, softened, flattened)
    for (let p = 0; p < result.protectedMask.length; p++) if (result.protectedMask[p]) {
      const i = p * 4
      result.data[i] = result.data[i + 1] = result.data[i + 2] = result.data[i + 3] = 0
    }
    removeTinyDots(result.data, width, height, settings.minDotSize ?? 0)
    removeSmallParticles(result.data, width, height, settings.particleMinSize ?? 0)
    for (let p = 0; p < result.protectedMask.length; p++) if (result.protectedMask[p]) {
      const i = p * 4
      result.data[i] = flattened[i]
      result.data[i + 1] = flattened[i + 1]
      result.data[i + 2] = flattened[i + 2]
      result.data[i + 3] = settings.protectSmoothEdge === false ? 255 : resized[i + 3]
    }
    result.transparent = Math.round(result.data.reduce((count: number, _, index: number) => index % 4 === 3 && result.data[index] === 0 ? count + 1 : count, 0) / (width * height) * 100)
    progress(96)
    self.postMessage({...result, original: resized, warning}, { transfer: [result.data.buffer, resized.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' })
  }
}
