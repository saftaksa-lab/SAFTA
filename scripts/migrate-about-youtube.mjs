#!/usr/bin/env node
/**
 * One-shot migration for the about page's video block: the self-hosted reel (a poster image
 * plus a play-button label and a duration caption, with the .mp4/.webm paths hardcoded in the
 * template) is replaced by a single admin-editable YouTube link.
 *
 *   removes  i008-reelposter, t009-شغّل-الفيديو, t010-٢٠-ثانية-بلا-صوت
 *   adds     t008-youtube  →  { "en": "", "ar": "" }
 *
 * Needed because content/ is gitignored and is the live data store — a long-lived deployment
 * keeps whatever it last published, and seed-content.mjs skips files that already exist. Since
 * zodForFields() in schema/codec.ts is `.strict()` *and* requires every registered key, a
 * production content/about.json left alone after this change breaks admin saves from both
 * sides at once: the three dropped keys are now unregistered (400 on any save to the page),
 * and the new key is absent so the admin panel's writeField() throws before a request is even
 * built. Running this makes the file agree with the new schema.
 *
 * The blank value for t008-youtube is deliberate and correct — about.astro omits the whole
 * video block for an empty link, so the section simply carries no video until someone pastes
 * one. (That is why this exists as its own script rather than a run of prune-orphan-keys.mjs,
 * which only ever removes keys and refuses to invent a missing one.)
 *
 * Dry run by default — prints every key it would drop, with its current value, so nothing is
 * discarded unseen. Pass --write to apply, which first copies the file to
 * about.json.youtube-<timestamp>.bak next to it. Idempotent: re-running after a successful
 * --write reports no changes.
 *
 *   node scripts/migrate-about-youtube.mjs           # dry run
 *   node scripts/migrate-about-youtube.mjs --write   # apply
 *
 * No TypeScript imports: like its sibling scripts this has to run on a production checkout
 * with no build step, so the expected key set is read out of public/admin/schema.js directly.
 */
import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_FILE = join(ROOT, 'content', 'about.json');
const SCHEMA_FILE = join(ROOT, 'public', 'admin', 'schema.js');
const UPLOADS_DIR = join(ROOT, 'public', 'uploads');

const DROP = ['i008-reelposter', 't009-شغّل-الفيديو', 't010-٢٠-ثانية-بلا-صوت'];
const ADD = 't008-youtube';
const ADD_VALUE = { en: '', ar: '' };

const write = process.argv.slice(2).includes('--write');

/** The keys public/admin/schema.js declares for the about page — the same object literal and
 *  the same regex the generator uses, so the two can't drift apart. */
async function declaredKeys() {
  const src = await readFile(SCHEMA_FILE, 'utf8');
  const match = src.match(/=\s*(\{[\s\S]*?\});?\s*$/m);
  if (!match) throw new Error('could not locate the assigned object literal in public/admin/schema.js');
  const page = JSON.parse(match[1]).about;
  if (!page) throw new Error('no "about" entry in public/admin/schema.js');

  const keys = [];
  for (const section of page.sections || []) {
    for (const f of section.fields || []) keys.push(f.key);
    for (const card of section.cards || []) for (const f of card.fields || []) keys.push(f.key);
  }
  return keys;
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('! content/about.json is missing.');
      console.error('  content/ is gitignored — this is a seeding problem, not schema drift.');
      console.error('  Run `npm run seed:content` first, then re-run this migration.');
      return 1;
    }
    console.error(`! content/about.json could not be parsed: ${err.message}`);
    return 1;
  }

  const next = { ...data };
  let changes = 0;
  const uploadsToDelete = [];

  for (const key of DROP) {
    if (!(key in next)) {
      console.log(`·  ${key} — already absent`);
      continue;
    }
    const record = next[key];
    console.log(`✎  ${key} — dropping ${JSON.stringify(record)}`);

    // The poster was admin-uploadable, so it may point at a file under public/uploads that
    // nothing will ever reclaim once the key is gone: pruneReplacedUploads() in store.ts only
    // looks at keys that still exist in the new data. Same filename guard it uses.
    const src = record && record.src;
    if (typeof src === 'string' && src.startsWith('uploads/')) {
      const name = src.slice('uploads/'.length);
      if (name && !name.includes('/') && !name.includes('\\')) uploadsToDelete.push(name);
    }

    delete next[key];
    changes++;
  }

  if (ADD in next) {
    console.log(`·  ${ADD} — already present, left as ${JSON.stringify(next[ADD])}`);
  } else {
    console.log(`✎  ${ADD} — adding ${JSON.stringify(ADD_VALUE)} (blank: the page hides the video until a link is set)`);
    next[ADD] = { ...ADD_VALUE };
    changes++;
  }

  for (const name of uploadsToDelete) {
    console.log(`✎  public/uploads/${name} — deleting, no field points at it any more`);
  }

  // Guard against applying a half-migration: after this runs, the file must line up exactly
  // with schema.js or generate-page-schema.mjs will refuse to emit anyway.
  const declared = await declaredKeys();
  const have = Object.keys(next);
  const extra = have.filter((k) => !declared.includes(k)).sort();
  const missing = declared.filter((k) => !have.includes(k)).sort();
  if (extra.length || missing.length) {
    console.error('\n! content/about.json would still disagree with public/admin/schema.js:');
    if (extra.length) console.error('   in content, not in schema.js:', extra);
    if (missing.length) console.error('   in schema.js, not in content:', missing);
    console.error('  Nothing was written. Fix these by hand — inventing values here would');
    console.error('  silently publish empty fields to the live site.');
    return 1;
  }

  if (!changes) {
    console.log('\n✓  Nothing to do — content/about.json is already migrated.');
    return 0;
  }

  if (!write) {
    console.log(`\n✓  Dry run: ${changes} change(s) to content/about.json`);
    if (uploadsToDelete.length) console.log(`   plus ${uploadsToDelete.length} orphaned upload(s)`);
    console.log('   Re-run with --write to apply.');
    return 0;
  }

  // Reorder to schema.js's field order so the new key lands where the removed ones were,
  // instead of being appended after the last section. Purely cosmetic — nothing reads this
  // file by position — but it keeps the live data readable next to the seed in
  // public/assets/content/about.js.
  const ordered = {};
  for (const key of declared) ordered[key] = next[key];

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${CONTENT_FILE}.youtube-${stamp}.bak`;
  await copyFile(CONTENT_FILE, backup);
  await writeFile(CONTENT_FILE, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

  for (const name of uploadsToDelete) {
    try {
      await unlink(join(UPLOADS_DIR, name));
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`!  could not delete public/uploads/${name}: ${err.message}`);
    }
  }

  console.log(`\n✓  Wrote content/about.json (${changes} change(s)), backup at ${backup}`);
  console.log('   Next: node scripts/generate-page-schema.mjs about');
  return 0;
}

process.exit(await main());
