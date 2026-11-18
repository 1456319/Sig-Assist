export const generatedFiles: string[];
export function publishPrototype(options: { cwd?: string; sourceSha: string }): 'published' | 'unchanged' | 'superseded';
