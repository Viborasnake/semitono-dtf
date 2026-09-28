import { halftone } from './halftone'
import { resizeRgba, sharpenRgba } from './resample'
import { autoAdjust } from './auto-adjust'
import { neuralUpscaleRgba } from './neural-upscale'

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
      resized = sharpenRgba(neural ? resizeRgba(neural, neuralWidth, neuralHeight, width, height, 'lanczos3') : resizeRgba(data, sourceWidth, sourceHeight, width, height, settings.resampleMethod), width, height, settings.sharpness)
    }
    progress(76)
    const result = halftone(autoAdjust(resized, settings), width, height, settings, resized)
    progress(96)
    self.postMessage({...result, original: resized, warning}, { transfer: [result.data.buffer, resized.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' })
  }
}
