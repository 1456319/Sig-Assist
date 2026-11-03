import { extractIndicationToken, resolveIndicationToken } from './indicationEngine';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import type { AbnormalityFinding } from './types';

/**
 * Recognizes Lidocaine topical patches (specifically 4% and 5%).
 */
export function isLidocainePatch(drug: string): boolean {
  const upper = drug.toUpperCase();
  return (
    /\bLIDOCAINE\b/.test(upper) &&
    /\bPATCH\b/.test(upper) &&
    (/[45]\s*%/.test(upper) || /\b(?:4|5)\b/.test(upper))
  );
}

/**
 * Resolves Lidocaine patch orders:
 * - Appends "12ON" to the end of all Lidocaine patch SIGs.
 * - Removes any indication to remove after 12 hours (covered by the 12ON suffix).
 * - Translates "BID" to "QD" (applying once daily and removing at bedtime).
 * - Extracts application site and formats dose as `1PA TPCL [TO SITE] [FREQ] [PRN] [INDICATION] 12ON`.
 */
export function resolveLidocainePatch(
  drugName: string,
  rawProse: string,
  inboundIndication?: string
): { sig: string; abnormalities: AbnormalityFinding[] } | undefined {
  if (!isLidocainePatch(drugName)) return undefined;

  let prose = rawProse.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Remove 12-hour removal / cycle / bedtime removal instructions from prose
  prose = prose.replace(
    /\bON\s+(?:FOR\s+)?12\s*HOURS?(?:\s*(?:AND|&|,)?\s*OFF\s+(?:FOR\s+)?12\s*HOURS?)?\b/gi,
    ''
  );
  prose = prose.replace(
    /\b(?:AND\s+)?(?:PLEASE\s+)?(?:REMOVE|TAKE\s+OFF|LEAVE\s+OFF|OFF)\s+(?:FOR\s+|AFTER\s+)?12\s*HOURS?(?:\s+PRIOR\s+TO\s+PLACING\s+(?:A\s+)?NEW\s+PATCH)?\b/gi,
    ''
  );
  prose = prose.replace(
    /\b(?:AND\s+)?(?:PLEASE\s+)?(?:REMOVE|TAKE\s+OFF|LEAVE\s+OFF|OFF)\s+(?:AT\s+BEDTIME|AT\s+NIGHT|IN\s+THE\s+EVENING|BEFORE\s+BED)\b/gi,
    ''
  );
  prose = prose.replace(
    /\b(?:REMOVE|TAKE\s+OFF|LEAVE\s+OFF)\s+PRIOR\s+TO\s+PLACING\s+(?:A\s+)?NEW\s+PATCH\b/gi,
    ''
  );
  prose = prose.replace(/\s+/g, ' ').trim();

  // 2. When Lidocaine patches say "BID" or "Q12H", they indicate applying once daily and removing at bedtime.
  // BID/Q12H translates as QD for Lidocaine patches (4% and 5%) to prevent chemical/thermal burns.
  prose = prose.replace(
    /\b(?:BID|TWICE\s+(?:A\s+)?DAY|TWICE\s+DAILY|2\s+TIMES\s+(?:A\s+)?DAY|TWO\s+TIMES\s+(?:A\s+)?DAY|Q12H|Q\s*12\s*H|EVERY\s+12\s*HOURS?)\b/gi,
    'QD'
  );

  // 3. Extract patch count (default 1, supporting digits and spelled-out words)
  const wordToNum: Record<string, string> = {
    ONE: '1',
    TWO: '2',
    THREE: '3',
    FOUR: '4',
  };
  const countMatch = prose.match(/\b(\d+|ONE|TWO|THREE|FOUR)\s*PATCH(?:ES)?\b/i);
  let count = '1';
  if (countMatch) {
    const rawCount = countMatch[1].toUpperCase();
    count = wordToNum[rawCount] || rawCount;
  }
  const doseToken = `${count}PA`;

  // 4. Extract site token (introduced by TO)
  let siteToken: string | undefined;
  const siteMatch = prose.match(
    /\b(?:APPLY(?:\s+(?:\d+|ONE|TWO|THREE|FOUR)\s+PATCH(?:ES)?)?(?:\s+(?:TOPICALLY|TPCL|TRANSDERMALLY|TRANSDERMAL))?\s+TO|(?:TOPICALLY|TPCL|TRANSDERMALLY|TRANSDERMAL)\s+TO)\s+(.+?)(?=\s+(?:TOPICALLY|TPCL|TRANSDERMALLY|TRANSDERMAL|IN\s+THE|EVERY|DAILY|QAM|QPM|BID|QD|QHS|FOR|AS\s+NEEDED|PRN|AT\s+BEDTIME)\b|$)/i
  );

  if (siteMatch) {
    const cleanedSite = siteMatch[1]
      .replace(/^(?:TO|THE)\s+/i, '')
      .replace(/\s+(?:TO|THE)$/i, '')
      .trim();
    if (cleanedSite && !/^(?:A|AN|\d+|ONE|TWO|THREE|FOUR)\s*PATCH/i.test(cleanedSite)) {
      siteToken = `TO ${cleanedSite.toUpperCase()}`;
    }
  }

  // 5. Route token
  const routeToken = 'TPCL';

  // 6. Frequency & PRN
  const freqRes = resolveFrequencyAndSchedule(prose);
  let freqToken = freqRes.frequencyToken || 'QD';

  if (/\b(?:IN\s+THE\s+MORNING|QAM|EVERY\s+MORNING|MORNINGS?)\b/i.test(prose)) {
    freqToken = 'QAM';
  } else if (/\b(?:AT\s+BEDTIME|BEDTIME|QHS|NIGHTLY|AT\s+NIGHT)\b/i.test(prose)) {
    freqToken = 'QHS';
  } else if (/\b(?:IN\s+THE\s+EVENING|QPM|EVENINGS?)\b/i.test(prose)) {
    freqToken = 'QPM';
  }

  // 7. Indication
  const indicationToken =
    resolveIndicationToken(inboundIndication) || extractIndicationToken(prose);

  // 8. Assemble final parts: dose, route, site, frequency, prn, indication, 12ON
  const parts: string[] = [doseToken, routeToken];
  if (siteToken) parts.push(siteToken);

  const hasExplicitDaily =
    Boolean(freqRes.frequencyToken) ||
    /\b(?:DAILY|EVERY\s+DAY|EVERY\s+MORNING|IN\s+THE\s+MORNING|QAM|QPM|QHS|BID|TID|QID|NIGHTLY)\b/i.test(
      prose
    );

  if (hasExplicitDaily || !freqRes.prnToken) {
    parts.push(freqToken);
  }
  if (freqRes.prnToken) parts.push(freqRes.prnToken);
  if (indicationToken) parts.push(indicationToken);
  parts.push('12ON');

  const finalSig = parts.join(' ').replace(/\s+/g, ' ').trim();
  const abnormalities: AbnormalityFinding[] = [];

  return {
    sig: finalSig,
    abnormalities,
  };
}
