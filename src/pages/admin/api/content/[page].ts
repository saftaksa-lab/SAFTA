import type { APIRoute } from 'astro';
import {
  MissingContentError,
  InvalidContentError,
  pruneReplacedUploads,
  readPageData,
  validatePageUpdate,
  writePageData,
} from '../../../../lib/content/store';
import { isEditablePage } from '../../../../lib/content/schema/registry';

/**
 * Read/write endpoint for the admin panel's live editing of ./content/<page>.json.
 *
 * Reachable only under /admin, which src/middleware.ts already gates behind a valid
 * session — there is no separate auth check here, matching src/pages/admin/index.astro.
 *
 * Only pages with a registered schema module (src/lib/content/schema/registry.ts) accept
 * writes. The rest still go through the legacy admin flow (download assets/content/<page>.js
 * and commit it by hand) until they are migrated too.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ params }) => {
  const page = params.page ?? '';
  if (!isEditablePage(page)) return json({ error: `"${page}" is not editable from the admin yet` }, 404);

  try {
    return json(await readPageData(page));
  } catch (err) {
    if (err instanceof MissingContentError) return json({ error: err.message }, 404);
    throw err;
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  const page = params.page ?? '';
  if (!isEditablePage(page)) return json({ error: `"${page}" is not editable from the admin yet` }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'request body must be JSON' }, 400);
  }

  try {
    const existing = await readPageData(page);
    const validated = validatePageUpdate(page, body);
    await writePageData(page, validated);
    await pruneReplacedUploads(existing, validated);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof MissingContentError) return json({ error: err.message }, 404);
    if (err instanceof InvalidContentError) return json({ error: err.message }, 400);
    throw err;
  }
};
