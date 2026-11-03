/** Recognize only the site's PEG 3350 17 g preparation. Other products/doses
 * retain their directions for review; explicit source dilution always wins. */
export function resolvePegPreparation(drug: string, prose: string, route?: string): {
  preparationTemplate: string; scheduleProse: string; preparationWasExplicit: boolean;
} | undefined {
  const identity = drug.replace(/\/SCOOP\b/gi, '');
  if (!route || !/\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/i.test(identity)
      || /\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/i.test(identity)) return;

  const drugHasPacket = /\b(?:PACKETS?|PKT)\b/i.test(drug);
  const proseHasPacket = /\b(?:PACKETS?|PKT)\b/i.test(prose);
  const proseHasCap = /\b(?:CAP|CAPS?|CAPFUL|SEE INSIDE CAP)\b/i.test(prose);

  // If no formulation is specified, look for "PACKET" or "CAP" in SIG to determine
  // if jar or packet formulation is to be dispensed. If not specified in SIG,
  // assume 238-gram jar is being dispensed (not packets).
  let packet = false;
  if (drugHasPacket) {
    packet = true;
  } else if (proseHasPacket) {
    packet = true;
  } else if (proseHasCap) {
    packet = false;
  } else {
    packet = false;
  }

  if (packet) {
    if (drugHasPacket && !/\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/i.test(drug)) return;
    if (!/^(?:GIVE|TAKE|ADMINISTER)\s+1\s+PACKET\b/i.test(prose)) return;
  } else {
    if (!/^(?:GIVE|TAKE|ADMINISTER)\s+(?:17(?:\.0+)?\s*(?:GRAMS?|GMS?|G)|(?:1\s+)?(?:CAPFUL?|CAP)|1\s+SCOOP)\b/i.test(prose)) return;
  }

  const mixVol = prose.match(/\b(?:MIX|DISSOLVE|STIR)\s+(?:WITH|IN|INTO)\s+(?:(?:A\s+)?MINIMUM\s+OF\s+)?(4\s*(?:-|TO)\s*8|[4-8])\s*(?:OZ|OUNCES?|FL\s*OZ|FLUID\s*OUNCES?)\s*(?:OF\s+)?((?:[A-Z-]+(?:\s+[A-Z-]+)*\s+)?(?:WATER|JUICE|LIQUID|BEVERAGE))\b/i);
  const mixNoVol = !mixVol ? prose.match(/\b(?:MIX|DISSOLVE|STIR)\s+(?:WITH|IN|INTO)\s*(?:OF\s+)?(?!\d|\b(?:A\s+)?(?:MINIMUM|MAXIMUM|FEW|SEVERAL|COUPLE)\b)((?:[A-Z-]+(?:\s+[A-Z-]+)*\s+)?(?:WATER|JUICE|LIQUID|BEVERAGE))\b/i) : null;
  const inLiquid = !mixVol && !mixNoVol ? prose.match(/\bIN LIQUID\b/i) : null;

  const explicit = mixVol || mixNoVol || inLiquid;
  let scheduleProse = prose;
  if (explicit) {
    scheduleProse = prose.replace(explicit[0], '').replace(/\s+/g, ' ').trim();
    scheduleProse = scheduleProse.replace(/\bAND\s+(?=IN THE MORNING|EVERY|DAILY|BID|TID|QID|QAM|QPM|QHS|AS NEEDED|PRN|FOR)\b/i, '');
    scheduleProse = scheduleProse.replace(/^(?:AND\s+)+/i, '').replace(/(?:\s+AND)+$/i, '').trim();
    scheduleProse = scheduleProse.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();
  }

  // Don't silently replace instructions outside this small recognized grammar.
  if (/\b(?:MIX|DISSOLVE|STIR|DILUTE|WATER|JUICE|BEVERAGE|OZ|OUNCES?|ML)\b/i.test(scheduleProse)) return;

  let volume = '8';
  let liquid = 'WATER';
  if (mixVol) {
    volume = mixVol[1].replace(/\s/g, '').replace(/TO/i, '-');
    liquid = mixVol[2].toUpperCase().trim();
  } else if (mixNoVol) {
    volume = '8';
    liquid = mixNoVol[1].toUpperCase().trim();
  } else if (inLiquid) {
    volume = '8';
    liquid = 'LIQUID';
  }

  return {
    preparationTemplate: `MIX 17 GM (${packet ? '1 PACKET' : 'SEE INSIDE CAP'}) IN ${volume}OZ OF ${liquid} AND GIVE ${route}`,
    scheduleProse,
    preparationWasExplicit: !!(mixVol || mixNoVol)
  };
}
