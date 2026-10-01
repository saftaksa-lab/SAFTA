/**
 * Where a media row's file lives, and the URL it is served at.
 *
 * Pure and sharp-free on purpose: the cache, the import path and the serving
 * endpoint all need these, and none of them may pull the upload pipeline
 * (`media.ts`) onto their import graph.
 */
import { join } from 'node:path';
import { env } from '../env.ts';

/** The public URL shape. The reverse proxy and `src/pages/media/[file].ts` both serve it. */
export const MEDIA_FILE_PATTERN = /^([0-9a-f]{64})\.(webp|jpg|png)$/;

export const MEDIA_MIME_TYPES = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
} as const;

export type MediaExt = keyof typeof MEDIA_MIME_TYPES;

export function mediaUrl(id: string, ext: string): string {
  return `/media/${id}.${ext}`;
}

/** `<UPLOAD_PATH>/<ab>/<cd>/<hash>.<ext>` — two levels of fanout keep directories small. */
export function mediaFilePath(id: string, ext: string): string {
  return join(env.UPLOAD_PATH, id.slice(0, 2), id.slice(2, 4), `${id}.${ext}`);
}
