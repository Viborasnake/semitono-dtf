export function migratePresetSettings<T extends object>(settings:T,defaults:Record<string,unknown>) {
  const result={...settings} as Record<string,unknown>
  for(const key of ['cornerRadiusMm','temperature','tint','autoToneStrength','autoContrastStrength','autoColorStrength','autoTone','autoContrast','autoColor','solidAlpha']) {
    if(result[key]===undefined)result[key]=defaults[key]
  }
  return result
}
