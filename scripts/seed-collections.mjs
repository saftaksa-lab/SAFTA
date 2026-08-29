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
 *   node scripts/seed-collections.mjs            # fill in every missing collection
 *   node scripts/seed-collections.mjs groups     # only these collections
 *   node scripts/seed-collections.mjs --force    # overwrite existing files too
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
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));

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
  if (!force && (await exists(target))) {
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

  await writeFile(target, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  console.log(`seeded content/${name}.json — ${Object.keys(normalized).length} records`);
  written++;
}

console.log(`${written} written, ${skipped} left alone (pass --force to overwrite).`);
