/** Separate later actions and limits so their PRN/frequency words do not change the primary dose. */
export function splitSupplementalDirections(rawProse: string, options?: { allowScaleActions?: boolean }): { primary: string; supplemental?: string } {
  // Every action within an insulin scale belongs to that scale.
  if (!options?.allowScaleActions && /\bSLIDING[\s-]+SCALE\b/i.test(rawProse)) return { primary: rawProse.trim() };
  const actions = /\b(?:THEN\s+(?:AS\s+NEEDED|PRN)\b|MAY\s+(?:GIVE|TAKE|ADMINISTER|USE|APPLY)|DO\s+NOT\b|NOT\s+TO\s+EXCEED|(?:MAXIMUM|MAX)\s+(?:OF\s+)?(?=\d)|(?:TAKE|GIVE|ADMINISTER)\s+(?=\d|ONE\b|TWO\b|HALF\b)|CHECK\b|MONITOR\b|WEIGH\b|RECHECK\b|TAKE\s+FOR\s+(?:BLOOD|BP|SBP)\b|(?:X\s*|FOR\s+(?:UP\s+TO\s+)?)(?=\d+\s+DOSES\b)|APPLY\b|WORK\s+(?:IT\s+)?IN\b|ALLOW\s+(?:IT\s+)?TO\s+SIT\b|LEAVE\s+(?:IT\s+)?(?:ON|IN)\b|REMOVE\s+PER\s+SCHEDULE\b|RINSE\b|CAN\s+SHAMPOO\b|FOLLOW\s+(?:THE\s+)?(?:TAR|MAR)\b|DRINK\s+WITH\b|ALTERNAT(?:E|ES)\s+WITH\b|HOSPICE\s+RESIDENT\b|MIX(?:ED)?\b|DISSOLVE\s+IN\b|PUT\s+(?:IN|ON)\b|REPEAT\b|DISCONTINUE\s+(?:ONCE|IF|WHEN)\b|IF\b|CALL\b|NOTIFY\b)/gi;
  for (const match of rawProse.matchAll(actions)) {
    if (match.index === undefined) continue;
    // This phase marker owns the following PRN words. An earlier comma and
    // course duration still belong to the routine phase, not the later action.
    if (/^THEN\s+(?:AS\s+NEEDED|PRN)\b/i.test(match[0])) return {
      primary: rawProse.slice(0, match.index).trim().replace(/[.;,]+$/, '').trim(),
      supplemental: rawProse.slice(match.index).trim(),
    };
    const beforeAction = rawProse.slice(0, match.index);
    if (!options?.allowScaleActions && (match.index === 0 || !beforeAction.trim())) continue;
    // A temporal prefix before the first administration belongs to the primary
    // dose (for example, 'At bedtime give half a tablet').
    if (!options?.allowScaleActions && /^(?:TAKE|GIVE|ADMINISTER)\s*$/i.test(match[0])
        && /^(?:AT|AFTER|BEFORE|DURING|IN\s+THE)\b/i.test(beforeAction.trim())
        && !/[.;,]|\b(?:TAKE|GIVE|ADMINISTER|INJECT|APPLY|INSTILL|INHALE|INSERT|USE|AND|THEN)\b/i.test(beforeAction)) continue;
    // Keep a hold condition and its notification together for the hold parser.
    if (/^(?:IF|CALL|NOTIFY)$/i.test(match[0]) && /\bHOLD\s+(?:IF|FOR|WHEN)?[^.;]*$/i.test(rawProse.slice(0, match.index))) continue;
    // A later action can begin with its own time, phase, or negation. Move that
    // entire clause together so its qualifier cannot be absorbed by the primary dose.
    const clauseBoundary = /[.;]|,|\b(?:AND\s+)?THEN\b|\bAND\b/gi;
    // Only an isolated scale tail can use its route as the start of a scoped
    // modifier, for example 'SQ BEFORE BREAKFAST GIVE HALF'.
    const boundaryPattern = options?.allowScaleActions
      ? /[.;]|,|\b(?:AND\s+)?THEN\b|\bAND\b|\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|INTRAMUSCULAR(?:LY)?|IM)\b/gi : clauseBoundary;
    let supplementalStart = match.index;
    const boundaries = [...beforeAction.matchAll(boundaryPattern)].map(boundary => ({
      start: boundary.index!, end: boundary.index! + boundary[0].length, text: boundary[0],
    }));
    if (options?.allowScaleActions) boundaries.unshift({ start: 0, end: 0, text: '' });
    for (const boundary of boundaries) {
      // AND may join the primary schedule ('morning and at bedtime do not
      // crush'). Only the new monitoring/half-dose actions use it as a boundary.
      if (/^AND$/i.test(boundary.text)
          && !/^(?:CHECK|MONITOR|WEIGH|RECHECK)$/i.test(match[0])
          && !/^(?:TAKE|GIVE|ADMINISTER)\s+HALF\b/i.test(rawProse.slice(match.index))) continue;
      const afterBoundary = boundary.end;
      const prefix = beforeAction.slice(afterBoundary).trimStart();
      if (/[.;]/.test(prefix)) continue;
      // A comma-terminated qualifier after a comma/conjunction is still part
      // of the primary schedule ('PO, BEFORE BREAKFAST, DO NOT CRUSH').
      if (/,/.test(prefix) && /^(?:,|AND|(?:AND\s+)?THEN)$/i.test(boundary.text)) continue;
      if (!/^(?:AT|AFTER|BEFORE|DURING|WHEN|UNLESS|UNTIL|ONLY|NEVER|NOT|IN\s+THE\s+(?:MORNING|AFTERNOON|EVENING)|FOR\s+(?:THE\s+NEXT\s+)?\d+\s+(?:DAYS?|WEEKS?|MONTHS?))\b/i.test(prefix)) continue;
      // THEN expresses a phase change and remains part of the retained clause.
      supplementalStart = /\bTHEN\b/i.test(boundary.text) ? boundary.start : afterBoundary;
      break;
    }
    return {
      primary: rawProse.slice(0, supplementalStart).trim().replace(/[.;,]+$/, '').replace(/\s+(?:AND|THEN)$/i, '').trim(),
      supplemental: rawProse.slice(supplementalStart).trim(),
    };
  }
  return { primary: rawProse.trim() };
}

export function uppercaseDirections(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}
