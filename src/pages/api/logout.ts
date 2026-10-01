import type { APIRoute } from 'astro';
import { auth } from '../../lib/auth.ts';

export const POST: APIRoute = async ({ request }) => {
  const headers = new Headers({ Location: '/en/login' });

  try {
    const result = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    for (const cookie of result.headers.getSetCookie()) {
      headers.append('Set-Cookie', cookie);
    }
  } catch {
    // Already signed out or no valid session — fall through to the redirect.
  }

  return new Response(null, { status: 302, headers });
};
