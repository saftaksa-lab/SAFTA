#!/usr/bin/env node
/**
 * Removes keys from the records in content/<name>.json that the collection's schema module
 * no longer declares — the collection-shaped counterpart to prune-orphan-keys.mjs.
 *
 * These orphans accumulate because content/ is gitignored and is the live data store:
 * seed-collections.mjs skips files that already exist, so when a field is dropped from a
 * collection's schema, a long-lived deployment keeps serving records that still carry the
 * old keys. zodForItemFields() in collections/codec.ts is `.strict()`, so a single orphan
 * key on a single record makes every admin save to that collection fail with 400 no matter
 * which field was edited.
 *
 * Dry run by default — prints each key it would drop, with its current value, so nothing is
 * discarded unseen. Pass --write to apply, which first copies each file to
 * <name>.json.orphans-<timestamp>.bak next to it.
 *
 *   node scripts/prune-orphan-collection-keys.mjs                 # dry run, every collection
 *   node scripts/prune-orphan-collection-keys.mjs groups          # dry run, only these
 *   node scripts/prune-orphan-collection-keys.mjs groups --write  # apply
 *
 * Only ever removes keys; a key the schema requires but a record lacks is reported and left
 * alone, because inventing a blank value would silently publish an empty field to the live
 * site. Fix those by hand.
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveShape } from './lib/legacy-collection-shape.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTIONS_DIR = join(ROOT, 'src', 'lib', 'content', 'collections');
const CONTENT_DIR = join(ROOT, 'content');
const SCHEMA_FILE = join(ROOT, 'public', 'admin', 'schema.js');

/** The registry's COLLECTIONS map is the source of truth for which collections are
 *  admin-writable — read the names from it rather than keeping a second list to fall out of
 *  date. Mirrors registeredPages() in lib/page-schema-keys.mjs. */
async function registeredCollections() {
  const src = await readFile(join(COLLECTIONS_DIR, 'registry.ts'), 'utf8');
  const block = src.match(/const COLLECTIONS\s*=\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error('could not locate the COLLECTIONS map in collections/registry.ts');
  return [...block[1].matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]);
}

/**
 * The top-level keys a collection declares, read from public/admin/schema.js's `_<name>`
 * entry via the same deriveShape() the generator uses.
 *
 * Read from schema.js rather than the generated collections/<name>.ts (which is what the
 * runtime validator is actually built from) because the generator refuses to emit a module
 * whose field set disagrees with the content file — so on a schema change this must run
 * *before* there is a regenerated module to read, and schema.js is the upstream both it and
 * the generator share. No import of the TypeScript module either way: these tools have to
 * run on a production checkout with no build step.
 */
async function declaredKeys(name) {
  const src = await readFile(SCHEMA_FILE, 'utf8');
  const match = src.match(/=\s*(\{[\s\S]*?\});?\s*$/m);
  if (!match) throw new Error('could not locate the assigned object literal in public/admin/schema.js');
  const entry = JSON.parse(match[1])[`_${name}`];
  if (!entry) throw new Error(`no "_${name}" entry in public/admin/schema.js`);
  return Object.keys(deriveShape(entry.sections || []));
}

/** Returns null when the file is absent — content/ is gitignored, so a missing file is a
 *  seeding problem (npm run seed:collections), not schema drift. */
async function diskData(name) {
  try {
    return JSON.parse(await readFile(join(CONTENT_DIR, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const wanted = args.filter((a) => !a.startsWith('--'));
const names = wanted.length ? wanted : await registeredCollections();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

let orphanTotal = 0;
let missingTotal = 0;
let changedFiles = 0;

for (const name of names) {
  const data = await diskData(name);
  if (!data) {
    console.log(`- ${name}: content/${name}.json is missing — run \`npm run seed:collections\` first`);
    continue;
  }

  const declared = new Set(await declaredKeys(name));

  // Collected per record, then reported grouped by key: every record in a collection shares
  // one shape, so nine identical "orphan on this record too" blocks would bury the signal.
  const orphansByKey = new Map();
  const missingByKey = new Map();
  for (const [id, record] of Object.entries(data)) {
    for (const k of Object.keys(record)) {
      if (!declared.has(k)) {
        if (!orphansByKey.has(k)) orphansByKey.set(k, []);
        orphansByKey.get(k).push([id, record[k]]);
      }
    }
    for (const k of declared) {
      if (!Object.prototype.hasOwnProperty.call(record, k)) {
        if (!missingByKey.has(k)) missingByKey.set(k, []);
        missingByKey.get(k).push(id);
      }
    }
  }

  if (!orphansByKey.size && !missingByKey.size) {
    console.log(`✓ ${name}: no orphans`);
    continue;
  }

  if (missingByKey.size) {
    missingTotal += [...missingByKey.values()].reduce((n, ids) => n + ids.length, 0);
    console.log(`! ${name}: key(s) required by the schema but absent from some records — fix by hand, not pruned:`);
    for (const [k, ids] of missingByKey) console.log(`    ${k}  (${ids.length} record(s): ${ids.join(', ')})`);
  }

  if (!orphansByKey.size) continue;

  orphanTotal += [...orphansByKey.values()].reduce((n, hits) => n + hits.length, 0);
  console.log(`${write ? '✎' : '·'} ${name}: ${orphansByKey.size} orphan key(s) across records${write ? ' removed' : ' would be removed'}:`);
  for (const [k, hits] of orphansByKey) {
    console.log(`    ${k}  (${hits.length} record(s))`);
    for (const [id, value] of hits) {
      const preview = JSON.stringify(value);
      console.log(`      ${id}: ${preview.length > 80 ? preview.slice(0, 80) + '…' : preview}`);
    }
  }

  if (!write) continue;

  const target = join(CONTENT_DIR, `${name}.json`);
  await copyFile(target, join(CONTENT_DIR, `${name}.json.orphans-${stamp}.bak`));

  // Rebuilt by filtering the original key order rather than deleting in place, so the
  // surviving fields keep the order the file already had and the diff stays readable.
  const pruned = {};
  for (const [id, record] of Object.entries(data)) {
    const item = {};
    for (const [k, v] of Object.entries(record)) if (declared.has(k)) item[k] = v;
    pruned[id] = item;
  }
  await writeFile(target, JSON.stringify(pruned, null, 2) + '\n', 'utf8');
  changedFiles++;
  console.log(`    → backup: content/${name}.json.orphans-${stamp}.bak`);
}

console.log('');
if (!orphanTotal && !missingTotal) {
  console.log(`No orphans across ${names.length} collection(s).`);
} else if (write) {
  console.log(`Removed ${orphanTotal} orphan key(s) from ${changedFiles} file(s).`);
  if (missingTotal) console.log(`${missingTotal} missing key(s) still need fixing by hand — saves will keep failing until then.`);
} else {
  console.log(`Dry run: ${orphanTotal} orphan key(s) would be removed. Re-run with --write to apply.`);
  if (missingTotal) console.log(`${missingTotal} missing key(s) cannot be repaired automatically — see above.`);
}
