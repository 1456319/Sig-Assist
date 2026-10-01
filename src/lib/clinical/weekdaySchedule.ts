const DAY = '(?:MON(?:DAY)?S?|TUE(?:S(?:DAY)?)?S?|WED(?:NESDAY)?S?|THU(?:R(?:S(?:DAY)?)?)?S?|FRI(?:DAY)?S?|SAT(?:URDAY)?S?|SUN(?:DAY)?S?)';
const DAY_NUMBERS: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

/** Parse one complete list/range. Never shorten a qualified schedule to its first day. */
export function resolveWeekdaySchedule(upper: string): { token?: string; unsupported?: boolean } {
  const schedule = upper.split(/\b(?:FOR|AS\s+NEEDED|PRN|HOLD)\b/)[0];
  if (!new RegExp(`\\b${DAY}\\b`).test(schedule)) return {};
  const start = schedule.match(new RegExp(`\\b(?:EVERY|ON)\\s+(${DAY})\\b`));
  if (!start || start.index === undefined) return { unsupported: true };
  if (/\b(?:OTHER|ALTERNAT(?:E|ING)|EXCEPT|UNLESS|EVERY\s+\d|TWICE|TWO\s+TIMES|THREE\s+TIMES|FOUR\s+TIMES|BID|TID|QID|Q\d+H|BEDTIME)\b/.test(schedule)) return { unsupported: true };

  const tail = schedule.slice(start.index + start[0].length);
  const range = tail.match(new RegExp(`^\\s*(?:-|TO\\b|THROUGH\\b)\\s*(${DAY})\\b`));
  const days: number[] = [DAY_NUMBERS[start[1].slice(0, 3)]];
  let consumed = 0;
  if (range) {
    const last = DAY_NUMBERS[range[1].slice(0, 3)];
    let next = days[0];
    while (next !== last) { next = next === 7 ? 1 : next + 1; days.push(next); }
    consumed = range[0].length;
  } else {
    const nextDay = new RegExp(`^\\s*[,/&]?\\s*(?:AND\\s+)?(?:EVERY\\s+|ON\\s+)?(${DAY})\\b`);
    while (true) {
      const next = tail.slice(consumed).match(nextDay);
      if (!next) break;
      days.push(DAY_NUMBERS[next[1].slice(0, 3)]);
      consumed += next[0].length;
    }
  }
  // Any remaining weekday, range, or unparsed modifier would otherwise be lost.
  const remainder = tail.slice(consumed).replace(/^[\s,.;]+/, '');
  if (remainder && !/^(?:IN\s+THE\s+(?:MORNING|EVENING)|DURING\s+(?:DAY|EVENING|NIGHT)\s+SHIFT)\s*$/.test(remainder)) return { unsupported: true };

  const suffix = [...new Set(days)].sort().join('');
  const shift = schedule.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  const period = /\b(?:EVENING|QPM)\b/.test(schedule) ? 'QPM' : /\b(?:MORNING|QAM)\b/.test(schedule) ? 'QAM' : 'QD';
  // The bundled reference contains all 126 nonempty proper day subsets for
  // QD/QAM/QPM; all seven days use the corresponding daily code.
  const token = suffix === '1234567' ? (shift ? 'QD' : period) : `${shift ? 'QD' : period}DAY${suffix}`;
  return { token: shift ? `${token} (DURING ${shift[1]} SHIFT)` : token };
}
