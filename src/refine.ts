/** Small, deterministic cleanup passes used after screening. */
export function smoothRgba(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(2, Math.round(radius)))
  if (!r) return data
  const out = new Uint8ClampedArray(data.length)
  const area = (r * 2 + 1) ** 2
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let rr = 0, gg = 0, bb = 0, aa = 0
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      const nx = Math.max(0, Math.min(width - 1, x + ox))
      const ny = Math.max(0, Math.min(height - 1, y + oy))
      const i = (ny * width + nx) * 4
      rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; aa += data[i + 3]
    }
    const i = (y * width + x) * 4
    out[i] = Math.round(rr / area); out[i + 1] = Math.round(gg / area)
    out[i + 2] = Math.round(bb / area); out[i + 3] = Math.round(aa / area)
  }
  return out
}

export function flattenSelectedColor(data: Uint8ClampedArray, color: string, tolerance: number) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color)
  if (!match) return new Uint8ClampedArray(data)
  const target = [parseInt(match[1].slice(0, 2), 16), parseInt(match[1].slice(2, 4), 16), parseInt(match[1].slice(4, 6), 16)]
  const limit = Math.max(0, Math.min(100, tolerance)) / 100 * 441
  const out = new Uint8ClampedArray(data)
  for (let i = 0; i < out.length; i += 4) {
    if (Math.hypot(data[i] - target[0], data[i + 1] - target[1], data[i + 2] - target[2]) <= limit) {
      out[i] = target[0]; out[i + 1] = target[1]; out[i + 2] = target[2]
    }
  }
  return out
}

export function applyColorCorrection(data: Uint8ClampedArray, mask: Uint8Array, color: string, tolerance = 0) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color)
  if (!match) return data
  const r = parseInt(match[1].slice(0, 2), 16), g = parseInt(match[1].slice(2, 4), 16), b = parseInt(match[1].slice(4, 6), 16)
  const limit = Math.max(0, Math.min(100, tolerance)) / 100 * 441
  const out = new Uint8ClampedArray(data)
  for (let p = 0; p < mask.length; p++) if (mask[p] && Math.hypot(data[p * 4] - r, data[p * 4 + 1] - g, data[p * 4 + 2] - b) <= limit) {
    const i = p * 4
    out[i] = r; out[i + 1] = g; out[i + 2] = b
  }
  return out
}

/** Restores protected ink after dot cleanup while respecting the output alpha mode. */
export function restoreProtectedPixels(output: Uint8ClampedArray, colors: Uint8ClampedArray, source: Uint8ClampedArray, mask: Uint8Array, solidAlpha: boolean, smoothEdge: boolean) {
  for (let p = 0; p < mask.length; p++) if (mask[p]) {
    const i = p * 4
    output[i] = colors[i]
    output[i + 1] = colors[i + 1]
    output[i + 2] = colors[i + 2]
    output[i + 3] = source[i + 3] === 0 ? 0 : solidAlpha || !smoothEdge ? 255 : source[i + 3]
  }
}

/** Removes connected alpha islands smaller than the requested pixel area. */
export function removeSmallParticles(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const threshold = Math.max(0, Math.floor(minArea))
  if (!threshold) return 0
  const visited = new Uint8Array(width * height)
  const removed = new Uint8Array(width * height)
  let removedPixels = 0
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] === 0) continue
    const component: number[] = [start]
    visited[start] = 1
    for (let cursor = 0; cursor < component.length; cursor++) {
      const p = component[cursor], x = p % width, y = Math.floor(p / width)
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue
        const nx = x + ox, ny = y + oy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const next = ny * width + nx
        if (!visited[next] && data[next * 4 + 3] > 0) { visited[next] = 1; component.push(next) }
      }
    }
    if (component.length < threshold) {
      for (const p of component) { removed[p] = 1; removedPixels++ }
    }
  }
  for (let p = 0; p < removed.length; p++) if (removed[p]) {
    const i = p * 4
    data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
  }
  return removedPixels
}

/** Removes tiny connected dots using the area implied by their diameter. */
export function removeTinyDots(data: Uint8ClampedArray, width: number, height: number, minSize: number) {
  const threshold = Math.ceil(Math.PI * (Math.max(0, minSize) / 2) ** 2)
  return removeSmallParticles(data, width, height, threshold > 1 ? threshold : 0)
}
