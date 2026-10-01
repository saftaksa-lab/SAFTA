import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth.ts';

// Better Auth's own endpoints (plugin routes, session handling). The login and
// logout forms post to /api/login and /api/logout instead, but plugin features
// added later route through here.
export const ALL: APIRoute = (ctx) => auth.handler(ctx.request);
