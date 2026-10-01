/** Separate later actions and limits so their PRN/frequency words do not change the primary dose. */
export function splitSupplementalDirections(rawProse: string): { primary: string; supplemental?: string } {
  const actions = /\b(?:MAY\s+(?:GIVE|TAKE|ADMINISTER|USE|APPLY)|(?:DO\s+NOT|NOT\s+TO)\s+EXCEED|(?:MAXIMUM|MAX)\s+(?:OF\s+)?(?=\d)|APPLY\b|WORK\s+(?:IT\s+)?IN\b|ALLOW\s+(?:IT\s+)?TO\s+SIT\b|LEAVE\s+(?:IT\s+)?(?:ON|IN)\b|RINSE\b|CAN\s+SHAMPOO\b)/gi;
  for (const match of rawProse.matchAll(actions)) {
    if (match.index === undefined || match.index === 0 || !rawProse.slice(0, match.index).trim()) continue;
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
