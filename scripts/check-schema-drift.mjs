#!/usr/bin/env node
/**
 * Diagnoses the "every admin save returns 400" failure by diffing, for each registered
 * page, the three key sets that must agree for a publish to validate:
 *
 *   fields   — src/lib/content/schema/<page>.ts `*_FIELDS`, what zodForFields() builds the
 *              validator from: every key required, and `.strict()` rejects anything else.
 *   sections — the same module's `*_SECTIONS`, the only keys the admin UI renders and so
 *              the only ones a publish actually sends (see flatFields() in admin.js).
 *   disk     — content/<page>.json, which the admin POSTs back wholesale, not just the
 *              field that was edited.
 *
 * Any disagreement is a permanent 400 on that page — no edit can succeed until it's
 * reconciled, because the payload is rejected before it is ever written.
 *
 * This drifts in production and not locally because content/ is gitignored and is the live
 * data store: seed-content.mjs skips files that already exist unless passed --force, so a
 * deployed content/<page>.json stays frozen while the schema modules ship fresh with every
 * deploy. Copy this to the prod checkout and run it there to name the offending keys.
 *
 *   node scripts/check-schema-drift.mjs           # every registered page
 *   node scripts/check-schema-drift.mjs about     # only these pages
 *
 * Exits 1 if any page has drifted, so it can gate a deploy.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'src', 'lib', 'content', 'schema');
const CONTENT_DIR = join(ROOT, 'content');

/** The registry is the source of truth for which pages are admin-writable — read the page
 *  names out of its PAGES map rather than keeping a second list here to fall out of date. */
async function registeredPages() {
  const src = await readFile(join(SCHEMA_DIR, 'registry.ts'), 'utf8');
  const block = src.match(/const PAGES\s*=\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error('could not locate the PAGES map in schema/registry.ts');
  return [...block[1].matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]);
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const pages = wanted.length ? wanted : await registeredPages();

let drifted = 0;

for (const page of pages) {
  const src = await readFile(join(SCHEMA_DIR, `${page}.ts`), 'utf8');

  // Both blocks are generator output (generate-page-schema.mjs), so their formatting is
  // stable enough to read with a regex — this deliberately avoids importing the TypeScript
  // modules so it can run on a prod checkout with no build step or esbuild present.
  const fieldsBlock = src.slice(src.indexOf('_FIELDS'), src.indexOf('_SECTIONS'));
  const fieldKeys = [...fieldsBlock.matchAll(/^\s*"([^"]+)":\s*\{\s*kind:/gm)].map((m) => m[1]);

  const sectionsBlock = src.slice(src.indexOf('_SECTIONS'));
  const sectionKeys = [...sectionsBlock.matchAll(/fields:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));

  let diskKeys = null;
  try {
    diskKeys = Object.keys(JSON.parse(await readFile(join(CONTENT_DIR, `${page}.json`), 'utf8')));
  } catch {
    // Left null — reported as MISSING below. content/ is gitignored, so an absent file is a
    // seeding problem (npm run seed:content), not schema drift.
  }

  const inFields = new Set(fieldKeys);
  const inSections = new Set(sectionKeys);
  const onDisk = diskKeys && new Set(diskKeys);

  const problems = [];
  for (const k of fieldKeys) {
    if (!inSections.has(k)) problems.push(['required by the validator, but in no section — the UI never sends it', k]);
  }
  for (const k of sectionKeys) {
    if (!inFields.has(k)) problems.push(['rendered by the UI, but absent from fields — .strict() rejects it', k]);
  }
  if (onDisk) {
    for (const k of fieldKeys) if (!onDisk.has(k)) problems.push(['required by the validator, missing from the content file', k]);
    for (const k of diskKeys) if (!inFields.has(k)) problems.push(['present in the content file, absent from the schema', k]);
  }

  const counts = `fields:${fieldKeys.length} sections:${inSections.size} disk:${diskKeys ? diskKeys.length : 'MISSING'}`;
  if (!problems.length) {
    console.log(`✓ ${page.padEnd(18)} ${counts}`);
    continue;
  }

  drifted++;
  console.log(`✗ ${page.padEnd(18)} ${counts}`);
  const byReason = new Map();
  for (const [reason, key] of problems) {
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(key);
  }
  for (const [reason, keys] of byReason) {
    console.log(`    ${reason}:`);
    for (const k of keys) console.log(`      ${k}`);
  }
}

if (drifted) {
  console.log(`\n${drifted} page(s) drifted — every admin save to them will 400 until the keys above agree.`);
  process.exit(1);
}
console.log(`\nAll ${pages.length} page(s) agree across schema, sections and content.`);
