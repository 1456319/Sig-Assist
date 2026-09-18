import React, { useState } from 'react';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { MessageSquarePlus } from 'lucide-react';

interface DiscrepancyPanelProps {
  pon: string;
  drugName: string;
  rawProse: string;
  generatedSig: string;
  onDiscrepancySaved: () => void;
}

export const DiscrepancyPanel: React.FC<DiscrepancyPanelProps> = ({
  pon,
  drugName,
  rawProse,
  generatedSig,
  onDiscrepancySaved
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [techSig, setTechSig] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    const adapter = getCitrixStorageAdapter();
    await adapter.appendDiscrepancy({
      id: `disc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      pon,
      drugName,
      rawProse,
      generatedSig,
      technicianSig: techSig,
      notes,
      flaggedForRph: false
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setIsOpen(false);
      onDiscrepancySaved();
    }, 1200);
  };

  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        <span>{isOpen ? 'Close Feedback' : 'Flag Discrepancy or Uncaught Error / Preference Lead'}</span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 rounded border bg-slate-50 p-3 text-xs dark:bg-slate-900">
          <div>
            <label className="block font-semibold">Technician Preferred / Corrected SIG:</label>
            <input
              type="text"
              value={techSig}
              onChange={(e) => setTechSig(e.target.value)}
              placeholder="e.g. COU PO QHS"
              className="mt-1 w-full rounded border px-2 py-1 uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold">Notes / Rationale:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe missed nuance or clinical rule lead..."
              className="mt-1 w-full rounded border px-2 py-1"
              rows={2}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
          >
            {isSaved ? 'Saved to Citrix Storage!' : 'Save Discrepancy Report'}
          </button>
        </div>
      )}
    </div>
  );
};
