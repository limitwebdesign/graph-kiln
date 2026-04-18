import type { ForgeWorkspace } from "./types.js";
import { safeJsonParse } from "./utils.js";

const DB_NAME = "graphkiln-db";
const STORE_NAME = "workspaces";
const KEY = "active";

export class WorkspaceStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private openDb(): Promise<IDBDatabase | null> {
    if (!("indexedDB" in globalThis)) return Promise.resolve(null);
    if (this.dbPromise) return this.dbPromise;

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

  async load(): Promise<ForgeWorkspace | null> {
    const db = await this.openDb();
    if (!db) {
      return this.loadFromLocalStorage();
    }

    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onerror = () => resolve(this.loadFromLocalStorage());
      req.onsuccess = () => resolve((req.result as ForgeWorkspace | undefined) ?? this.loadFromLocalStorage());
    });
  }

  async save(workspace: ForgeWorkspace): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      this.saveToLocalStorage(workspace);
      return;
    }

    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.onerror = () => {
        this.saveToLocalStorage(workspace);
        resolve();
      };
      tx.oncomplete = () => resolve();
      tx.objectStore(STORE_NAME).put(workspace, KEY);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    localStorage.removeItem(KEY);
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.objectStore(STORE_NAME).delete(KEY);
    });
  }

  private saveToLocalStorage(workspace: ForgeWorkspace): void {
    localStorage.setItem(KEY, JSON.stringify(workspace));
  }

  private loadFromLocalStorage(): ForgeWorkspace | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return safeJsonParse<ForgeWorkspace>(raw);
  }
}
