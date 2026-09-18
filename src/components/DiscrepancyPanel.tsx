import React, { useState, useRef, useEffect } from 'react';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { MessageSquarePlus } from 'lucide-react';

export interface DiscrepancyPanelProps {
  pon: string;
  drugName: string;
  rawProse: string;
  generatedSig: string;
  onDiscrepancySaved: () => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const DiscrepancyPanel: React.FC<DiscrepancyPanelProps> = ({
  pon,
  drugName,
  rawProse,
  generatedSig,
  onDiscrepancySaved,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [techSig, setTechSig] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const toggleOpen = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledIsOpen, onToggleOpen]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const adapter = getCitrixStorageAdapter();
      await adapter.appendDiscrepancy({
        id: `disc_${Date.now()}`,
        timestamp: new Date().toISOString(),
        pon,
        drugName,
        rawProse,
        generatedSig,
        technicianSig: techSig.trim().toUpperCase(),
        notes,
        flaggedForRph: false,
      });
      setIsSaved(true);
      setTechSig('');
      setNotes('');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsSaved(false);
        if (controlledIsOpen !== undefined) {
          if (isOpen && onToggleOpen) onToggleOpen();
        } else {
          setInternalIsOpen(false);
        }
        onDiscrepancySaved();
      }, 1200);
    } catch {
      // handle storage errors gracefully
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        <span>
          {isOpen
            ? 'Close Feedback'
            : 'Flag Discrepancy or Uncaught Error / Preference Lead'}
        </span>
        <kbd className="hidden sm:inline-block rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
          Alt+N
        </kbd>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 rounded border bg-slate-50 p-3 text-xs dark:bg-slate-900">
          <div>
            <label className="block font-semibold">
              Technician Preferred / Corrected SIG:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={techSig}
              onChange={(e) => setTechSig(e.target.value.toUpperCase())}
              placeholder="e.g. COU PO QHS"
              className="mt-1 w-full rounded border px-2 py-1 uppercase bg-background"
            />
          </div>
          <div>
            <label className="block font-semibold">Notes / Rationale:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe missed nuance or clinical rule lead..."
              className="mt-1 w-full rounded border px-2 py-1 bg-background"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaved
              ? 'Saved to Citrix Storage!'
              : isSaving
                ? 'Saving...'
                : 'Save Discrepancy Report'}
          </button>
        </div>
      )}
    </div>
  );
};
