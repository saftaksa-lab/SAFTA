/**
 * The GET and PUT handlers every collection endpoint shares. Not a route: Astro
 * skips files that start with `_`.
 *
 * PUT replaces the whole list in one transaction (repo.ts `replace*`). The list
 * arrives in display order, so each row's `order` is set here from its position,
 * which is what makes moving a row up or down stick.
 *
 * Under `/admin` because src/middleware.ts gates that prefix; the role check is
 * belt-and-braces for the day that guard moves.
 */
import type { APIRoute } from 'astro';
import { ContentValidationError, type ReplaceOptions } from '../../../lib/content/repo.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Rows as the dashboard sees them: the server-owned columns stripped. */
function editable<T extends { updatedAt?: unknown; updatedBy?: unknown }>(rows: readonly T[]) {
  return rows.map(({ updatedAt: _a, updatedBy: _b, ...rest }) => rest);
}

export function collectionEndpoint<T extends { updatedAt?: unknown; updatedBy?: unknown }>(
  what: string,
  listAll: () => readonly T[],
  replace: (rows: unknown[], options: ReplaceOptions) => number,
): { GET: APIRoute; PUT: APIRoute } {
  const GET: APIRoute = ({ locals }) => {
    if (locals.user?.role !== 'admin') return json({ ok: false, message: 'غير مصرّح.' }, 403);
    return json({ ok: true, data: editable(listAll()) }, 200);
  };

  const PUT: APIRoute = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') return json({ ok: false, message: 'غير مصرّح.' }, 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: 'تعذّرت قراءة البيانات المرسلة.' }, 400);
    }
    if (!Array.isArray(body) || body.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      return json({ ok: false, message: 'صيغة البيانات غير صحيحة.' }, 400);
    }

    const rows = body.map((row, i) => ({ ...(row as object), order: i * 10 }));
    try {
      replace(rows, { updatedBy: locals.user.id, requireMedia: true });
      return json({ ok: true, data: editable(listAll()) }, 200);
    } catch (error) {
      if (error instanceof ContentValidationError) {
        return json(
          { ok: false, message: 'تعذّر الحفظ: راجع الحقول المميّزة بالأحمر.', issues: error.issues },
          422,
        );
      }
      console.error(`[content] failed to write ${what}`, error);
      return json({ ok: false, message: 'حدث خطأ غير متوقّع أثناء الحفظ.' }, 500);
    }
  };

  return { GET, PUT };
}
