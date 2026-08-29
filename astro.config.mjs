import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // The admin panel needs a real server to check credentials against .env and enforce
  // session cookies via middleware, so the whole site now renders on demand through a
  // standalone Node process instead of shipping as prebuilt static files.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',

  // Astro's default host is 'localhost', which Node 17+ resolves to ::1 first, so the
  // dev/preview server ends up bound to the IPv6 loopback only. Under WSL2 the Windows
  // browser reaches the server over IPv4, finds nothing listening, and hangs until it
  // times out. Binding IPv4 loopback explicitly fixes that and keeps the server off the
  // LAN — pass `--host` on the command line when you do want it reachable from a phone.
  server: { host: '127.0.0.1' },
  security: {
    checkOrigin: false
  }
});
