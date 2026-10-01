import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  // Uploaded images are public and never depend on who is asking, so they skip the
  // session lookup, which is a database read per request.
  const path = context.url.pathname;
  if (path.startsWith('/media/') || path.startsWith('/uploads/')) {
    context.locals.user = null;
    context.locals.session = null;
    return next();
  }

  const result = await auth.api.getSession({ headers: context.request.headers });

  context.locals.user = result?.user ?? null;
  context.locals.session = result?.session ?? null;

  if (path.startsWith('/admin')) {
    if (!context.locals.user) {
      return context.redirect('/en/login', 302);
    }
    if (context.locals.user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }
  }

  return next();
});
