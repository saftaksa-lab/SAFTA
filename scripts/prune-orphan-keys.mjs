#!/usr/bin/env node
/**
 * Removes keys from content/<page>.json that the page's schema module no longer declares —
 * the repair for the drift that check-schema-drift.mjs reports.
 *
 * These orphans accumulate because content/ is gitignored and is the live data store:
 * seed-content.mjs skips files that already exist, so when a field is dropped from a page's
 * schema (typically because it moved into a collection — challenges.json, roles.json), a
 * long-lived deployment keeps serving a content file that still carries the old keys. The
 * page validator is `.strict()`, so a single orphan key makes every admin save to that page
 * fail with 400 no matter which field was edited.
 *
 * Dry run by default — prints each key it would drop, with its current value, so nothing is
 * discarded unseen. Pass --write to apply, which first copies each file to
 * <page>.json.orphans-<timestamp>.bak next to it.
 *
 *   node scripts/prune-orphan-keys.mjs                  # dry run, every registered page
 *   node scripts/prune-orphan-keys.mjs about index      # dry run, only these
 *   node scripts/prune-orphan-keys.mjs --write          # apply
 *
 * Only ever removes keys; a key the schema requires but the file lacks is reported and left
 * alone, because inventing a blank value would silently publish an empty field to the live
 * site. Fix those by hand.
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONTENT_DIR, registeredPages, schemaKeys, diskData } from './lib/page-schema-keys.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const wanted = args.filter((a) => !a.startsWith('--'));
const pages = wanted.length ? wanted : await registeredPages();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

let orphanTotal = 0;
let missingTotal = 0;
let changedFiles = 0;

for (const page of pages) {
  const { fields } = await schemaKeys(page);
  const data = await diskData(page);
  if (!data) {
    console.log(`- ${page}: content/${page}.json is missing — run \`npm run seed:content\` first`);
    continue;
  }

  const declared = new Set(fields);
  const orphans = Object.keys(data).filter((k) => !declared.has(k));
  const missing = fields.filter((k) => !Object.prototype.hasOwnProperty.call(data, k));

  if (!orphans.length && !missing.length) {
    console.log(`✓ ${page}: no orphans`);
    continue;
  }

  if (missing.length) {
    missingTotal += missing.length;
    console.log(`! ${page}: ${missing.length} key(s) required by the schema but absent from the file — fix by hand, not pruned:`);
    for (const k of missing) console.log(`    ${k}`);
  }

  if (!orphans.length) continue;

  orphanTotal += orphans.length;
  console.log(`${write ? '✎' : '·'} ${page}: ${orphans.length} orphan key(s)${write ? ' removed' : ' would be removed'}:`);
  for (const k of orphans) {
    const preview = JSON.stringify(data[k]);
    console.log(`    ${k}  ${preview.length > 90 ? preview.slice(0, 90) + '…' : preview}`);
  }

  if (!write) continue;

  const target = join(CONTENT_DIR, `${page}.json`);
  const backup = join(CONTENT_DIR, `${page}.json.orphans-${stamp}.bak`);
  await copyFile(target, backup);

  // Rebuilt by filtering the original key order rather than deleting in place, so the
  // surviving fields keep the order the file already had and the diff stays readable.
  const pruned = {};
  for (const [k, v] of Object.entries(data)) if (declared.has(k)) pruned[k] = v;
  await writeFile(target, JSON.stringify(pruned, null, 2) + '\n', 'utf8');
  changedFiles++;
  console.log(`    → backup: content/${page}.json.orphans-${stamp}.bak`);
}

console.log('');
if (!orphanTotal && !missingTotal) {
  console.log(`No orphans across ${pages.length} page(s).`);
} else if (write) {
  console.log(`Removed ${orphanTotal} orphan key(s) from ${changedFiles} file(s).`);
  if (missingTotal) console.log(`${missingTotal} missing key(s) still need fixing by hand — saves will keep failing until then.`);
} else {
  console.log(`Dry run: ${orphanTotal} orphan key(s) would be removed. Re-run with --write to apply.`);
  if (missingTotal) console.log(`${missingTotal} missing key(s) cannot be repaired automatically — see above.`);
}
