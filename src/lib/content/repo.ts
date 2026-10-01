/**
 * The only writer for content tables.
 *
 * Every mutation validates with the same Zod schema the readers trust, writes in a
 * transaction, and then invalidates the affected cache key. Writing to
 * `content_singleton` or a collection table from anywhere else — a page, an
 * endpoint, an ad-hoc script — breaks the cache's single-source invalidation and
 * will serve stale content until the process restarts.
 */
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  article,
  contentSingleton,
  event,
  media,
  member,
  workingGroup,
  MEMBER_CATEGORIES,
  WORKING_GROUP_CHALLENGES,
} from '../../db/content-schema.ts';
import {
  singletons,
  singletonList,
  type AnySingleton,
  type SingletonData,
  type SingletonKey,
} from './schemas/index.ts';
import type { MediaRef } from './schemas/fields.ts';
import {
  arText,
  bilingual,
  collectMediaIds,
  enText,
  itemId,
  linkHref,
  mediaId,
  optionalBilingual,
  slug,
} from './schemas/fields.ts';
import {
  invalidateArticles,
  invalidateEvents,
  invalidateMembers,
  invalidateWorkingGroups,
  invalidateSingleton,
  invalidateAll,
  invalidateMedia,
  type Media,
} from './cache.ts';

/**
 * Note the plain field assignment rather than a TypeScript parameter property:
 * these modules are loaded by `node scripts/*.ts` under type-stripping, which
 * rejects parameter properties outright.
 */
export class ContentValidationError extends Error {
  issues: z.core.$ZodIssue[];

