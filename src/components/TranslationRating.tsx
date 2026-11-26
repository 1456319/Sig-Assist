import { useEffect, useRef, useState } from 'react';
import { captureFeedbackCorrection, findTranslationFeedback, saveTranslationFeedback } from '../lib/translationFeedback';
import { feedbackKey, feedbackState, type ExplanationMode, type TranslationFeedbackSnapshot } from '../lib/translationFeedbackModel';

export function TranslationRating({ input, disabled = false }: { input: TranslationFeedbackSnapshot; disabled?: boolean }) {
  return <Rating key={feedbackKey(input)} input={input} disabled={disabled} />;
}
function Rating({ input, disabled }: { input: TranslationFeedbackSnapshot; disabled: boolean }) {
  const [score, setScore] = useState<number>();
  const [mode, setMode] = useState<ExplanationMode>();
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const changed = useRef(false);
  const latest = useRef(input); latest.current = input;
  useEffect(() => {
    let active = true;
    void findTranslationFeedback(latest.current).then(report => {
      if (active && !changed.current && report) {
        const state = feedbackState(report); setScore(state.rating); setMode(state.mode); setComment(state.comment);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function save(event: Parameters<typeof saveTranslationFeedback>[1]) {
    setStatus('Saving feedback…');
    try { const result = await saveTranslationFeedback(input, event); setStatus(result ? 'Feedback saved. Continue processing.' : 'Thanks — no discrepancy created.'); }
    catch { setStatus('Feedback not saved to reports yet. Continue processing; use Retry pending feedback in the report list.'); }
  }
  const choose = (rating: number) => {
    changed.current = true; setScore(rating); setMode(undefined);
    void save({ kind: 'rating', rating, draft: input.currentDraft });
  };
  const choices: Array<[ExplanationMode, string]> = (score || 10) > 5
    ? [['obvious', 'The error is obvious'], ['brief', 'I will briefly explain the error']]
    : [['none', "I don't want to explain the error"], ['brief', 'I will briefly describe the error'],
      ['detailed', 'I will give an in-depth explanation of the error'], ['later', 'I will explain the error later']];
  return <section aria-label="Optional translation rating" className="mt-2 space-y-2 text-xs">
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Rate automatic translation from 1 to 10">
      <span className="mr-1">Translation quality (optional)</span>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(rating => <button key={rating} type="button" disabled={disabled}
        aria-label={`Rate translation ${rating} out of 10`} aria-pressed={score === rating} title={`${rating}/10`}
        className={`rounded px-1 py-1 text-lg leading-none disabled:opacity-40 ${score !== undefined && rating <= score ? 'text-amber-500' : 'text-muted-foreground'}`}
        onClick={() => choose(rating)}>★<span className="text-[10px]">{rating}</span></button>)}
      {score !== undefined && <strong>{score}/10</strong>}
    </div>
    {score !== undefined && score < 10 && <>
      <div className="flex flex-wrap gap-2">{choices.map(([value, label]) => <button key={value} type="button" disabled={disabled}
        aria-pressed={mode === value} className={`rounded border px-2 py-1 ${mode === value ? 'border-primary bg-primary/10' : 'border-border'}`}
        onClick={() => { setMode(value); void save({ kind: 'explanation', mode: value, draft: input.currentDraft }); }}>{label}</button>)}</div>
      {(mode === 'brief' || mode === 'detailed') && <div className="space-y-1">
        <textarea aria-label="Translation error explanation" rows={mode === 'detailed' ? 5 : 2} value={comment} disabled={disabled}
          className="w-full rounded border bg-background p-2" placeholder="Optional — describe what was wrong, or keep working."
          onChange={e => setComment(e.target.value)} />
        <button type="button" className="rounded border px-2 py-1" disabled={disabled || !comment.trim()}
          onClick={() => void save({ kind: 'comment', mode, comment, draft: input.currentDraft, resolved: true })}>Save explanation</button>
      </div>}
      {mode === 'later' && <p>Saved in the deferred explanation queue with the original source and translation.</p>}
    </>}
    {status && <p role={status.includes('not saved') ? 'alert' : 'status'}>{status}</p>}
  </section>;
}

export { captureFeedbackCorrection };
