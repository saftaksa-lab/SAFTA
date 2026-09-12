import type { APIRoute } from 'astro';
import { REVISION_HEADER } from '../../../lib/content/json-file';
import { getSiteSettingsWithRevision, updateSiteSettings } from '../../../lib/content/settings';

/**
 * Read/write endpoint for site-wide feature flags (src/lib/content/settings.ts) — currently
 * just `hideAwards`. Reachable only under /admin, which src/middleware.ts already gates
 * behind a valid session, matching src/pages/admin/api/content/[page].ts.
 */

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export const GET: APIRoute = async () => {
  const { data, rev } = await getSiteSettingsWithRevision();
  return json(data, 200, { [REVISION_HEADER]: rev });
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'request body must be JSON' }, 400);
  }

  if (typeof body !== 'object' || body === null || typeof (body as { hideAwards?: unknown }).hideAwards !== 'boolean') {
    return json({ error: 'body must be { hideAwards: boolean }' }, 400);
  }

  const { data, rev } = await updateSiteSettings({ hideAwards: (body as { hideAwards: boolean }).hideAwards });
  return json({ ok: true, ...data }, 200, { [REVISION_HEADER]: rev });
};
