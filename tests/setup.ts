// Ensure localStorage is cleanly defined across Node runtime environments and jsdom
if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();

  if (typeof Storage !== 'undefined') {
    try {
      if (!Storage.prototype.getItem) Storage.prototype.getItem = function(key: string) { return store.get(key) ?? null; };
      if (!Storage.prototype.setItem) Storage.prototype.setItem = function(key: string, value: string) { store.set(key, String(value)); };
      if (!Storage.prototype.removeItem) Storage.prototype.removeItem = function(key: string) { store.delete(key); };
      if (!Storage.prototype.clear) Storage.prototype.clear = function() { store.clear(); };
      if (!Storage.prototype.key) Storage.prototype.key = function(index: number) { return Array.from(store.keys())[index] ?? null; };
      const desc = Object.getOwnPropertyDescriptor(Storage.prototype, 'length');
      if (!desc || desc.configurable) {
        Object.defineProperty(Storage.prototype, 'length', {
          get: function() { return store.size; },
          configurable: true,
        });
      }
    } catch {
      // Ignore if Storage.prototype is sealed or non-configurable in some Node versions
    }
  }

  const mockStorage = typeof Storage !== 'undefined' ? Object.create(Storage.prototype) : {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  };

  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;
  }

  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });
    } catch {
      (window as unknown as { localStorage: unknown }).localStorage = mockStorage;
    }
  }
}
