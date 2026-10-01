export type TraceLayer = 'intake' | 'clinical' | 'packaging' | 'assembly' | 'storage' | 'ui';
export type TraceLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface TraceEvent {
  id: string;
  seq?: number;
  traceId: string;
  timestamp: string;
  layer: TraceLayer;
  level: TraceLevel;
  component: string;
  message: string;
  details?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface TraceFilter {
  layer?: TraceLayer;
  level?: TraceLevel;
  traceId?: string;
  component?: string;
  search?: string;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export interface TraceFlushResult {
  flushedCount: number;
  destination: 'file_system' | 'browser_cache' | string;
}

export class TraceLogger {
  private events: TraceEvent[] = [];
  private readonly maxCapacity: number;
  private readonly subscribers = new Set<(event: TraceEvent) => void>();
  private activeTraceId: string | null = null;
  private onFlushHook?: (events: TraceEvent[]) => Promise<{ destination: 'file_system' | 'browser_cache' | string; recordsSaved: number } | void>;
  private nextSeq = 1;
  private acknowledgedByDestination = new Map<string, Set<string>>();
  private activeFlushChain: Promise<TraceFlushResult> = Promise.resolve({ flushedCount: 0, destination: 'storage' });

  constructor(maxCapacity = 1000) {
    this.maxCapacity = maxCapacity;
  }

  public setOnFlushHook(
    hook: (events: TraceEvent[]) => Promise<{ destination: 'file_system' | 'browser_cache' | string; recordsSaved: number } | void>
  ): void {
    this.onFlushHook = hook;
  }

  public generateTraceId(prefix = 'TRC'): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${Date.now().toString(36).toUpperCase()}_${randomSuffix}`;
  }

  public startTrace(prefix = 'TRC'): string {
    const traceId = this.generateTraceId(prefix);
    this.activeTraceId = traceId;
    return traceId;
  }

  public setActiveTraceId(traceId: string | null): void {
    this.activeTraceId = traceId;
  }

  public getActiveTraceId(): string {
    return this.activeTraceId || 'GLOBAL';
  }

  public hydratePersistedEvents(persisted: TraceEvent[], destination?: string): number {
    if (!persisted || persisted.length === 0) return 0;
    const existingIds = new Set(this.events.map((e) => e.id));
    const fresh = persisted.filter((e) => !existingIds.has(e.id));

    const maxPersistedSeq = persisted.reduce((max, e) => Math.max(max, e.seq ?? 0), 0);
    this.nextSeq = Math.max(this.nextSeq, maxPersistedSeq + 1);

    // A sequence from a previous session can overlap newly created events.
    // Only these actual IDs were read from this destination and acknowledged.
    this.acknowledge(destination || 'storage', persisted);
    this.events = [...fresh, ...this.events].slice(-this.maxCapacity);
    this.pruneAcknowledgements();
    return fresh.length;
  }

  private acknowledge(destination: string, events: TraceEvent[]): void {
    const ids = this.acknowledgedByDestination.get(destination) || new Set<string>();
    events.forEach(event => ids.add(event.id));
    this.acknowledgedByDestination.set(destination, ids);
  }

  private pruneAcknowledgements(): void {
    const retainedIds = new Set(this.events.map(event => event.id));
    for (const ids of this.acknowledgedByDestination.values()) {
      for (const id of ids) if (!retainedIds.has(id)) ids.delete(id);
    }
  }

  public log(
    layer: TraceLayer,
    level: TraceLevel,
    component: string,
    message: string,
    details?: Record<string, unknown>,
    error?: { name: string; message: string; stack?: string },
    traceId?: string
  ): TraceEvent {
    const event: TraceEvent = {
      id: generateId(),
      seq: this.nextSeq++,
      traceId: traceId || this.activeTraceId || 'GLOBAL',
      timestamp: new Date().toISOString(),
      layer,
      level,
      component,
      message,
      details,
      error
    };

    this.events.push(event);
    if (this.events.length > this.maxCapacity) {
      this.events.shift();
      this.pruneAcknowledgements();
    }

    // Console output for development / devtools inspection
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'test') {
      const badge = `[${layer.toUpperCase()}:${level}] [${component}]`;
      if (level === 'ERROR') {
        console.error(badge, message, details || '', error || '');
      } else if (level === 'WARN') {
        console.warn(badge, message, details || '');
      } else {
        console.log(badge, message, details || '');
      }
    }

    // Notify UI subscribers
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(event);
      } catch {
        // Safe guard against subscriber errors
      }
    });

    return event;
  }

  private resolveErrorAndTrace(
    errorOrTraceId?: { name: string; message: string; stack?: string } | string,
    traceId?: string
  ): { error?: { name: string; message: string; stack?: string }; traceId?: string } {
    if (typeof errorOrTraceId === 'string') {
      return { traceId: errorOrTraceId };
    }
    return { error: errorOrTraceId, traceId };
  }

  public debug(
    layer: TraceLayer,
    component: string,
    message: string,
    details?: Record<string, unknown>,
    errorOrTraceId?: { name: string; message: string; stack?: string } | string,
    traceId?: string
  ): TraceEvent {
    const resolved = this.resolveErrorAndTrace(errorOrTraceId, traceId);
    return this.log(layer, 'DEBUG', component, message, details, resolved.error, resolved.traceId);
  }

  public info(
    layer: TraceLayer,
    component: string,
    message: string,
    details?: Record<string, unknown>,
    errorOrTraceId?: { name: string; message: string; stack?: string } | string,
    traceId?: string
  ): TraceEvent {
    const resolved = this.resolveErrorAndTrace(errorOrTraceId, traceId);
    return this.log(layer, 'INFO', component, message, details, resolved.error, resolved.traceId);
  }

  public warn(
    layer: TraceLayer,
    component: string,
    message: string,
    details?: Record<string, unknown>,
    errorOrTraceId?: { name: string; message: string; stack?: string } | string,
    traceId?: string
  ): TraceEvent {
    const resolved = this.resolveErrorAndTrace(errorOrTraceId, traceId);
    return this.log(layer, 'WARN', component, message, details, resolved.error, resolved.traceId);
  }

  public error(
    layer: TraceLayer,
    component: string,
    message: string,
    details?: Record<string, unknown>,
    errorOrTraceId?: { name: string; message: string; stack?: string } | string,
    traceId?: string
  ): TraceEvent {
    const resolved = this.resolveErrorAndTrace(errorOrTraceId, traceId);
    return this.log(layer, 'ERROR', component, message, details, resolved.error, resolved.traceId);
  }

  public getEvents(filter?: TraceFilter): TraceEvent[] {
    if (!filter) return [...this.events];

    return this.events.filter((event) => {
      if (filter.layer && event.layer !== filter.layer) return false;
      if (filter.level && event.level !== filter.level) return false;
      if (filter.traceId && event.traceId !== filter.traceId) return false;
      if (filter.component && !event.component.toLowerCase().includes(filter.component.toLowerCase())) return false;
      if (filter.search) {
        const query = filter.search.toLowerCase();
        const matchesMsg = event.message.toLowerCase().includes(query);
        const matchesComp = event.component.toLowerCase().includes(query);
        const matchesTrace = event.traceId.toLowerCase().includes(query);
        const matchesDetails = event.details ? JSON.stringify(event.details).toLowerCase().includes(query) : false;
        if (!matchesMsg && !matchesComp && !matchesTrace && !matchesDetails) return false;
      }
      return true;
    });
  }

  public clear(): void {
    this.events = [];
    this.acknowledgedByDestination.clear();
    this.activeTraceId = null;
  }

  public getPendingFlushCount(destination?: string): number {
    const destKey = destination || 'storage';
    const ids = this.acknowledgedByDestination.get(destKey);
    return this.events.filter(event => !ids?.has(event.id)).length;
  }

  public subscribe(subscriber: (event: TraceEvent) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public exportJson(): string {
    return JSON.stringify(this.events, null, 2);
  }

  public exportJsonl(): string {
    return this.events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  }

  public async flush(targetDestination?: string): Promise<TraceFlushResult> {
    const runFlush = async (): Promise<TraceFlushResult> => {
      if (!this.onFlushHook) {
        return { flushedCount: 0, destination: targetDestination || 'storage' };
      }
      const destKey = targetDestination || 'storage';
      const ids = this.acknowledgedByDestination.get(destKey);
      const unflushed = this.events.filter(event => !ids?.has(event.id));
      if (unflushed.length === 0) {
        return { flushedCount: 0, destination: destKey };
      }

      const result = await this.onFlushHook(unflushed);
      const actualDest = result && 'destination' in result && result.destination ? result.destination : destKey;
      const destId = result && typeof result === 'object' && 'destinationId' in result && result.destinationId ? (result.destinationId as string) : actualDest;

      this.acknowledge(destId, unflushed);
      if (actualDest === 'browser_cache' || destId === actualDest) this.acknowledge(actualDest, unflushed);
      if (destKey === 'storage') {
        this.acknowledge('storage', unflushed);
      }
      this.pruneAcknowledgements();

      return {
        flushedCount: unflushed.length,
        destination: actualDest
      };
    };

    const next = this.activeFlushChain.then(runFlush, runFlush);
    this.activeFlushChain = next.catch(() => ({ flushedCount: 0, destination: targetDestination || 'storage' }));
    return next;
  }

  public resetFlushCursor(destination?: string): void {
    if (destination) {
      this.acknowledgedByDestination.delete(destination);
    } else {
      this.acknowledgedByDestination.clear();
    }
  }

  public createScoped(scopeName: string, maxCapacity = 500): TraceLogger {
    const scoped = new TraceLogger(maxCapacity);
    scoped.setActiveTraceId(scopeName);
    return scoped;
  }
}

export const traceLogger = new TraceLogger(1000);
