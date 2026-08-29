#!/usr/bin/env node
/**
 * Standalone regression test for the collection-content primitive
 * (src/lib/content/collections/*). There is no page template consuming it yet (that's a
 * separate, later task), so this is the only thing exercising it — esbuild-bundles the
 * TypeScript modules to a temp ESM file (written inside the project root so `zod` resolves
 * from node_modules, deleted again once the run finishes) and asserts against plain functions
 * with node:assert, the same technique used to test the flat-page schema validators.
 *
 * Assumes content/{groups,articles,events}.json already exist — run
 * `node scripts/seed-collections.mjs` first if this fails with "content/groups.json is missing".
 *
 *   node scripts/test-collections.mjs
 */
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const ENTRY = resolve('src/lib/content/collections/_test-entry.ts');
const OUT = resolve('./__collections_test.mjs');

// esbuild needs a real entry file on disk (not stdin) to resolve the relative imports below
// against src/lib/content/collections/, so this writes a throwaway entry point re-exporting
// everything the assertions need, bundles it, then deletes both the entry and the bundle.
const entrySource = `
export * from './codec';
export * from './registry';
export * from './store';
export { default as GROUPS_COLLECTION } from './groups';
export { default as ARTICLES_COLLECTION } from './articles';
export { default as EVENTS_COLLECTION } from './events';
`;

async function main() {
  await writeFile(ENTRY, entrySource, 'utf8');
  try {
    await build({
      entryPoints: [ENTRY],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: OUT,
      packages: 'external',
      // Not run through Vite here, so import.meta.env doesn't exist — json-file.ts reads
      // import.meta.env.DEV to pick a cache TTL; treat it as prod (false) for this harness.
      define: { 'import.meta.env.DEV': 'false' },
      logLevel: 'silent',
    });

    const mod = await import(OUT);
    await runAssertions(mod);
    console.log('all collection assertions passed');
  } finally {
    await unlink(ENTRY).catch(() => {});
    await unlink(OUT).catch(() => {});
  }
}

async function runAssertions(mod) {
  const {
    zodForItemFields,
    zodForCollection,
    GROUPS_COLLECTION,
    ARTICLES_COLLECTION,
    EVENTS_COLLECTION,
    validateCollectionUpdate,
    getCollectionContent,
  } = mod;

  // 1. Each collection's own `newItem` template — a fully-shaped record covering every
  //    declared key, same convention as a page's on-disk content — is a minimal valid item.
  //    (Unlike a scalar 'value'/'boolean'/'list' field, a 'text'/'image' field has no
  //    top-level default — every registered key is required, matching the page validator's
  //    "no such thing as optional content" contract; only its *inner* en/ar default to '').
  for (const [label, collection] of [
    ['groups', GROUPS_COLLECTION],
    ['articles', ARTICLES_COLLECTION],
    ['events', EVENTS_COLLECTION],
  ]) {
    const result = zodForItemFields(collection.fields).safeParse(collection.newItem);
    assert.equal(
      result.success,
      true,
      `${label}: newItem should validate — ${result.success ? '' : JSON.stringify(result.error.issues)}`,
    );
  }

  // 2. Missing-required-key vs extra-key, isolated against a known-valid baseline.
  {
    const validator = zodForItemFields(EVENTS_COLLECTION.fields);
    // `title` is 'text'-kind ({en,ar}), which has no top-level default (unlike a 'value'
    // field like `link`) — omitting it entirely is the case that should fail.
    const { title, ...missingTitle } = EVENTS_COLLECTION.newItem;
    const missingKey = validator.safeParse(missingTitle);
    assert.equal(missingKey.success, false, 'events: a missing declared text-kind key should be rejected');

    const wrongShape = validator.safeParse({ ...EVENTS_COLLECTION.newItem, day: 5 }); // number, not string
    assert.equal(wrongShape.success, false, 'events: a non-string value field should be rejected');

    const extraKey = validator.safeParse({ ...EVENTS_COLLECTION.newItem, bogus: 'x' });
    assert.equal(extraKey.success, false, 'events: an undeclared key should be rejected (.strict())');
  }

  // 3. A 'list' field round-trips arrays of length 0, 1, and 7 — proving the variable-length
  //    design (every repeating structure in the real data varies in length per record).
  {
    const statsSchema = zodForItemFields(GROUPS_COLLECTION.fields).shape.stats;
    for (const n of [0, 1, 7]) {
      const items = Array.from({ length: n }, (_, i) => ({ n: String(i), l: { en: `label ${i}`, ar: '' } }));
      const result = statsSchema.safeParse(items);
      assert.equal(result.success, true, `groups.stats should accept an array of length ${n}`);
      assert.equal(result.data.length, n);
    }
  }

  // 4. Id-set enforcement: removal is never allowed (addable or not — an empty {} must not
  //    silently wipe a whole addable collection, since z.record({}) has nothing to reject on
  //    its own); addition is allowed only when the collection is addable.
  {
    const { readCollectionData } = mod;
    const existingArticles = await readCollectionData('articles');
    const oneArticleId = Object.keys(existingArticles)[0];

    const addedId = { ...existingArticles, 'new-fake-id': ARTICLES_COLLECTION.newItem };
    assert.throws(
      () => validateCollectionUpdate('articles', existingArticles, addedId),
      /does not allow adding records/,
      'articles: adding an id should be rejected (fixed set)',
    );
    const removedId = { ...existingArticles };
    delete removedId[oneArticleId];
    assert.throws(
      () => validateCollectionUpdate('articles', existingArticles, removedId),
      /does not allow removing records/,
      'articles: removing an id should be rejected',
    );

    const existingGroups = await readCollectionData('groups');
    const oneGroupId = Object.keys(existingGroups)[0];

    const addedGroupId = { ...existingGroups, 'wg-new-test': GROUPS_COLLECTION.newItem };
    const groupsResult = validateCollectionUpdate('groups', existingGroups, addedGroupId);
    assert.ok(groupsResult['wg-new-test'], 'groups: adding an id should be accepted (addable)');

    const removedGroupId = { ...existingGroups };
    delete removedGroupId[oneGroupId];
    assert.throws(
      () => validateCollectionUpdate('groups', existingGroups, removedGroupId),
      /does not allow removing records/,
      'groups: removing an existing id should be rejected even though the collection is addable',
    );

    assert.throws(
      () => validateCollectionUpdate('groups', existingGroups, {}),
      /does not allow removing records/,
      'groups: an empty {} must not silently wipe the whole collection',
    );
  }

  // 5. getCollectionContent()'s typed accessors match what's actually on disk.
  {
    const groups = await getCollectionContent('groups');
    const items = groups.items();
    assert.ok(items.length >= 9, 'groups should have at least the 9 seeded records');
    const palmWeevil = items.find((i) => i.id === 'palm-weevil');
    assert.ok(palmWeevil, 'palm-weevil should be among the seeded groups');
    assert.equal(palmWeevil.value('no'), '01');
    assert.equal(palmWeevil.value('ch'), 'pests');
    assert.equal(typeof palmWeevil.text('name').en, 'string');
    assert.ok(palmWeevil.text('name').en.length > 0);
    assert.ok(Array.isArray(palmWeevil.list('stats')));

    const article = await getCollectionContent('articles');
    const firstCohort = article.item('first-cohort');
    assert.equal(firstCohort.flag('ph'), false, 'first-cohort article should have ph: false');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
