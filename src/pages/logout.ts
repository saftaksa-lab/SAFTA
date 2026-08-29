import type { APIRoute } from 'astro';
import { destroySession } from '../lib/auth/session';

const SESSION_COOKIE = 'safta_admin_sid';

export const POST: APIRoute = ({ cookies, redirect }) => {
  const sid = cookies.get(SESSION_COOKIE)?.value;
  if (sid) destroySession(sid);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/en/login');
};
