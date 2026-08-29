import type { APIRoute } from 'astro';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

/**
 * Serves the admin's uploaded images and documents out of ./public/uploads.
 *
 * public/ is copied into the build output once, at build time, so a file uploaded after
 * a deploy would 404 until the next build. This route reads the directory from disk on
 * each request instead, which is what makes uploads usable without a rebuild. In
 * `astro dev` Astro's own public/ handler answers first with the same bytes.
 */

const UPLOADS_DIR = resolve(process.cwd(), 'public', 'uploads');

const MIME: Record<string, string> = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

const notFound = () => new Response('Not found', { status: 404 });

export const GET: APIRoute = async ({ params, request }) => {
  const rest = params.path ?? '';
  if (!rest) return notFound();

  // The whole path is attacker-controlled, so resolve first and then prove the result is
  // still inside the uploads directory — `..` segments and absolute paths both die here.
  const target = resolve(join(UPLOADS_DIR, decodeURIComponent(rest)));
  if (target !== UPLOADS_DIR && !target.startsWith(UPLOADS_DIR + sep)) return notFound();

  let info;
  try {
    info = await stat(target);
  } catch {
    return notFound();
  }
  if (!info.isFile()) return notFound();

  const lastModified = new Date(info.mtimeMs);
  lastModified.setMilliseconds(0);

  const since = request.headers.get('if-modified-since');
  if (since && new Date(since).getTime() >= lastModified.getTime()) {
    return new Response(null, { status: 304 });
  }

  const headers = new Headers({
    'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': String(info.size),
    'Last-Modified': lastModified.toUTCString(),
    // Uploads are replaced under the same name when the admin swaps an image, so the
    // filename is not a version — keep the window short and let revalidation do the rest.
    'Cache-Control': 'public, max-age=300, must-revalidate',
  });

  const body = Readable.toWeb(createReadStream(target)) as ReadableStream;
  return new Response(body, { status: 200, headers });
};
