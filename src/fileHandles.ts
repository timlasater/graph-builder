const DATABASE_NAME = 'graph-builder-files'
const DATABASE_VERSION = 1
const STORE_NAME = 'handles'

export interface PersistentFileHandle {
  name: string
  getFile: () => Promise<File>
  queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>
  requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean
      types?: { description?: string; accept: Record<string, string[]> }[]
    }) => Promise<PersistentFileHandle[]>
  }
}

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('The file permission database could not be opened.'))
})

export const storeFileHandle = async (handle: PersistentFileHandle, existingId?: string) => {
  const database = await openDatabase()
  const id = existingId ?? crypto.randomUUID()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(handle, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The file permission could not be saved.'))
  })
  database.close()
  return id
}

export const getFileHandle = async (id: string) => {
  const database = await openDatabase()
  const handle = await new Promise<PersistentFileHandle | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as PersistentFileHandle | undefined)
    request.onerror = () => reject(request.error ?? new Error('The saved file permission could not be read.'))
  })
  database.close()
  return handle
}

export const persistentFilePickerAvailable = () => typeof window.showOpenFilePicker === 'function' && typeof indexedDB !== 'undefined'

export const pickPersistentFile = async (existingId?: string) => {
  if (!window.showOpenFilePicker) return undefined
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: 'Tabular data', accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv', '.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    } }],
  })
  if (!handle) return undefined
  const handleId = await storeFileHandle(handle, existingId)
  return { file: await handle.getFile(), handleId }
}

export const fileFromSavedHandle = async (id: string) => {
  const handle = await getFileHandle(id)
  if (!handle) return undefined
  let permission = await handle.queryPermission?.({ mode: 'read' }) ?? 'prompt'
  if (permission === 'prompt') permission = await handle.requestPermission?.({ mode: 'read' }) ?? 'denied'
  if (permission !== 'granted') return undefined
  return handle.getFile()
}
