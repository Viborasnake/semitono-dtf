const TILE = 512
const PAD = 16

// Experimental CPU/WASM path. Tiles keep peak memory bounded and the padded
// overlap prevents visible seams when the model sees a tile boundary.
export async function neuralUpscaleRgba(data: Uint8ClampedArray, width: number, height: number, scale: 2 | 4) {
  const modelUrl = `${import.meta.env.BASE_URL}models/real_esrgan_x${scale}.onnx`
  const useWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
  const ort = await (useWebGpu ? import('onnxruntime-web/webgpu') : import('onnxruntime-web'))
  if (!useWebGpu) ort.env.wasm.numThreads = 1
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: useWebGpu ? ['webgpu'] : ['wasm'],
    graphOptimizationLevel: 'all',
  })
  const outputWidth = width * scale, outputHeight = height * scale
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  const inputName = session.inputNames[0], outputName = session.outputNames[0]
  for (let y = 0; y < height; y += TILE) for (let x = 0; x < width; x += TILE) {
    const coreWidth = Math.min(TILE, width - x), coreHeight = Math.min(TILE, height - y)
    const paddedWidth = coreWidth + PAD * 2, paddedHeight = coreHeight + PAD * 2
    const input = new Float32Array(3 * paddedWidth * paddedHeight)
    for (let py = 0; py < paddedHeight; py++) for (let px = 0; px < paddedWidth; px++) {
      const sx = Math.min(width - 1, Math.max(0, x + px - PAD))
      const sy = Math.min(height - 1, Math.max(0, y + py - PAD))
      const source = (sy * width + sx) * 4
      const target = py * paddedWidth + px
      const alpha = data[source + 3] / 255
      input[target] = data[source] / 255 * alpha
      input[paddedWidth * paddedHeight + target] = data[source + 1] / 255 * alpha
      input[2 * paddedWidth * paddedHeight + target] = data[source + 2] / 255 * alpha
    }
    const result = await session.run({[inputName]: new ort.Tensor('float32', input, [1, 3, paddedHeight, paddedWidth])})
    const tensor = result[outputName] as {data: Float32Array}
    const values = tensor.data as Float32Array
    const modelWidth = paddedWidth * scale, modelHeight = paddedHeight * scale
    const plane = modelWidth * modelHeight
    for (let py = 0; py < coreHeight; py++) for (let px = 0; px < coreWidth; px++) {
      const ox = (x + px) * scale, oy = (y + py) * scale
      const modelX = (px + PAD) * scale, modelY = (py + PAD) * scale
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const source = (modelY + dy) * modelWidth + modelX + dx
        const target = ((oy + dy) * outputWidth + ox + dx) * 4
        output[target] = Math.max(0, Math.min(255, Math.round(values[source] * 255)))
        output[target + 1] = Math.max(0, Math.min(255, Math.round(values[plane + source] * 255)))
        output[target + 2] = Math.max(0, Math.min(255, Math.round(values[plane * 2 + source] * 255)))
        const sx = x + px, sy = y + py
        output[target + 3] = data[(sy * width + sx) * 4 + 3]
      }
    }
  }
  return output
}
