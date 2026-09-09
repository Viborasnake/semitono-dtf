import {useEffect,useRef} from 'react'
import type {ProjectFile} from './project-file'
import {writeActiveProject} from './project-storage'

export type ProjectSaveStatus={name:string;message:string;pending:boolean;failed:boolean;bytes?:number}
export function useProjectAutosave(factory:()=>ProjectFile,revision:unknown[],enabled:boolean,onStatus?:(s:ProjectSaveStatus)=>void) {
  const latest=useRef({factory,onStatus});latest.current={factory,onStatus}
  const dirty=useRef(false),generation=useRef(0)
  const queue=useRef(Promise.resolve())
  const flush=useRef<()=>void>(()=>{})
  useEffect(()=>{
    const id=++generation.current
    dirty.current=true
    const report=(message:string,pending:boolean,failed=false)=>latest.current.onStatus?.({name:'',message,pending,failed})
    if(!enabled){report('Preparando proyecto para guardar…',true);return}
    report('Cambios pendientes…',true)
    let started=false
    const save=()=>{
      if(started)return
      started=true
      let project:ProjectFile
      try {project=latest.current.factory()}catch(e){report(`Sin guardar: ${(e as Error).message}`,true,true);return}
      report('Guardando en este navegador…',true)
      queue.current=queue.current.catch(()=>{}).then(async()=>{
        try {
          const {updatedAt,bytes}=await writeActiveProject(project)
          if(generation.current===id){dirty.current=false;latest.current.onStatus?.({name:project.name,message:`Guardado · ${new Date(updatedAt).toLocaleTimeString()}`,pending:false,failed:false,bytes})}
        }catch(e){if(generation.current===id)report(`No guardado. Descarga una copia. ${(e as Error).message}`,true,true)}
      })
    }
    flush.current=save
    const timer=window.setTimeout(save,500)
    return ()=>{window.clearTimeout(timer);flush.current=()=>{}}
  // The caller supplies the data dependencies; the factory is refreshed via ref.
  },[enabled,...revision])
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty.current){flush.current();event.preventDefault();event.returnValue=''}}
    const visibility=()=>{if(document.visibilityState==='hidden'&&dirty.current)flush.current()}
    window.addEventListener('beforeunload',beforeUnload);document.addEventListener('visibilitychange',visibility)
    return ()=>{generation.current++;window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('visibilitychange',visibility)}
  },[])
}
