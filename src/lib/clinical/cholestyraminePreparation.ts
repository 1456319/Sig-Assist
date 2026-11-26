/** The reported site template applies to a single 4 g light packet taken orally. */
export function resolveCholestyraminePreparation(drug: string, prose: string, route: string) {
  if (route !== 'PO' || !/\bCHOLESTYRAMINE\b/.test(drug) || !/\bLIGHT\b/.test(drug)
    || !/\b(?:PACKET|PKT)\b/.test(drug) || !/\b4(?:\.0+)?\s*(?:GM|G)\b/.test(drug)
    || !/^(?:GIVE|TAKE|ADMINISTER)\s+1\s+(?:PACKET|PKT)\b/.test(prose)) return;
  // An explicit preparation or drug-separation instruction remains authoritative.
  if (/\b(?:MIX|MIXED|DISSOLVE|STIR|DILUTE|WATER|JUICE|OZ|OUNCES?|ML|OTHER\s+(?:ORAL\s+)?(?:DRUGS|MEDICATIONS)|HOURS?\s+(?:BEFORE|AFTER))\b/.test(prose)) return;
  return {
    preparationTemplate: 'DIS 1 PACKET IN 4OZ OF H20 AND GIVE PO',
    preparationInstructions: '(FOR OPTIMAL EFFICACY, GIVE OTHER ORAL DRUGS 1 HOUR BEFORE OR 4 HOURS AFTER CHOLESTYRAMINE)',
  };
}
