import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { FieldMap, TypedPageContent } from './schema/codec';
import { getPageValidator, isEditablePage } from './schema/registry';

/**
 * Reads the site's editable content out of ./content/*.json at request time.
 *
 * The directory is gitignored — it is the admin's data store, not source — so it is read
 * from disk rather than imported. To keep that off the critical path of every request the
 * parsed JSON is cached in memory and only revalidated periodically: a cached page is
 * handed back untouched until REVALIDATE_MS has elapsed, after which one stat() decides
 * whether anything actually needs re-parsing.
 */

const CONTENT_DIR = resolve(process.cwd(), 'content');
const UPLOADS_DIR = resolve(process.cwd(), 'public', 'uploads');

// Dev revalidates on every read so an edit shows up on the next reload; production trades
// a few seconds of staleness for not touching the filesystem on every hit.
const REVALIDATE_MS = import.meta.env.DEV ? 0 : 5_000;

export interface TextField {
  en: string;
  ar: string;
}

export interface ImageField {
  src: string;
  alt: string;
  altAr: string;
}

type Record_ = { en?: string; ar?: string; src?: string; alt?: string; alt_ar?: string };
export type PageData = Record<string, Record_>;

interface CacheEntry {
  data: unknown;
  mtimeMs: number;
  checkedAt: number;
}

// Guarded on globalThis for the same reason as the session map: Vite re-evaluates this
// module on every HMR update during `astro dev`, and a module-local Map would be thrown
// away with it.
const globalForContent = globalThis as unknown as { __saftaContentCache?: Map<string, CacheEntry> };
const cache = (globalForContent.__saftaContentCache ??= new Map<string, CacheEntry>());

export class MissingContentError extends Error {}

async function readJson<T>(fileName: string): Promise<T> {
  const path = join(CONTENT_DIR, fileName);
  const cached = cache.get(path);
  const now = Date.now();

  if (cached && now - cached.checkedAt < REVALIDATE_MS) return cached.data as T;

  let mtimeMs: number;
  try {
    ({ mtimeMs } = await stat(path));
  } catch {
    cache.delete(path);
    throw new MissingContentError(
      `content/${fileName} is missing. The content directory is gitignored — run \`npm run seed:content\` to recreate it from public/assets/content/.`,
    );
  }

  if (cached && cached.mtimeMs === mtimeMs) {
    cached.checkedAt = now;
    return cached.data as T;
  }

  const data = JSON.parse(await readFile(path, 'utf8')) as T;
  cache.set(path, { data, mtimeMs, checkedAt: now });
  return data;
}

/**
 * `assets/...` paths are relative on purpose — BaseLayout sets <base href="/"> so they
 * resolve from the site root at any route depth. Admin uploads live outside the build
 * output and are served by src/pages/uploads/[...path].ts, so they get a rooted path.
 */
export function resolveAsset(src: string): string {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('/')) return src;
  if (src.startsWith('uploads/')) return `/${src}`;
  return src;
}

/** The raw field map for a page, as stored on disk — what the admin edits. */
export async function readPageData(page: string): Promise<PageData> {
  return readJson<PageData>(`${page}.json`);
}

/**
 * Replaces a page's content file. Writes to a sibling temp file and renames, so a reader
 * never observes a half-written file, and primes the cache with what was just written so
 * the site reflects the edit immediately instead of waiting out the revalidate window.
 */
export async function writePageData(page: string, data: PageData): Promise<void> {
  const path = join(CONTENT_DIR, `${page}.json`);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const json = JSON.stringify(data, null, 2) + '\n';

  await writeFile(tmp, json, 'utf8');
  await rename(tmp, path);

  const { mtimeMs } = await stat(path);
  cache.set(path, { data, mtimeMs, checkedAt: Date.now() });
}

/**
 * Deletes uploaded image files that a publish just replaced, so re-uploading a page's
 * images repeatedly doesn't leak files into public/uploads forever. Only touches files
 * under uploads/ — asset paths from public/assets/content are never admin-uploaded and
 * are never removed. A file is only deleted if no field in the *new* data still points at
 * it, so two keys sharing one image never lose it out from under the surviving one.
 */
export async function pruneReplacedUploads(existing: PageData, next: PageData): Promise<void> {
  const keptSrcs = new Set(Object.values(next).map((r) => r.src).filter(Boolean));

  for (const key of Object.keys(existing)) {
    const oldSrc = existing[key]?.src;
    if (!oldSrc || !oldSrc.startsWith('uploads/')) continue;
    if (oldSrc === next[key]?.src) continue;
    if (keptSrcs.has(oldSrc)) continue;

    const name = oldSrc.slice('uploads/'.length);
    if (!name || name.includes('/') || name.includes('\\')) continue;

    try {
      await unlink(join(UPLOADS_DIR, name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[content] failed to delete replaced upload "${oldSrc}":`, err);
      }
    }
  }
}

export class InvalidContentError extends Error {}

/**
 * Validates an admin-submitted field map against that page's schema module
 * (./schema/<page>.ts, generated from the admin UI's field layout — see
 * ./schema/registry.ts) before it is ever passed to writePageData. The schema, not
 * whatever happens to already be on disk, is the source of truth for the editable key
 * set: every registered key is required (never fewer — a dropped key would blank the live
 * page) and no unregistered key is accepted (never more — an extra key is either a client
 * bug or an attempt to smuggle in data no renderer was written to expect). Each record
 * must keep its schema-declared shape — text stays {en, ar}, image stays
 * {src, alt, alt_ar} — because that shape is what tells the renderer which component
 * (Text vs Image) the key belongs to.
 */
export function validatePageUpdate(page: string, incoming: unknown): PageData {
  if (!isEditablePage(page)) throw new InvalidContentError(`"${page}" has no registered schema`);

  const result = getPageValidator(page).safeParse(incoming);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    throw new InvalidContentError(`field "${path}": ${issue?.message ?? 'invalid content'}`);
  }
  return result.data as PageData;
}

export interface PageContent {
  text(key: string): TextField;
  image(key: string): ImageField;
}

/**
 * `F` narrows `text()`/`image()` to one page's own keys — pass a page's `*_FIELDS` export
 * as the type parameter (e.g. `getPageContent<typeof ABOUT_FIELDS>('about')`) so a call
 * with a typo'd key, or a text call on an image key, is a compile-time error instead of a
 * silent blank field at runtime. `F` is a type-only hint: the accessors below are still
 * built generically and know nothing about any specific page's field set.
 */
export async function getPageContent<F extends FieldMap = FieldMap>(
  page: string,
): Promise<TypedPageContent<F>> {
  const data = await readJson<PageData>(`${page}.json`);

  function record(key: string, kind: string): Record_ {
    const found = data[key];
    if (found) return found;
    // A typo'd key is a bug, and in dev it should be impossible to miss. In production a
    // single bad key must not take the page down — it degrades to an empty field.
    const message = `content/${page}.json has no ${kind} field "${key}"`;
    if (import.meta.env.DEV) throw new Error(message);
    console.warn(`[content] ${message}`);
    return {};
  }

  const content: PageContent = {
    text(key) {
      const r = record(key, 'text');
      return { en: r.en ?? '', ar: r.ar ?? '' };
    },
    image(key) {
      const r = record(key, 'image');
      return { src: resolveAsset(r.src ?? ''), alt: r.alt ?? '', altAr: r.alt_ar ?? '' };
    },
  };
  return content as unknown as TypedPageContent<F>;
}
