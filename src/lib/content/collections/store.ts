import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ItemFieldMap, TypedItemContent } from './codec';
import { getCollectionMeta, getCollectionValidator, isEditableCollection, type CollectionName } from './registry';
import { readJsonCached, readJsonCachedWithRevision, writeJsonAtomic } from '../json-file';
import { resolveAsset } from '../store';

/**
 * Reads/writes the site's editable collections out of ./content/{groups,articles,events}.json
 * — the id-keyed counterpart to ../store.ts's flat PageData. Shares the same mtime-cached
 * read / atomic write primitives (../json-file.ts) as page content.
 */

const UPLOADS_DIR = resolve(process.cwd(), 'public', 'uploads');

type ItemValue = string | boolean | { en?: string; ar?: string } | { src?: string } | unknown[];
export type ItemRecord = Record<string, ItemValue>;
export type CollectionData = Record<string, ItemRecord>;

export class MissingCollectionError extends Error {}

function missingCollection(name: CollectionName) {
  return () =>
    new MissingCollectionError(
      `content/${name}.json is missing. The content directory is gitignored — run \`npm run seed:collections\` to recreate it from public/assets/js/.`,
    );
}

async function readJson(name: CollectionName): Promise<CollectionData> {
  return readJsonCached<CollectionData>(`${name}.json`, missingCollection(name));
}

/** The raw id-keyed record map for a collection, as stored on disk — what the admin edits. */
export async function readCollectionData(name: CollectionName): Promise<CollectionData> {
  return readJson(name);
}

/**
 * As readCollectionData, plus the collection file's revision — the admin panel stores it with
 * a draft so a later boot can tell whether someone else published over the copy that draft
 * was based on. See ../store.ts's readPageDataWithRevision.
 */
export async function readCollectionDataWithRevision(
  name: CollectionName,
): Promise<{ data: CollectionData; rev: string }> {
  return readJsonCachedWithRevision<CollectionData>(`${name}.json`, missingCollection(name));
}

/**
 * Replaces a collection's content file. See ../json-file.ts's writeJsonAtomic. Returns the
 * revision the file now carries, for the publishing admin panel to record against its draft.
 */
export async function writeCollectionData(name: CollectionName, data: CollectionData): Promise<string> {
  return writeJsonAtomic(`${name}.json`, data);
}

export class InvalidCollectionError extends Error {}

/**
 * Validates an admin-submitted record map against that collection's schema module (shape)
 * before it is ever passed to writeCollectionData, then enforces the id-set rule zod itself
 * can't express: removing an existing id is allowed only for `deletable` collections
 * (`_groups`/`_roles` — the old admin's delete button used to only ever undid a not-yet-published
 * add for every collection, never an already-saved record, until these opted into full
 * deletion), and adding a new id is allowed only for `addable` collections
 * (`_groups`/`_events`/`_roles`) — `_articles`' fixed 7-record set rejects both directions
 * identically.
 */
export function validateCollectionUpdate(
  name: string,
  existing: CollectionData,
  incoming: unknown,
): CollectionData {
  if (!isEditableCollection(name)) throw new InvalidCollectionError(`"${name}" has no registered schema`);

  const result = getCollectionValidator(name).safeParse(incoming);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    throw new InvalidCollectionError(`item "${path}": ${issue?.message ?? 'invalid content'}`);
  }
  const data = result.data as CollectionData;

  const meta = getCollectionMeta(name);

  // Removing an existing id is rejected unless the collection is `deletable` — a bare
  // z.record(...) validator has no opinion on this at all (an empty {} trivially "validates"
  // as zero records), so this is the one place that actually enforces it.
  const existingIds = Object.keys(existing);
  const incomingIds = new Set(Object.keys(data));
  const removed = existingIds.filter((id) => !incomingIds.has(id));
  if (removed.length && !meta.deletable) {
    throw new InvalidCollectionError(`"${name}" does not allow removing records (removed: ${removed.join(', ')})`);
  }

  if (!meta.addable) {
    const added = [...incomingIds].filter((id) => !existingIds.includes(id));
    if (added.length) {
      throw new InvalidCollectionError(`"${name}" does not allow adding records (added: ${added.join(', ')})`);
    }
  }

  return data;
}

/**
 * Deletes uploaded image files that a publish just replaced, across every item's `img`-kind
 * field in the whole collection — the collection-shaped counterpart to ../store.ts's
 * pruneReplacedUploads. A file is only deleted if no item's img field anywhere in the *new*
 * data still points at it.
 */
export async function pruneReplacedCollectionUploads(
  fields: ItemFieldMap,
  existing: CollectionData,
  next: CollectionData,
): Promise<void> {
  const imageKeys = Object.entries(fields)
    .filter(([, def]) => def.kind === 'image')
    .map(([key]) => key);
  if (!imageKeys.length) return;

  const keptSrcs = new Set<string>();
  for (const record of Object.values(next)) {
    for (const key of imageKeys) {
      const src = (record[key] as { src?: string } | undefined)?.src;
      if (src) keptSrcs.add(src);
    }
  }

  for (const record of Object.values(existing)) {
    for (const key of imageKeys) {
      const oldSrc = (record[key] as { src?: string } | undefined)?.src;
      if (!oldSrc || !oldSrc.startsWith('uploads/') || keptSrcs.has(oldSrc)) continue;

      const name = oldSrc.slice('uploads/'.length);
      if (!name || name.includes('/') || name.includes('\\')) continue;

      try {
        await unlink(join(UPLOADS_DIR, name));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`[collections] failed to delete replaced upload "${oldSrc}":`, err);
        }
      }
    }
  }
}

export interface ItemContent {
  text(key: string): { en: string; ar: string };
  image(key: string): { src: string };
  value(key: string): string;
  flag(key: string): boolean;
  list(key: string): unknown[];
}

function buildItemContent(record: ItemRecord): ItemContent {
  return {
    text(key) {
      const r = (record[key] as { en?: string; ar?: string } | undefined) ?? {};
      return { en: r.en ?? '', ar: r.ar ?? '' };
    },
    image(key) {
      const r = (record[key] as { src?: string } | undefined) ?? {};
      return { src: resolveAsset(r.src ?? '') };
    },
    value(key) {
      return typeof record[key] === 'string' ? (record[key] as string) : '';
    },
    flag(key) {
      return record[key] === true;
    },
    list(key) {
      return Array.isArray(record[key]) ? (record[key] as unknown[]) : [];
    },
  };
}

/**
 * `F` narrows the per-item accessors to one collection's own keys — pass its `*_FIELDS`
 * export as the type parameter (e.g. `getCollectionContent<typeof GROUPS_FIELDS>('groups')`).
 * `F` is a type-only hint: the accessors are still built generically and know nothing about
 * any specific collection's field set, same convention as ../store.ts's getPageContent.
 */
export async function getCollectionContent<F extends ItemFieldMap = ItemFieldMap>(
  name: CollectionName,
): Promise<{
  item(id: string): TypedItemContent<F>;
  items(): Array<{ id: string } & TypedItemContent<F>>;
}> {
  const data = await readJson(name);
  return {
    item(id) {
      const record = data[id] ?? {};
      return buildItemContent(record) as unknown as TypedItemContent<F>;
    },
    items() {
      return Object.entries(data).map(([id, record]) => ({
        id,
        ...(buildItemContent(record) as unknown as TypedItemContent<F>),
      }));
    },
  };
}
