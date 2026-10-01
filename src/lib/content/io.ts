/**
 * Content import and export.
 *
 * One envelope, one code path — used for backups, for moving content between
 * environments, and (in Phase 4 of the port) for loading SAFTA's legacy content.
 *
 * Export is **content only**. `user`, `session` and `account` rows never enter the
 * envelope: password hashes must not leave in a file an admin can download.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { article, contentSingleton, event, media, member, workingGroup } from '../../db/content-schema.ts';
import { singletons, singletonList, type SingletonKey } from './schemas/index.ts';
import { upgrade } from './migrate.ts';
import {
  mediaInput,
  replaceArticles,
  replaceEvents,
  replaceMembers,
  replaceWorkingGroups,
  validateRows,
  collectionMediaRefs,
  collectionInputs,
  ContentValidationError,
} from './repo.ts';
import { collectMediaIds } from './schemas/fields.ts';
import { mediaFilePath } from './media-paths.ts';
import { invalidateAll } from './cache.ts';

export const FORMAT = 'safta-content';
export const FORMAT_VERSION = 1;

const envelopeSchema = z.object({
  format: z.literal(FORMAT),
  formatVersion: z.number().int().min(1).max(FORMAT_VERSION),
  exportedAt: z.string(),
  singletons: z.record(
    z.string(),
    z.object({ schemaVersion: z.number().int().min(1), data: z.unknown() }),
  ),
  collections: z.object({
    events: z.array(z.unknown()),
    media: z.array(z.unknown()),
    workingGroups: z.array(z.unknown()),
    articles: z.array(z.unknown()),
    members: z.array(z.unknown()),
  }),
});

export type Envelope = z.infer<typeof envelopeSchema>;

export function exportContent(): Envelope {
  const rows = db.select().from(contentSingleton).all();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const out: Envelope['singletons'] = {};
  for (const def of singletonList) {
    const row = byKey.get(def.key);
    out[def.key] = row
      ? { schemaVersion: row.schemaVersion, data: row.data }
      : { schemaVersion: def.version, data: def.schema.parse(def.initial) };
  }

  const events = db
    .select()
    .from(event)
    .orderBy(asc(event.order), asc(event.slug))
    .all()
    // Server-owned columns are not content; they would be meaningless in another
    // environment where the user ids differ.
    .map(({ updatedAt: _u, updatedBy: _b, ...rest }) => rest);

  // Metadata only. The files travel separately (`rsync data/uploads/`): see
  // docs/content-storage.md#import-and-export.
  const mediaRows = db
    .select()
    .from(media)
    .orderBy(asc(media.id))
    .all()
    .map(({ updatedAt: _u, updatedBy: _b, ...rest }) => rest);

  const workingGroups = db
    .select()
    .from(workingGroup)
    .orderBy(asc(workingGroup.order), asc(workingGroup.slug))
    .all()
    .map(({ updatedAt: _u, updatedBy: _b, ...rest }) => rest);

  const articles = db
    .select()
    .from(article)
    .orderBy(asc(article.order), asc(article.slug))
    .all()
    .map(({ updatedAt: _u, updatedBy: _b, ...rest }) => rest);

  const members = db
    .select()
    .from(member)
    .orderBy(asc(member.order), asc(member.slug))
    .all()
    .map(({ updatedAt: _u, updatedBy: _b, ...rest }) => rest);

  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    singletons: out,
    collections: { events, media: mediaRows, workingGroups, articles, members },
  };
}

export interface ImportReport {
  singletons: Array<{ key: string; from: number; to: number; migrated: boolean }>;
  events: number;
  workingGroups: number;
  articles: number;
  members: number;
  media: number;
  skippedSingletons: string[];
  /**
   * Media rows whose file is not under UPLOAD_PATH. A warning, not a failure: the
   * rows import, and every reference resolves once the files are copied across.
   */
  missingBlobs: string[];
  /** Singleton image references with no media row in the database or the envelope. */
  danglingMedia: Array<{ key: string; path: string; id: string }>;
  dryRun: boolean;
}

/**
 * Validates an envelope in full, runs every singleton up its ladder, and only then
 * writes — inside a single transaction. An envelope that fails validation anywhere
 * writes nothing at all.
 */
