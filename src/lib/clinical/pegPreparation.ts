/** Site PEG 3350 preparation template. Source dilution, route, holds and
 * duration remain authoritative; combination bowel preparations are excluded. */
export function resolvePegPreparation(drug: string, prose: string, route?: string): {
  preparationTemplate: string; scheduleProse: string; preparationWasExplicit: boolean;
} | undefined {
  const identity = drug.replace(/\/SCOOP\b|\bMIX-IN PAX\b/gi, '');
  if (!route || !/\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/i.test(identity)
      || /\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/i.test(identity)) return;
  let clean = prose.toUpperCase().replace(/\*+/g, ' ').replace(/[–—]/g, '-')
    .replace(/\bIN(?=\d)/g, 'IN ').replace(/(LIQUIDS?|FLUIDS?|WATER)(?=HOLD\b)/g, '$1 ')
    .replace(/\s+/g, ' ').trim();
  const packet = /\b(?:PACKETS?|PKT)\b/.test(drug.toUpperCase()) || /^(?:GIVE|TAKE|ADMINISTER)\s+1\s+(?:PACKET|PKT)\b/.test(clean);
  const statedStrength = identity.match(/\b(\d+(?:\.\d+)?)\s*(?:GM|GRAMS?|G)\b/i);
  if (packet && statedStrength && Number(statedStrength[1]) !== 17) return;
  if (/\b(?:GMS?|GRAMS?|G)\s*\/\s*SCOOP\b/i.test(drug) && statedStrength && Number(statedStrength[1]) !== 17) return;
  const dose = packet
    ? /^(?:GIVE|TAKE|ADMINISTER)\s+(?:1\s+(?:PACKET|PKT)|17(?:\.0+)?\s*(?:GRAMS?|GMS?|G))\b/
    : /^(?:GIVE|TAKE|ADMINISTER)\s+(?:17(?:\.0+)?\s*(?:GRAMS?|GMS?|G)|(?:1\s+)?(?:CAPFULS?|CAPS?)|1\s+SCOOP)\b/;
  if (!dose.test(clean)) return;

  const liquid = '(?:FLUID(?:S)? OF CHOICE|FOC|(?:NON[ -]CARBONATED )?(?:LIQUIDS?|FLUIDS?|BEVERAGES?)|(?:APPLE |CRANBERRY |ORANGE )?JUICE|WATER|MILK)';
  const liquids = `${liquid}(?:(?:\\s*,\\s*(?:(?:OR|AND)\\s+)?|\\s+(?:OR|AND)\\s+)${liquid})*`;
  const measure = '(4\\s*(?:-|TO)\\s*8|[4-8]|120\\s*(?:-|TO)\\s*240|\\d+(?:\\.\\d+)?)\\s*(FLUID\\s*OUNCES?|FL\\s*OZ|OUNCES?|OZ|ML|MILLILITERS?)';
  const mixing = '(?:MIX(?:ED)?(?:\\s+TILL\\s+DISSOLVE)?|DISSOLVE|STIR|TAKE)(?:\\s+(?:1\\s+(?:PACKET|PKT|SCOOP|CAPFUL)|17\\s*(?:GMS?|GRAMS?)))?\\s+(?:WITH|IN|INTO)\\s*';
  const withVolume = new RegExp(`\\b${mixing}(${measure})\\s*(?:OF\\s+)?(${liquids})`, 'g');
  const parenthesized = new RegExp(`\\(IN LIQUID\\)\\s*(${measure})\\s*(?:OF\\s+)?(${liquids})`, 'g');
  const matches = [...clean.matchAll(withVolume), ...clean.matchAll(parenthesized)];
  if (matches.length > 1) return;
  let volume = '8', unit = 'OZ', beverage = 'WATER', explicit = false;
  if (matches.length) {
    const m = matches[0];
    volume = m[2].replace(/\s/g, '').replace('TO', '-');
    unit = /^(?:ML|MILLILITER)/.test(m[3]) ? 'ML' : 'OZ';
    const values = volume.split('-').map(Number);
    if (unit === 'OZ' && values.some(n => n < 4 || n > 8)) return;
    if (values.some(n => n <= 0) || values.length === 2 && values[0] > values[1]) return;
    beverage = m[4];
    clean = clean.slice(0, m.index) + ' ' + clean.slice(m.index! + m[0].length);
    explicit = true;
  } else {
    const withoutVolume = new RegExp(`\\b(?:MIX(?:ED)?|DISSOLVE|STIR)\\s+(?:WITH|IN|INTO)\\s+(?:(?:A )?(?:GLASS|CUP) OF )?(${liquids})\\b`);
    const m = clean.match(withoutVolume);
    if (m) { beverage = m[1]; clean = clean.replace(m[0], ' '); explicit = true; }
    else if (/\bIN LIQUID\b/.test(clean)) { beverage = 'LIQUID'; clean = clean.replace(/\(?\bIN LIQUID\b\)?/, ' '); explicit = true; }
  }
  // Remove repeated daily PRN wording only when it agrees with the source.
  const repeat = clean.match(/\bAND DRINK DAILY AS NEEDED FOR CONSTIPATION[.;]?/);
  if (repeat) {
    const primary = clean.slice(0, repeat.index);
    if (!/\b(?:EVERY 24 HOURS|ONE TIME A DAY|1 TIME A DAY|DAILY)\b/.test(primary)
        || !/\b(?:AS NEEDED|PRN)\b/.test(primary) || !/\bCONSTIPATION\b/.test(primary)) return;
    clean = clean.replace(repeat[0], ' ');
  }
  if (/\b(?:MIX|MIXED|DISSOLVE|STIR|DILUTE|WATER|JUICE|BEVERAGE|FLUIDS?|OZ|OUNCES?|ML|DRINK)\b/.test(clean)) return;
  clean = clean.replace(/\bAND\s+(?=HOLD\b|IN THE MORNING|EVERY|DAILY|BID|TID|QID|QAM|QPM|QHS|AS NEEDED|PRN|FOR)/g, '')
    .replace(/\s+-\s*(?=HOLD\b)/g, ' ').replace(/\s+/g, ' ').replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();
  beverage = beverage.replace(/FLUIDS? OF CHOICE/g, 'FOC').replace(/\s*,\s*/g, ',');
  return { preparationTemplate: `MIX 17 GM (${packet ? '1 PACKET' : 'SEE INSIDE CAP'}) IN ${volume}${unit} OF ${beverage} AND GIVE ${route}`,
    scheduleProse: clean, preparationWasExplicit: explicit };
}
