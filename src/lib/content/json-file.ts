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
  rev: string;
  checkedAt: number;
}

/**
 * Response header the admin API carries a content revision on. The admin panel stores the
 * revision alongside the draft it keeps in localStorage; on its next boot a mismatch means
 * another browser published in the meantime, so that draft describes content nobody has any
 * more. Kept here, next to the revisions themselves, since both routes send it.
 */
export const REVISION_HEADER = 'X-Content-Revision';

/**
 * Opaque per-file revision handed to the admin panel so it can tell whether a draft held in
 * one browser's localStorage was based on the copy the server still has. mtime alone can
 * collide when two writes land in the same millisecond, so size is folded in as well.
 */
function revisionOf(mtimeMs: number, size: number): string {
  return `${Math.round(mtimeMs)}-${size}`;
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
  return (await readJsonCachedWithRevision<T>(fileName, makeMissingError)).data;
}

/**
 * As readJsonCached, but also returns the file's current revision. The revision travels with
 * the data it was read alongside — a cache hit returns the revision that was recorded for
 * that same parse — so a caller can never pair fresh content with a stale revision.
 */
export async function readJsonCachedWithRevision<T>(
  fileName: string,
  makeMissingError: () => Error,
): Promise<{ data: T; rev: string }> {
  const path = join(CONTENT_DIR, fileName);
  const cached = cache.get(path);
  const now = Date.now();

  if (cached && now - cached.checkedAt < REVALIDATE_MS) return { data: cached.data as T, rev: cached.rev };

  let mtimeMs: number;
  let size: number;
  try {
    ({ mtimeMs, size } = await stat(path));
  } catch {
    cache.delete(path);
    throw makeMissingError();
  }

  if (cached && cached.mtimeMs === mtimeMs) {
    cached.checkedAt = now;
    return { data: cached.data as T, rev: cached.rev };
  }

  const data = JSON.parse(await readFile(path, 'utf8')) as T;
  const rev = revisionOf(mtimeMs, size);
  cache.set(path, { data, mtimeMs, rev, checkedAt: now });
  return { data, rev };
}

/**
 * Replaces `content/<fileName>`. Writes to a sibling temp file and renames, so a reader
 * never observes a half-written file, and primes the cache with what was just written so
 * the site reflects the edit immediately instead of waiting out the revalidate window.
 *
 * Returns the revision the file now carries, so a publish can hand it straight back to the
 * admin panel that made the write.
 */
export async function writeJsonAtomic<T>(fileName: string, data: T): Promise<string> {
  const path = join(CONTENT_DIR, fileName);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const json = JSON.stringify(data, null, 2) + '\n';

  await writeFile(tmp, json, 'utf8');
  await rename(tmp, path);

  const { mtimeMs, size } = await stat(path);
  const rev = revisionOf(mtimeMs, size);
  cache.set(path, { data, mtimeMs, rev, checkedAt: Date.now() });
  return rev;
}
