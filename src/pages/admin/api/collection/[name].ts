import type { APIRoute } from 'astro';
import {
  InvalidCollectionError,
  MissingCollectionError,
  pruneReplacedCollectionUploads,
  readCollectionData,
  validateCollectionUpdate,
  writeCollectionData,
} from '../../../../lib/content/collections/store';
import { getCollectionFields, isEditableCollection } from '../../../../lib/content/collections/registry';

/**
 * Read/write endpoint for the admin panel's live editing of ./content/{groups,articles,events}.json
 * — the collection-shaped counterpart to ../content/[page].ts.
 *
 * Reachable only under /admin, which src/middleware.ts already gates behind a valid session —
 * there is no separate auth check here, matching content/[page].ts. Nothing in
 * public/admin/admin.js calls this yet; that wiring (plus add/remove-record UI) is a
 * separate, later task.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ params }) => {
  const name = params.name ?? '';
  if (!isEditableCollection(name)) return json({ error: `"${name}" is not an editable collection` }, 404);

  try {
    return json(await readCollectionData(name));
  } catch (err) {
    if (err instanceof MissingCollectionError) return json({ error: err.message }, 404);
    throw err;
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  const name = params.name ?? '';
  if (!isEditableCollection(name)) return json({ error: `"${name}" is not an editable collection` }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'request body must be JSON' }, 400);
  }

  try {
    const existing = await readCollectionData(name);
    const validated = validateCollectionUpdate(name, existing, body);
    await writeCollectionData(name, validated);
    await pruneReplacedCollectionUploads(getCollectionFields(name), existing, validated);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof MissingCollectionError) return json({ error: err.message }, 404);
    if (err instanceof InvalidCollectionError) return json({ error: err.message }, 400);
    throw err;
  }
};
