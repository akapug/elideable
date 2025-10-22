import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve project root relative to this file location (not process.cwd())
// This file is at services/elide/lib/paths.mjs, so we need to go up 3 levels to reach project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, '..', '..', '..');
export const GENERATED_APPS_DIR = path.join(ROOT, 'generated-apps');

