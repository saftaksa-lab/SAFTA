#!/usr/bin/env node
/**
 * Seeds ./content/<page>.json from the committed public/assets/content/<page>.js files.
 *
 * ./content is gitignored — it is the admin's live data store — so a fresh clone starts
 * out with no copy at all. The legacy content files are still in git, and they are just
 * `JSON.stringify` output wrapped in an assignment, so they double as the recoverable
 * defaults for every page.
 *
 *   node scripts/seed-content.mjs                          # fill in every missing page
 *   node scripts/seed-content.mjs about                    # only these pages
 *   node scripts/seed-content.mjs --force                  # overwrite existing files too
 *
 * A whole-file reseed throws away every admin edit on that page, which is usually more than
 * you want when one section drifted. Narrow the blast radius with --section/--field: the
 * named keys are refreshed from the legacy defaults and merged back into the existing
 * content/<page>.json, leaving the admin's other edits in place.
 *
 *   node scripts/seed-content.mjs about --list-sections    # section keys + labels for a page
 *   node scripts/seed-content.mjs about --section=section-3
 *   node scripts/seed-content.mjs about --section=section-3,section-4 --dry-run
 *   node scripts/seed-content.mjs about --field=t015-نظرة-عامة
 */
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaKeys, pageSections } from './lib/page-schema-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_DIR = join(ROOT, 'public', 'assets', 'content');
const CONTENT_DIR = join(ROOT, 'content');
const UPLOADS_DIR = join(ROOT, 'public', 'uploads');

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const listSections = args.includes('--list-sections');
const wanted = args.filter((a) => !a.startsWith('--'));

/** Collects a repeatable, comma-separated flag: --section=a --section=b,c -> ['a','b','c'] */
function multiFlag(name) {
  return args
    .filter((a) => a.startsWith(`--${name}=`))
    .flatMap((a) => a.slice(name.length + 3).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

const wantedSections = multiFlag('section');
const wantedFields = multiFlag('field');
const partial = wantedSections.length > 0 || wantedFields.length > 0;

// Partial seeding rewrites specific keys inside one page's live file, so it needs exactly
// one page to be unambiguous — and --force is about replacing whole files, which is the
// opposite of what a partial reseed is for.
if (partial && wanted.length !== 1) {
  console.error('--section/--field target keys within a single page — pass exactly one page name.');
  process.exit(1);
}
if (partial && force) {
  console.error('--force replaces the whole file; drop it, or drop --section/--field.');
  process.exit(1);
}
if (listSections && wanted.length !== 1) {
  console.error('--list-sections needs exactly one page name.');
  process.exit(1);
}

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

/** Reads a page's defaults straight out of its legacy file, schema-filtered as usual. */
async function legacyDefaults(page) {
  return filterToSchema(page, parseLegacy(await readFile(join(LEGACY_DIR, `${page}.js`), 'utf8'), page));
}

if (listSections) {
  const page = pages[0];
  for (const { key, label, fields } of await pageSections(page)) {
    console.log(`${key.padEnd(12)} ${String(fields.length).padStart(3)} fields  ${label}`);
  }
  process.exit(0);
}

// --- partial reseed: refresh named keys inside the live file, leave every other key alone.
if (partial) {
  const page = pages[0];
  const targetFile = targetFileFor(page);
  const target = join(CONTENT_DIR, targetFile);
  if (!(await exists(target))) {
    console.error(`content/${targetFile} does not exist yet — run a full seed for "${page}" first.`);
    process.exit(1);
  }

  const sections = await pageSections(page);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const byLabel = new Map(sections.map((s) => [s.label, s]));

  const keys = new Set();
  for (const name of wantedSections) {
    const section = byKey.get(name) ?? byLabel.get(name);
    if (!section) {
      console.error(`unknown section "${name}" for page "${page}" — see --list-sections.`);
      process.exit(1);
    }
    for (const f of section.fields) keys.add(f);
  }
  for (const f of wantedFields) keys.add(f);

  const defaults = await legacyDefaults(page);
  const missing = [...keys].filter((k) => !(k in defaults));
  if (missing.length) {
    console.error(`no legacy default for: ${missing.join(', ')}`);
    process.exit(1);
  }

  const current = JSON.parse(await readFile(target, 'utf8'));
  const changed = [...keys].filter((k) => JSON.stringify(current[k]) !== JSON.stringify(defaults[k]));
  // Key order follows the existing file, so an unchanged key set produces a byte-identical
  // file and a reseed of one section never reshuffles the rest of the diff.
  const merged = { ...current };
  for (const k of keys) merged[k] = defaults[k];

  for (const k of changed) console.log(`  ${k}`);
  if (dryRun) {
    console.log(`dry run — would reseed ${changed.length}/${keys.size} key(s) in content/${targetFile}.`);
  } else {
    await writeFile(target, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    console.log(`reseeded ${changed.length}/${keys.size} key(s) in content/${targetFile} (the rest already matched).`);
  }
  process.exit(0);
}

let written = 0;
let skipped = 0;

for (const page of pages) {
  const targetFile = targetFileFor(page);
  const target = join(CONTENT_DIR, targetFile);
  if (!force && (await exists(target))) {
    skipped++;
    continue;
  }
  const data = await legacyDefaults(page);
  if (dryRun) {
    console.log(`dry run — would seed content/${targetFile} — ${Object.keys(data).length} fields`);
  } else {
    await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`seeded content/${targetFile} — ${Object.keys(data).length} fields`);
    written++;
  }
}

console.log(`${written} ${dryRun ? 'would be written' : 'written'}, ${skipped} left alone (pass --force to overwrite).`);
