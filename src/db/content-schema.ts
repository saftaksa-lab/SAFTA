/**
 * CMS content tables.
 *
 * Kept out of `schema.ts` on purpose: that file is overwritten wholesale by
 * `npx auth generate` (see docs/better-auth.md#regenerating-the-schema). Anything
 * hand-written there is lost on the next auth config change, so app tables live
 * here and `src/db/index.ts` re-exports both modules as one schema.
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
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

