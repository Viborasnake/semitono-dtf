import {parseProject,type ProjectFile} from './project-file.ts'

export type LocalProject = {project:ProjectFile;updatedAt:number}
const databaseName='trama-dtf-projects-v1'
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(databaseName,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('projects')
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error ?? new Error('No se pudo abrir el almacenamiento local.'))
    request.onblocked=()=>reject(new Error('Otra pestaña bloquea el almacenamiento del proyecto. Ciérrala y vuelve a intentar.'))
  })
}
export async function readActiveProject():Promise<LocalProject|undefined> {
  const db=await openDatabase()
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('projects','readonly')
      const request=tx.objectStore('projects').get('active')
      request.onerror=()=>reject(request.error)
      tx.oncomplete=()=>{
        try {const value=request.result as LocalProject|undefined;resolve(value?{...value,project:parseProject(JSON.stringify(value.project))}:undefined)}catch(e){reject(e)}
      }
      tx.onabort=()=>reject(tx.error)
    })
  }finally{db.close()}
}
export async function writeActiveProject(project:ProjectFile):Promise<{updatedAt:number;bytes:number}> {
  const serialized=JSON.stringify(project)
  const checked=parseProject(serialized),updatedAt=Date.now(),bytes=new Blob([serialized]).size
  const db=await openDatabase()
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite')
      tx.objectStore('projects').put({project:checked,updatedAt},'active')
      tx.oncomplete=()=>resolve()
      tx.onabort=()=>reject(tx.error ?? new Error('El proyecto no se pudo guardar.'))
      tx.onerror=()=>reject(tx.error)
    })
    return {updatedAt,bytes}
  }finally{db.close()}
}
export async function deleteActiveProject():Promise<void> {
  const db=await openDatabase()
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete('active')
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error)
    })
  }finally{db.close()}
}
export function emptyProject(name:string):ProjectFile {
  const clean=name.trim().replace(/\.trama\.json$/i,'').trim().slice(0,80)
  if(!clean)throw new Error('Escribe un nombre para el proyecto.')
  return {format:'trama-dtf',version:1,name:clean,sheet:{width:58,height:100,dpi:300,gap:5,rotate:true},background:'checker',items:[]}
}
