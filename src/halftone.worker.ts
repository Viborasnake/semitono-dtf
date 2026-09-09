import { halftone } from './halftone'
import { resizeRgba } from './resample'
import { autoAdjust } from './auto-adjust'

self.onmessage = (event) => {
  try {
    const { data, width, height, sourceWidth, sourceHeight, settings } = event.data
    const resized = resizeRgba(data, sourceWidth, sourceHeight, width, height)
    const result = halftone(autoAdjust(resized, settings), width, height, settings, resized)
    self.postMessage({...result, original: resized}, { transfer: [result.data.buffer, resized.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' })
  }
}
