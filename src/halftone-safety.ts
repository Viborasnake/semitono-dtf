export type HalftoneSafetyInput = {
  dpi: number
  sourceDpi: number
  lpi: number
  size: number
  minDotSize: number
  solidAlpha: boolean
  enabled: boolean
}

export type HalftoneSafetyIssue = {
  title: string
  message: string
}

export type HalftoneSafetyReport = {
  sourceDpi: number
  cellPixels: number
  maximumDotPixels: number
  recommendedMinimumDotPixels: number
  recommendedMinimumDotMm: number
  maxRecommendedLpi: number
  issues: HalftoneSafetyIssue[]
}

const recommendedMinimumDotPixels = 2
const recommendedCellPixels = 6

/**
 * Checks the settings that determine whether a screened dot can be represented
 * reliably in the output raster. It deliberately does not promise a continuous
 * gradient: transparent holes are how the lightest halftone tones are encoded.
 */
export function assessHalftoneSafety(input: HalftoneSafetyInput): HalftoneSafetyReport {
  const cellPixels = input.dpi / input.lpi
  const maximumDotPixels = cellPixels * input.size / 100
  const recommendedMinimumDotMm = recommendedMinimumDotPixels / input.dpi * 25.4
  const maxRecommendedLpi = Math.floor(input.dpi / recommendedCellPixels)
  const issues: HalftoneSafetyIssue[] = []

  if (input.sourceDpi < input.dpi) {
    issues.push({
      title: 'El original se está ampliando',
      message: `Al tamaño final el original aporta ${Math.round(input.sourceDpi)} ppp, pero la salida solicita ${input.dpi} ppp. El remuestreo permite generar el PNG, pero no recupera detalle ni mejora la definición real de impresión.`,
    })
  }

  if (!input.enabled) return {sourceDpi:input.sourceDpi, cellPixels, maximumDotPixels, recommendedMinimumDotPixels, recommendedMinimumDotMm, maxRecommendedLpi, issues}

  if (cellPixels < recommendedCellPixels) {
    issues.push({
      title: 'Trama demasiado fina para esta resolución',
      message: `Cada celda mide ${cellPixels.toFixed(1)} px. Para ${input.dpi} ppp se recomienda no superar ${maxRecommendedLpi} LPI; los puntos de las zonas claras pueden desaparecer o quedar irregulares.`,
    })
  }
  if (maximumDotPixels < recommendedMinimumDotPixels) {
    issues.push({
      title: 'Punto máximo demasiado pequeño',
      message: `Con ${input.size}% de tamaño, incluso el punto más grande mide cerca de ${maximumDotPixels.toFixed(1)} px. Sube el tamaño del punto o baja los LPI para llegar al menos a ${recommendedMinimumDotPixels} px.`,
    })
  }
  if (input.minDotSize >= maximumDotPixels && input.minDotSize > 0) {
    issues.push({
      title: 'El filtro puede borrar toda la trama fina',
      message: `El tamaño mínimo configurado (${input.minDotSize.toFixed(1)} px) es igual o mayor que el punto máximo estimado (${maximumDotPixels.toFixed(1)} px). Esto puede crear huecos blancos en el degradado.`,
    })
  }
  if (!input.solidAlpha) {
    issues.push({
      title: 'Alfa parcial activo',
      message: 'Los bordes de los puntos conservan transparencia parcial. Para DTF, Alfa sólido ofrece una trama más predecible; valida el alfa parcial con tu RIP antes de producir.',
    })
  }
  return {sourceDpi:input.sourceDpi, cellPixels, maximumDotPixels, recommendedMinimumDotPixels, recommendedMinimumDotMm, maxRecommendedLpi, issues}
}
