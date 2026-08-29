# SAFTA v5

Static bilingual (EN ⇄ AR) site for the Saudi AgriFood Tech Alliance, built with
[Astro](https://astro.build). No backend and no data persistence — every page is
prerendered to plain HTML.

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
  pages/[locale]/*.astro      one file per route, generated at both /en/x and /ar/x via
                               getStaticPaths(); each holds only its own <main>
public/
  assets/                     css · js · img · video · content — served as-is, paths unchanged
  admin/                      the content control centre (plain HTML/JS, not built by Astro)
  robots.txt
```

Every page is bilingual: English is the visible markup, `data-ar="..."` on the same
element holds the Arabic translation, and `assets/js/i18n.js` swaps between them at
runtime (also flipping `dir`/`lang`). The `/en` and `/ar` URL prefix is source of truth for
which language is shown — `i18n.js`'s `detect()` reads it from `location.pathname` first,
falling back to a saved preference or `navigator.language` only when no prefix is present
(the root redirector, or the admin preview iframe). `BaseLayout` renders the correct
`<html lang dir>` and `<title>` per locale at build time from the `locale` prop every
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

`/admin/index.html` is the control centre. It edits into `localStorage` and exports
`assets/content/*.js` files for manual upload — it does not write to the site.
