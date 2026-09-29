import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Build-time check so pages can fall back when an image has not been fetched yet.
export const publicFileExists = (rel: string): boolean => existsSync(join(process.cwd(), 'public', rel));
