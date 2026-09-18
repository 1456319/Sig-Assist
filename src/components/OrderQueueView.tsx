import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { translateFreeTextSig } from '../lib/sigEngine';
import { cancelOrder, editDraft, orderKey, saveOrder, sourceStamp, type OrderSource, type QueueOrder } from '../lib/orderQueue';
import { copyBlockReason, reviewStamp } from '../lib/reviewPolicy';
import { useReviewSession } from '../hooks/use-review-session';
import { SigReviewPanel, reviewButtonClass, reviewInputClass } from './SigReviewPanel';

const emptySource: OrderSource = { facility: '', patientRef: '', pon: '', drug: '', directions: '' };
const sample: OrderSource = { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT', pon: 'DEMO-PON-001', drug: 'Example medication 10 mg tablet', directions: 'Take 1 tablet by mouth twice daily for 7 days.' };

export function OrderQueueView() {
  const { orders, setOrders, exclusions, policyRevision } = useReviewSession();
  const [form, setForm] = useState<OrderSource>(emptySource);
  const [selectedId, setSelectedId] = useState<string>();
  const [reviseId, setReviseId] = useState<string>();
  const [query, setQuery] = useState('');
  const selected = orders.find(order => order.id === selectedId);
  const selectedDirections = selected?.directions;
  const selectedDrug = selected?.drug;
  const selectedDefaultSig = selected?.defaultSig;
  const parsed = useMemo(() => selectedDirections === undefined ? undefined : translateFreeTextSig(selectedDirections, { drug: selectedDrug ?? '', defaultSig: selectedDefaultSig }), [selectedDirections, selectedDrug, selectedDefaultSig]);
  const filtered = orders.filter(order => [order.pon, order.facility, order.patientRef].some(value => value.toLowerCase().includes(query.toLowerCase())));

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const { sig } = translateFreeTextSig(form.directions, { drug: form.drug, defaultSig: form.defaultSig });
      const next = saveOrder(orders, form, sig, reviseId);
      setOrders(next);
      setSelectedId(orderKey(form));
      setForm(emptySource);
      setReviseId(undefined);
      toast.success(next === orders ? 'This exact order is already in the queue.' : 'Order saved for review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the order.');
    }
  }

  function updateSelected(update: (order: QueueOrder) => QueueOrder) {
    setOrders(items => items.map(order => order.id === selectedId ? update(order) : order));
  }

  function status(order: QueueOrder) {
    if (order.cancelled) return 'Cancelled';
    const stamp = reviewStamp(sourceStamp(order), order.draft, exclusions, policyRevision);
    if (copyBlockReason(sourceStamp(order), order.draft, exclusions, order.approved, false, policyRevision)) return 'Needs review';
    return order.copied === stamp ? 'Copied' : 'Reviewed';
  }

  return <div className="p-4 md:p-6 space-y-5 max-w-[1500px] mx-auto">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div>
        <h2 className="text-xl font-semibold">Order review queue</h2>
        <p className="text-sm text-muted-foreground mt-1">Manual PON matching · local session · Iguana is not connected</p>
        <p className="text-xs text-muted-foreground mt-1">Orders stay in memory until you clear or reload this tab. They are not uploaded.</p>
      </div>
      <button className={reviewButtonClass} disabled={!orders.length} onClick={() => {
        if (!window.confirm('Clear all orders and review history from this tab?')) return;
        setOrders([]); setSelectedId(undefined); setReviseId(undefined); setForm(emptySource);
      }}>Clear orders</button>
    </div>
    <details className="rounded-lg border border-border bg-card p-4" open>
      <summary className="cursor-pointer font-medium">{reviseId ? 'Revise original directions' : 'Add an order'}</summary>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          {(['facility', 'patientRef', 'pon'] as const).map(field => <label key={field} className="text-sm space-y-1">
            <span>{field === 'patientRef' ? 'Patient reference' : field === 'pon' ? 'PON from Framework' : 'Facility / source'}</span>
            <input required readOnly={!!reviseId} className={reviewInputClass} value={form[field]} onChange={event => setForm(value => ({ ...value, [field]: event.target.value }))} />
          </label>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm space-y-1"><span>Drug / strength as ordered</span><input className={reviewInputClass} value={form.drug} onChange={event => setForm(value => ({ ...value, drug: event.target.value }))} /></label>
          <label className="block text-sm space-y-1"><span>Default SIG template (optional blending)</span><input className={reviewInputClass} placeholder="e.g. DISSOLVE 1 PACKET IN 8 OZ WATER AND GIVE PO QD" value={form.defaultSig ?? ''} onChange={event => setForm(value => ({ ...value, defaultSig: event.target.value }))} /></label>
        </div>
        <label className="block text-sm space-y-1"><span>Original nurse directions</span><textarea required rows={3} className={reviewInputClass} value={form.directions} onChange={event => setForm(value => ({ ...value, directions: event.target.value }))} /></label>
        <div className="flex gap-2 flex-wrap">
          <button type="submit" className={`${reviewButtonClass} bg-primary text-primary-foreground`}>{reviseId ? 'Save new revision' : 'Add to review queue'}</button>
          <button type="button" className={reviewButtonClass} onClick={() => { setReviseId(undefined); setForm({ ...sample }); }}>Fill synthetic example</button>
          {reviseId && <button type="button" className={reviewButtonClass} onClick={() => { setReviseId(undefined); setForm(emptySource); }}>Discard source edit</button>}
        </div>
      </form>
    </details>
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
      <section aria-label="Orders" className="space-y-3">
        <input aria-label="Search orders by PON, facility or patient reference" placeholder="Find PON, facility or patient…" className={reviewInputClass} value={query} onChange={event => setQuery(event.target.value)} />
        <p className="text-xs text-muted-foreground">{orders.length} orders · {orders.filter(order => status(order) === 'Needs review').length} need review</p>
        <ul className="space-y-2">{filtered.map(order => <li key={order.id}><button onClick={() => setSelectedId(order.id)} aria-pressed={selectedId === order.id} className={`w-full text-left rounded-lg border p-3 ${selectedId === order.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
          <span className="block font-mono font-semibold break-all">{order.pon}</span>
          <span className="block text-xs text-muted-foreground break-all">{order.facility} · {order.patientRef}</span>
          <span className="block text-xs mt-2">Revision {order.revision} · {status(order)}</span>
        </button></li>)}</ul>
        {!filtered.length && <p className="text-sm text-muted-foreground">No orders to display.</p>}
      </section>
      <section aria-label="Selected order review" className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5 space-y-4">
        {selected && parsed ? <>
          <div className="flex justify-between flex-wrap gap-2">
            <h3 className="font-semibold break-all">PON {selected.pon} · revision {selected.revision}</h3>
            <span className="text-sm">{status(selected)}</span>
          </div>
          <p className="text-sm break-all">{selected.facility} · {selected.patientRef} · {selected.drug || 'Drug not supplied'}</p>
          <div className="rounded-md border border-border p-3">
            <h4 className="text-xs text-muted-foreground mb-2">Original directions · unchanged</h4>
            <p className="whitespace-pre-wrap break-words">{selected.directions}</p>
          </div>
          <div className="flex gap-2">
            <button className={reviewButtonClass} disabled={selected.cancelled} onClick={() => {
              setReviseId(selected.id);
              setForm({ facility: selected.facility, patientRef: selected.patientRef, pon: selected.pon, drug: selected.drug, directions: selected.directions, defaultSig: selected.defaultSig });
              updateSelected(order => ({ ...order, approved: undefined, copied: undefined }));
            }}>Revise source</button>
            <button className={reviewButtonClass} disabled={selected.cancelled} onClick={() => {
              if (window.confirm('Mark this order cancelled? Copying will be disabled.')) {
                updateSelected(cancelOrder);
                if (reviseId === selected.id) { setReviseId(undefined); setForm(emptySource); }
              }
            }}>Cancel order</button>
          </div>
          <SigReviewPanel key={`${selected.id}:${selected.revision}`} source={sourceStamp(selected)} suggestion={parsed.sig}
            draft={selected.draft} approved={selected.approved} unavailable={selected.cancelled || reviseId === selected.id}
            warnings={parsed.order.issues.map(issue => `${issue.severity.toUpperCase()}: ${issue.message}`)}
            onEdit={draft => updateSelected(order => editDraft(order, draft))}
            onResetSuggestion={() => updateSelected(order => editDraft(order, parsed.sig))}
            onApprove={approved => updateSelected(order => ({ ...order, approved, copied: undefined }))}
            onCopied={stamp => updateSelected(order => order.approved === stamp && reviewStamp(sourceStamp(order), order.draft, exclusions, policyRevision) === stamp ? { ...order, copied: stamp } : order)} />
          {selected.previousSources.length > 0 && <details><summary className="cursor-pointer text-sm">Previous source revisions ({selected.previousSources.length})</summary>
            {selected.previousSources.map((source, index) => <div key={index} className="border-t border-border mt-2 pt-2 text-sm"><p>Revision {index + 1} · {source.drug}</p><p className="whitespace-pre-wrap">{source.directions}</p></div>)}
          </details>}
        </> : <div className="py-12 text-center text-muted-foreground"><p>Select an order to compare, correct and review its SIG.</p><p className="text-sm mt-2">Use the synthetic example to try the full workflow.</p></div>}
      </section>
    </div>
  </div>;
}
