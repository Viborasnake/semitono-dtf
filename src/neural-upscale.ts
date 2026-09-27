import * as ort from 'onnxruntime-web'

const MODEL_URL = '/models/real_esrgan_x2.onnx'
const TILE = 512
const PAD = 16

// Experimental CPU/WASM path. Tiles keep peak memory bounded and the padded
// overlap prevents visible seams when the model sees a tile boundary.
export async function neuralUpscaleRgba(data: Uint8ClampedArray, width: number, height: number) {
  ort.env.wasm.numThreads = 1
  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  const outputWidth = width * 2, outputHeight = height * 2
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
    const tensor = result[outputName] as ort.Tensor
    const values = tensor.data as Float32Array
    const modelWidth = paddedWidth * 2, modelHeight = paddedHeight * 2
    const plane = modelWidth * modelHeight
    for (let py = 0; py < coreHeight; py++) for (let px = 0; px < coreWidth; px++) {
      const ox = (x + px) * 2, oy = (y + py) * 2
      const modelX = (px + PAD) * 2, modelY = (py + PAD) * 2
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
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
