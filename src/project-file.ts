import type {EditorDocument} from './editor-document'
export type ProjectAsset={id:string;name:string;dataUrl:string;naturalWidth:number;naturalHeight:number;widthCm:number;heightCm:number;quantity:number;document?:EditorDocument}
export type ProjectFile={format:'trama-dtf';version:1;name:string;sheet:{width:number;height:number;dpi:number;gap:number;rotate:boolean};background:string;items:ProjectAsset[];editor?:{name:string;document:EditorDocument;assetId?:string}}
const fail=()=>{throw new Error('Proyecto inválido o incompatible. No se cambió el trabajo actual.')}
const positive=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0
const png=(s:unknown)=>typeof s==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s)
function checkDocument(d:EditorDocument) {
  if(!d||d.version!==1||!png(d.original)||!positive(d.widthCm)||![150,300,600].includes(d.dpi)||!d.settings)fail()
  const s=d.settings
  if(s.whiteRemoval!==undefined&&!['all','connected'].includes(s.whiteRemoval))fail()
  const numeric=['lpi','angle','size','contrast','brightness','whiteCutoff','tolerance','featherMm','cornerRadiusMm','trimMm','sharpness','gamma','autoToneStrength','autoContrastStrength','temperature','tint','autoColorStrength'] as const
  const boolean=['preserveColor','invert','enabled','autoTone','autoContrast','autoColor','solidAlpha'] as const
  if(numeric.some(k=>typeof s[k]!=='number'||!Number.isFinite(s[k]))||boolean.some(k=>typeof s[k]!=='boolean')||!['circle','square','line'].includes(s.shape)||!['black','white','none'].includes(s.background)||!Array.isArray(s.edgeSides)||s.edgeSides.length!==4||s.edgeSides.some(v=>typeof v!=='boolean'))fail()
  if(s.lpi<=0||s.gamma<=0||s.featherMm<0||s.trimMm<0||s.cornerRadiusMm<0)fail()
  if(d.crop&&(![d.crop.x,d.crop.y,d.crop.width,d.crop.height].every(Number.isInteger)||d.crop.x<0||d.crop.y<0||d.crop.width<1||d.crop.height<1))fail()
}
export function parseProject(text:string):ProjectFile {
  const p=JSON.parse(text) as ProjectFile
  if(!p||p.format!=='trama-dtf'||p.version!==1||typeof p.name!=='string'||!p.sheet||!positive(p.sheet.width)||!positive(p.sheet.height)||![150,300,600].includes(p.sheet.dpi)||!Number.isFinite(p.sheet.gap)||p.sheet.gap<0||typeof p.sheet.rotate!=='boolean'||!['checker','black','white','#596778','#304b70','#7b2931'].includes(p.background)||!Array.isArray(p.items)||p.items.length>200)fail()
  const ids=new Set<string>();let copies=0
  for(const a of p.items){
    if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.name!=='string'||!png(a.dataUrl)||![a.naturalWidth,a.naturalHeight,a.widthCm,a.heightCm].every(positive)||!Number.isInteger(a.quantity)||a.quantity<1||a.quantity>200)fail()
    ids.add(a.id);copies+=a.quantity
    if(a.document)checkDocument(a.document)
  }
  if(copies>200)fail()
  if(p.editor){if(typeof p.editor.name!=='string'||(p.editor.assetId!==undefined&&!ids.has(p.editor.assetId)))fail();checkDocument(p.editor.document)}
  return p
}
