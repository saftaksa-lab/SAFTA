import 'dotenv/config';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

// BETTER_AUTH_URL is the site's public origin (Better Auth needs it for cookies). It
// also tells Astro which X-Forwarded-Host/-Proto values to trust from the reverse proxy:
// without that, a TLS-terminating proxy makes every request look like http:// to Astro,
// the browser's https:// Origin never matches, and the CSRF check below 403s every
// login POST — the reason checkOrigin was once switched off. Read at build time, so
// rebuild after changing it.
const publicUrl = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null;

export default defineConfig({
  // The admin panel needs a real server for sessions and the database, so the whole
  // site renders on demand through a standalone Node process.
  output: 'server',
  // The adapter's default body limit is 1 GB. Image uploads cap at 8 MB once the new
  // media pipeline lands; this leaves headroom for the multipart envelope.
  adapter: node({ mode: 'standalone', bodySizeLimit: 10 * 1024 * 1024 }),
  // React is for the /admin dashboard only. Public pages stay zero-JS-framework.
  integrations: [react()],
  trailingSlash: 'never',

  // Astro's default host is 'localhost', which Node 17+ resolves to ::1 first, so the
  // dev/preview server ends up bound to the IPv6 loopback only. Under WSL2 the Windows
  // browser reaches the server over IPv4, finds nothing listening, and hangs until it
  // times out. Binding IPv4 loopback explicitly fixes that and keeps the server off the
  // LAN — pass `--host` on the command line when you do want it reachable from a phone.
  server: { host: '127.0.0.1' },

  // Astro's CSRF origin check stays on (the default): a cross-site form POST to
  // /api/login or /admin/api/* gets a 403. curl needs -H "Origin: http://127.0.0.1:4321".
  security: {
    allowedDomains: publicUrl
      ? [{ hostname: publicUrl.hostname, protocol: publicUrl.protocol.replace(':', '') }]
      : [],
  },
});
