// Clear only the active project, never the user's preset library or other apps.
export function clearActiveProject(storage:Pick<Storage,'removeItem'>) {
  for(const key of ['trama-dtf-gang-sheet-v1','trama-dtf-sheet-settings','trama-dtf-project-name'])storage.removeItem(key)
}
