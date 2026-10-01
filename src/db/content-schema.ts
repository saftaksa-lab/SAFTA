/**
 * CMS content tables.
 *
 * Kept out of `schema.ts` on purpose: that file is overwritten wholesale by
 * `npx auth generate` (see docs/better-auth.md#regenerating-the-schema). Anything
 * hand-written there is lost on the next auth config change, so app tables live
 * here and `src/db/index.ts` re-exports both modules as one schema.
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { user } from './schema.ts';

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull();

/**
 * One row per editable single-instance surface — `home_hero`, `about_mission`, and
 * so on. `data` is a JSON payload whose shape is fixed by the Zod schema declared
 * for that key in `src/lib/content/schemas/`, and `schema_version` records which
 * version of that shape the row currently holds.
 *
 * The JSON column is not licence for a page builder: see
 * docs/content-storage.md#singletons-share-one-table.
 */
export const contentSingleton = sqliteTable('content_singleton', {
  key: text('key').primaryKey(),
  schemaVersion: integer('schema_version').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
});

/**
 * Uploaded images. The bytes live on disk under `UPLOAD_PATH`; this row is the
 * metadata, and the only thing content refers to.
 *
 * `id` is the SHA-256 of the stored file, so it is stable across environments
 * and the file path is derived from it — a user-supplied filename never reaches
 * the filesystem. See docs/content-storage.md#media-uploaded-images.
 */
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  ext: text('ext').notNull(),
  mimeType: text('mime_type').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  altAr: text('alt_ar').notNull(),
  /** Optional; the English site falls back to `altAr`. */
  altEn: text('alt_en').notNull().default(''),
  /** Display only; never a path. */
  originalName: text('original_name'),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
});

/**
 * The tables below are SAFTA's four collections. Each mirrors the input schema
 * of the same name in src/lib/content/repo.ts, which is the validator: a column
 * here and a field there change together. The field sources are in waterstrip's
 * docs/safta-key-map.md.
 *
 * Image columns (`logoId`, `imageId`) hold a `media` id, with no foreign key: an
 * import may legitimately arrive ahead of its media rows, and a dangling id
 * renders the placeholder. The dashboard's save path does check that the row
 * exists (see `assertMediaExists` in repo.ts).
 */

/** The member categories. Fixed, because the map colours and filter chips key off them. */
export const MEMBER_CATEGORIES = ['government', 'academic', 'private', 'nonprofit'] as const;

/** Alliance members: the directory, the profile page and the members map. */
export const member = sqliteTable(
  'member',
  {
    slug: text('slug').primaryKey(),
    category: text('category', { enum: MEMBER_CATEGORIES }).notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull().default(''),
    logoId: text('logo_id'),
    /** Shown in place of the logo when there is none, e.g. `MEWA`. */
    initials: text('initials').notNull(),
    roleAr: text('role_ar').notNull(),
    roleEn: text('role_en').notNull().default(''),
    sectorAr: text('sector_ar').notNull(),
    sectorEn: text('sector_en').notNull().default(''),
    /** Written as shown, e.g. `2026`. Not a date. */
    since: text('since').notNull(),
    bioAr: text('bio_ar').notNull(),
    bioEn: text('bio_en').notNull().default(''),
    /** Map position. A member without both is left off the map. */
    lat: real('lat'),
    lng: real('lng'),
    cityAr: text('city_ar').notNull().default(''),
    cityEn: text('city_en').notNull().default(''),
    countryAr: text('country_ar').notNull().default(''),
    countryEn: text('country_en').notNull().default(''),
    /** Ordering within the list only — not layout. Lower sorts first. */
    order: integer('order').notNull().default(0),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    updatedAt: updatedAt(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [index('member_order_idx').on(table.order)],
);

/** The challenge themes. Each picks a working-group tile's colour. */
export const WORKING_GROUP_CHALLENGES = ['pests', 'waste', 'climate', 'soil'] as const;

/** Working groups, shown as tiles on `/technologies`. The tile icon is keyed by slug in code. */
export const workingGroup = sqliteTable(
  'working_group',
  {
    slug: text('slug').primaryKey(),
    /** Display ordinal as printed, e.g. `01`. Not a sort key. */
    number: text('number').notNull(),
    challenge: text('challenge', { enum: WORKING_GROUP_CHALLENGES }).notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull().default(''),
    scopeAr: text('scope_ar').notNull(),
    scopeEn: text('scope_en').notNull().default(''),
    /** `null` renders the themed icon tile. */
    imageId: text('image_id'),
    order: integer('order').notNull().default(0),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    updatedAt: updatedAt(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [index('working_group_order_idx').on(table.order)],
);

/** News articles. `blocks` and `tags` are small open lists, so they store as JSON. */
export const article = sqliteTable(
  'article',
  {
    slug: text('slug').primaryKey(),
    kindAr: text('kind_ar').notNull(),
    kindEn: text('kind_en').notNull().default(''),
    /** Free text such as "July 28, 2026". Not parsed. */
    dateAr: text('date_ar').notNull(),
    dateEn: text('date_en').notNull().default(''),
    readTimeAr: text('read_time_ar').notNull(),
    readTimeEn: text('read_time_en').notNull().default(''),
    /** `null` uses `article_chrome.defaultImageId`. */
    imageId: text('image_id'),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull().default(''),
    ledeAr: text('lede_ar').notNull(),
    ledeEn: text('lede_en').notNull().default(''),
    blocks: text('blocks', { mode: 'json' })
      .notNull()
      .$type<{ id: string; headingAr: string; headingEn: string; bodyAr: string; bodyEn: string }[]>(),
    /** Optional in both languages. */
    quoteAr: text('quote_ar').notNull().default(''),
    quoteEn: text('quote_en').notNull().default(''),
    quoteByAr: text('quote_by_ar').notNull().default(''),
    quoteByEn: text('quote_by_en').notNull().default(''),
    tags: text('tags', { mode: 'json' })
      .notNull()
      .$type<{ id: string; labelAr: string; labelEn: string }[]>(),
    order: integer('order').notNull().default(0),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    updatedAt: updatedAt(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [index('article_order_idx').on(table.order)],
);

/** Events. `day` and `month` are written labels ("18", "SEP 2026"), not dates. */
export const event = sqliteTable(
  'event',
  {
    slug: text('slug').primaryKey(),
    day: text('day').notNull(),
    monthAr: text('month_ar').notNull(),
    monthEn: text('month_en').notNull().default(''),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull().default(''),
    descriptionAr: text('description_ar').notNull(),
    descriptionEn: text('description_en').notNull().default(''),
    /** A site path (localized when rendered) or an https URL. */
    href: text('href').notNull(),
    order: integer('order').notNull().default(0),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    updatedAt: updatedAt(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [index('event_order_idx').on(table.order)],
);
