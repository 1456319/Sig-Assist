export interface BuildIdentity { schemaVersion: number; version: string; buildId: string }
export function buildInputPaths(root?: string): string[];
export function getBuildIdentity(root?: string): BuildIdentity;
export function verifyBuildHtml(html: string, identity: BuildIdentity): void;
export function verifyPortableBuild(root?: string): BuildIdentity;
