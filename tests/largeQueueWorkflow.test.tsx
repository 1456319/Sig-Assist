import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSession } from '../src/components/ReviewSession';
import { OrderQueueView } from '../src/components/OrderQueueView';
import * as clinicalEngine from '../src/lib/clinical/clinicalEngine';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';
beforeEach(() => { localStorage.clear(); _resetCitrixStorageAdapterForTesting(); });
afterEach(() => { cleanup(); _resetCitrixStorageAdapterForTesting(); vi.restoreAllMocks(); });
it('hydrates and filters a queue larger than the clinical cache without translating pending rows; selected orders still translate', async () => {
  const adapter = getCitrixStorageAdapter();
  await adapter.writeQueue(Array.from({ length: 1200 }, (_, i) => ({
    id: 'SYN-' + i, pon: 'SYNTHETIC-PON-' + i, facility: 'DEMO', patientRef: 'DEMO-' + i,
    drugName: 'Synthetic medication', rawProse: 'Take 1 tablet by mouth daily.',
    suggestedSig: '1T PO QD', draftSig: '1T PO QD', isReviewed: false, status: 'pending' as const,
  })), { immediate: true });
  const translate = vi.spyOn(clinicalEngine, 'getCachedClinicalSig');
  render(<ReviewSession><OrderQueueView /></ReviewSession>);
  await screen.findByText(/1200 matching · 1200 saved orders · 1200 need review/);
  await adapter.flushPendingWrites();
  expect(translate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('SYNTHETIC-PON-1199'));
  await screen.findByLabelText('Final SIG · editable, uppercase');
  await waitFor(() => expect(translate).toHaveBeenCalled());
  expect(translate.mock.calls.every(([order]) => order.id === 'SYN-1199')).toBe(true);
});
