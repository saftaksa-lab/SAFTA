/**
 * Uploads one image: multipart `file` plus `altAr` and an optional `altEn`.
 *
 * Returns the media row as a `MediaView`. Uploading does not attach the image to
 * anything — the dashboard puts the returned id into a section's draft, and the
 * section's own save writes the reference (and checks the row exists).
 *
 * Under `/admin` for the same reason as the content endpoint: the middleware gate
 * covers it, and the role check below is belt-and-braces.
 */
import type { APIRoute } from 'astro';
import { ContentValidationError } from '../../../../lib/content/repo.ts';
import { ingestImage, MAX_UPLOAD_BYTES, MediaRejectedError } from '../../../../lib/content/media.ts';
import { mediaUrl } from '../../../../lib/content/media-paths.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const TOO_LARGE = 'حجم الملف يتجاوز الحد المسموح (8 ميغابايت).';

/** Room for the multipart boundaries and the alt-text part around the file. */
const ENVELOPE_ALLOWANCE = 64 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return json({ ok: false, message: 'غير مصرّح.' }, 403);
  }

  // Refuse before buffering anything, when the client declares its size.
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_UPLOAD_BYTES + ENVELOPE_ALLOWANCE) {
    return json({ ok: false, message: TOO_LARGE }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: 'تعذّرت قراءة الملف المرسل.' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return json({ ok: false, message: 'لم يُرسَل أي ملف.' }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, message: TOO_LARGE }, 413);
  }

  try {
    const { media, duplicate } = await ingestImage({
      bytes: Buffer.from(await file.arrayBuffer()),
      altAr: form.get('altAr'),
      altEn: form.get('altEn'),
      originalName: file.name,
      updatedBy: locals.user.id,
    });
    return json(
      {
        ok: true,
        duplicate,
        media: {
          id: media.id,
          url: mediaUrl(media.id, media.ext),
          width: media.width,
          height: media.height,
          altAr: media.altAr,
          altEn: media.altEn,
        },
      },
      duplicate ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof MediaRejectedError) {
      return json({ ok: false, message: error.message }, 422);
    }
    if (error instanceof ContentValidationError) {
      return json({ ok: false, message: error.message, issues: error.issues }, 422);
    }
    console.error('[media] upload failed', error);
    return json({ ok: false, message: 'حدث خطأ غير متوقّع أثناء رفع الصورة.' }, 500);
  }
};
