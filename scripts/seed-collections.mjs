#!/usr/bin/env node
/**
 * Seeds ./content/{groups,articles,events}.json from the committed
 * public/assets/js/{wg-data,article-data,events-data}.js files — the collection-content
 * counterpart to seed-content.mjs. ./content is gitignored, so a fresh clone has none; these
 * legacy `window.SAFTA_*` files are the only source of truth for this data today.
 *
 * Each raw record is reshaped (via scripts/lib/legacy-collection-shape.mjs, driven by
 * public/admin/schema.js's `_<name>` field declarations) from the legacy flat/`_ar`-sibling
 * form into the nested {en,ar} / array-of-items form src/lib/content/collections/codec.ts
 * validates against — the same shape a `.text()`/`.value()`/`.list()` accessor expects to
 * read back.
 *
 *   node scripts/seed-collections.mjs                        # fill in every missing collection
 *   node scripts/seed-collections.mjs groups                 # only these collections
 *   node scripts/seed-collections.mjs --force                # overwrite existing files too
 *
 * --record narrows a reseed to individual records, merging them back into the existing
 * content/<name>.json instead of replacing the file — so restoring one stale working group
 * does not discard the admin's edits to the other twenty.
 *
 *   node scripts/seed-collections.mjs groups --list-records  # record ids in the legacy source
 *   node scripts/seed-collections.mjs groups --record=wg-01
 *   node scripts/seed-collections.mjs groups --record=wg-01,wg-02 --dry-run
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveShape, reshapeRecord } from './lib/legacy-collection-shape.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(ROOT, 'public', 'assets', 'js');
const CONTENT_DIR = join(ROOT, 'content');

const SOURCES = {
  groups: { file: 'wg-data.js', global: 'SAFTA_GROUPS', schemaKey: '_groups' },
  articles: { file: 'article-data.js', global: 'SAFTA_ARTICLES', schemaKey: '_articles' },
  events: { file: 'events-data.js', global: 'SAFTA_EVENTS', schemaKey: '_events' },
  members: { file: 'members-data.js', global: 'SAFTA_MEMBERS_FULL', schemaKey: '_members' },
  roles: { file: 'roles-data.js', global: 'SAFTA_ROLES', schemaKey: '_roles' },
  partners: { file: 'partners-data.js', global: 'SAFTA_PARTNERS', schemaKey: '_partners' },
  challenges: { file: 'challenges-data.js', global: 'SAFTA_CHALLENGES', schemaKey: '_challenges' },
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const listRecords = args.includes('--list-records');
const wanted = args.filter((a) => !a.startsWith('--'));

const wantedRecords = args
  .filter((a) => a.startsWith('--record='))
  .flatMap((a) => a.slice('--record='.length).split(','))
  .map((v) => v.trim())
  .filter(Boolean);

// Both modes rewrite records inside one collection's live file, so the collection has to be
// unambiguous; --force replaces whole files, which is the opposite of a per-record reseed.
if ((wantedRecords.length || listRecords) && wanted.length !== 1) {
  console.error('--record/--list-records target a single collection — pass exactly one name.');
  process.exit(1);
}
if (wantedRecords.length && force) {
  console.error('--force replaces the whole file; drop it, or drop --record.');
  process.exit(1);
}

/**
 * Pulls `window.SAFTA_X = { ... };` out as a live object. These files are plain JS object
 * literals — article-data.js in particular uses unquoted keys — not JSON, so this needs a
 * JS-literal evaluation rather than JSON.parse. Trusted, repo-committed source only.
 */
function parseLegacy(source, global, file) {
  const marker = `window.${global}`;
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) throw new Error(`${file}: no window.${global} assignment found`);
  const start = source.indexOf('{', source.indexOf('=', markerIdx));
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error(`${file}: no object literal found`);
  return new Function(`return (${source.slice(start, end + 1)});`)();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const schemaSrc = await readFile(join(ROOT, 'public', 'admin', 'schema.js'), 'utf8');
const schemaMatch = schemaSrc.match(/=\s*(\{[\s\S]*?\});?\s*$/m);
if (!schemaMatch) throw new Error('could not locate the assigned object literal in public/admin/schema.js');
const allSchemas = JSON.parse(schemaMatch[1]);

await mkdir(CONTENT_DIR, { recursive: true });

const names = wanted.length ? wanted : Object.keys(SOURCES);

let written = 0;
let skipped = 0;

for (const name of names) {
  const source = SOURCES[name];
  if (!source) {
    console.error(`unknown collection "${name}" — expected one of: ${Object.keys(SOURCES).join(', ')}`);
    process.exitCode = 1;
    continue;
  }

  const target = join(CONTENT_DIR, `${name}.json`);
  const partial = wantedRecords.length > 0;
  if (!force && !partial && !listRecords && (await exists(target))) {
    skipped++;
    continue;
  }

  const pageSchema = allSchemas[source.schemaKey];
  if (!pageSchema) throw new Error(`no "${source.schemaKey}" entry in public/admin/schema.js`);
  const shape = deriveShape(pageSchema.sections || []);

  const raw = await readFile(join(JS_DIR, source.file), 'utf8');
  const data = parseLegacy(raw, source.global, source.file);
  const normalized = Object.fromEntries(
    Object.entries(data).map(([id, record]) => [id, reshapeRecord(record, shape)]),
  );

  if (listRecords) {
    for (const id of Object.keys(normalized)) console.log(id);
    continue;
  }

  // --- per-record reseed: replace just these records, leave the rest of the file alone.
  if (partial) {
    if (!(await exists(target))) {
      console.error(`content/${name}.json does not exist yet — run a full seed for "${name}" first.`);
      process.exitCode = 1;
      continue;
    }
    const unknown = wantedRecords.filter((id) => !(id in normalized));
    if (unknown.length) {
      console.error(`no legacy record in ${source.file} for: ${unknown.join(', ')} — see --list-records.`);
      process.exitCode = 1;
      continue;
    }

    const current = JSON.parse(await readFile(target, 'utf8'));
    const changed = wantedRecords.filter((id) => JSON.stringify(current[id]) !== JSON.stringify(normalized[id]));
    // Existing ids keep their position; only genuinely new ones are appended, so reseeding
    // one record never reorders the collection.
    const merged = { ...current };
    for (const id of wantedRecords) merged[id] = normalized[id];

    for (const id of changed) console.log(`  ${id}`);
    if (dryRun) {
      console.log(`dry run — would reseed ${changed.length}/${wantedRecords.length} record(s) in content/${name}.json.`);
    } else {
      await writeFile(target, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log(`reseeded ${changed.length}/${wantedRecords.length} record(s) in content/${name}.json (the rest already matched).`);
      written++;
    }
    continue;
  }

  if (dryRun) {
    console.log(`dry run — would seed content/${name}.json — ${Object.keys(normalized).length} records`);
  } else {
    await writeFile(target, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
    console.log(`seeded content/${name}.json — ${Object.keys(normalized).length} records`);
    written++;
  }
}

if (!listRecords) console.log(`${written} ${dryRun ? 'would be written' : 'written'}, ${skipped} left alone (pass --force to overwrite).`);
