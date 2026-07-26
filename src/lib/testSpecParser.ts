export interface ImportedSigSpec {
  id: number;
  treatment: boolean;
  drug: string;
  userEntry: string;
  expected: string[];
}

/** Parses the human-maintained TESTS.txt into a migration inventory. */
export function parseSigTestSpec(source: string): ImportedSigSpec[] {
  const sections = source.split(/(?=^(?:\*TREATMENT\*\s*)?\d+\))/gm);
  return sections.flatMap((section) => {
    const header = section.match(/^(?:\*TREATMENT\*\s*)?(\d+)\)\s*([^\n]+)[\s\S]*?USER ENTRY:\s*([\s\S]*?)(?=\n\n(?:OPTIMAL OUTPUT|NOTE|DEFAULT|[-]{3})|$)/i);
    if (!header) return [];
    const expected = [...section.matchAll(/OPTIMAL OUTPUT(?:\s*\d+)?:\s*([^\n]+(?:\n(?!\s*(?:NOTE|DEFAULT|USER ENTRY|OPTIMAL OUTPUT|[-]{3})).*)*)/gi)]
      .map((match) => match[1].replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!header[2].trim() || !header[3].trim() || expected.length === 0) return [];
    return [{
      id: Number(header[1]),
      treatment: /^\*TREATMENT\*/i.test(section.trim()),
      drug: header[2].trim(),
      userEntry: header[3].replace(/\s+/g, ' ').trim(),
      expected,
    }];
  });
}
