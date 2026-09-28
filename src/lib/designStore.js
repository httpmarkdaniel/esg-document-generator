// Browser storage (IndexedDB) for uploaded certificate designs, one per
// certificate type — so a Canva design and its field positions are still
// there next time. Designs are page-size images (a few MB), too big for
// localStorage. Every call fails soft: if storage is unavailable (private
// window, blocked site data) the design simply isn't remembered.

const DB_NAME = 'esg-document-generator'
const STORE = 'certificateDesigns'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const result = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(result.result)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** All saved designs, as { [certificateType]: design }. */
export async function loadDesigns() {
  try {
    const db = await openDb()
    try {
      return await new Promise((resolve, reject) => {
        const out = {}
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) return resolve(out)
          out[cursor.key] = cursor.value
          cursor.continue()
        }
        req.onerror = () => reject(req.error)
      })
    } finally {
      db.close()
    }
  } catch (err) {
    console.warn('Could not load saved certificate designs', err)
    return {}
  }
}

/** Save (or with `null`, delete) the design for one certificate type. */
export async function saveDesign(type, design) {
  try {
    await withStore('readwrite', (store) => (design ? store.put(design, type) : store.delete(type)))
  } catch (err) {
    console.warn('Could not save the certificate design', err)
  }
}
