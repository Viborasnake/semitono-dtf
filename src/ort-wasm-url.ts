// Kept in a lazily imported module so Node's unit-test loader never needs to
// resolve Vite's `?url` asset convention. Vite replaces this with the deployed,
// base-aware asset path during the production build.
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'

export default ortWasmUrl
