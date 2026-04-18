import { safeJsonParse } from "./utils.js";
const DB_NAME = "graphkiln-db";
const STORE_NAME = "workspaces";
const KEY = "active";
export class WorkspaceStorage {
    dbPromise = null;
    openDb() {
        if (!("indexedDB" in globalThis))
            return Promise.resolve(null);
        if (this.dbPromise)
            return this.dbPromise;
        this.dbPromise = new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => resolve(null);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
        return this.dbPromise;
    }
    async load() {
        const db = await this.openDb();
        if (!db) {
            return this.loadFromLocalStorage();
        }
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(KEY);
            req.onerror = () => resolve(this.loadFromLocalStorage());
            req.onsuccess = () => resolve(req.result ?? this.loadFromLocalStorage());
        });
    }
    async save(workspace) {
        const db = await this.openDb();
        if (!db) {
            this.saveToLocalStorage(workspace);
            return;
        }
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.onerror = () => {
                this.saveToLocalStorage(workspace);
                resolve();
            };
            tx.oncomplete = () => resolve();
            tx.objectStore(STORE_NAME).put(workspace, KEY);
        });
    }
    async clear() {
        const db = await this.openDb();
        localStorage.removeItem(KEY);
        if (!db)
            return;
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.objectStore(STORE_NAME).delete(KEY);
        });
    }
    saveToLocalStorage(workspace) {
        localStorage.setItem(KEY, JSON.stringify(workspace));
    }
    loadFromLocalStorage() {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return null;
        return safeJsonParse(raw);
    }
}
