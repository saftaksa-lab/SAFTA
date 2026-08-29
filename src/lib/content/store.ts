import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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
type PageData = Record<string, Record_>;

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

export interface PageContent {
  text(key: string): TextField;
  image(key: string): ImageField;
}

export async function getPageContent(page: string): Promise<PageContent> {
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

  return {
    text(key) {
      const r = record(key, 'text');
      return { en: r.en ?? '', ar: r.ar ?? '' };
    },
    image(key) {
      const r = record(key, 'image');
      return { src: resolveAsset(r.src ?? ''), alt: r.alt ?? '', altAr: r.alt_ar ?? '' };
    },
  };
}
