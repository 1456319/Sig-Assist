// Ensure localStorage is cleanly defined across Node runtime environments and jsdom
if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();

  if (typeof Storage !== 'undefined') {
    Storage.prototype.getItem = function(key: string) { return store.get(key) ?? null; };
    Storage.prototype.setItem = function(key: string, value: string) { store.set(key, String(value)); };
    Storage.prototype.removeItem = function(key: string) { store.delete(key); };
    Storage.prototype.clear = function() { store.clear(); };
    Storage.prototype.key = function(index: number) { return Array.from(store.keys())[index] ?? null; };
    Object.defineProperty(Storage.prototype, 'length', {
      get: function() { return store.size; },
      configurable: true,
    });
  }

  const mockStorage = typeof Storage !== 'undefined' ? Object.create(Storage.prototype) : {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
}
