/**
 * The in-memory content cache.
 *
 * The node adapter runs standalone in a single process, so module state *is* the
 * cache. Getters are synchronous — `better-sqlite3` is a synchronous driver — so
 * Astro components read content without `await` and without a loading state.
 *
 * Invalidation has exactly one source: every write goes through `repo.ts`, which
 * refreshes the affected key after its transaction commits. There is no TTL and no
 * stale window. This is why nothing outside `repo.ts` may write to these tables.
 *
 * Keep this module's imports minimal — dev-mode module reloading can otherwise
 * leave two live copies of the cache with divergent contents.
 *
 * Single process is a deployment requirement, not an accident: see
 * docs/content-storage.md#the-in-memory-cache.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { article, contentSingleton, event, media, member, workingGroup } from '../../db/content-schema.ts';
import { singletons, type SingletonData, type SingletonKey } from './schemas/index.ts';
import { upgrade } from './migrate.ts';
import { mediaUrl } from './media-paths.ts';

export type Event = typeof event.$inferSelect;
export type Media = typeof media.$inferSelect;
export type WorkingGroup = typeof workingGroup.$inferSelect;
export type Article = typeof article.$inferSelect;
export type Member = typeof member.$inferSelect;

/** What a page — or a dashboard preview — needs to render an uploaded image. */
export interface MediaView {
  id: string;
  url: string;
  width: number;
  height: number;
  altAr: string;
  altEn: string;
}

const singletonCache = new Map<SingletonKey, unknown>();
let eventCache: readonly Event[] | null = null;
let workingGroupCache: readonly WorkingGroup[] | null = null;
let articleCache: readonly Article[] | null = null;
let memberCache: readonly Member[] | null = null;
/** `null` is cached too: a dangling id is looked up once, not on every render. */
const mediaCache = new Map<string, MediaView | null>();

/** Recursive freeze so a caller cannot mutate cached content in place. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
  }
  return value;
}

function loadSingleton<K extends SingletonKey>(key: K): SingletonData<K> {
  const def = singletons[key];
  const row = db
    .select()
    .from(contentSingleton)
    .where(eq(contentSingleton.key, key))
    .get();

  // No row yet: fall back to the declared initial value rather than throwing, so a
  // half-seeded database still renders. `repo.ensureSingletons()` writes these in.
  const data = row
    ? upgrade(def, row.schemaVersion, row.data)
    : def.schema.parse(def.initial);

  return deepFreeze(data) as SingletonData<K>;
}

/** Reads one editable single-instance surface. Synchronous and cached. */
export function getSingleton<K extends SingletonKey>(key: K): SingletonData<K> {
  if (!singletonCache.has(key)) singletonCache.set(key, loadSingleton(key));
  return singletonCache.get(key) as SingletonData<K>;
}

/** Published events, in list order. Ordering within a list is not layout. */
export function listEvents(): readonly Event[] {
  if (!eventCache) {
    eventCache = deepFreeze(
      db
        .select()
        .from(event)
        .where(eq(event.published, true))
        .orderBy(asc(event.order), asc(event.slug))
        .all(),
    );
  }
  return eventCache;
}

/** Every event including unpublished ones — for the dashboard, not the public site. */
export function listAllEvents(): Event[] {
  return db.select().from(event).orderBy(asc(event.order), asc(event.slug)).all();
}

/** Published working groups, in list order. Ordering within a list is not layout. */
export function listWorkingGroups(): readonly WorkingGroup[] {
  if (!workingGroupCache) {
    workingGroupCache = deepFreeze(
      db
        .select()
        .from(workingGroup)
        .where(eq(workingGroup.published, true))
        .orderBy(asc(workingGroup.order), asc(workingGroup.slug))
        .all(),
    );
  }
  return workingGroupCache;
}

/** One published working group by slug, or `null` if it does not exist or is unpublished. */
export function getWorkingGroup(slug: string): WorkingGroup | null {
  return listWorkingGroups().find((g) => g.slug === slug) ?? null;
}

/** Every working group including unpublished ones — for the dashboard, not the public site. */
export function listAllWorkingGroups(): WorkingGroup[] {
  return db.select().from(workingGroup).orderBy(asc(workingGroup.order), asc(workingGroup.slug)).all();
}

/** Published articles, in list order. Ordering within a list is not layout. */
export function listArticles(): readonly Article[] {
  if (!articleCache) {
    articleCache = deepFreeze(
      db
        .select()
        .from(article)
        .where(eq(article.published, true))
        .orderBy(asc(article.order), asc(article.slug))
        .all(),
    );
  }
  return articleCache;
}

/** One published article by slug, or `null` if it does not exist or is unpublished. */
export function getArticle(slug: string): Article | null {
  return listArticles().find((a) => a.slug === slug) ?? null;
}

/** Every article including unpublished ones — for the dashboard, not the public site. */
export function listAllArticles(): Article[] {
  return db.select().from(article).orderBy(asc(article.order), asc(article.slug)).all();
}

/** Published members, in list order. Ordering within a list is not layout. */
export function listMembers(): readonly Member[] {
  if (!memberCache) {
    memberCache = deepFreeze(
      db
        .select()
        .from(member)
        .where(eq(member.published, true))
        .orderBy(asc(member.order), asc(member.slug))
        .all(),
    );
  }
  return memberCache;
}

/** One published member by slug, or `null` if it does not exist or is unpublished. */
export function getMember(slug: string): Member | null {
  return listMembers().find((m) => m.slug === slug) ?? null;
}

/** Every member including unpublished ones — for the dashboard, not the public site. */
export function listAllMembers(): Member[] {
  return db.select().from(member).orderBy(asc(member.order), asc(member.slug)).all();
}

/**
 * One uploaded image's metadata, or `null` when no row has that id — a reference
 * imported ahead of its media rows. Callers fall back to placeholder artwork.
 */
export function getMedia(id: string): MediaView | null {
  if (!mediaCache.has(id)) {
    const row = db.select().from(media).where(eq(media.id, id)).get();
    mediaCache.set(
      id,
      row
        ? deepFreeze({
            id: row.id,
            url: mediaUrl(row.id, row.ext),
            width: row.width,
            height: row.height,
            altAr: row.altAr,
            altEn: row.altEn,
          })
        : null,
    );
  }
  return mediaCache.get(id)!;
}

export function invalidateSingleton(key: SingletonKey): void {
  singletonCache.delete(key);
}

export function invalidateEvents(): void {
  eventCache = null;
}

export function invalidateWorkingGroups(): void {
  workingGroupCache = null;
}

export function invalidateArticles(): void {
  articleCache = null;
}

export function invalidateMembers(): void {
  memberCache = null;
}

export function invalidateMedia(id: string): void {
  mediaCache.delete(id);
}

/** Drops everything. Used after an import, which can touch every surface. */
export function invalidateAll(): void {
  singletonCache.clear();
  eventCache = null;
  workingGroupCache = null;
  articleCache = null;
  memberCache = null;
  mediaCache.clear();
}
