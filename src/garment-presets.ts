import type {Settings} from './App'

export type GarmentTone = 'dark' | 'light'
export type PresetMode = 'halftone' | 'continuous'
type PresetValues = Omit<Settings, 'featherMm' | 'cornerRadiusMm' | 'trimMm' | 'edgeSides'>
export type GarmentPreset = {label:string; description:string; garment:GarmentTone; mode:PresetMode; values:PresetValues}

// Explicit processing values prevent settings from the previous category
// leaking into the next one. Physical dimensions, DPI, crop and edges stay put.
const neutral:PresetValues = {
  lpi:32,angle:22.5,shape:'circle',size:100,contrast:100,brightness:100,
  whiteCutoff:255,preserveColor:true,invert:false,background:'black',
  whiteRemoval:'all',whiteDetail:0,backgroundCleanup:0,tolerance:0,enabled:true,sharpness:0,
  gamma:1,autoTone:false,autoContrast:false,autoColor:false,
  autoToneStrength:100,autoContrastStrength:100,autoColorStrength:100,
  solidAlpha:true,temperature:0,tint:0,
}
export const garmentPresets:Record<string,GarmentPreset> = {
  default:{garment:'dark',mode:'halftone',label:'Equilibrado',description:'32 LPI, sin enfoque ni correcciones automáticas. El negro lo aporta la prenda.',values:{...neutral}},
  darkFine:{garment:'dark',mode:'halftone',label:'Trama fina',description:'45 LPI para una trama menos visible. Conserva la cobertura y los ajustes de tono neutros.',values:{...neutral,lpi:45}},
  darkBold:{garment:'dark',mode:'halftone',label:'Trama marcada',description:'24 LPI para puntos más grandes y visibles, con acabado gráfico. Mantiene los tonos neutros; los detalles pequeños pueden perder continuidad.',values:{...neutral,lpi:24}},
  darkClean:{garment:'dark',mode:'halftone',label:'Reducir ruido',description:'45 LPI y limpieza de sombras al 35%. Atenúa pintitas de color cercanas al negro; puede reducir detalles oscuros reales. Conserva el color fuera de esa zona.',values:{...neutral,lpi:45,backgroundCleanup:35}},
  darkMono:{garment:'dark',mode:'halftone',label:'Un color',description:'Solo puntos blancos sobre prenda oscura, a 45 LPI. El negro se elimina y no se conservan colores del original.',values:{...neutral,lpi:45,preserveColor:false}},
  darkOriginal:{garment:'dark',mode:'continuous',label:'Color original',description:'Sin trama ni eliminación de fondo. Conserva el color y la transparencia del archivo; ideal si ya está recortado.',values:{...neutral,enabled:false,background:'none',solidAlpha:false}},
  darkCutout:{garment:'dark',mode:'continuous',label:'Quitar negro',description:'Elimina el negro de toda la imagen sin puntos. Usa alfa parcial; también afecta los detalles negros interiores.',values:{...neutral,enabled:false,solidAlpha:false}},
  darkMonoContinuous:{garment:'dark',mode:'continuous',label:'Un color',description:'Diseño blanco, sin trama. Elimina negro y conserva transiciones con alfa parcial; convierte todos los colores del original en blanco.',values:{...neutral,enabled:false,solidAlpha:false,preserveColor:false}},
  lightGarment:{garment:'light',mode:'halftone',label:'Trama tonal',description:'32 LPI. La cobertura de los puntos varía con el tono, sin refuerzo de detalle. El blanco eliminado queda transparente.',values:{...neutral,background:'white',whiteDetail:0}},
  lightFine:{garment:'light',mode:'halftone',label:'Trama fina',description:'45 LPI y refuerzo de detalle al 30%. Conserva variación tonal con puntos más pequeños, sin enfoque adicional.',values:{...neutral,background:'white',whiteDetail:30,lpi:45}},
  lightBold:{garment:'light',mode:'halftone',label:'Trama marcada',description:'24 LPI para puntos más grandes y visibles sobre blanco, sin refuerzo de detalle. Acabado gráfico; los detalles pequeños pueden perder continuidad.',values:{...neutral,background:'white',lpi:24}},
  lightClean:{garment:'light',mode:'halftone',label:'Reducir ruido',description:'45 LPI y limpieza de blancos al 35%, sin refuerzo de detalle. Atenúa pintitas de color cercanas al blanco; puede aclarar detalles claros reales.',values:{...neutral,background:'white',lpi:45,backgroundCleanup:35}},
  lightMono:{garment:'light',mode:'halftone',label:'Un color',description:'Solo puntos negros sobre prenda clara, a 45 LPI. El blanco se elimina y no se conservan colores del original.',values:{...neutral,background:'white',lpi:45,preserveColor:false}},
  lightOriginal:{garment:'light',mode:'continuous',label:'Color original',description:'Sin trama ni eliminación de fondo. Conserva el color y la transparencia del archivo; ideal si ya está recortado.',values:{...neutral,enabled:false,background:'none',solidAlpha:false}},
  whiteCutout:{garment:'light',mode:'continuous',label:'Quitar fondo blanco',description:'Elimina blancos conectados al borde, sin trama. Conserva los detalles claros encerrados; revisa zonas claras conectadas al fondo.',values:{...neutral,enabled:false,background:'white',whiteRemoval:'connected',whiteCutoff:242,solidAlpha:false}},
  lightMonoContinuous:{garment:'light',mode:'continuous',label:'Un color',description:'Diseño negro, sin trama. Elimina blanco y conserva transiciones con alfa parcial; convierte todos los colores del original en negro.',values:{...neutral,enabled:false,background:'white',solidAlpha:false,preserveColor:false}},
}
export function presetsFor(garment:GarmentTone,mode:PresetMode){
  return Object.entries(garmentPresets).filter(([,p])=>p.garment===garment&&p.mode===mode)
}
