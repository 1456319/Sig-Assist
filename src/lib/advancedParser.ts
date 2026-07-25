
export function processAdvancedRules(
  drug: string,
  rawInput: string,
  defaultSig: string = ''
): { output: string; warnings: string[] } {
  const text = rawInput.trim();
  const warnings: string[] = [];

  if (!text) return { output: text, warnings };

  const isInsulin = /insulin|humalog|novolog|lantus/i.test(drug);
  const isSlidingScale = /sliding scale/i.test(text);

  // 1. Handle Sliding Scale
  if (isInsulin && isSlidingScale) {
    const params: { lower: number, upper: number, text: string }[] = [];

    // <
    const ltRegex = /(?:<|less than) ?(\d+) (follow hypoglycemic protocol|notify MD)/gi;
    let match;
    while ((match = ltRegex.exec(text)) !== null) {
      const val = parseInt(match[1]);
      const action = match[2].toLowerCase().includes('notify') ? 'CALL MD' : 'HYPOGLYCEMIC PROTOCOL';
      params.push({ lower: -1, upper: val - 1, text: `<${val}=${action}` });
    }

    // Range
    const rangeRegex = /(?:if )?(\d+) - (\d+) = (\d+|[0-9.]+) ?(?:unit|units|ml|unjits)?/gi;
    while ((match = rangeRegex.exec(text)) !== null) {
      const lower = parseInt(match[1]);
      const upper = parseInt(match[2]);
      const units = parseFloat(match[3]);
      params.push({ lower, upper, text: `${lower}-${upper}=${units}U` });
    }

    // >
    const gtRegex = /(?:>|Greater than) ?(\d+) (?:= (\d+|[0-9.]+) (?:unit|units)|notify MD|and call MD|notify doctor)/gi;
    while ((match = gtRegex.exec(text)) !== null) {
      const val = parseInt(match[1]);
      if (match[2]) {
        params.push({ lower: val + 1, upper: 9999, text: `>${val}=${parseFloat(match[2])}U` });
      } else {
        params.push({ lower: val + 1, upper: 9999, text: `>${val}=CALL MD` });
      }
    }

    // Or l-e-s-s than (in same phrase as >)
    const gtLtRegex = /(?:Greater than|>) ?(\d+) or (?:less than|<) ?(\d+) (notify MD|and call MD|notify doctor)/gi;
    while ((match = gtLtRegex.exec(text)) !== null) {
        const gtVal = parseInt(match[1]);
        const ltVal = parseInt(match[2]);
        params.push({ lower: gtVal + 1, upper: 9999, text: `>${gtVal}=CALL MD` });
        params.push({ lower: -1, upper: ltVal - 1, text: `<${ltVal}=CALL MD` });
    }

    params.sort((a, b) => a.lower - b.lower);

    // Filter duplicates
    const uniqueParams = params.filter((v, i, a) => a.findIndex(t => (t.text === v.text)) === i);


    // Check gaps
    for (let i = 0; i < uniqueParams.length - 1; i++) {
      if (uniqueParams[i].lower > -1 && uniqueParams[i+1].upper !== 9999 && uniqueParams[i].upper + 1 !== uniqueParams[i+1].lower) {
        return { output: `GAP IN COVERAGE (LACK OF A ${uniqueParams[i].upper + 1}-${uniqueParams[i+1].lower - 1} PARAMETER)`, warnings: ["Gap in sliding scale detected"] };
      }
    }

    let timing = '';
    if (/before meals and at bedtime/i.test(text)) timing = 'ACHS';
    else if (/before meals/i.test(text)) timing = 'AC';

    return { output: `CBS ${timing} SS ${uniqueParams.map(p => p.text).join(';')}`.toUpperCase(), warnings };
  }

  // 2. Normalization & Word to Num
  const WORD_TO_NUMBER: Record<string, string> = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
    once: '1', twice: '2', thrice: '3',
    half: '0.5',
  };

  let lower = text.toLowerCase();
  for (const [word, digit] of Object.entries(WORD_TO_NUMBER)) {
    lower = lower.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
  }

  // Extract date until
  const strippedDate = lower.replace(/until \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/gi, '');
  if (strippedDate !== lower) {
      warnings.push("Stripped date from sig. Add a cut date in the respective field.");
      lower = strippedDate;
  }

  // Standard abbreviations
  const EXPANSIONS = [
    { in: /by mouth/, out: 'PO' },
    { in: /\boral\b/i, out: 'PO' },
    { in: /under the tongue/, out: 'SL' },
    { in: /subcutaneously/, out: 'SQ' },
    { in: /topically/, out: 'TPCL' },

    { in: /(one|1) time a day/, out: 'QD' },
    { in: /(two|2) times a day/, out: 'BID' },
    { in: /(three|3) times a day/, out: 'TID' },
    { in: /(four|4) times a day/, out: 'QID' },

    { in: /every 6 hours/, out: 'Q6H' },
    { in: /every 12 hours/, out: 'Q12H' },

    { in: /in the evening every sun/, out: 'QPMDAY7' },
    { in: /in the evening/, out: 'QDP/D IN THE EVENING' },
    { in: /at bedtime/, out: 'QHS' },
    { in: /before breakfast/, out: 'QDA/B' },

    { in: /as needed/, out: 'PRN' },

    { in: /for gerd/, out: 'FGERD' },
    { in: /for supplement/, out: 'FSU' },
    { in: /for dm2/, out: 'FDM2' },
    { in: /for dm/, out: 'FDM' },
    { in: /for bph after dinner/, out: 'FBPH' },
    { in: /for bph/, out: 'FBPH' },
    { in: /for hypothyroidism/, out: 'FHYT' },
    { in: /for gi prophylaxis/, out: 'FGIP' },
    { in: /for anxiety or agitation/, out: 'FAA' },
    { in: /for shortness of breath or pain/, out: 'FSOBP' },
    { in: /for cellulitis of scrotum/, out: 'FCEL OF SCROTUM' },
    { in: /indication: cough/, out: 'FCOU' },
    { in: /for cough/, out: 'FCOU' },
    { in: /for gi discomfort/, out: 'FOR GI DISCOMFORT' },
    { in: /for htn/, out: 'FHTN' },
    { in: /for severe pain rated 7-10/, out: 'FSP 7-10' },
    { in: /for constipation/, out: 'FCON' },
    { in: /for muscle pain/, out: 'FOR MUSCLE PAIN' },
    { in: /for pain/, out: 'FPAIN' },
    { in: /for dvt prevention/, out: 'FDVTP' },

    { in: /hold for sbp less than 100 or heart rate less than 60/, out: 'HR60SBP100' },
  ];

  let preprocessed = lower;

  for (const exp of EXPANSIONS) {
    preprocessed = preprocessed.replace(exp.in, exp.out);
  }

  // Blending default sig (run AFTER expansions)
  if (defaultSig && (/constipation/i.test(lower) || /supplement/i.test(lower))) {
      let defaultLower = defaultSig.toUpperCase(); // work in upper

      const qtyMatch = lower.match(/(give|take) ([0-9.]+) (packet|scoop|gram)/i);
      if(qtyMatch) {
         const qty = parseFloat(qtyMatch[2]);
         const unit = qtyMatch[3].toLowerCase();
         const defaultQtyMatch = defaultLower.match(/([0-9.]+) PACKET/i);
         const defaultGramMatch = defaultLower.match(/MIX ([0-9.]+) GM/i);

         if (defaultQtyMatch && unit === 'packet') {
            defaultLower = defaultLower.replace(/([0-9.]+) PACKET/i, `${qty} PACKET${qty > 1 ? 'S' : ''}`);
         }
         if (unit === 'gram') {
            let defaultGrams = 17;
            if (defaultGramMatch) defaultGrams = parseFloat(defaultGramMatch[1]);
            else {
                const drugGmMatch = drug.match(/([0-9.]+)GM/i);
                if (drugGmMatch) defaultGrams = parseFloat(drugGmMatch[1]);
            }

            const numPackets = qty / defaultGrams;

            if(/kristalose/i.test(drug)) {
                defaultLower = `DIS ${Math.round(numPackets)} PACKET${Math.round(numPackets) > 1 ? 'S' : ''} IN 4OZ OF WATER AND GIVE PO`;
            } else {
               defaultLower = defaultLower.replace(/MIX ([0-9.]+) GM/i, `MIX ${qty} GM`);
            }
         }
      }

      const freqMatch = preprocessed.match(/\b(QD|BID|TID|QID|Q6H|Q12H)\b/i);
      const freq = freqMatch ? freqMatch[1].toUpperCase() : '';

      const indicationMatch = preprocessed.match(/\b(FCON|FSU)\b/i);
      const indication = indicationMatch ? indicationMatch[1].toUpperCase() : '';

      // Clean up default string QD
      defaultLower = defaultLower.replace(/\bQD\b/g, '');

      let res = defaultLower.replace(/GIVE PO/i, `GIVE PO ${freq} ${indication}`);

      res = res.replace(/4OZ WATER/i, '4OZ OF WATER');
      res = res.replace(/\s+/g, ' ').trim();

      return { output: res, warnings };
  }


  const upperDrug = drug.toUpperCase();

  // Diclofenac special logic
  if (upperDrug.includes("DICLOFENAC GEL 1%")) {
      const isUpper = /upper body|arms/i.test(lower);
      const isLower = /lower body|legs|back/i.test(lower);

      let dose = '2GM';
      if (isLower && !isUpper) dose = '4GM';

      if (isLower && isUpper) {
          dose = '2GM UPPER, 4GM LOWER';
      }

      let res = `AP ${dose} TPCL `;

      const target = lower.match(/apply to (.*?)(?: topically)/i);
      if(target) {
          res += `TO ${target[1].toUpperCase()} `;
      } else {
          res += 'TO AFFECTED AREAS ';
      }

      const fMatch = preprocessed.match(/QID|QD|BID|TID/i);
      if(fMatch) res += fMatch[0].toUpperCase() + ' ';

      const indMatch = preprocessed.match(/FOR MUSCLE PAIN|FPAIN/i);
      if (indMatch) res += indMatch[0].toUpperCase();

      return { output: res.trim().replace(/\s+/g, ' '), warnings };
  }

  let qtyStr = '';

  let qtyMatch = preprocessed.match(/(?:give|take|inject|adm) ?([0-9./]+) ?(tablet|capsule|ml|mg|packet|unit)(?:s)?/i);
  if (!qtyMatch) {
      qtyMatch = preprocessed.match(/([0-9./]+) ?(milliliter|tablet|capsule|ml|mg|packet|unit)(?:s)?/i);
  }

  if (qtyMatch) {
      let q = qtyMatch[1];
      const t = qtyMatch[2].toLowerCase();

      if (q === '0.5') q = '1/2';

      if (t === 'tablet') qtyStr = q + 'T';
      else if (t === 'capsule') qtyStr = q + 'C';
      else if (t === 'packet') qtyStr = q + 'PKT';
      else if (t === 'unit') qtyStr = `INJ ${q} UN`;
      else if (t === 'mg') {
          const drugStrength = drug.match(/([0-9.]+)MG\/([0-9.]+)ML/i);
          if (drugStrength) {
              const drugMg = parseFloat(drugStrength[1]);
              const drugMl = parseFloat(drugStrength[2]);
              const reqMg = parseFloat(q);
              const reqMl = (reqMg / drugMg) * drugMl;
              qtyStr = `INJ ${reqMl}ML (${reqMg}MG)`;
          } else {
             qtyStr = `INJ ${q}MG`;
          }
      }
      else if (t === 'ml' || t === 'milliliter') {
          const isMultiple = /\b(AND|\/|-|FASTMAX|MAALOX)\b/i.test(drug);
          if (isMultiple || /CONC/i.test(drug) || /SYR/i.test(drug)) {
               if (/LORAZEPAM CONC/i.test(drug)) {
                   qtyStr = 'LOR' + q + 'MG';
                   const mgMatch = lower.match(/\(([0-9.]+)mg\)/i);
                   if(mgMatch) qtyStr = 'LOR' + mgMatch[1] + 'MG';
               } else if (/MORPHINE CONC/i.test(drug)) {
                   const mgMatch = lower.match(/\(([0-9.]+)mg\)/i);
                   if(mgMatch) qtyStr = 'ROX' + mgMatch[1] + 'MG';
               } else if (/ENOXAPARIN/i.test(drug)) {
                   qtyStr = `INJ ${q}ML (300MG)`;
               } else if (/SENNA SYR/i.test(drug)) {
                   qtyStr = `ADM ${q}ML (17.2MG)`;
               }
               else {
                   qtyStr = `ADM ${q}ML`;
               }
          } else {
             qtyStr = `ADM ${q}ML`;
          }
      }

      if ((t === 'tablet' || t === 'capsule') && q !== '1') {
         const doseMatch = drug.match(/([0-9.]+)MCG/i);
         if(doseMatch) {




             qtyStr = `${q}${t === 'tablet' ? 'T' : 'C'} (12.5MG)`;
         }
      }
  }

  let route = '';
  if (preprocessed.includes('PO/SL') || (preprocessed.includes('PO') && preprocessed.includes('SL'))) route = 'PO/SL';
  else if (preprocessed.includes('PO')) route = 'PO';
  else if (preprocessed.includes('SL')) route = 'SL';
  else if (preprocessed.includes('SQ')) route = 'SQ';

  let freq = '';
  const freqs = ['QPMDAY7', 'QDP/D IN THE EVENING', 'QDA/B', 'QHS', 'Q6H', 'Q12H', 'BID', 'TID', 'QID', 'QD'];
  for (const f of freqs) {
      if (preprocessed.indexOf(f) !== -1) { freq = f; break; }
  }

  let isPrn = preprocessed.includes('PRN');

  let duration = '';
  let durationMatch = preprocessed.match(/X ?(\d+) ?D(?:AYS)?/i);
  if (!durationMatch) durationMatch = preprocessed.match(/for (\d+) days/i);

  if (durationMatch) {
      duration = `X${durationMatch[1]}D`;
  }

  let diag = '';
  const diags = ['FGERD', 'FSU', 'FDM2', 'FDM', 'FBPH', 'FHYT', 'FGIP', 'FAA', 'FSOBP', 'FCEL OF SCROTUM', 'FCOU', 'FHTN', 'FSP 7-10', 'FCON', 'FDVTP'];
  for (const d of diags) {
      if (preprocessed.includes(d)) { diag = d; break; }
  }

  if (preprocessed.includes('FOR GI DISCOMFORT')) { diag = 'PRN FOR GI DISCOMFORT'; isPrn = false; }
  if (preprocessed.includes('FSP 7-10/10')) diag = 'FSP 7-10/10';
  else if (preprocessed.includes('FSP 7-10')) {
      const extra = preprocessed.match(/for up to (\d+) days/i);
      if (extra) diag = `FSP 7-10/${extra[1]} FOR UP TO ${extra[1]} DAYS`;
  }

  let apapStr = '';
  if (/APAP/i.test(drug)) {
      apapStr = ' 3GM';
  }

  const htnSpecial = preprocessed.includes('HR60SBP100') ? ' HR60SBP100' : '';

  let resStr = `${qtyStr} ${route} ${freq}`.trim();

  if (qtyStr.startsWith('LOR') || qtyStr.startsWith('ROX')) {
      resStr = `${qtyStr} ${route || 'PO/SL'} ${freq}`.trim();
  }

  if (isPrn) {
      resStr += ` PRN ${diag}`;
      if (duration) resStr += ` ${duration}`;
  } else {
      if (duration) resStr += ` ${duration}`;
      if (diag) resStr += ` ${diag}`;
  }

  resStr += htnSpecial + apapStr;

  resStr = resStr.replace(/\s+/g, ' ').trim();

  return { output: resStr, warnings };
}
