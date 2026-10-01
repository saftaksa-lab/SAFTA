/**
 * Writes one singleton surface.
 *
 * Lives under `/admin` on purpose: src/middleware.ts gates `/admin` only, not
 * `/api/*`. The role check below is belt-and-braces for the day that guard moves.
 *
 * Astro's CSRF origin check is on, which is why the dashboard's `fetch` must be
 * same-origin — it is, so no extra header is needed.
 */
import type { APIRoute } from 'astro';
import { setSingleton, ContentValidationError } from '../../../../lib/content/repo.ts';
import { isSingletonKey } from '../../../../lib/content/schemas/index.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return json({ ok: false, message: 'غير مصرّح.' }, 403);
  }

  const key = params.key;
  if (!key || !isSingletonKey(key)) {
    return json({ ok: false, message: 'قسم غير معروف.' }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: 'تعذّرت قراءة البيانات المرسلة.' }, 400);
  }

  try {
    const data = setSingleton(key, body, locals.user.id);
    return json({ ok: true, data }, 200);
  } catch (error) {
    if (error instanceof ContentValidationError) {
      return json(
        { ok: false, message: 'تعذّر الحفظ: راجع الحقول المميّزة بالأحمر.', issues: error.issues },
        422,
      );
    }
    console.error(`[content] failed to write singleton "${key}"`, error);
    return json({ ok: false, message: 'حدث خطأ غير متوقّع أثناء الحفظ.' }, 500);
  }
};
