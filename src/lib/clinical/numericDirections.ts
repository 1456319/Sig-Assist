const numbers: Record<string, number> = {
  ZERO: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7,
  EIGHT: 8, NINE: 9, TEN: 10, ELEVEN: 11, TWELVE: 12, THIRTEEN: 13,
  FOURTEEN: 14, FIFTEEN: 15, SIXTEEN: 16, SEVENTEEN: 17, EIGHTEEN: 18,
  NINETEEN: 19, TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50, SIXTY: 60,
};
const words = Object.keys(numbers).join('|');
const units = '(?:TABLETS?|TABS?|CAPSULES?|CAPS?|LOZENGES?|DROPS?|GTT|SUPPOSITORIES|SUPPOSITORY|PACKETS?|VIALS?|PUFFS?|GRAMS?|GMS?|MG|MCG|MEQ|ML|MILLILITERS?|UNITS?|HOURS?|HRS?|DAYS?|WEEKS?|MONTHS?|TIMES?|DOSES?)';

/** Normalize numbers only beside dose/schedule units, never inside diagnoses. */
export function normalizeNumericDirections(prose: string): string {
  return prose.toUpperCase()
    .replace(/[¼½¾]/g, value => ({ '¼': ' 1/4', '½': ' 1/2', '¾': ' 3/4' })[value]!)
    .replace(/\b(ONE|TWO|THREE)\s+AND\s+(?:A\s+)?HALF(?=\s+(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b)/g, (_, n: string) => `${numbers[n]} 1/2`)
    .replace(/\b(?:ONE[- ]HALF|HALF(?:\s+A)?)(?=\s+(?:TABLETS?|TABS?|ML|MILLILITERS?)\b)/g, '0.5')
    .replace(/\bONE[- ]QUARTER(?=\s+(?:TABLETS?|TABS?)\b)/g, '1/4')
    .replace(/\bTHREE[- ]QUARTERS?(?=\s+(?:TABLETS?|TABS?)\b)/g, '3/4')
    .replace(new RegExp(`\\b(TWENTY|THIRTY|FORTY|FIFTY|SIXTY)[ -](ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)(?=\\s+${units}\\b)`, 'g'),
      (_, tens: string, ones: string) => String(numbers[tens] + numbers[ones]))
    .replace(new RegExp(`\\b(${words})(?=\\s+${units}\\b)`, 'g'), (_, n: string) => String(numbers[n]))
    .replace(/(?<![\d.])\.(\d+)(?=\s*(?:ML|MG|GM|GRAMS?|TABLETS?|TABS?|CAPSULES?)\b)/g, '0.$1')
    .replace(/\bQ\s*(\d+)\s*(?:HOURS?|HRS?|HR|H)\b/g, 'Q$1H')
    .replace(/\s+/g, ' ').trim();
}
