# SAFTA v5

Static bilingual (EN ⇄ AR) site for the Saudi AgriFood Tech Alliance, built with
[Astro](https://astro.build). No backend and no data persistence — every page is
prerendered to plain HTML.

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # → dist/
npm run preview   # serve dist/ locally
```

## Layout

```
src/
  layouts/BaseLayout.astro    <head>, header, drawer, join banner, footer, shared scripts
  components/                 SiteHeader · SiteDrawer · JoinBanner · SiteFooter
  pages/*.astro               one file per route; each holds only its own <main>
public/
  assets/                     css · js · img · video · content — served as-is, paths unchanged
  admin/                      the content control centre (plain HTML/JS, not built by Astro)
  robots.txt
```

URLs are extensionless (`/about`, `/member?id=kaust`). That comes from
`build.format: 'file'` in `astro.config.mjs`, which emits `dist/about.html` — keeping
every route one segment deep so the relative asset paths in `public/` keep resolving.

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
