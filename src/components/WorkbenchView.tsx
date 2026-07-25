import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical, Copy, Check, TriangleAlert, ChevronDown, ChevronRight,
  Zap, RefreshCw, Info, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchAllSigEntries } from '../lib/sigDictionaryService';
import { fetchAllTechRules } from '../lib/techRulesService';
import { fetchAllExpansions } from '../lib/sigExpansionService';
import { runParser } from '../lib/parser';
import type { SigDictionaryEntry, TechRule, SigExpansion, ParseResult, InputMode, TraceStep, ResolvedToken } from '../lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';

const HL7_SAMPLE = `MSH|^~\\&|PHARMACY|HOSPITAL|EMR|SYSTEM|20240115120000||RXO^O01|MSG001|P|2.5
PID|1||123456^^^HOSP^MR||DOE^JOHN^A||19650301|M|||123 MAIN ST^^ANYTOWN^ST^12345
ORC|NW|ORD001|FILL001||CM|||||20240115120000|||DR SMITH^JOHN
RXO|1234567890^METFORMIN HCL^NDC|500|MG|TAB|Take 1 tablet BID PC|METFORMIN HCL 500MG TABS|10|TAB
RXE|ORD001|METFORMIN HCL^500MG^TAB|500|MG|TAB|Take 1 tablet BID PC|10|TAB`;

const FREETEXT_SAMPLE = 'Take 1 tablet twice daily after meals prn';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function TraceStepCard({ step, defaultOpen }: { step: TraceStep; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const hasWarnings = step.warnings.length > 0;

  const stepColors: Record<number, string> = {
    1: 'text-blue-500',
    2: 'text-amber-500',
    3: 'text-violet-500',
    4: 'text-orange-500',
    5: 'text-emerald-500',
  };

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      hasWarnings ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left"
      >
        <span className={cn('font-mono text-[11px] font-bold tabular-nums flex-shrink-0', stepColors[step.step])}>
          STEP {step.step}
        </span>
        <span className="text-[12px] font-medium text-foreground flex-1 truncate">{step.label}</span>
        {hasWarnings && (
          <span className="flex items-center gap-1 text-amber-500 text-[10px] font-medium flex-shrink-0">
            <TriangleAlert className="w-3 h-3" />
            {step.warnings.length}
          </span>
        )}
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Input</p>
              <p className="text-[11px] font-mono-tight bg-muted/60 rounded px-2 py-1.5 break-all text-foreground/80">
                {step.input || <span className="italic text-muted-foreground">empty</span>}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Output</p>
              <p className="text-[11px] font-mono-tight bg-muted/60 rounded px-2 py-1.5 break-all text-foreground/80">
                {step.output || <span className="italic text-muted-foreground">empty</span>}
              </p>
            </div>
          </div>

          {step.rulesApplied.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Applied</p>
              <ul className="space-y-0.5">
                {step.rulesApplied.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] font-mono-tight text-foreground/70">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-500 mb-1">Warnings</p>
              <ul className="space-y-0.5">
                {step.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] font-mono-tight text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HighRiskToken({ token }: { token: ResolvedToken }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-high-risk font-bold cursor-help border-b border-dashed border-high-risk">
            {token.translation}
            <AlertTriangle className="w-3 h-3 inline ml-0.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[240px] text-xs bg-destructive text-destructive-foreground border-destructive"
        >
          <p className="font-semibold mb-0.5">HIGH RISK</p>
          <p>{token.highRiskWarning}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FinalOutput({ result, copied, onCopy }: { result: ParseResult | null; copied: boolean; onCopy: () => void }) {

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
        <FlaskConical className="w-8 h-8 opacity-30" />
        <p className="text-sm">Enter a SIG to begin parsing</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {result.hasHighRisk && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-destructive/15 text-high-risk border border-high-risk/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            High Risk Detected
          </span>
        )}
        {result.hasUnresolved && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" />
            Unresolved Tokens
          </span>
        )}
        {!result.hasHighRisk && !result.hasUnresolved && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Clean — No Flags
          </span>
        )}
        {result.inputMode === 'hl7' && result.hl7Extraction && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" />
            {result.hl7Extraction.segment}-{result.hl7Extraction.fieldIndex}
          </span>
        )}
      </div>

      {/* Final SIG rendered */}
      <div className="bg-muted/50 rounded-lg p-3 border border-border min-h-[56px]">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Framework SIG</p>
        <div className="text-[14px] font-medium leading-relaxed flex flex-wrap gap-x-1.5 gap-y-0.5">
          {result.resolvedTokens.map((token, i) => (
            token.isHighRisk ? (
              <HighRiskToken key={i} token={token} />
            ) : token.unresolved ? (
              <span key={i} className="text-amber-500 italic">{token.translation}</span>
            ) : (
              <span key={i}>{token.translation}</span>
            )
          ))}
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={onCopy}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
          copied
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
        )}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy Standardized SIG'}
      </button>
    </div>
  );
}

