/**
 * Shared key extraction for the flat-page schema modules, used by
 * ../check-schema-drift.mjs and ../prune-orphan-keys.mjs.
 *
 * Both blocks read here are generator output (generate-page-schema.mjs), so their
 * formatting is stable enough to read with a regex. This deliberately avoids importing the
 * TypeScript modules so the tools run on a production checkout with no build step and no
 * esbuild present.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCHEMA_DIR = join(ROOT, 'src', 'lib', 'content', 'schema');
export const CONTENT_DIR = join(ROOT, 'content');

/** The registry's PAGES map is the source of truth for which pages are admin-writable —
 *  read the names from it rather than keeping a second list to fall out of date. */
export async function registeredPages() {
  const src = await readFile(join(SCHEMA_DIR, 'registry.ts'), 'utf8');
  const block = src.match(/const PAGES\s*=\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error('could not locate the PAGES map in schema/registry.ts');
  return [...block[1].matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]);
}

/** `fields` drives the zod validator (every key required, `.strict()` rejects the rest);
 *  `sections` is the subset the admin UI actually renders and therefore sends. */
export async function schemaKeys(page) {
  const src = await readFile(join(SCHEMA_DIR, `${page}.ts`), 'utf8');

  const fieldsBlock = src.slice(src.indexOf('_FIELDS'), src.indexOf('_SECTIONS'));
  const fields = [...fieldsBlock.matchAll(/^\s*"([^"]+)":\s*\{\s*kind:/gm)].map((m) => m[1]);

  const sectionsBlock = src.slice(src.indexOf('_SECTIONS'));
  const sections = [...sectionsBlock.matchAll(/fields:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));

  return { fields, sections };
}

/** The content/*.json file a page's data lives in — `<page>.json` unless the schema module
 *  declares a `contentFile` override (see registry.ts's getContentFile, which reads the same
 *  property off the imported module — this is that check's no-import, regex equivalent, so
 *  it stays runnable on a production checkout with no build step). A page like `members`
 *  overrides it because `content/members.json` is already claimed by the `_members`
 *  collection; without resolving this, these scripts would diff/prune the wrong file. */
export async function contentFileFor(page) {
  const src = await readFile(join(SCHEMA_DIR, `${page}.ts`), 'utf8');
  const match = src.match(/contentFile:\s*"([^"]+)"/);
  return match ? match[1] : `${page}.json`;
}

/** Returns null when the file is absent — content/ is gitignored, so a missing file is a
 *  seeding problem (npm run seed:content), not schema drift. */
export async function diskData(page) {
  try {
    return JSON.parse(await readFile(join(CONTENT_DIR, await contentFileFor(page)), 'utf8'));
  } catch {
    return null;
  }
}
