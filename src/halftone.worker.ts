import { processImage } from './process-image'
import { resizeRgba, sharpenRgba } from './resample'
import { neuralUpscaleRgba } from './neural-upscale'

self.onmessage = async (event) => {
  try {
    const { data, preprocessed, width, height, sourceWidth, sourceHeight, settings } = event.data
    const progress = (value: number) => self.postMessage({ type: 'progress', progress: value })
    progress(8)
    let resized: Uint8ClampedArray
    let lanczosComparison: Uint8ClampedArray | undefined
    let appliedNeuralScale = event.data.preprocessed ? (event.data.preprocessedNeuralScale ?? 1) : 1
    let warning: string | undefined
    if (preprocessed) {
      resized = new Uint8ClampedArray(data)
      progress(72)
    } else {
    const neuralScale = settings.resampleMethod === 'neural4' ? 4 : 2
    const neuralRequested = settings.resampleMethod === 'neural2' || settings.resampleMethod === 'neural4'
    let neural: Uint8ClampedArray | null = null
    if (neuralRequested) {
      // Bound allocation size, not processing time. Large artwork is handled
      // by the model's tiled GPU path just like small artwork.
      const neuralIntermediatePixels = sourceWidth * sourceHeight * neuralScale * neuralScale
      if (neuralIntermediatePixels > 48_000_000) {
        warning = `Neural ×${neuralScale} no se aplicó: generaría más de 48 megapíxeles intermedios. Se usó Lanczos-3 para evitar un error de memoria.`
      } else {
        try { neural = await neuralUpscaleRgba(data, sourceWidth, sourceHeight, neuralScale, fraction => progress(8 + Math.round(54 * fraction)),event.data.assetOrigin); if (neural) appliedNeuralScale = neuralScale }
        catch (error) { warning = `Neural ×${neuralScale} no pudo ejecutarse; se usó Lanczos-3 como respaldo.${error instanceof Error ? ` Detalle: ${error.message}` : ''}` }
      }
    }
      progress(neural ? 62 : 42)
      const neuralWidth = sourceWidth * neuralScale, neuralHeight = sourceHeight * neuralScale
      const fallbackMethod=neuralRequested?'lanczos3':settings.resampleMethod
      resized = sharpenRgba(neural ? resizeRgba(neural, neuralWidth, neuralHeight, width, height, 'lanczos3') : resizeRgba(data, sourceWidth, sourceHeight, width, height, fallbackMethod), width, height, settings.sharpness)
      if (neural) lanczosComparison = sharpenRgba(resizeRgba(data, sourceWidth, sourceHeight, width, height, 'lanczos3'), width, height, settings.sharpness)
    }
    progress(76)
    const result = processImage(resized,width,height,settings,event.data.colorCorrection,event.data.compareBackground)
    progress(96)
    self.postMessage({...result, original: resized, lanczosComparison, warning, neuralScale: appliedNeuralScale}, { transfer: [result.data.buffer, resized.buffer,...(lanczosComparison?[lanczosComparison.buffer]:[]),...(result.background?[result.background.buffer]:[])] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' })
  }
}
