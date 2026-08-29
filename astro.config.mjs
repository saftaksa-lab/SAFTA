import { defineConfig } from 'astro/config';

export default defineConfig({
  // Routes are extensionless (`/en/about` -> dist/en/about.html) rather than directories
  // with an index.html each. Pages live two segments deep now (/en/x, /ar/x); every relative
  // `assets/...` reference still resolves because BaseLayout emits `<base href="/">`.
  build: { format: 'file' },
  trailingSlash: 'never',

  // Astro's default host is 'localhost', which Node 17+ resolves to ::1 first, so the
  // dev/preview server ends up bound to the IPv6 loopback only. Under WSL2 the Windows
  // browser reaches the server over IPv4, finds nothing listening, and hangs until it
  // times out. Binding IPv4 loopback explicitly fixes that and keeps the server off the
  // LAN — pass `--host` on the command line when you do want it reachable from a phone.
  server: { host: '127.0.0.1' },
});