export function WorkbenchView() {
  const [inputMode, setInputMode] = useState<InputMode>('hl7');
  const [rawInput, setRawInput] = useState(HL7_SAMPLE);
  const [drugName, setDrugName] = useState("");
  const [defaultSig, setDefaultSig] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dictionary, setDictionary] = useState<SigDictionaryEntry[]>([]);
  const [techRules, setTechRules] = useState<TechRule[]>([]);
  const [expansions, setExpansions] = useState<SigExpansion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const debouncedInput = useDebounce(rawInput, 300);
  const debouncedDrugName = useDebounce(drugName, 300);
  const debouncedDefaultSig = useDebounce(defaultSig, 300);
  const runCount = useRef(0);
  const resultRef = useRef<ParseResult | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dict, rules, exps] = await Promise.all([fetchAllSigEntries(), fetchAllTechRules(), fetchAllExpansions()]);
        setDictionary(dict);
        setTechRules(rules);
        setExpansions(exps);
      } catch (err) {
        toast.error('Failed to load dictionary or rules');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (loading || !debouncedInput.trim()) {
      setResult(null);
      resultRef.current = null;
      return;
    }
    runCount.current += 1;
    const parsed = runParser(debouncedInput, inputMode, dictionary, techRules, expansions, debouncedDrugName, debouncedDefaultSig);
    setResult(parsed);
    resultRef.current = parsed;
  }, [debouncedInput, debouncedDrugName, debouncedDefaultSig, inputMode, dictionary, techRules, expansions, loading]);

  const handleCopy = useCallback(async (silent = false) => {
    const current = resultRef.current;
    if (!current?.finalSig) return;
    try {
      await navigator.clipboard.writeText(current.finalSig);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      setCopied(true);
      if (!silent) toast.success('STANDARDIZED SIG COPIED TO CLIPBOARD');
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore on blur
    }
  }, []);

  useEffect(() => {
    const onBlur = () => handleCopy(true);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [handleCopy]);

  const handleModeChange = useCallback((mode: InputMode) => {
    setInputMode(mode);
    setRawInput(mode === 'hl7' ? HL7_SAMPLE : FREETEXT_SAMPLE);
  }, []);

  const handleClear = () => {
    setRawInput('');
    setResult(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mode selector bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/40 flex-shrink-0">
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {(['hl7', 'freetext'] as InputMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] font-medium transition-all',
                inputMode === mode
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mode === 'hl7' ? 'Raw HL7' : 'Free Text SIG'}
            </button>
          ))}
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading dictionary...
          </span>
        )}
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {dictionary.length} codes loaded · {techRules.filter((r) => r.enabled).length} rules · {expansions.filter((e) => e.enabled).length} expansions
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3 text-primary" />
            Live
          </span>
          <button
            onClick={handleClear}
            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 grid md:grid-cols-2 grid-cols-1 min-h-0">
        {/* Left — Input */}
        <div className="flex flex-col md:border-r border-r-0 border-b md:border-b-0 border-border min-h-0">
          <div className="flex flex-col gap-2 p-4 border-b border-border bg-card/10">
            <input
              type="text"
              placeholder="Drug Name (Optional)"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              className="px-3 py-1.5 text-sm bg-transparent border border-border rounded outline-none focus:border-primary/50"
            />
            <input
              type="text"
              placeholder="Default SIG (Optional)"
              value={defaultSig}
              onChange={(e) => setDefaultSig(e.target.value)}
              className="px-3 py-1.5 text-sm bg-transparent border border-border rounded outline-none focus:border-primary/50"
            />
          </div>
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/20 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {inputMode === 'hl7' ? 'Raw HL7 Input' : 'Free Text SIG Input'}
            </span>
          </div>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={inputMode === 'hl7'
              ? 'Paste raw HL7 message here...'
              : 'Enter free text SIG, e.g. "Take 1 tablet BID PRN"'
            }
            className={cn(
              'flex-1 resize-none p-4 bg-transparent outline-none text-foreground placeholder-muted-foreground/50 scrollbar-thin',
              'font-mono-tight'
            )}
            spellCheck={false}
          />
        </div>

        {/* Right — Output */}
        <div className="flex flex-col min-h-0 overflow-auto scrollbar-thin">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/20 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live Parsed Output
            </span>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-auto scrollbar-thin">
            {/* Step trace */}
            {result && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Execution Trace
                </p>
                {result.steps.map((step) => (
                  <TraceStepCard
                    key={step.step}
                    step={step}
                    defaultOpen={step.step === result.steps.length}
                  />
                ))}
              </div>
            )}

            {/* Final output */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-3">
                Final Standardized SIG
              </p>
              <FinalOutput result={result} copied={copied} onCopy={() => handleCopy(false)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
