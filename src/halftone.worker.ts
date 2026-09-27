import { halftone } from './halftone'
import { resizeRgba, sharpenRgba } from './resample'
import { autoAdjust } from './auto-adjust'
import { neuralUpscaleRgba } from './neural-upscale'

self.onmessage = async (event) => {
  try {
    const { data, width, height, sourceWidth, sourceHeight, settings } = event.data
    const neural = settings.resampleMethod === 'neural2' ? await neuralUpscaleRgba(data, sourceWidth, sourceHeight) : null
    const neuralWidth = sourceWidth * 2, neuralHeight = sourceHeight * 2
    const resized = sharpenRgba(neural ? resizeRgba(neural, neuralWidth, neuralHeight, width, height, 'lanczos3') : resizeRgba(data, sourceWidth, sourceHeight, width, height, settings.resampleMethod), width, height, settings.sharpness)
    const result = halftone(autoAdjust(resized, settings), width, height, settings, resized)
    self.postMessage({...result, original: resized}, { transfer: [result.data.buffer, resized.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' })
  }
}
