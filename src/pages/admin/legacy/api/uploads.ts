import type { APIRoute } from 'astro';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Accepts an image upload from the admin panel and writes it into ./public/uploads,
 * where src/pages/uploads/[...path].ts serves it back out. Reachable only under /admin,
 * which src/middleware.ts already gates behind a valid session.
 */

const UPLOADS_DIR = resolve(process.cwd(), 'public', 'uploads');
const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'expected multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'missing "file"' }, 400);
  if (file.size === 0) return json({ error: 'file is empty' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'file exceeds 3MB' }, 400);

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return json({ error: `unsupported type "${file.type}"` }, 400);

  // Mirror the sanitize + uniquify convention the admin already used for its (now
  // retired) client-only draft images, so uploaded-image filenames stay predictable.
  const stem = file.name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').toLowerCase() || 'upload';
  const name = `${Date.now().toString(36)}-${stem}${ext}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(resolve(UPLOADS_DIR, name), buffer);

  return json({ path: `uploads/${name}` });
};
