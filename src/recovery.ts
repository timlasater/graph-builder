import { parseProject, projectJson, type ProjectFile } from './projects'

const DB_NAME = 'graph-builder-recovery'
const STORE_NAME = 'projects'
const STORAGE_KEY = 'graph-builder.recovery.v1'

const database = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME) }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Local recovery storage is unavailable.'))
})

const transaction = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, capture: (value: T) => void) => void): Promise<T> => {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    let result: T
    const finish = () => { db.close(); resolve(result) }
    const fail = () => { db.close(); reject(tx.error ?? new Error('Local recovery storage failed.')) }
    tx.onerror = fail
    tx.oncomplete = finish
    action(tx.objectStore(STORE_NAME), (value) => { result = value })
  })
}

export const saveRecovery = async (project: ProjectFile) => {
  if (typeof indexedDB === 'undefined') { localStorage.setItem(STORAGE_KEY, projectJson(project)); return }
  await transaction<void>('readwrite', (store, resolve) => { const request = store.put(project, 'latest'); request.onsuccess = () => resolve() })
}

export const readRecovery = async (): Promise<ProjectFile | undefined> => {
  if (typeof indexedDB === 'undefined') { const saved = localStorage.getItem(STORAGE_KEY); return saved ? parseProject(saved) : undefined }
  const stored = await transaction<unknown>('readonly', (store, resolve) => { const request = store.get('latest'); request.onsuccess = () => resolve(request.result) })
  return stored === undefined ? undefined : parseProject(JSON.stringify(stored))
}

export const clearRecovery = async () => {
  if (typeof indexedDB === 'undefined') { localStorage.removeItem(STORAGE_KEY); return }
  await transaction<void>('readwrite', (store, resolve) => { const request = store.delete('latest'); request.onsuccess = () => resolve() })
}
