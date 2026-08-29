import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Shared mtime-cached read / atomic write for JSON files under ./content — used by both
 * store.ts (flat page content) and collections/store.ts (id-keyed collection content).
 * ./content is gitignored — it is the admin's live data store, not source — so every read
 * goes to disk, cached just long enough to keep that off the critical path of a request.
 */

const CONTENT_DIR = resolve(process.cwd(), 'content');

// Dev revalidates on every read so an edit shows up on the next reload; production trades
// a few seconds of staleness for not touching the filesystem on every hit.
const REVALIDATE_MS = import.meta.env.DEV ? 0 : 5_000;

interface CacheEntry {
  data: unknown;
  mtimeMs: number;
  checkedAt: number;
}

// Guarded on globalThis for the same reason as the session map: Vite re-evaluates this
// module on every HMR update during `astro dev`, and a module-local Map would be thrown
// away with it.
const globalForJson = globalThis as unknown as { __saftaJsonFileCache?: Map<string, CacheEntry> };
const cache = (globalForJson.__saftaJsonFileCache ??= new Map<string, CacheEntry>());

/**
 * Reads `content/<fileName>` with mtime-based revalidation. `makeMissingError` lets each
 * caller throw its own domain-specific "missing" error (e.g. MissingContentError vs.
 * MissingCollectionError) with a message pointing at the right seed script.
 */
export async function readJsonCached<T>(fileName: string, makeMissingError: () => Error): Promise<T> {
  const path = join(CONTENT_DIR, fileName);
  const cached = cache.get(path);
  const now = Date.now();

  if (cached && now - cached.checkedAt < REVALIDATE_MS) return cached.data as T;

  let mtimeMs: number;
  try {
    ({ mtimeMs } = await stat(path));
  } catch {
    cache.delete(path);
    throw makeMissingError();
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
 * Replaces `content/<fileName>`. Writes to a sibling temp file and renames, so a reader
 * never observes a half-written file, and primes the cache with what was just written so
 * the site reflects the edit immediately instead of waiting out the revalidate window.
 */
export async function writeJsonAtomic<T>(fileName: string, data: T): Promise<void> {
  const path = join(CONTENT_DIR, fileName);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const json = JSON.stringify(data, null, 2) + '\n';

  await writeFile(tmp, json, 'utf8');
  await rename(tmp, path);

  const { mtimeMs } = await stat(path);
  cache.set(path, { data, mtimeMs, checkedAt: Date.now() });
}
