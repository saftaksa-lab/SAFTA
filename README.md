# SAFTA v5

Bilingual (EN ⇄ AR) site for the Saudi AgriFood Tech Alliance, built with
[Astro](https://astro.build) and served on demand by a standalone Node process, so the
admin panel can authenticate and pages can read editable content at request time.

## Commands

```bash
npm install
npm run dev       # http://127.0.0.1:4321
npm run build     # → dist/
npm run preview   # serve dist/ locally
```

Both servers bind `127.0.0.1` explicitly (`server.host` in `astro.config.mjs`). Astro's
default is `localhost`, which Node 17+ resolves to `::1` first — that leaves the server on
the IPv6 loopback only, and under WSL2 a Windows browser reaching it over IPv4 finds
nothing listening and hangs until it times out. To reach the server from another device,
pass the flag instead of changing the default: `npm run dev -- --host`.

## Layout

```
src/
  layouts/BaseLayout.astro    <head>, header, drawer, join banner, footer, shared scripts
  components/                 SiteHeader · SiteDrawer · JoinBanner · SiteFooter
  pages/index.astro           redirects "/" to the visitor's preferred locale (/en or /ar)
  pages/404.astro             site-wide 404 fallback, not locale-routed, links to /en/*
  pages/[locale]/*.astro      one file per route, rendered on demand at /en/x and /ar/x;
                               each holds only its own <main>
  pages/uploads/[...path].ts  serves public/uploads from disk, per request
  components/content/         Text · Image — render a field from the content store
  lib/content/store.ts        reads content/*.json, caches the parsed JSON in memory
  lib/auth/                   password hashing and the in-memory session map
  middleware.ts               gates /admin behind a valid session
public/
  assets/                     css · js · img · video · content — served as-is, paths unchanged
  admin/                      the content control centre (plain HTML/JS, not built by Astro)
  uploads/                    admin-uploaded images and documents (gitignored)
  robots.txt
content/                      per-page editable copy as JSON (gitignored)
scripts/                      seed-content.mjs · hash-password.mjs
```

Every page is bilingual: English is the visible markup, `data-ar="..."` on the same
element holds the Arabic translation, and `assets/js/i18n.js` swaps between them at
runtime (also flipping `dir`/`lang`). The `/en` and `/ar` URL prefix is source of truth for
which language is shown — `i18n.js`'s `detect()` reads it from `location.pathname` first,
falling back to a saved preference or `navigator.language` only when no prefix is present
(the root redirector, or the admin preview iframe). `BaseLayout` renders the correct
`<html lang dir>` and `<title>` per locale from the `locale` prop every
`[locale]/*.astro` page receives via `Astro.params.locale`.

URLs are extensionless (`/en/about`, `/en/member?id=kaust`). That comes from
`build.format: 'file'` in `astro.config.mjs`, which emits `dist/en/about.html`. Pages now
sit two segments deep, so `BaseLayout` sets `<base href="/">` in `<head>` — every relative
`assets/...` reference in `public/` keeps resolving from site root regardless of route depth.

## Front-end scripts

The scripts in `public/assets/js` are plain global IIFEs, not modules, and they run in a
fixed order that `cms.js` depends on:

```
content/<page>.js → cms.js → i18n.js → main.js
```

`BaseLayout` renders the shared ones and exposes two slots — `scripts` (before `i18n.js`)
and `scripts-late` (after it) — so each page keeps the exact order it had. Every tag is
marked `is:inline` so Astro leaves it alone.

## Content editing

Content is moving off the build and into two data stores, both gitignored because they
are the admin's data rather than source:

```
content/<page>.json     page copy — { "<key>": { "en": …, "ar": … } } for text,
                        { "src": …, "alt": …, "alt_ar": … } for images
public/uploads/         images and documents the admin uploads
```

`src/lib/content/store.ts` reads a page's JSON at request time and caches the parsed
result in memory, revalidating by mtime — instantly in dev, at most every 5s in
production. Pages render it through `src/components/content/Text.astro` and
`Image.astro`, which keep the `data-cms` / `data-ar` attribute contract the front-end
scripts already expect, so `i18n.js` and the admin preview are unaffected. The copy is in
the served HTML now, not painted in afterwards.

Because `content/` is gitignored, a fresh clone has none. `npm run seed:content`
regenerates it from the committed `public/assets/content/*.js` files, and `npm run dev`
and `npm run build` run it first to fill in anything missing (it never overwrites — pass
`--force` for that).

`public/uploads/` is served by `src/pages/uploads/[...path].ts`, which reads from disk per
request. Astro copies `public/` into the build output only once, at build time, so
without that route a file uploaded after a deploy would 404 until the next build.

**Migration status:** only `[locale]/about.astro` is on the new stores. The other pages
still load `assets/content/<page>.js` and let `assets/js/cms.js` patch the DOM after
paint, and `/admin` still edits `localStorage` and exports those `.js` files for manual
upload — it does not yet write to `content/`.
