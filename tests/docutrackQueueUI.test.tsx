import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DocuTrackQueue, EdcWarning } from '../src/components/DocuTrackQueue';
import { edcMatch, type EdcSnapshot } from '../src/lib/docutrackQueue';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows a confirmed folder snapshot and clears matched warnings if the next scan fails', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({ ok:true, capture:{ headers:['Document Type','Text 3','Document #'],rows:[['E-DC Order','TEST:009','001234']],unreadable:0 } })})
    .mockResolvedValueOnce({ok:true,json:async()=>({ok:false,error:'Wrong folder'})});
  vi.stubGlobal('fetch', fetch);
  function Panel() {
    const [snapshot,onCapture] = useState<EdcSnapshot>();
    const match = snapshot && edcMatch(snapshot.documents,{pon:'TEST:009'},[]);
    return <><DocuTrackQueue snapshot={snapshot} onCapture={onCapture} onFind={() => {}}/>{match && snapshot && <EdcWarning match={match} snapshot={snapshot}/>}</>;
  }
  render(<Panel/>); fireEvent.click(screen.getByText('Show E-DC PONs'));
  expect(await screen.findByText('This PON has a matching E-DC in DocuTrack!')).toBeDefined();
  expect(within(screen.getByRole('table')).getByText('001234')).toBeDefined();
  expect(fetch.mock.calls[0][0]).toBe('/connector/desktop/docutrack');
  fireEvent.click(screen.getByText('Show E-DC PONs'));
  expect(await screen.findByText(/Wrong folder/)).toBeDefined(); expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByText('This PON has a matching E-DC in DocuTrack!')).toBeNull();
});
