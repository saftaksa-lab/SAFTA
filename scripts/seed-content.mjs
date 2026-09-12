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
import { schemaKeys } from './lib/page-schema-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_DIR = join(ROOT, 'public', 'assets', 'content');
const CONTENT_DIR = join(ROOT, 'content');
const UPLOADS_DIR = join(ROOT, 'public', 'uploads');

const args = process.argv.slice(2);
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));

// content/<page>.json is the default target, but "members" collides with the _members
// collection's own data file (content/members.json, seeded by seed-collections.mjs) — its
// page copy lives at content/members-page.json instead (see schema/members.ts's
// `contentFile`).
const TARGET_FILE_OVERRIDES = { members: 'members-page.json' };
function targetFileFor(page) {
  return TARGET_FILE_OVERRIDES[page] ?? `${page}.json`;
}

/** Pull the object literal out of `window.SAFTA_C["about"] = { ... };` */
function parseLegacy(source, page) {
  const marker = source.indexOf('window.SAFTA_C[');
  if (marker === -1) throw new Error(`${page}: no window.SAFTA_C[...] assignment found`);
  const start = source.indexOf('{', source.indexOf('=', marker));
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error(`${page}: no object literal found`);
  return JSON.parse(source.slice(start, end + 1));
}

/**
 * Registered pages (src/lib/content/schema/<page>.ts) are `.strict()`-validated against
 * their own field set — see check-schema-drift.mjs. Some legacy public/assets/content/<page>.js
 * files carry more keys than the page schema declares (e.g. members.js still has each
 * member org's hero-era duplicate fields, now owned by the `_members` collection instead), so
 * seeding straight from the legacy file would immediately drift a freshly provisioned
 * environment. Filtering to the schema's declared keys keeps a fresh seed in parity with the
 * schema from the start, the same parity generate-page-schema.mjs enforces at authoring time.
 * Pages without a schema module (not every legacy page has been migrated) are seeded as-is.
 */
async function filterToSchema(page, data) {
  let fields;
  try {
    ({ fields } = await schemaKeys(page));
  } catch {
    return data;
  }
  if (!fields.length) return data;
  const declared = new Set(fields);
  const filtered = {};
  for (const [k, v] of Object.entries(data)) if (declared.has(k)) filtered[k] = v;
  return filtered;
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
  const targetFile = targetFileFor(page);
  const target = join(CONTENT_DIR, targetFile);
  if (!force && (await exists(target))) {
    skipped++;
    continue;
  }
  const source = await readFile(join(LEGACY_DIR, `${page}.js`), 'utf8');
  const data = await filterToSchema(page, parseLegacy(source, page));
  await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`seeded content/${targetFile} — ${Object.keys(data).length} fields`);
  written++;
}

console.log(`${written} written, ${skipped} left alone (pass --force to overwrite).`);
