import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { translateFreeTextSig } from '../lib/sigEngine';
import { cancelOrder, editDraft, orderKey, saveOrder, sourceStamp, type OrderSource, type QueueOrder } from '../lib/orderQueue';
import { copyBlockReason, reviewStamp } from '../lib/reviewPolicy';
import { useReviewSession } from '../hooks/use-review-session';
import { SigReviewPanel, reviewButtonClass, reviewInputClass } from './SigReviewPanel';
import { parseInboundOrder } from '../lib/clinical/inboundParser';
import { HL7_SAMPLE } from '../lib/clinical/fixtures';
import { getCachedClinicalSig, translateClinicalSig } from '../lib/clinical/clinicalEngine';
import { AbnormalityBanner } from './AbnormalityBanner';
import { MultiOrderCards } from './MultiOrderCards';
import { traceLogger } from '../lib/diagnostics/traceLogger';
import { addDemoOrders, DEMO_ORDERS } from '../lib/demoOrders';
import { DiscrepancyPanel } from './DiscrepancyPanel';
import { DiscrepancyArchive } from './DiscrepancyArchive';
import { IguanaConnectorPanel } from './IguanaConnectorPanel';

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
  function getOrderTraceId(order: QueueOrder): string {
    return `ORD_${order.id}_R${order.revision}`;
  }

  const clinicalResult = useMemo(() => {
    if (!selected) return undefined;
    const traceId = getOrderTraceId(selected);
    return getCachedClinicalSig({
      id: selected.id,
      pon: selected.pon,
      drugName: selected.drug,
      rawProse: selected.directions,
      defaultSigTemplate: selected.defaultSig,
      sourceFormat: 'manual_text',
      traceId
    });
  }, [selected]);

  useEffect(() => {
    if (selected) {
      traceLogger.info('ui', 'OrderQueueView', 'Selected queue order evaluated', {
        id: selected.id,
        pon: selected.pon,
        drug: selected.drug,
        revision: selected.revision
      }, undefined, getOrderTraceId(selected));
    }
  }, [selected]);

  const filtered = orders.filter(order => [order.pon, order.facility, order.patientRef].some(value => value.toLowerCase().includes(query.toLowerCase())));

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const orderId = orderKey(form);
      const traceId = `ORD_${orderId}_R${reviseId ? 'REV' : '1'}`;
      const clinical = translateClinicalSig({
        id: orderId,
        pon: form.pon,
        drugName: form.drug,
        rawProse: form.directions,
        defaultSigTemplate: form.defaultSig,
        sourceFormat: 'manual_text',
        traceId
      });
      const sig = clinical.primarySig;
      const next = saveOrder(orders, form, sig, reviseId);
      setOrders(next);
      setSelectedId(orderKey(form));
      setForm(emptySource);
      setReviseId(undefined);
      traceLogger.info('ui', 'OrderQueueView', 'Order saved for review in queue', { pon: form.pon, drug: form.drug, sig }, undefined, traceId);
      toast.success(next === orders ? 'This exact order is already in the queue.' : 'Order saved for review.');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      traceLogger.error('ui', 'OrderQueueView', 'Failed to save order to queue', { pon: form.pon }, { name: err.name, message: err.message });
      toast.error(err.message || 'Unable to save the order.');
    }
  }

  function updateSelected(update: (order: QueueOrder) => QueueOrder) {
    setOrders(items => items.map(order => order.id === selectedId ? update(order) : order));
  }

  const orderStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      if (order.intakeHold) { map.set(order.id, 'Intake needs investigation'); continue; }
      if (order.cancelled) {
        map.set(order.id, 'Cancelled');
        continue;
      }
      try {
        const clinical = getCachedClinicalSig({
          id: order.id,
          pon: order.pon,
          drugName: order.drug,
          rawProse: order.directions,
          defaultSigTemplate: order.defaultSig,
          sourceFormat: 'manual_text',
          traceId: getOrderTraceId(order),
        });
        if (clinical.subOrders.length > 1) {
          let allApproved = true;
          let allCopied = true;
          for (const sub of clinical.subOrders) {
            const draftSig = order.subOrderDrafts?.[sub.id] ?? sub.suggestedSig;
            const approval = order.subOrderApprovals?.[sub.id];
            if (!approval) {
              allApproved = false;
              allCopied = false;
              break;
            }
            const block = copyBlockReason(sub.suggestedSig, draftSig, exclusions, approval, false, policyRevision);
            if (block) {
              allApproved = false;
              allCopied = false;
              break;
            }
            if (!order.subOrderCopied?.[sub.id] || order.subOrderCopied[sub.id] !== approval) {
              allCopied = false;
            }
          }
          if (!allApproved) {
            map.set(order.id, 'Needs review');
          } else {
            map.set(order.id, allCopied ? 'Copied' : 'Reviewed');
          }
          continue;
        }
      } catch {
        // fallback to single order logic
      }

      const stamp = reviewStamp(sourceStamp(order), order.draft, exclusions, policyRevision);
      if (copyBlockReason(sourceStamp(order), order.draft, exclusions, order.approved, false, policyRevision)) {
        map.set(order.id, 'Needs review');
      } else {
        map.set(order.id, order.copied === stamp ? 'Copied' : 'Reviewed');
      }
    }
    return map;
  }, [orders, exclusions, policyRevision]);

  const status = (order: QueueOrder) => orderStatusMap.get(order.id) ?? 'Needs review';

  return <div className="p-4 md:p-6 space-y-5 max-w-[1500px] mx-auto">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div>
        <h2 className="text-xl font-semibold">Order review queue</h2>
        <p className="text-sm text-muted-foreground mt-1">Local review queue · manual entry or read-only Iguana intake</p>
        <p className="text-xs text-muted-foreground mt-1">Orders are saved in browser cache or your connected folder and restored after reload. Clear orders removes the saved queue.</p>
      </div>
      <button className={reviewButtonClass} disabled={!orders.length} onClick={() => {
        if (!window.confirm('Clear all orders and review history from this tab and its saved queue?')) return;
        setOrders([]); setSelectedId(undefined); setReviseId(undefined); setForm(emptySource);
      }}>Clear orders</button>
    </div>
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2" aria-label="Demo workflow">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div><h3 className="font-semibold text-sm">Try the demonstration</h3><p className="text-sm text-muted-foreground">Five synthetic orders: scheduled dosing, morning/bedtime split, taper, PRN, and hold parameters.</p></div>
        <button className={`${reviewButtonClass} bg-primary text-primary-foreground`} onClick={() => {
          setOrders(current => addDemoOrders(current));
          setSelectedId(orderKey(DEMO_ORDERS[0]));
          setReviseId(undefined); setForm(emptySource); setQuery('');
          toast.success('Demo queue loaded. Select an order, compare directions, edit, review and copy.');
        }}>Load demo queue</button>
      </div>
      <p className="text-xs text-muted-foreground">Suggestions require human review. Match the PON in Framework before copying.</p>
    </section>
    <IguanaConnectorPanel onSelect={id => { setSelectedId(id); setReviseId(undefined); setForm(emptySource); }} />
    <DiscrepancyArchive />
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
          <button type="button" className={reviewButtonClass} onClick={() => {
            const parsed = parseInboundOrder(HL7_SAMPLE);
            setReviseId(undefined);
            setForm({
              facility: 'HL7-FACILITY',
              patientRef: 'HL7-PATIENT',
              pon: parsed.pon,
              drug: parsed.drugName,
              directions: parsed.rawProse,
              defaultSig: parsed.defaultSigTemplate || '',
            });
          }}>Fill from HL7 fixture</button>
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
        {selected ? <>
          <div className="flex justify-between flex-wrap gap-2">
            <h3 className="font-semibold break-all">PON {selected.pon} · revision {selected.revision}</h3>
            <span className="text-sm">{status(selected)}</span>
          </div>
          <p className="text-sm break-all">{selected.facility} · {selected.patientRef} · {selected.drug || 'Drug not supplied'}</p>
          {selected.intakeHold && <p role="alert" className="text-sm text-amber-400">{selected.intakeHold}</p>}
          {selected.iguana && <details className="rounded-md border border-border p-3" open>
            <summary className="cursor-pointer text-sm font-medium">Incoming prescription fields</summary>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm mt-2">
              <div><dt className="text-muted-foreground">NDC / strength</dt><dd>{selected.iguana.ndc || 'Not supplied'} / {selected.iguana.strength || 'Not supplied'}</dd></div>
              <div><dt className="text-muted-foreground">Dose / route / frequency</dt><dd>{[selected.iguana.dose, selected.iguana.doseUnit, selected.iguana.route, selected.iguana.frequency].filter(Boolean).join(' · ') || 'Not supplied'}</dd></div>
              <div><dt className="text-muted-foreground">Administration times</dt><dd>{selected.iguana.administrationTimes.join(', ') || 'Not supplied'}</dd></div>
              <div><dt className="text-muted-foreground">Start / effective date</dt><dd>{selected.iguana.startDate || 'Not supplied'} / {selected.iguana.effectiveDate || 'Not supplied'}</dd></div>
              <div><dt className="text-muted-foreground">Resident reference field</dt><dd>{selected.iguana.patientRefType}</dd></div>
              <div><dt className="text-muted-foreground">SCRIPT MessageID / source</dt><dd className="break-all">{selected.iguana.messageId} · {selected.iguana.channel || selected.iguana.sender}</dd></div>
            </dl>
          </details>}
          <div className="rounded-md border border-border p-3">
            <h4 className="text-xs text-muted-foreground mb-2">Original directions · unchanged</h4>
            <p className="whitespace-pre-wrap break-words">{selected.directions}</p>
          </div>
          <div className="flex gap-2">
            <button className={reviewButtonClass} disabled={selected.cancelled || reviseId === selected.id} onClick={() => {
              setReviseId(selected.id);
              setForm({ facility: selected.facility, patientRef: selected.patientRef, pon: selected.pon, drug: selected.drug, directions: selected.directions, defaultSig: selected.defaultSig, iguana: selected.iguana });
              updateSelected(order => ({
                ...order,
                approved: undefined,
                copied: undefined,
                subOrderApprovals: undefined,
                subOrderCopied: undefined
              }));
              traceLogger.info('ui', 'OrderQueueView', 'Technician started source revision', { id: selected.id, pon: selected.pon }, undefined, getOrderTraceId(selected));
            }}>Revise source</button>
            <button className={reviewButtonClass} disabled={selected.cancelled} onClick={() => {
              if (window.confirm('Mark this order cancelled? Copying will be disabled.')) {
                updateSelected(cancelOrder);
                if (reviseId === selected.id) { setReviseId(undefined); setForm(emptySource); }
                traceLogger.warn('ui', 'OrderQueueView', 'Technician marked order cancelled', { id: selected.id, pon: selected.pon }, undefined, getOrderTraceId(selected));
              }
            }}>Cancel order</button>
          </div>

          {clinicalResult && clinicalResult.abnormalities.length > 0 && (
            <AbnormalityBanner findings={clinicalResult.abnormalities} />
          )}

          {clinicalResult && clinicalResult.subOrders.length > 1 ? (
            <MultiOrderCards
              key={`${selected.id}:${selected.revision}`}
              primarySig={clinicalResult.primarySig}
              subOrders={clinicalResult.subOrders}
              unavailable={selected.cancelled || !!selected.intakeHold || reviseId === selected.id}
              traceId={getOrderTraceId(selected)}
              initialDrafts={selected.subOrderDrafts}
              initialApprovals={selected.subOrderApprovals}
              onDraftChange={(subOrderId, draftSig) => {
                updateSelected(order => {
                  const nextApprovals = { ...(order.subOrderApprovals || {}) };
                  delete nextApprovals[subOrderId];
                  return {
                    ...order,
                    subOrderDrafts: { ...(order.subOrderDrafts || {}), [subOrderId]: draftSig },
                    subOrderApprovals: nextApprovals
                  };
                });
              }}
              onApprovalChange={(subOrderId, stamp) => {
                updateSelected(order => {
                  const nextApprovals = { ...(order.subOrderApprovals || {}) };
                  if (stamp) nextApprovals[subOrderId] = stamp;
                  else delete nextApprovals[subOrderId];
                  return { ...order, subOrderApprovals: nextApprovals };
                });
              }}
              onCopySubOrder={(subOrder, draftSig, stamp) => {
                if (selected.cancelled || selected.intakeHold || reviseId === selected.id) return;
                const effectiveStamp = stamp || reviewStamp(subOrder.suggestedSig, draftSig, exclusions, policyRevision);
                updateSelected(order => ({
                  ...order,
                  subOrderCopied: { ...(order.subOrderCopied || {}), [subOrder.id]: effectiveStamp }
                }));
              }}
            />
          ) : (
            <SigReviewPanel key={`${selected.id}:${selected.revision}`} source={sourceStamp(selected)} suggestion={clinicalResult?.primarySig || parsed?.sig || selected.draft}
              draft={selected.draft} approved={selected.approved} unavailable={selected.cancelled || !!selected.intakeHold || reviseId === selected.id}
              warnings={parsed?.order.issues.map(issue => `${issue.severity.toUpperCase()}: ${issue.message}`) || []}
              onEdit={draft => updateSelected(order => editDraft(order, draft))}
              onResetSuggestion={() => updateSelected(order => editDraft(order, clinicalResult?.primarySig || parsed?.sig || selected.draft))}
              onApprove={approved => updateSelected(order => ({ ...order, approved, copied: undefined }))}
              onCopied={stamp => updateSelected(order => order.approved === stamp && reviewStamp(sourceStamp(order), order.draft, exclusions, policyRevision) === stamp ? { ...order, copied: stamp } : order)} />
          )}
          <DiscrepancyPanel key={`report:${selected.id}:${selected.revision}`}
            pon={selected.pon} drugName={selected.drug} rawProse={selected.directions}
            generatedSig={clinicalResult?.primarySig || parsed?.sig || ''}
            currentDraft={clinicalResult && clinicalResult.subOrders.length > 1
              ? clinicalResult.subOrders.map(sub => `${sub.label}: ${selected.subOrderDrafts?.[sub.id] ?? sub.suggestedSig}`).join('\n')
              : selected.draft}
            context={{ source: 'queue', traceId: getOrderTraceId(selected), revision: selected.revision,
              iguana: selected.iguana,
              defaultSigTemplate: selected.defaultSig, policyRevision, exclusions,
              abnormalities: clinicalResult?.abnormalities,
              subOrders: clinicalResult?.subOrders.map(sub => ({ id: sub.id, label: sub.label,
                suggestedSig: sub.suggestedSig, draftSig: selected.subOrderDrafts?.[sub.id] ?? sub.suggestedSig })) }}
            onDiscrepancySaved={() => toast.success('Discrepancy report recorded')} />
          {selected.previousSources.length > 0 && <details><summary className="cursor-pointer text-sm">Previous source revisions ({selected.previousSources.length})</summary>
            {selected.previousSources.map((source, index) => <div key={index} className="border-t border-border mt-2 pt-2 text-sm"><p>Revision {index + 1} · {source.drug}</p><p className="whitespace-pre-wrap">{source.directions}</p></div>)}
          </details>}
        </> : <div className="py-12 text-center text-muted-foreground"><p>Select an order to compare, correct and review its SIG.</p><p className="text-sm mt-2">Use the synthetic example to try the full workflow.</p></div>}
      </section>
    </div>
  </div>;
}
