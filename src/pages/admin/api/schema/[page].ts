import type { APIRoute } from 'astro';
import { isEditablePage, getAdminSchema } from '../../../../lib/content/schema/registry';

/**
 * Serves a page's editable-field layout straight from its schema module
 * (src/lib/content/schema/registry.ts) instead of the admin panel's hand-maintained
 * public/admin/schema.js. admin.js fetches this at boot for apiBacked pages and merges it
 * over the static copy, so the server's schema module — not a second, independently
 * hand-edited file — is what actually governs which fields the admin can touch.
 *
 * Reachable only under /admin, which src/middleware.ts already gates behind a valid
 * session — there is no separate auth check here, matching src/pages/admin/index.astro.
 */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ params }) => {
  const page = params.page ?? '';
  if (!isEditablePage(page)) return json({ error: `"${page}" has no registered schema` }, 404);
  return json(getAdminSchema(page));
};
