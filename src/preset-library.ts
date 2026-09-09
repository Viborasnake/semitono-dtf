export function renamePersonalPreset<T extends {id:string;name:string}>(items:T[],id:string,name:string):T[] {
  const clean=name.trim()
  if(!id.startsWith('saved:')||!items.some(p=>p.id===id))throw new Error('Selecciona uno de tus presets.')
  if(!clean||clean.length>60)throw new Error('El nombre debe tener entre 1 y 60 caracteres.')
  if(items.some(p=>p.id!==id&&p.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))throw new Error('Ya tienes un preset con ese nombre.')
  return items.map(p=>p.id===id?{...p,name:clean}:p)
}
export function deletePersonalPreset<T extends {id:string}>(items:T[],id:string):T[] {
  if(!id.startsWith('saved:')||!items.some(p=>p.id===id))throw new Error('Selecciona uno de tus presets.')
  return items.filter(p=>p.id!==id)
}
