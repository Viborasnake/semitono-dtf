export type History<T> = {past:T[];present:T;future:T[];group:number|null}
export const createHistory = <T>(present:T):History<T> => ({past:[],present,future:[],group:null})
export function recordHistory<T>(h:History<T>,next:T,group:number):History<T> {
  if(JSON.stringify(h.present)===JSON.stringify(next)) return h
  return {past:h.group===group?h.past:[...h.past,h.present].slice(-50),present:next,future:[],group}
}
export function moveHistory<T>(h:History<T>,direction:'undo'|'redo'):History<T> {
  if(direction==='undo') return h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future],group:null}:h
  return h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1),group:null}:h
}
