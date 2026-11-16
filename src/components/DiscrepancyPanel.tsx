import React, { useState, useRef, useEffect, useId } from 'react';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { MessageSquarePlus } from 'lucide-react';
import type { DiscrepancyReport } from '../lib/clinical/types';
import { DISCREPANCY_SAVED_EVENT, discrepancyCaseBundle } from '../lib/discrepancyCases';

export interface DiscrepancyPanelProps {
  pon: string;
  drugName: string;
  rawProse: string;
  generatedSig: string;
  currentDraft?: string;
  context?: DiscrepancyReport['context'];
  onDiscrepancySaved: () => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const DiscrepancyPanel: React.FC<DiscrepancyPanelProps> = ({
  pon,
  drugName,
  rawProse,
  generatedSig,
  currentDraft,
  context,
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
  const [saveError, setSaveError] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const draftIdentity = useRef<{ source: string; id: string; timestamp: string }>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldId = useId();

  const toggleOpen = () => {
    setSaveError('');
    if (!isOpen && !techSig && currentDraft !== undefined) setTechSig(currentDraft.toUpperCase());
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
  const currentReport = (): DiscrepancyReport => {
    const source = JSON.stringify([pon, drugName, rawProse, generatedSig]);
    if (draftIdentity.current?.source !== source) draftIdentity.current = {
      source,
      // getRandomValues also works on HTTP workstation origins.
      id: `disc_${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`,
      timestamp: new Date().toISOString(),
    };
    return {
      id: draftIdentity.current.id, timestamp: draftIdentity.current.timestamp,
      storageUpdatedAt: new Date().toISOString(),
      pon, drugName, rawProse, generatedSig, technicianSig: techSig.trim().toUpperCase(), notes,
      flaggedForRph: false, appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, context,
    };
  };
  const downloadReport = () => {
    if (!techSig.trim() && !notes.trim()) { setSaveError('Enter a corrected SIG or notes describing the problem.'); return; }
    try {
      const report = currentReport();
      const url = URL.createObjectURL(new Blob([JSON.stringify(discrepancyCaseBundle([report]), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `sig-assist-unsaved-${report.id}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloadNotice('Download requested. Check that the file exists before closing. This does not add the report to the saved list.');
    } catch { setSaveError('Download could not start. Copy the corrected SIG and notes into a local file before closing.'); }
  };
  const handleSave = async () => {
    if (isSaving || isSaved) return;
    if (!techSig.trim() && !notes.trim()) {
      setSaveError('Enter a corrected SIG or notes describing the problem.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      const adapter = getCitrixStorageAdapter();
      await adapter.appendDiscrepancy(currentReport(), { immediate: true });
      window.dispatchEvent(new Event(DISCREPANCY_SAVED_EVENT));
      setIsSaved(true);
      setTechSig('');
      setNotes('');
      setDownloadNotice(''); draftIdentity.current = undefined;
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setSaveError(`Report could not be saved. Your entries are still here. ${errMsg}`);
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
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 rounded border bg-slate-50 p-3 text-xs dark:bg-slate-900">
          <div>
            <label htmlFor={`${fieldId}-sig`} className="block font-semibold">
              Technician Preferred / Corrected SIG:
            </label>
            <textarea
              id={`${fieldId}-sig`}
              ref={inputRef}
              value={techSig}
              onChange={(e) => setTechSig(e.target.value.toUpperCase())}
              placeholder="e.g. COU PO QHS"
              rows={3}
              className="mt-1 w-full rounded border px-2 py-1 uppercase bg-background"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-notes`} className="block font-semibold">Notes / Rationale:</label>
            <textarea
              id={`${fieldId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe missed nuance or clinical rule lead..."
              className="mt-1 w-full rounded border px-2 py-1 bg-background"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={isSaving || isSaved}
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaved
              ? 'Discrepancy saved locally'
              : isSaving
                ? 'Saving...'
                : 'Save Discrepancy Report'}
          </button>
          {!isSaved && <div className="space-y-1">
            <button type="button" disabled={isSaving} onClick={downloadReport} className="rounded border px-3 py-1 font-medium">Download this report</button>
            <p>Local file includes the original order text and your correction. Choose an approved local folder.</p>
          </div>}
          {saveError && <p role="alert" className="font-semibold text-red-700 dark:text-red-300">{saveError}</p>}
          {downloadNotice && <p role="status">{downloadNotice}</p>}
        </div>
      )}
    </div>
  );
};
