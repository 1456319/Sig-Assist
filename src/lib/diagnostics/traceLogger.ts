export type TraceLayer = 'intake' | 'clinical' | 'packaging' | 'assembly' | 'storage' | 'ui';
export type TraceLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface TraceEvent {
  id: string;
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

export class TraceLogger {
  private events: TraceEvent[] = [];
  private readonly maxCapacity: number;
  private readonly subscribers = new Set<(event: TraceEvent) => void>();
  private activeTraceId: string | null = null;
  private onFlushHook?: (events: TraceEvent[]) => Promise<void>;
  private lastFlushedIndex = 0;

  constructor(maxCapacity = 1000) {
    this.maxCapacity = maxCapacity;
  }

  public setOnFlushHook(hook: (events: TraceEvent[]) => Promise<void>): void {
    this.onFlushHook = hook;
  }

  public startTrace(prefix = 'TRC'): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const traceId = `${prefix}_${Date.now().toString(36).toUpperCase()}_${randomSuffix}`;
    this.activeTraceId = traceId;
    return traceId;
  }

  public setActiveTraceId(traceId: string | null): void {
    this.activeTraceId = traceId;
  }

  public getActiveTraceId(): string {
    return this.activeTraceId || 'GLOBAL';
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
      if (this.lastFlushedIndex > 0) {
        this.lastFlushedIndex--;
      }
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
    this.lastFlushedIndex = 0;
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

  public async flush(): Promise<void> {
    if (this.onFlushHook && this.events.length > this.lastFlushedIndex) {
      const unflushed = this.events.slice(this.lastFlushedIndex);
      this.lastFlushedIndex = this.events.length;
      await this.onFlushHook(unflushed);
    }
  }

  public resetFlushCursor(): void {
    this.lastFlushedIndex = 0;
  }

  public createScoped(scopeName: string, maxCapacity = 500): TraceLogger {
    const scoped = new TraceLogger(maxCapacity);
    scoped.setActiveTraceId(scopeName);
    return scoped;
  }
}

export const traceLogger = new TraceLogger(1000);
