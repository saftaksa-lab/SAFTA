/**
 * The upload pipeline: identify, normalise, hash, store.
 *
 * One sharp pass per upload, never per request. The output is always WebP, which
 * is what makes the content hash a useful dedupe key: the same source image
 * normalises to the same bytes, so uploading it twice returns the existing row.
 *
 * Nothing on the render path may import this module — `cache.ts` in particular.
 * Rendering needs a metadata row and a URL (`media-paths.ts`); sharp and the
 * filesystem belong to the dashboard's write path only.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import { mediaFilePath, MEDIA_MIME_TYPES } from './media-paths.ts';
import { ContentValidationError, findMedia, insertMedia, mediaAlt, mediaAltEn } from './repo.ts';
import type { Media } from './cache.ts';

/** Enforced here and in the endpoint; the reverse proxy should match it. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Long-edge cap. Larger sources are scaled down, smaller ones never up. */
const MAX_EDGE = 2400;

/** ~120 MP. Above this sharp refuses to decode: a decompression bomb, not a photo. */
const MAX_INPUT_PIXELS = 120_000_000;

/** sharp's names for what it identified. `heif` covers AVIF. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

/** Rejected for a reason the admin can act on. The message is shown verbatim. */
export class MediaRejectedError extends Error {}

export interface IngestInput {
  bytes: Buffer;
  altAr: unknown;
  /** Optional English alt text; empty or absent means "fall back to `altAr`". */
  altEn?: unknown;
  originalName?: string | null;
  updatedBy?: string | null;
}

export interface IngestResult {
  media: Media;
  /** True when these bytes were already stored; the existing row is returned unchanged. */
  duplicate: boolean;
}

/**
 * Filenames are display-only, but they are still rendered in the dashboard, so
 * control characters and bidi overrides are removed — an Arabic filename with an
 * embedded U+202E would otherwise reorder the text around it.
 */
function displayName(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, 200);
  return clean || null;
}

export async function ingestImage(input: IngestInput): Promise<IngestResult> {
  // Cheap checks before the expensive decode.
  const alt = mediaAlt.safeParse(input.altAr);
  if (!alt.success) {
    throw new ContentValidationError(
      'النص البديل للصورة مطلوب.',
      alt.error.issues.map((issue) => ({ ...issue, path: ['altAr', ...issue.path] })),
    );
  }
  const altEn = mediaAltEn.safeParse(input.altEn ?? '');
  if (!altEn.success) {
    throw new ContentValidationError(
      'النص البديل الإنجليزي غير صالح.',
      altEn.error.issues.map((issue) => ({ ...issue, path: ['altEn', ...issue.path] })),
    );
  }
  if (input.bytes.length === 0) throw new MediaRejectedError('الملف فارغ.');
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new MediaRejectedError('حجم الملف يتجاوز الحد المسموح (8 ميغابايت).');
  }

  // Identify by magic bytes. The declared Content-Type and the file extension are
  // both attacker-controlled and are never consulted.
  let metadata: Metadata;
  try {
    metadata = await sharp(input.bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new MediaRejectedError('تعذّر التعرّف على الملف كصورة.');
  }
  if (metadata.format === 'svg') {
    // SVG is executable. See docs/content-storage.md#svg-uploads-are-refused-not-sanitized.
    throw new MediaRejectedError('ملفات SVG غير مقبولة. ارفع الصورة بصيغة PNG أو JPEG.');
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new MediaRejectedError('صيغة غير مدعومة. الصيغ المقبولة: JPEG وPNG وWebP وAVIF.');
  }

  // A PNG with transparency, or a small one, is almost always a logo or a
  // diagram: lossy WebP would smear its edges. Everything else is a photo.
  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  const lossless = metadata.format === 'png' && (metadata.hasAlpha || pixels <= 1_000_000);

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(input.bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      // Apply the EXIF orientation before the metadata is dropped, or a phone
      // photo lands sideways. sharp strips EXIF (and its GPS block) by default.
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp(lossless ? { lossless: true } : { quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaRejectedError('تعذّرت معالجة الصورة. جرّب حفظها بصيغة JPEG أو PNG ثم أعد رفعها.');
  }

  const ext = 'webp';
  const id = createHash('sha256').update(output.data).digest('hex');

  const existing = findMedia(id);
  if (existing) return { media: existing, duplicate: true };

  // File first, row second: a row must never point at a file that is not there.
  // A crash between the two leaves an orphan file, which is harmless.
  const path = mediaFilePath(id, ext);
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, output.data);
    await rename(temp, path);
  }

  return insertMedia(
    {
      id,
      ext,
      mimeType: MEDIA_MIME_TYPES[ext],
      bytes: output.info.size,
      width: output.info.width,
      height: output.info.height,
      altAr: alt.data,
      altEn: altEn.data,
      originalName: displayName(input.originalName),
    },
    input.updatedBy,
  );
}
