/** Recognize only the site's PEG 3350 17 g preparation. Other products/doses
 * retain their directions for review; explicit source dilution always wins. */
export function resolvePegPreparation(drug: string, prose: string, route?: string): {
  preparationTemplate: string; scheduleProse: string; preparationWasExplicit: boolean;
} | undefined {
  const identity = drug.replace(/\/SCOOP\b/g, '');
  if (!route || !/\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/.test(identity)
      || /\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/.test(identity)) return;

  // Clean decorative asterisks or markdown delimiters from prose
  const cleanProse = prose.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();

  // Formulation resolution:
  // If no formulation is specified in drug name, check for "PACKET" or "CAP" in sig.
  // If not specified in sig either, assume jar (238g jar with 'SEE INSIDE CAP').
  let isPacket = /\b(?:PACKETS?|PKT)\b/.test(drug);
  if (!isPacket && !/\b(?:POWDER|PWD|BOTTLE|JAR)\b/.test(drug)) {
    if (/\b(?:PACKETS?|PKT)\b/.test(cleanProse)) {
      isPacket = true;
    }
  }

  if (isPacket ? (!/\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/.test(drug) && !/\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/.test(cleanProse)) || !/^(?:GIVE|TAKE|ADMINISTER)\s+1\s+PACKET\b/.test(cleanProse)
      : !/^(?:GIVE|TAKE|ADMINISTER)\s+17(?:\.0+)?\s*(?:GRAMS?|GMS?|G)\b/.test(cleanProse)) return;

  const mix = cleanProse.match(/\bMIX\s+(?:WITH|IN)\s+(4\s*-\s*8|[4-8])\s*(?:OZ|OUNCES?)\s+(?:OF\s+)?((?:NON[- ]CARBONATED\s+)?(?:WATER|JUICE|LIQUID|BEVERAGE))\b/);
  const inLiquid = cleanProse.match(/\bIN LIQUID\b/);
  const explicit = mix || inLiquid;
  const scheduleProse = explicit ? cleanProse.replace(explicit[0], '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').trim() : cleanProse;
  // Don't silently replace instructions outside this small recognized grammar.
  if (/\b(?:MIX|DISSOLVE|STIR|DILUTE|WATER|JUICE|BEVERAGE|OZ|OUNCES?|ML)\b/.test(scheduleProse)) return;
  const volume = mix ? mix[1].replace(/\s/g, '') : '8';
  const liquid = mix ? mix[2].replace(/\s+/g, ' ').trim() : inLiquid ? 'LIQUID' : 'WATER';
  return { preparationTemplate: `MIX 17 GM (${isPacket ? '1 PACKET' : 'SEE INSIDE CAP'}) IN ${volume}OZ OF ${liquid} AND GIVE ${route}`,
    scheduleProse, preparationWasExplicit: !!mix };
}