  constructor(message: string, issues: z.core.$ZodIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ContentValidationError(
      `${what} is not valid: ` +
        result.error.issues
          .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
          .join('; '),
      result.error.issues,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Singletons

/** Writes one singleton surface at its current schema version. */
export function setSingleton<K extends SingletonKey>(
  key: K,
  data: unknown,
  updatedBy?: string | null,
): SingletonData<K> {
  // Widened to the erased definition type: with several surfaces registered,
  // `singletons[key]` is a union whose `schema` TypeScript cannot correlate with
  // `SingletonData<K>`. The cast on the return below is what re-narrows it.
  const def: AnySingleton = singletons[key];
  const valid = parse(def.schema, data, `singleton "${key}"`);
  assertMediaExists(collectMediaIds(def.schema, valid));

  db.insert(contentSingleton)
    .values({
      key,
      schemaVersion: def.version,
      data: valid,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contentSingleton.key,
      set: {
        schemaVersion: def.version,
        data: valid,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    })
    .run();

  invalidateSingleton(key);
  return valid as SingletonData<K>;
}

/**
 * Inserts the declared initial payload for any singleton with no row yet.
 * Idempotent — existing rows are left alone. Runs as part of `npm run setup`.
 */
export function ensureSingletons(): string[] {
  const created: string[] = [];
  db.transaction((tx) => {
    for (const def of singletonList) {
      const existing = tx
        .select({ key: contentSingleton.key })
        .from(contentSingleton)
        .where(eq(contentSingleton.key, def.key))
        .get();
      if (existing) continue;

      tx.insert(contentSingleton)
        .values({
          key: def.key,
          schemaVersion: def.version,
          data: def.schema.parse(def.initial),
          updatedAt: new Date(),
        })
        .run();
      created.push(def.key);
    }
  });
  if (created.length) invalidateAll();
  return created;
}

// ---------------------------------------------------------------------------
// Collections
//
// Each is edited as a whole list and saved in one transaction (`replace*`): the
// lists are short, and replacing the list is what makes add, remove and reorder
// one operation. The field sources are in waterstrip's docs/safta-key-map.md.

const order = z.number().int().min(0).max(9999).default(0);
const published = z.boolean().default(true);

/** A map coordinate, or `null` for "not on the map". */
function coordinate(limit: number) {
  return z
    .number({ error: 'يجب أن يكون رقمًا.' })
    .min(-limit, `بين ‎-${limit}‎ و${limit}.`)
    .max(limit, `بين ‎-${limit}‎ و${limit}.`)
    .nullable()
    .default(null);
}

/** The member fields an admin may set. `updatedAt`/`updatedBy` are server-owned. */
export const memberInput = z
  .object({
    slug,
    category: z.enum(MEMBER_CATEGORIES, { error: 'اختر نوع الجهة.' }),
    ...bilingual('name', 200),
    logoId: mediaId.nullable().default(null),
    initials: arText(1, 6),
    ...bilingual('role', 200),
    ...bilingual('sector', 200),
    since: arText(1, 20),
    ...bilingual('bio', 1500),
    lat: coordinate(90),
    lng: coordinate(180),
    cityAr: enText(80).default(''),
    cityEn: enText(80).default(''),
    countryAr: enText(80).default(''),
    countryEn: enText(80).default(''),
    order,
    published,
  })
  .refine((m) => (m.lat === null) === (m.lng === null), {
    message: 'أدخل خط العرض وخط الطول معًا، أو اتركهما فارغين.',
    path: ['lng'],
  });

export type MemberInput = z.input<typeof memberInput>;

/** The working-group fields an admin may set. */
export const workingGroupInput = z.object({
  slug,
  number: arText(1, 8),
  challenge: z.enum(WORKING_GROUP_CHALLENGES, { error: 'اختر التحدي.' }),
  ...bilingual('name', 200),
  ...bilingual('scope', 800),
  imageId: mediaId.nullable().default(null),
  order,
  published,
});

export type WorkingGroupInput = z.input<typeof workingGroupInput>;

const articleBlock = z.object({
  id: itemId,
  ...bilingual('heading', 160),
  ...bilingual('body', 3000),
});

const articleTag = z.object({
  id: itemId,
  ...bilingual('label', 40),
});

/** The article fields an admin may set. */
export const articleInput = z.object({
  slug,
  ...bilingual('kind', 40),
  ...bilingual('date', 40),
  ...bilingual('readTime', 40),
  imageId: mediaId.nullable().default(null),
  ...bilingual('title', 200),
  ...bilingual('lede', 500),
  blocks: z.array(articleBlock).min(1, 'أضف فقرة واحدة على الأقل.').max(20),
  ...optionalBilingual('quote', 600),
  ...optionalBilingual('quoteBy', 160),
  tags: z.array(articleTag).max(6).default([]),
  order,
  published,
});

export type ArticleInput = z.input<typeof articleInput>;

/** The event fields an admin may set. */
export const eventInput = z.object({
  slug,
  day: arText(1, 8),
  ...bilingual('month', 40),
  ...bilingual('title', 200),
  ...bilingual('description', 600),
  href: linkHref,
  order,
  published,
});

export type EventInput = z.input<typeof eventInput>;

export interface ReplaceOptions {
  updatedBy?: string | null;
  /**
   * Refuse image ids with no `media` row. The dashboard sets it, as a singleton
   * save always does; an import leaves it off, because its rows may arrive ahead
   * of their files (see the note on `mediaId` in schemas/fields.ts).
   */
  requireMedia?: boolean;
}

/**
 * Validates a whole list. Issue paths start with the row index, so the dashboard
 * marks `3.nameAr` rather than the whole list. Slugs must be unique.
 */
function parseRows<T extends { slug: string }>(schema: z.ZodType<T>, inputs: unknown[], what: string): T[] {
  const rows: T[] = [];
  const issues: z.core.$ZodIssue[] = [];
  const seen = new Set<string>();

  inputs.forEach((input, i) => {
    // Checked on the raw value, so a duplicate is reported alongside the row's
    // other errors rather than only once they are fixed.
    const raw = (input as { slug?: unknown } | null)?.slug;
    const key = typeof raw === 'string' ? raw.trim() : null;
    if (key && seen.has(key)) {
      issues.push({
        code: 'custom',
        path: [i, 'slug'],
        message: 'هذا المعرّف مستخدم في سجل آخر.',
        input: key,
      } as z.core.$ZodIssue);
    }
    if (key) seen.add(key);

    const result = schema.safeParse(input);
    if (!result.success) {
      issues.push(...result.error.issues.map((issue) => ({ ...issue, path: [i, ...issue.path] })));
      return;
    }
    rows.push(result.data);
  });

  if (issues.length) {
    throw new ContentValidationError(
      `${what} is not valid: ` +
        issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '),
      issues,
    );
  }
  return rows;
}

function rowMediaRefs(schema: z.core.$ZodType, rows: unknown[]): MediaRef[] {
  return rows.flatMap((row, i) =>
    collectMediaIds(schema, row).map((ref) => ({ ...ref, path: [i, ...ref.path] })),
  );
}

function prepareRows<T extends { slug: string }>(
  schema: z.ZodType<T>,
  inputs: unknown[],
  what: string,
  options: ReplaceOptions,
): T[] {
  const rows = parseRows(schema, inputs, what);
  if (options.requireMedia) assertMediaExists(rowMediaRefs(schema, rows));
  return rows;
}

function stamp<T>(row: T, options: ReplaceOptions) {
  return { ...row, updatedBy: options.updatedBy ?? null, updatedAt: new Date() };
}

export function replaceMembers(inputs: unknown[], options: ReplaceOptions = {}): number {
  const rows = prepareRows(memberInput, inputs, 'members', options);
  db.transaction((tx) => {
    tx.delete(member).run();
    for (const row of rows) tx.insert(member).values(stamp(row, options)).run();
  });
  invalidateMembers();
  return rows.length;
}

export function replaceWorkingGroups(inputs: unknown[], options: ReplaceOptions = {}): number {
  const rows = prepareRows(workingGroupInput, inputs, 'working groups', options);
  db.transaction((tx) => {
    tx.delete(workingGroup).run();
    for (const row of rows) tx.insert(workingGroup).values(stamp(row, options)).run();
  });
  invalidateWorkingGroups();
  return rows.length;
}

export function replaceArticles(inputs: unknown[], options: ReplaceOptions = {}): number {
  const rows = prepareRows(articleInput, inputs, 'articles', options);
  db.transaction((tx) => {
    tx.delete(article).run();
    for (const row of rows) tx.insert(article).values(stamp(row, options)).run();
  });
  invalidateArticles();
  return rows.length;
}

export function replaceEvents(inputs: unknown[], options: ReplaceOptions = {}): number {
  const rows = prepareRows(eventInput, inputs, 'events', options);
  db.transaction((tx) => {
    tx.delete(event).run();
    for (const row of rows) tx.insert(event).values(stamp(row, options)).run();
  });
  invalidateEvents();
  return rows.length;
}

/** Every collection's input schema, for the import's dry run and reference report. */
export const collectionInputs = {
  members: memberInput,
  workingGroups: workingGroupInput,
  articles: articleInput,
  events: eventInput,
} as const;

/** Validates a list without writing it. Used by the import before its transaction. */
export function validateRows(name: keyof typeof collectionInputs, inputs: unknown[]): unknown[] {
  return parseRows(collectionInputs[name] as z.ZodType<{ slug: string }>, inputs, name);
}

/** Every image reference in a validated list, with row-prefixed paths. */
export function collectionMediaRefs(name: keyof typeof collectionInputs, rows: unknown[]): MediaRef[] {
  return rowMediaRefs(collectionInputs[name], rows);
}

// ---------------------------------------------------------------------------
// Media

/**
 * Alt text is required on every upload. Optional alt text is how alt text ends
 * up empty everywhere; see docs/content-storage.md#the-table.
 */
export const mediaAlt = arText(1, 200);

/** English alt text is optional; the English site falls back to `altAr`. */
export const mediaAltEn = enText(200);

/**
 * A media row as the pipeline produces it and as an import envelope carries it.
 * `updatedAt`/`updatedBy` are server-owned, as on every other content table.
 */
export const mediaInput = z.object({
  id: mediaId,
  ext: z.enum(['webp', 'jpg', 'png']),
  mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altAr: mediaAlt,
  altEn: mediaAltEn.default(''),
  originalName: z.string().max(200).nullable().default(null),
});

export type MediaInput = z.input<typeof mediaInput>;

export function findMedia(id: string): Media | null {
  return db.select().from(media).where(eq(media.id, id)).get() ?? null;
}

/**
 * Payloads cannot carry a foreign key, so this is the check a column would
 * otherwise have guaranteed. Issues carry the field path, so the dashboard
 * marks the image field that failed rather than the whole section.
 */
function assertMediaExists(refs: MediaRef[]): void {
  if (!refs.length) return;
  const ids = [...new Set(refs.map((r) => r.id))];
  const found = new Set(
    db.select({ id: media.id }).from(media).where(inArray(media.id, ids)).all().map((r) => r.id),
  );
  const missing = refs.filter((r) => !found.has(r.id));
  if (!missing.length) return;

  throw new ContentValidationError(
    `unknown media id(s): ${missing.map((r) => r.id).join(', ')}`,
    missing.map((r) => ({
      code: 'custom',
      path: r.path,
      message: 'الصورة غير موجودة. ارفعها من جديد.',
      input: r.id,
    })) as z.core.$ZodIssue[],
  );
}

/**
 * Records an uploaded image. Idempotent by content hash: inserting bytes that are
 * already stored returns the existing row, alt text included, and says so.
 */
export function insertMedia(
  input: MediaInput,
  updatedBy?: string | null,
): { media: Media; duplicate: boolean } {
  const valid = parse(mediaInput, input, 'media');
  const inserted = db
    .insert(media)
    .values({ ...valid, updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .onConflictDoNothing({ target: media.id })
    .returning()
    .get();

  if (inserted) {
    invalidateMedia(inserted.id);
    return { media: inserted, duplicate: false };
  }
  return { media: findMedia(valid.id)!, duplicate: true };
}
