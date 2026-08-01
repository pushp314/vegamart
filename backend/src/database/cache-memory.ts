interface MemoryEntry {
  value: string;
  expiresAt: number;
}

interface MemoryStore {
  map: Map<string, MemoryEntry>;
  get: (key: string) => string | null;
  set: (key: string, value: string, ttlSeconds: number) => void;
  del: (key: string) => void;
  clearPattern: (pattern: string) => void;
}

const store: MemoryStore = {
  map: new Map<string, MemoryEntry>(),
  get(key: string): string | null {
    const entry = store.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.map.delete(key);
      return null;
    }
    return entry.value;
  },
  set(key: string, value: string, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    store.map.set(key, { value, expiresAt });
  },
  del(key: string): void {
    store.map.delete(key);
  },
  clearPattern(pattern: string): void {
    if (!pattern.includes("*")) {
      store.map.delete(pattern);
      return;
    }
    const prefix = pattern.slice(0, pattern.indexOf("*"));
    for (const key of store.map.keys()) {
      if (key.startsWith(prefix)) {
        store.map.delete(key);
      }
    }
  },
};

export function memoryCacheGet(key: string): string | null {
  return store.get(key);
}

export function memoryCacheSet(key: string, value: string, ttlSeconds: number): void {
  store.set(key, value, ttlSeconds);
}

export function memoryCacheDel(key: string): void {
  store.del(key);
}

export function memoryCacheClearPattern(pattern: string): void {
  store.clearPattern(pattern);
}

export function memoryCacheStats(): { size: number } {
  return { size: store.map.size };
}

export default store;
