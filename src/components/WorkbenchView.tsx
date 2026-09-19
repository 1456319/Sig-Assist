import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TriangleAlert, ChevronDown, ChevronRight, Zap, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchAllSigEntries } from '../lib/sigDictionaryService';
import { fetchAllTechRules } from '../lib/techRulesService';
import { fetchAllExpansions } from '../lib/sigExpansionService';
import { runParser } from '../lib/parser';
import { SigReviewPanel } from './SigReviewPanel';
import { supabase } from '../lib/supabase';
import type { SigDictionaryEntry, TechRule, SigExpansion, ParseResult, InputMode, TraceStep } from '../lib/types';
import { toast } from 'sonner';
import { createTranslationDiagnostic, SessionDiagnosticSink, toGitHubIssueDraft } from '../lib/translationDiagnostics';
import type { TranslationDiagnostic } from '../lib/translationDiagnostics';
import { AbnormalityBanner } from './AbnormalityBanner';
import { MultiOrderCards } from './MultiOrderCards';
import { DiscrepancyPanel } from './DiscrepancyPanel';
import { translateClinicalSig } from '../lib/clinical/clinicalEngine';
import { parseInboundOrder } from '../lib/clinical/inboundParser';
import type { ClinicalSigResult, InboundOrder } from '../lib/clinical/types';

const HL7_SAMPLE = `MSH|^~\\&|DEMO|DEMO-FACILITY|DEMO-RECEIVER||20260918120000||RDE^O11^RDE_O11|DEMO-MSG|T|2.5
ORC|NW|DEMO-ORDER
RXO|DEMO^EXAMPLE MEDICATION|||||Take 1 tablet by mouth twice daily`;

const FREETEXT_SAMPLE = 'Take 1 tablet twice daily after meals prn';

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

function WorkbenchReview({ result, source }: { result: ParseResult; source: string }) {
  const [draft, setDraft] = useState(result.finalSig.toUpperCase());
  const [approved, setApproved] = useState<string>();
  const isUserEditedRef = useRef(false);
  const prevSuggestionRef = useRef(result.finalSig);

  useEffect(() => {
    if (result.finalSig !== prevSuggestionRef.current) {
      prevSuggestionRef.current = result.finalSig;
      if (!isUserEditedRef.current) {
        setDraft(result.finalSig.toUpperCase());
        setApproved(undefined);
      }
    }
  }, [result.finalSig]);

  return <SigReviewPanel source={source} suggestion={result.finalSig} draft={draft} approved={approved}
    unavailable={result.inputMode === 'hl7' && !!result.hl7Extraction?.warning}
    warnings={result.steps.flatMap(step => step.warnings)}
    onEdit={value => {
      isUserEditedRef.current = true;
      setDraft(value.toUpperCase());
      setApproved(undefined);
    }}
    onResetSuggestion={() => {
      isUserEditedRef.current = false;
      setDraft(result.finalSig.toUpperCase());
      setApproved(undefined);
    }}
    onApprove={setApproved} />;
}

