// Client-side persistence for geolocation JSON files that successfully
// parsed as BSSID location data, so they don't have to be re-uploaded every
// visit. Keyed by filename — uploading the same name again overwrites the
// existing entry rather than duplicating it.
//
// Backed by IndexedDB rather than localStorage: real scan exports run to
// several MB (a 2km Las Vegas scan is ~4.5 MB), and localStorage caps out
// around 5 MB per origin — worse, it stores strings as UTF-16, so a 4.5 MB
// file needs ~9 MB of quota and fails to save at all. IndexedDB has no
// comparable cap and stores strings without that doubling.

const DB_NAME = "wayfinder";
const DB_VERSION = 1;
const STORE_NAME = "savedGeoFiles";

export type SavedGeoFile = {
    name: string;
    content: string;
    sizeBytes: number;
    savedAt: string; // ISO timestamp
    bssidCount: number;
    queryName?: string;
};

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "name" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open database"));
    });
}

// Wraps a store operation in its own transaction, resolving with the
// request's result once the transaction actually commits — resolving on
// request.onsuccess alone would report success for writes that later fail
// to commit (e.g. on quota exhaustion).
async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const request = run(tx.objectStore(STORE_NAME));
            let result: T;
            request.onsuccess = () => { result = request.result; };
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
        });
    } finally {
        db.close();
    }
}

export async function listSavedGeoFiles(): Promise<SavedGeoFile[]> {
    try {
        const files = await withStore<SavedGeoFile[]>("readonly", store => store.getAll());
        return files.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    } catch {
        // Storage unavailable (private browsing, blocked) — behave as empty
        // rather than breaking the tab; saving will surface its own error.
        return [];
    }
}

export async function saveGeoFile(entry: Omit<SavedGeoFile, "savedAt">): Promise<SavedGeoFile[]> {
    // put() overwrites by keyPath, so a repeat filename replaces in place.
    await withStore("readwrite", store => store.put({ ...entry, savedAt: new Date().toISOString() }));
    return listSavedGeoFiles();
}

export async function deleteGeoFile(name: string): Promise<SavedGeoFile[]> {
    await withStore("readwrite", store => store.delete(name));
    return listSavedGeoFiles();
}
