// Ensure Storage and localStorage are cleanly defined across all Node and jsdom test environments.
class MockStorage implements Storage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

const mockInstance = new MockStorage();

try {
  Object.defineProperty(globalThis, 'Storage', {
    value: MockStorage,
    writable: true,
    configurable: true,
  });
} catch {
  (globalThis as unknown as { Storage: unknown }).Storage = MockStorage;
}

try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockInstance,
    writable: true,
    configurable: true,
  });
} catch {
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockInstance;
}

if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'Storage', {
      value: MockStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    (window as unknown as { Storage: unknown }).Storage = MockStorage;
  }

  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockInstance,
      writable: true,
      configurable: true,
    });
  } catch {
    (window as unknown as { localStorage: unknown }).localStorage = mockInstance;
  }
}
