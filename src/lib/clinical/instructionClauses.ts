/** Separate later actions and limits so their PRN/frequency words do not change the primary dose. */
export function splitSupplementalDirections(rawProse: string): { primary: string; supplemental?: string } {
  // Every action within an insulin scale belongs to that scale.
  if (/\bSLIDING[\s-]+SCALE\b/i.test(rawProse)) return { primary: rawProse.trim() };
  const actions = /\b(?:MAY\s+(?:GIVE|TAKE|ADMINISTER|USE|APPLY)|DO\s+NOT\b|NOT\s+TO\s+EXCEED|(?:MAXIMUM|MAX)\s+(?:OF\s+)?(?=\d)|(?:TAKE|GIVE|ADMINISTER)\s+(?=\d|ONE\b|TWO\b)|TAKE\s+FOR\s+(?:BLOOD|BP|SBP)\b|(?:X\s*|FOR\s+(?:UP\s+TO\s+)?)(?=\d+\s+DOSES\b)|APPLY\b|WORK\s+(?:IT\s+)?IN\b|ALLOW\s+(?:IT\s+)?TO\s+SIT\b|LEAVE\s+(?:IT\s+)?(?:ON|IN)\b|REMOVE\s+PER\s+SCHEDULE\b|RINSE\b|CAN\s+SHAMPOO\b|FOLLOW\s+(?:THE\s+)?(?:TAR|MAR)\b|DRINK\s+WITH\b|ALTERNAT(?:E|ES)\s+WITH\b|HOSPICE\s+RESIDENT\b|MIX(?:ED)?\b|DISSOLVE\s+IN\b|PUT\s+(?:IN|ON)\b|REPEAT\b|DISCONTINUE\s+(?:ONCE|IF|WHEN)\b|IF\b|CALL\b|NOTIFY\b)/gi;
  for (const match of rawProse.matchAll(actions)) {
    if (match.index === undefined || match.index === 0 || !rawProse.slice(0, match.index).trim()) continue;
    // Keep a hold condition and its notification together for the hold parser.
    if (/^(?:IF|CALL|NOTIFY)$/i.test(match[0]) && /\bHOLD\s+(?:IF|FOR|WHEN)?[^.;]*$/i.test(rawProse.slice(0, match.index))) continue;
    return {
      primary: rawProse.slice(0, match.index).trim().replace(/[.;,]+$/, '').replace(/\s+(?:AND|THEN)$/i, '').trim(),
      supplemental: rawProse.slice(match.index).trim(),
    };
  }
  return { primary: rawProse.trim() };
}

export function uppercaseDirections(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}