export function importContent(
  input: unknown,
  options: { dryRun?: boolean; updatedBy?: string | null } = {},
): ImportReport {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ContentValidationError(
      'not a valid content envelope: ' +
        parsed.error.issues
          .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
          .join('; '),
      parsed.error.issues,
    );
  }
  const envelope = parsed.data;
  const dryRun = options.dryRun ?? false;

  // Phase 1: validate and migrate everything in memory.
  const prepared: Array<{ key: SingletonKey; version: number; data: unknown; from: number }> = [];
  const skippedSingletons: string[] = [];

  for (const [key, record] of Object.entries(envelope.singletons)) {
    if (!(key in singletons)) {
      // A surface this build does not know about — an envelope from a newer app, or
      // a key that has since been retired. Report it rather than failing the import.
      skippedSingletons.push(key);
      continue;
    }
    const typedKey = key as SingletonKey;
    const def = singletons[typedKey];
    prepared.push({
      key: typedKey,
      version: def.version,
      data: upgrade(def, record.schemaVersion, record.data),
      from: record.schemaVersion,
    });
  }

  const mediaRows = envelope.collections.media.map((m, i) => {
    const result = mediaInput.safeParse(m);
    if (!result.success) {
      throw new ContentValidationError(
        `media[${i}] is not valid: ` +
          result.error.issues
            .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
            .join('; '),
        result.error.issues,
      );
    }
    return result.data;
  });

  const events = validateRows('events', envelope.collections.events);
  const workingGroups = validateRows('workingGroups', envelope.collections.workingGroups);
  const articles = validateRows('articles', envelope.collections.articles);
  const members = validateRows('members', envelope.collections.members);

  // References are tolerated, not enforced — see the note on `mediaId` in fields.ts.
  const refs: Array<{ key: string; path: string; id: string }> = prepared.flatMap((p) =>
    collectMediaIds(singletons[p.key].schema, p.data).map((ref) => ({
      key: p.key,
      path: ref.path.join('.'),
      id: ref.id,
    })),
  );
  const lists = { events, workingGroups, articles, members };
  for (const name of Object.keys(collectionInputs) as Array<keyof typeof collectionInputs>) {
    for (const ref of collectionMediaRefs(name, lists[name])) {
      refs.push({ key: name, path: ref.path.join('.'), id: ref.id });
    }
  }
  const knownIds = new Set(mediaRows.map((m) => m.id));
  const unresolved = [...new Set(refs.map((r) => r.id).filter((id) => !knownIds.has(id)))];
  if (unresolved.length) {
    for (const row of db
      .select({ id: media.id })
      .from(media)
      .where(inArray(media.id, unresolved))
      .all()) {
      knownIds.add(row.id);
    }
  }

  const report: ImportReport = {
    singletons: prepared.map((p) => ({
      key: p.key,
      from: p.from,
      to: p.version,
      migrated: p.from !== p.version,
    })),
    events: events.length,
    workingGroups: workingGroups.length,
    articles: articles.length,
    members: members.length,
    media: mediaRows.length,
    skippedSingletons,
    missingBlobs: mediaRows.filter((m) => !existsSync(mediaFilePath(m.id, m.ext))).map((m) => m.id),
    danglingMedia: refs.filter((r) => !knownIds.has(r.id)),
    dryRun,
  };

  if (dryRun) return report;

  // Phase 2: write. Nothing here can fail validation.
  db.transaction((tx) => {
    // Upserted, never replaced: media rows are immutable apart from alt text, and
    // deleting rows absent from the envelope would orphan their files.
    for (const row of mediaRows) {
      tx.insert(media)
        .values({ ...row, updatedBy: options.updatedBy ?? null, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: media.id,
          set: {
            altAr: row.altAr,
            altEn: row.altEn,
            originalName: row.originalName,
            updatedBy: options.updatedBy ?? null,
            updatedAt: new Date(),
          },
        })
        .run();
    }

    for (const item of prepared) {
      tx.insert(contentSingleton)
        .values({
          key: item.key,
          schemaVersion: item.version,
          data: item.data,
          updatedBy: options.updatedBy ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: contentSingleton.key,
          set: {
            schemaVersion: item.version,
            data: item.data,
            updatedBy: options.updatedBy ?? null,
            updatedAt: new Date(),
          },
        })
        .run();
    }
  });

  const by = { updatedBy: options.updatedBy };
  replaceEvents(events, by);
  replaceWorkingGroups(workingGroups, by);
  replaceArticles(articles, by);
  replaceMembers(members, by);
  invalidateAll();
  return report;
}

export interface ResetReport {
  singletons: number;
  events: number;
  workingGroups: number;
  articles: number;
  members: number;
  media: number;
  /** Uploaded files removed from UPLOAD_PATH. Can be lower than `media` if a file was already missing. */
  mediaFilesDeleted: number;
}

/**
 * Wipes every content surface back to nothing: singletons, events, working
 * groups, articles, members, media rows, and their uploaded files. Unlike
 * `importContent`, which upserts singletons and media so a restore can never
 * orphan files, this is the one path that actually deletes them — it exists
 * for staff who want a blank slate to re-seed onto, not for routine imports.
 */
export function resetContent(): ResetReport {
  const singletonRows = db.select({ key: contentSingleton.key }).from(contentSingleton).all();
  const eventRows = db.select({ slug: event.slug }).from(event).all();
  const workingGroupRows = db.select({ slug: workingGroup.slug }).from(workingGroup).all();
  const articleRows = db.select({ slug: article.slug }).from(article).all();
  const memberRows = db.select({ slug: member.slug }).from(member).all();
  const mediaRows = db.select({ id: media.id, ext: media.ext }).from(media).all();

  let mediaFilesDeleted = 0;
  for (const row of mediaRows) {
    const filePath = mediaFilePath(row.id, row.ext);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      mediaFilesDeleted += 1;
    }
  }

  db.transaction((tx) => {
    tx.delete(contentSingleton).run();
    tx.delete(media).run();
  });
  replaceEvents([]);
  replaceWorkingGroups([]);
  replaceArticles([]);
  replaceMembers([]);
  invalidateAll();

  return {
    singletons: singletonRows.length,
    events: eventRows.length,
    workingGroups: workingGroupRows.length,
    articles: articleRows.length,
    members: memberRows.length,
    media: mediaRows.length,
    mediaFilesDeleted,
  };
}

/** True when no content has been imported or edited yet. */
export function isContentEmpty(): boolean {
  const singleton = db.select({ key: contentSingleton.key }).from(contentSingleton).get();
  const anyEvent = db.select({ slug: event.slug }).from(event).get();
  const anyWorkingGroup = db.select({ slug: workingGroup.slug }).from(workingGroup).get();
  const anyArticle = db.select({ slug: article.slug }).from(article).get();
  const anyMember = db.select({ slug: member.slug }).from(member).get();
  const anyMedia = db.select({ id: media.id }).from(media).get();
  return !singleton && !anyEvent && !anyWorkingGroup && !anyArticle && !anyMember && !anyMedia;
}
