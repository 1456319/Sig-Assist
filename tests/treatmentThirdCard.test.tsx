import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MultiOrderCards } from '../src/components/MultiOrderCards';
import { ReviewContext } from '../src/hooks/use-review-session';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('renders, reviews and copies the retained third treatment card', async () => {
  const result = translateClinicalSig({
    id: 'synthetic-treatment-cards', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName: 'Zinc oxide cream',
    rawProse: 'Cleanse left heel with saline, pat dry, apply cream daily and as needed AND apply to right elbow as needed for itching.',
  });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<ReviewContext.Provider value={{ orders: [], setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 }}>
    <MultiOrderCards primarySig={result.primarySig} subOrders={result.subOrders} />
  </ReviewContext.Provider>);
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
  expect(screen.getByText(/Review and copy each of the 3 order cards/)).toBeTruthy();
  const copy = screen.getByRole('button', { name: 'Copy Reviewed SIG (Order 3 of 3 (PRN))' }) as HTMLButtonElement;
  expect(copy.disabled).toBe(true);
  fireEvent.click(screen.getAllByLabelText('Reviewed and approved for FrameworkLTC')[2]);
  fireEvent.click(copy);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('APPLY TO RIGHT ELBOW AS NEEDED FOR ITCHING.'));
});
