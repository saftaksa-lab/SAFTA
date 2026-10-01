/**
 * Serves uploaded images at `/media/<sha256>.<ext>`.
 *
 * In production the reverse proxy should serve UPLOAD_PATH at this URL itself, so
 * Node never sees an image request. This endpoint is the fallback that keeps
 * `npm run build && npm start` working on a box with no proxy in front — and the
 * path in development.
 *
 * No database read and no auth: the filename is the whole lookup, validated
 * against a strict pattern before it is joined to a path, so it cannot traverse.
 * src/middleware.ts skips its session lookup for this prefix.
 */
import type { APIRoute } from 'astro';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  MEDIA_FILE_PATTERN,
  MEDIA_MIME_TYPES,
  mediaFilePath,
  type MediaExt,
} from '../../lib/content/media-paths.ts';

export const GET: APIRoute = async ({ params, request }) => {
  const match = MEDIA_FILE_PATTERN.exec(params.file ?? '');
  if (!match) return new Response('Not found', { status: 404 });

  const [, id, ext] = match as unknown as [string, string, MediaExt];
  const path = mediaFilePath(id, ext);

  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // The content cannot change underneath its hash, so the hash is the ETag and
  // the response may be cached forever.
  const headers = new Headers({
    'content-type': MEDIA_MIME_TYPES[ext],
    'cache-control': 'public, max-age=31536000, immutable',
    etag: `"${id}"`,
    'x-content-type-options': 'nosniff',
  });

  if (request.headers.get('if-none-match') === `"${id}"`) {
    return new Response(null, { status: 304, headers });
  }

  headers.set('content-length', String(size));
  const body = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
  return new Response(body, { status: 200, headers });
};
