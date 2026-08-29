#!/usr/bin/env node
/**
 * Seeds ./content/<page>.json from the committed public/assets/content/<page>.js files.
 *
 * ./content is gitignored — it is the admin's live data store — so a fresh clone starts
 * out with no copy at all. The legacy content files are still in git, and they are just
 * `JSON.stringify` output wrapped in an assignment, so they double as the recoverable
 * defaults for every page.
 *
 *   node scripts/seed-content.mjs            # fill in every missing page
 *   node scripts/seed-content.mjs about      # only these pages
 *   node scripts/seed-content.mjs --force    # overwrite existing files too
 */
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_DIR = join(ROOT, 'public', 'assets', 'content');
const CONTENT_DIR = join(ROOT, 'content');
const UPLOADS_DIR = join(ROOT, 'public', 'uploads');

const args = process.argv.slice(2);
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));

/** Pull the object literal out of `window.SAFTA_C["about"] = { ... };` */
function parseLegacy(source, page) {
  const marker = source.indexOf('window.SAFTA_C[');
  if (marker === -1) throw new Error(`${page}: no window.SAFTA_C[...] assignment found`);
  const start = source.indexOf('{', source.indexOf('=', marker));
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error(`${page}: no object literal found`);
  return JSON.parse(source.slice(start, end + 1));
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

await mkdir(CONTENT_DIR, { recursive: true });
// Both stores are gitignored, so a fresh clone has neither. Uploads starts out empty.
await mkdir(UPLOADS_DIR, { recursive: true });

const pages = wanted.length
  ? wanted
  : (await readdir(LEGACY_DIR)).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));

let written = 0;
let skipped = 0;

for (const page of pages) {
  const target = join(CONTENT_DIR, `${page}.json`);
  if (!force && (await exists(target))) {
    skipped++;
    continue;
  }
  const source = await readFile(join(LEGACY_DIR, `${page}.js`), 'utf8');
  const data = parseLegacy(source, page);
  await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`seeded content/${page}.json — ${Object.keys(data).length} fields`);
  written++;
}

console.log(`${written} written, ${skipped} left alone (pass --force to overwrite).`);