export function WorkbenchView() {
  const [inputMode, setInputMode] = useState<InputMode>('freetext');
  const [rawInput, setRawInput] = useState('');
  const [dictionary, setDictionary] = useState<SigDictionaryEntry[]>([]);
  const [techRules, setTechRules] = useState<TechRule[]>([]);
  const [expansions, setExpansions] = useState<SigExpansion[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestDiagnostic, setLatestDiagnostic] = useState<TranslationDiagnostic | null>(null);
  
  const [drugName, setDrugName] = useState('');
  const [defaultSig, setDefaultSig] = useState('');
  
  const diagnosticSinkRef = useRef(new SessionDiagnosticSink());
  const diagnosticKeysRef = useRef(new Set<string>());

  useEffect(() => {
    async function load() {
      try {
        const [dict, rules, exps] = await Promise.all([fetchAllSigEntries(), fetchAllTechRules(), fetchAllExpansions()]);
        setDictionary(dict);
        setTechRules(rules);
        setExpansions(exps);
      } catch {
        toast.error('Failed to load dictionary or rules');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const result = useMemo(() => loading || !rawInput.trim() ? null
    : runParser(rawInput, inputMode, dictionary, techRules, expansions, drugName, defaultSig),
    [loading, rawInput, inputMode, dictionary, techRules, expansions, drugName, defaultSig]);

  const clinicalInbound = useMemo((): InboundOrder | null => {
    if (!rawInput.trim()) return null;
    const parsed = parseInboundOrder(rawInput);
    return {
      ...parsed,
      drugName: drugName.trim() || parsed.drugName,
      defaultSigTemplate: defaultSig.trim() || parsed.defaultSigTemplate,
    };
  }, [rawInput, drugName, defaultSig]);

  const clinicalResult = useMemo((): ClinicalSigResult | null => {
    if (!clinicalInbound) return null;
    try {
      return translateClinicalSig(clinicalInbound);
    } catch {
      return null;
    }
  }, [clinicalInbound]);

  const effectiveResult = useMemo(() => {
    if (!result) return null;
    if (clinicalResult?.primarySig) {
      return {
        ...result,
        finalSig: clinicalResult.primarySig,
      };
    }
    return result;
  }, [result, clinicalResult]);

  const source = JSON.stringify([rawInput, inputMode, drugName, defaultSig, effectiveResult]);

  useEffect(() => {
    if (!result?.sigEngineOrder || (!result.hasHighRisk && !result.hasUnresolved)) return;
    const key = `${result.rawInput}\n${result.finalSig}`;
    if (diagnosticKeysRef.current.has(key)) return;
    diagnosticKeysRef.current.add(key);
    const event = createTranslationDiagnostic(
      result.hasHighRisk ? 'blocked' : 'unaccepted-output',
      'manual',
      result.rawInput,
      result.sigEngineOrder.drug,
      result.finalSig,
      result.sigEngineOrder,
    );
    diagnosticSinkRef.current.record(event);
    setLatestDiagnostic(event);
  }, [result]);

  const openDiagnosticIssue = useCallback(() => {
    if (!latestDiagnostic) return;
    const draft = toGitHubIssueDraft(latestDiagnostic);
    const url = new URL('https://github.com/1456319/Sig-Assist/issues/new');
    url.searchParams.set('title', draft.title);
    url.searchParams.set('body', draft.body);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, [latestDiagnostic]);

  const handleModeChange = useCallback((mode: InputMode) => {
    setInputMode(mode);
  }, []);

  const handleClear = () => {
    setRawInput('');
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
            {!supabase ? 'Local mode · ' : ''}{dictionary.length} codes loaded · {techRules.filter((r) => r.enabled).length} rules · {expansions.filter((e) => e.enabled).length} expansions
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {latestDiagnostic && (
            <button
              onClick={openDiagnosticIssue}
              className="text-[10px] text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/10 transition-colors"
              title="Opens a redacted GitHub issue draft; GitHub submission still requires user confirmation."
            >
              Report translation issue
            </button>
          )}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3 text-primary" />
            Parser
          </span>
          <button className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted" onClick={() => setRawInput(inputMode === 'hl7' ? HL7_SAMPLE : FREETEXT_SAMPLE)}>Example</button>
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
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card/20 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {inputMode === 'hl7' ? 'Raw HL7 Input' : 'Free Text SIG Input'}
            </span>
          </div>

          {inputMode === 'freetext' && (
            <div className="px-4 py-3 border-b border-border bg-card/10 space-y-3 flex-shrink-0">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Drug Name</label>
                <input
                  type="text"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Lisinopril 10mg"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Default SIG (Optional)</label>
                <input
                  type="text"
                  value={defaultSig}
                  onChange={(e) => setDefaultSig(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Take 1 tablet daily"
                />
              </div>
            </div>
          )}

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
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                Review and correct SIG
              </p>

              {clinicalResult && clinicalResult.abnormalities.length > 0 && (
                <AbnormalityBanner findings={clinicalResult.abnormalities} />
              )}

              {clinicalResult && clinicalResult.subOrders.length > 1 ? (
                <MultiOrderCards subOrders={clinicalResult.subOrders} />
              ) : effectiveResult ? (
                <WorkbenchReview key={`${inputMode}:${rawInput}:${effectiveResult.finalSig}`} result={effectiveResult} source={source} />
              ) : (
                <p className="text-sm text-muted-foreground">Enter original directions to prepare a draft for review.</p>
              )}

              <DiscrepancyPanel
                pon={clinicalInbound?.pon || 'MANUAL_ENTRY'}
                drugName={drugName || clinicalInbound?.drugName || 'UNKNOWN DRUG'}
                rawProse={clinicalInbound?.rawProse || rawInput}
                generatedSig={clinicalResult?.primarySig || result?.finalSig || ''}
                onDiscrepancySaved={() => {
                  toast.success('Discrepancy report recorded');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
