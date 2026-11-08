/** Recognize only the site's PEG 3350 17 g preparation. Other products/doses
 * retain their directions for review; explicit source dilution always wins. */
export function resolvePegPreparation(drug: string, prose: string, route?: string): {
  preparationTemplate: string; scheduleProse: string; preparationWasExplicit: boolean;
} | undefined {
  const identity = drug.replace(/\/SCOOP\b/gi, '');
  if (!route || !/\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/i.test(identity)
      || /\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/i.test(identity)) return;

  const cleanProse = prose.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();

  const drugHasPacket = /\b(?:PACKETS?|PKT)\b/i.test(drug);
  const proseHasPacket = /\b(?:PACKETS?|PKT)\b/i.test(cleanProse);
  const proseHasCap = /\b(?:CAPS?|CAPFULS?|SEE INSIDE CAP)\b/i.test(cleanProse);

  // If no formulation is specified in drug, look for "PACKET" or "CAP" in SIG.
  // If not specified in SIG, default to 238-gram bulk jar (packet = false).
  const packet = drugHasPacket || (proseHasPacket && !proseHasCap);

  if (packet) {
    if (drugHasPacket && !/\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/i.test(drug)) return;
    if (!/^(?:GIVE|TAKE|ADMINISTER)\s+1\s+PACKET\b/i.test(cleanProse)) return;
  } else {
    if (!/^(?:GIVE|TAKE|ADMINISTER)\s+(?:17(?:\.0+)?\s*(?:GRAMS?|GMS?|G)|(?:1\s+)?(?:CAPFULS?|CAPS?)|1\s+SCOOP)\b/i.test(cleanProse)) return;
  }

  const mixVol = cleanProse.match(/\b(?:MIX|DISSOLVE|STIR)\s+(?:WITH|IN|INTO)\s+(?:(?:A\s+)?MINIMUM\s+OF\s+)?(4\s*(?:-|TO)\s*8|[4-8])\s*(?:OZ|OUNCES?|FL\s*OZ|FLUID\s*OUNCES?)\s*(?:OF\s+)?((?:[A-Z-]+(?:\s+[A-Z-]+)*\s+)?(?:WATER|JUICE|LIQUID|BEVERAGE))\b/i);
  const mixNoVol = !mixVol ? cleanProse.match(/\b(?:MIX|DISSOLVE|STIR)\s+(?:WITH|IN|INTO)\s*(?:OF\s+)?(?!\d|\b(?:A\s+)?(?:MINIMUM|MAXIMUM|FEW|SEVERAL|COUPLE)\b)(?:(?:A\s+)?(?:GLASS|CUP)\s+(?:OF\s+)?)?((?:[A-Z-]+(?:\s+[A-Z-]+)*\s+)?(?:WATER|JUICE|LIQUID|BEVERAGE))\b/i) : null;
  const inLiquid = !mixVol && !mixNoVol ? cleanProse.match(/\bIN LIQUID\b/i) : null;

  const explicit = mixVol || mixNoVol || inLiquid;
  let scheduleProse = cleanProse;
  if (explicit) {
    scheduleProse = cleanProse.replace(explicit[0], '').replace(/\s+/g, ' ').trim();
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
