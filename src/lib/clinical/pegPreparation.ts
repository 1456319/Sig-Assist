/** Recognize only the site's PEG 3350 17 g preparation. Other products/doses
 * retain their directions for review; explicit source dilution always wins. */
export function resolvePegPreparation(drug: string, prose: string, route?: string): {
  preparationTemplate: string; scheduleProse: string; preparationWasExplicit: boolean;
} | undefined {
  const brandedPacket = /^MIRALAX MIX[ -]IN PAX(?: ORAL)? PACKETS?$/.test(drug);
  const identity = drug.replace(/\/SCOOP\b/g, '').replace(/\bMIX-IN PAX\b/g, 'MIX IN PAX');
  if (!route || !/\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/.test(identity)
      || /\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/.test(identity)) return;
  const packet = /\b(?:PACKETS?|PKT)\b/.test(drug);
  if (packet ? (!brandedPacket && !/\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/.test(drug)) || !/^(?:GIVE|TAKE|ADMINISTER)\s+1\s+PACKET\b/.test(prose)
      : !/^(?:GIVE|TAKE|ADMINISTER)\s+17(?:\.0+)?\s*(?:GRAMS?|GMS?|G)\b/.test(prose)) return;
  const mix = prose.match(/\bMIX\s+(?:WITH|IN)\s+(4\s*-\s*8|[4-8])\s*(?:OZ|OUNCES?)\s+(?:OF\s+)?((?:WATER|JUICE)(?:\s+OR\s+(?:WATER|JUICE))?|LIQUID|BEVERAGE)\b/);
  const inLiquid = prose.match(/\bIN LIQUID\b/);
  const explicit = mix || inLiquid;
  const scheduleProse = explicit ? prose.replace(explicit[0], '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').trim() : prose;
  // Don't silently replace instructions outside this small recognized grammar.
  if (/\b(?:MIX|DISSOLVE|STIR|DILUTE|WATER|JUICE|BEVERAGE|OZ|OUNCES?|ML)\b/.test(scheduleProse)) return;
  const volume = mix ? mix[1].replace(/\s/g, '') : '8';
  const liquid = mix ? mix[2] : inLiquid ? 'LIQUID' : 'WATER';
  return { preparationTemplate: `MIX 17 GM (${packet ? '1 PACKET' : 'SEE INSIDE CAP'}) IN ${volume}OZ OF ${liquid} AND GIVE ${route}`,
    scheduleProse, preparationWasExplicit: !!mix };
}
