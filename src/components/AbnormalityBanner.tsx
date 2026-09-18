import React from 'react';
import { AbnormalityFinding } from '../lib/clinical/types';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface AbnormalityBannerProps {
  findings: AbnormalityFinding[];
}

export const AbnormalityBanner: React.FC<AbnormalityBannerProps> = ({ findings }) => {
  if (findings.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <span>One or more abnormalities were identified. Review the directions on the electronic hardcopy carefully:</span>
      </div>
      <div className="mt-3 space-y-3">
        {findings.map((f, index) => (
          <div key={f.id} className="rounded border border-amber-200 bg-white/60 p-3 text-sm dark:border-amber-800 dark:bg-black/40">
            <div className="flex items-center gap-2 font-medium">
              {f.tier === 'uncorrected_gap' && <AlertOctagon className="h-4 w-4 text-red-500" />}
              {f.tier === 'applied_correction' && <Info className="h-4 w-4 text-blue-500" />}
              {f.tier === 'potential_error' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              <span>{index + 1}) [{f.title}]</span>
            </div>
            <p className="mt-1 font-semibold">{f.message}</p>
            {f.correction && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400"><span className="font-semibold">Correction:</span> {f.correction}</p>}
            {f.trigger && <p className="text-xs text-slate-600 dark:text-slate-400"><span className="font-semibold">Trigger:</span> {f.trigger}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
