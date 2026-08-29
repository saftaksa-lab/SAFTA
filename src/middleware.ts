import { defineMiddleware } from 'astro:middleware';
import { validateSession } from './lib/auth/session';

const SESSION_COOKIE = 'safta_admin_sid';

export const onRequest = defineMiddleware((context, next) => {
  if (!context.url.pathname.startsWith('/admin')) return next();

  const sid = context.cookies.get(SESSION_COOKIE)?.value;
  if (sid && validateSession(sid)) return next();

  context.cookies.delete(SESSION_COOKIE, { path: '/' });
  return context.redirect('/en/login');
});
