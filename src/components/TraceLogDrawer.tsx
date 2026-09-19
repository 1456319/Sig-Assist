import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Trash2,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Terminal,
  Activity,
  AlertTriangle,
  Info,
  Bug,
  AlertOctagon
} from 'lucide-react';
import { traceLogger, type TraceEvent, type TraceLayer, type TraceLevel } from '../lib/diagnostics/traceLogger';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { cn } from '../lib/utils';

export interface TraceLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LAYERS: Array<{ id: 'all' | TraceLayer; label: string }> = [
  { id: 'all', label: 'All Layers' },
  { id: 'intake', label: 'Intake' },
  { id: 'clinical', label: 'Clinical' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'storage', label: 'Storage' },
  { id: 'ui', label: 'UI' },
];

const LEVELS: Array<{ id: 'all' | TraceLevel; label: string }> = [
  { id: 'all', label: 'All Levels' },
  { id: 'DEBUG', label: 'Debug' },
  { id: 'INFO', label: 'Info' },
  { id: 'WARN', label: 'Warn' },
  { id: 'ERROR', label: 'Error' },
];

export function TraceLogDrawer({ isOpen, onClose }: TraceLogDrawerProps) {
  const [events, setEvents] = useState<TraceEvent[]>(() => traceLogger.getEvents());
  const [selectedLayer, setSelectedLayer] = useState<'all' | TraceLayer>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | TraceLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [flushedStatus, setFlushedStatus] = useState(false);
  const [maxDisplayCount, setMaxDisplayCount] = useState(200);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to live log streaming
  useEffect(() => {
    if (!isOpen) return;
    setEvents(traceLogger.getEvents());

    const unsubscribe = traceLogger.subscribe(() => {
      setEvents(traceLogger.getEvents());
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Auto-scroll on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedLayer !== 'all' && e.layer !== selectedLayer) return false;
      if (selectedLevel !== 'all' && e.level !== selectedLevel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = e.message.toLowerCase().includes(q);
        const matchesComp = e.component.toLowerCase().includes(q);
        const matchesTrace = e.traceId.toLowerCase().includes(q);
        const matchesDetails = e.details ? JSON.stringify(e.details).toLowerCase().includes(q) : false;
        if (!matchesMsg && !matchesComp && !matchesTrace && !matchesDetails) return false;
      }
      return true;
    });
  }, [events, selectedLayer, selectedLevel, searchQuery]);

  const visibleEvents = useMemo(() => {
    if (filteredEvents.length <= maxDisplayCount) return filteredEvents;
    return filteredEvents.slice(filteredEvents.length - maxDisplayCount);
  }, [filteredEvents, maxDisplayCount]);

  if (!isOpen) return null;

  const storageAdapter = getCitrixStorageAdapter();
  const isStorageConnected = storageAdapter.isConnected();
  const storageMode = storageAdapter.getStorageMode();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyJsonl = async () => {
    try {
      const jsonl = traceLogger.exportJsonl();
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonl);
      }
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFlush = async () => {
    try {
      await traceLogger.flush();
      setFlushedStatus(true);
      setTimeout(() => setFlushedStatus(false), 2000);
    } catch {
      // safe fallback
    }
  };

  const handleExportBundle = () => {
    try {
      const bundle = {
        exportedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
        storageMode,
        storageConnected: isStorageConnected,
        eventCount: events.length,
        events,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sig-assist-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback
    }
  };

  const handleClear = () => {
    traceLogger.clear();
    setEvents([]);
    setExpandedIds(new Set());
  };

  const getLevelBadge = (level: TraceLevel) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <AlertOctagon className="w-3 h-3" />
            ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            WARN
          </span>
        );
      case 'INFO':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            <Bug className="w-3 h-3" />
            DEBUG
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-3xl h-full bg-card border-l border-border shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Diagnostic Trace Logs</h2>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                  {filteredEvents.length} / {events.length}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Client-side multi-layer execution telemetry (Zero admin privileges required)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 border-b border-border bg-background flex flex-col gap-2.5">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFlush}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                title="Flush pending memory traces to sig-assist-trace.jsonl on connected Citrix directory share"
              >
                {flushedStatus ? <Check className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>{flushedStatus ? 'Flushed!' : 'Flush to Share'}</span>
              </button>
              <button
                onClick={handleExportBundle}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                title="Download JSON diagnostics bundle via browser Blob"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Bundle</span>
              </button>
              <button
                onClick={handleCopyJsonl}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors"
                title="Copy raw JSONL events to clipboard"
              >
                {copiedStatus ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedStatus ? 'Copied!' : 'Copy JSONL'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear in-memory ring buffer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Search & Level Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trace logs (message, component, traceId, drug)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-muted/50 border border-input focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-md border border-border">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setSelectedLevel(lvl.id)}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded transition-colors',
                    selectedLevel === lvl.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Layer:
            </span>
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => setSelectedLayer(layer.id)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-md whitespace-nowrap transition-colors',
                  selectedLayer === layer.id
                    ? 'bg-primary/10 text-primary font-medium border border-primary/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trace Event Log Viewer */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 font-mono text-xs scrollbar-thin">
          {filteredEvents.length > maxDisplayCount && (
            <div className="flex justify-center my-1">
              <button
                onClick={() => setMaxDisplayCount((prev) => prev + 200)}
                className="text-[11px] text-primary hover:underline px-2.5 py-1 rounded bg-muted/60 border border-border"
              >
                Load {Math.min(200, filteredEvents.length - maxDisplayCount)} older events ({filteredEvents.length - maxDisplayCount} remaining)
              </button>
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Terminal className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs">No diagnostic trace events match the current filter</p>
            </div>
          ) : (
            visibleEvents.map((evt) => {
              const isExpanded = expandedIds.has(evt.id);
              const hasExtra = Boolean(evt.details || evt.error);

              return (
                <div
                  key={evt.id}
                  className="p-2 rounded border border-border bg-background hover:border-primary/40 transition-colors flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {evt.timestamp.slice(11, 23)}
                      </span>
                      {getLevelBadge(evt.level)}
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground border border-border">
                        {evt.layer}
                      </span>
                      <span className="text-[11px] font-semibold text-foreground">
                        [{evt.component}]
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 rounded">
                        {evt.traceId}
                      </span>
                    </div>

                    {hasExtra && (
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        className="flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>Details</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs font-sans text-foreground leading-snug">
                    {evt.message}
                  </p>

                  {isExpanded && hasExtra && (
                    <div className="mt-1 p-2 rounded bg-muted/70 text-[11px] font-mono overflow-x-auto border border-border">
                      {evt.details && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Details:</p>
                          <pre className="text-muted-foreground whitespace-pre-wrap">
                            {JSON.stringify(evt.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {evt.error && (
                        <div className="mt-1 pt-1 border-t border-border">
                          <p className="text-[10px] font-bold text-red-500 uppercase mb-0.5">Error:</p>
                          <p className="text-red-500">{evt.error.name}: {evt.error.message}</p>
                          {evt.error.stack && (
                            <pre className="text-[10px] text-red-400 mt-0.5 whitespace-pre-wrap">
                              {evt.error.stack}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Storage Indicator */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <HardDrive className={cn('w-4 h-4', isStorageConnected ? 'text-emerald-500' : 'text-amber-500')} />
            <span>
              {isStorageConnected
                ? 'Citrix Share: Connected (sig-assist-trace.jsonl)'
                : 'Storage: Browser Cache (Connect share in Settings)'}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Active Trace: {traceLogger.getActiveTraceId()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
