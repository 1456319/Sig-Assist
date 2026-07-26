import type { SigExpectation } from './sigComparison';

export interface SigRegressionFixture {
  name: string;
  drug: string;
  userEntry: string;
  expectation: SigExpectation;
}

// These are executable, data-only fixtures. Add every newly discovered facility
// variant here before adding a parser rule.
export const sigRegressionFixtures: SigRegressionFixture[] = [
  { name: 'scheduled tablet', drug: 'PROTONIX 40MG TABLET', userEntry: 'Give 1 tablet by mouth one time a day for GERD', expectation: { acceptable: ['1T PO QD FGERD'] } },
  { name: 'concentration math', drug: 'LIRAGLUTIDE INJ 18MG/3ML', userEntry: 'Inject 1.8 mg subcutaneously one time a day for type 2 diabetes', expectation: { acceptable: ['INJ 0.3ML (1.8MG) SQ QD FDM2'] } },
  { name: 'PRN duration order', drug: 'GUAIASORB DM S/F LQ 100-10/5ML', userEntry: 'Give 10 ml by mouth every 6 hours as needed for Cough for 14 Days', expectation: { acceptable: ['ADM 10ML PO Q6H PRN FCOU X14D'] } },
  { name: 'cut date stripped', drug: 'CEPHALEXIN TAB 500MG', userEntry: 'Give 1 tablet by mouth every 12 hours for cellulitis until 07/30/2026 20:59', expectation: { acceptable: ['1T PO Q12H FCEL'] } },
  { name: 'site synonym variants', drug: 'TOPICAL PRODUCT', userEntry: 'Apply topically to left buttock and peri-area twice daily', expectation: { acceptable: ['AP TPCL TO LT BUTTOCK AND PERI-AREA BID', 'AP TPCL TO BUTTOCK/PERI-AREA BID', 'AP TPCL TO PERI-AREA & LT BUTTOCK BID'], requiredTokens: ['AP', 'TPCL', 'BID'] } },
];
