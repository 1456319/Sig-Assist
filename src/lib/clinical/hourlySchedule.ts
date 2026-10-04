import { SIG_CODE_REFERENCE } from './sigCodeReference';
import { normalizeNumericDirections } from './numericDirections';

// Numeric-looking codes can encode ranges: Q23H means every 2–3 hours.
// Use a compact code only when the root dictionary confirms the exact interval.
export function hourlySchedule(hours: string): string {
  const count = Number(hours);
  const code = `Q${count}H`;
  const expansion = SIG_CODE_REFERENCE[code];
  return count > 0 && expansion && new RegExp(`^EVERY ${count} HOURS?$`).test(normalizeNumericDirections(expansion))
    ? code : `EVERY ${hours} HOURS`;
}
