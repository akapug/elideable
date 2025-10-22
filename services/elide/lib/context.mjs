import fs from 'node:fs/promises';
import path from 'node:path';
import { GENERATED_APPS_DIR } from './paths.mjs';

export async function buildAppContext(appId, { maxFiles = 10, maxCharsPerFile = 400 } = {}) {
  try {
    const appDir = path.join(GENERATED_APPS_DIR, appId);
    const tree = await readTreeFromDir(appDir, appDir);
    const filePaths = [];
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'file') filePaths.push(n.path);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    const score = (p) => {
      let s = 0;
      if (/^index\.(html|tsx?|jsx?)$/i.test(p)) s += 100;
      if (/^main\.(ts|js)x?$/i.test(p)) s += 80;
      if (/^app\.(ts|js)x?$/i.test(p)) s += 70;
      if (/^styles?\.(css|scss)$/i.test(p)) s += 60;
      if (/^src\//i.test(p)) s += 50;
      if (/components?\//i.test(p)) s += 40;
      if (/\.css$/i.test(p)) s += 10;
      if (/\.json$/i.test(p)) s -= 10;
      return s;
    };
    filePaths.sort((a,b) => score(b) - score(a) || a.localeCompare(b));

    const selected = filePaths.slice(0, maxFiles);
    const parts = [];
    for (const rel of selected) {
      try {
        const full = path.join(appDir, rel);
        let content = await fs.readFile(full, 'utf8');
        if (content.length > maxCharsPerFile) content = content.slice(0, maxCharsPerFile) + '...';
        parts.push(`- ${rel}:\n${content}`);
      } catch {}
    }
    return parts.join('\n\n');
  } catch (e) {
    console.warn('[ai] buildAppContext failed:', e?.message || e);
    return '';
  }
}

export async function readTreeFromDir(dir, baseDir = GENERATED_APPS_DIR) {
  const tree = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(baseDir, fullPath);
      if (entry.isDirectory()) {
        const children = await readTreeFromDir(fullPath, baseDir);
        tree.push({ type: 'dir', path: rel, children });
      } else if (entry.isFile()) {
        tree.push({ type: 'file', path: rel });
      }
    }
  } catch {}
  return tree;
}

