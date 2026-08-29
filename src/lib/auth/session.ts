import { randomBytes } from 'node:crypto';

interface Session {
  createdAt: number;
  lastSeenAt: number;
}

// Guarded on globalThis so sessions survive Vite/HMR module re-evaluation
// during `astro dev` — without it, editing any file that transitively
// imports this module would silently log everyone out.
const globalForSessions = globalThis as unknown as { __saftaAdminSessions?: Map<string, Session> };
const sessions = (globalForSessions.__saftaAdminSessions ??= new Map<string, Session>());

// Sessions live only in this process's memory: a restart invalidates every
// session, and this design assumes exactly one Node instance (no sticky
// sessions to configure because there's nothing to balance across).
function idleTimeoutMs() {
  const minutes = Number(import.meta.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30;
  return minutes * 60_000;
}

function absoluteTimeoutMs() {
  const minutes = Number(import.meta.env.SESSION_ABSOLUTE_TIMEOUT_MINUTES) || 480;
  return minutes * 60_000;
}

export function createSession(): string {
  const id = randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(id, { createdAt: now, lastSeenAt: now });
  return id;
}

export function validateSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  const now = Date.now();
  if (now - session.lastSeenAt > idleTimeoutMs() || now - session.createdAt > absoluteTimeoutMs()) {
    sessions.delete(id);
    return false;
  }

  session.lastSeenAt = now;
  return true;
}

export function destroySession(id: string): void {
  sessions.delete(id);
}

function sweepExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastSeenAt > idleTimeoutMs() || now - session.createdAt > absoluteTimeoutMs()) {
      sessions.delete(id);
    }
  }
}

const globalForSweep = globalThis as unknown as { __saftaAdminSweep?: NodeJS.Timeout };
if (!globalForSweep.__saftaAdminSweep) {
  globalForSweep.__saftaAdminSweep = setInterval(sweepExpiredSessions, 5 * 60_000).unref();
}
