# SAFTA v5

Bilingual (EN ⇄ AR) site for the Saudi AgriFood Tech Alliance, built with
[Astro](https://astro.build) and served on demand by a standalone Node process, so the
admin panel can authenticate and pages can read editable content at request time.

## Commands

```bash
npm install
cp .env.example .env   # then fill it in — see "Admin account" below
npm run dev       # migrate + seed the admin, then http://127.0.0.1:4321
npm run build     # → dist/
npm start         # migrate + seed the admin, then serve dist/
npm run db:generate   # after a change to src/db/*schema.ts: write a migration to drizzle/
npm run db:migrate    # apply migrations to DATABASE_PATH
npm run db:seed       # create the .env admin if missing (idempotent)
npm run content:migrate          # create missing singletons, upgrade old ones (part of setup)
npm run content:export [file]    # the database content as one JSON envelope
npm run content:import <file> [--dry-run]
npm run content:reset -- --yes   # wipe all database content and uploaded media
npm run check:admin   # every dashboard panel matches its schema — keep it passing
npx astro check       # typecheck — keep it clean
```

`better-sqlite3` is a native module; its install script is allowed in `package.json`
(`allowScripts`). If it fails to load after a fresh `npm ci`, run `npm rebuild better-sqlite3`.

## Admin account

There is exactly one admin, created from `.env` on first launch (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`, optional `ADMIN_NAME`) by [scripts/seed-admin.ts](scripts/seed-admin.ts),
which `npm run dev` and `npm start` run every time. It only ever **creates** the account:
once it exists, changing `ADMIN_PASSWORD` does nothing. Sign-up is disabled.

Auth is [Better Auth](https://better-auth.com) 1.7 with users and sessions in SQLite
(`DATABASE_PATH`, default `data/safta.db`, gitignored), so a restart no longer signs anyone out.
Sign in at `/en/login` or `/ar/login`; the form posts to `/api/login`. Astro's CSRF origin check
is on, so `curl` needs `-H "Origin: http://127.0.0.1:4321"`. In production `BETTER_AUTH_URL` must be the
public `https://` origin **at build time**: `astro.config.mjs` derives `security.allowedDomains`
from it so the reverse proxy's `X-Forwarded-Proto/Host` are trusted. Without that, every login
POST behind a TLS-terminating proxy gets a 403. Read
[docs/better-auth.md](docs/better-auth.md) before changing auth code — 1.7 differs from most
tutorials.

This auth and database layer is copied from the Water STRIP project (commit `dcfba70`), and the
content store and dashboard below from commit `9526700`. Both are maintained here independently; the
two codebases share nothing at runtime.

## The dashboard

`/admin` is the new dashboard: one page per site page, each a stack of panels that save on their
own. Content lives in SQLite (`content_singleton` plus the `member`, `working_group`, `article`
and `event` tables); every read goes through the cache in `src/lib/content/cache.ts` and every
write through `src/lib/content/repo.ts`. Uploaded images go through `sharp` to WebP under
`UPLOAD_PATH` and are served at `/media/<sha256>.webp`.

**The public pages read it.** Each `[locale]/*.astro` page takes its values from `getSingleton`
and the `list*`/`get*` getters in `cache.ts`, and renders them through `components/content/Text`
(English, with the Arabic in `data-ar` for `i18n.js`; English falls back to Arabic when blank) and
`Image` (the upload, or the slot's default art from `src/lib/safta-assets.ts`). Interface copy
that is the same everywhere, such as the Home breadcrumb and member category names, is in
`src/lib/ui.ts`. A missing `?id=` on `/member` or `/article` redirects to the list; an unknown or
unpublished one is a 404.

The old editor is still at `/admin/legacy`, but it no longer changes the site: it writes
`content/*.json`, which is now only the source of the one-time legacy import. It goes away once
that import has run.

- What each surface holds: the Zod schemas in `src/lib/content/schemas/` (one file per site page)
  and the collection inputs in `repo.ts`. A fresh database starts from each schema's `initial`
  value, which is SAFTA's current text; images start empty.
- How each panel looks: `src/components/admin/sections.ts` lists every panel's fields as data, and
  one renderer (`FieldList.tsx`) draws them. Admins edit values only; the field lists are code.
  `npm run check:admin` fails if a panel and its schema disagree in either direction.
- Collections are edited and saved as a whole list; the server sets each row's `order` from its
  position, so moving a row up or down is saved.

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
  pages/uploads/[...path].ts  serves public/uploads from disk (legacy; for the old editor)
  components/content/         Text · Image — render a content field into the public markup
  lib/bilingual.ts · ui.ts    xAr/xEn → markup helpers · fixed interface copy
  lib/safta-assets.ts         default art for image slots with no upload
  lib/content/store.ts        the legacy content/*.json store, read only by /admin/legacy
  lib/auth.ts · lib/env.ts    Better Auth instance · environment variables (process.env)
  db/                         Drizzle + SQLite: generated auth schema, content-schema.ts
  pages/api/                  login · logout · Better Auth's own endpoints
  middleware.ts               loads the session; gates /admin to the admin role
  lib/content/                cache · repo · schemas/ · media · io (database content store)
  components/admin/           the dashboard: sections.ts (panel fields) · FieldList · editors
  pages/admin/                dashboard pages; api/ (content, media, collections); legacy/
  pages/media/[file].ts       serves uploaded images from UPLOAD_PATH
public/
  assets/                     css · js · img · video · content — served as-is, paths unchanged
  admin/                      the old content control centre, served at /admin/legacy
  uploads/                    admin-uploaded images and documents (gitignored)
  robots.txt
content/                      per-page editable copy as JSON (gitignored)
scripts/                      seed-content.mjs · seed-admin.ts · content.ts · check-admin-specs.ts
drizzle/                      SQL migrations (generated, committed)
data/                         SQLite database and uploads (gitignored)
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
fixed order:

```
(page scripts, e.g. Leaflet) → i18n.js → main.js
```

No page loads `assets/content/*.js` or `cms.js` any more; they stay only as a source for the
legacy import. The members map (`main.js` module 13) reads its markers from a JSON
`<script id="membersMapData">` that `members.astro` renders from member rows.

`BaseLayout` renders the shared ones and exposes two slots — `scripts` (before `i18n.js`)
and `scripts-late` (after it) — so each page keeps the exact order it had. Every tag is
marked `is:inline` so Astro leaves it alone.

## Content editing (legacy)

> This section describes the old `content/*.json` store behind `/admin/legacy`. The public site
> no longer reads it (see [The dashboard](#the-dashboard)); it stays until the legacy import has
> run, and is then deleted with this section.

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

`/admin/legacy` (`public/admin/`) is the editor UI. For pages on the new stores it now writes
straight through three API routes gated by the same session middleware as the rest of
`/admin/legacy`:

- `src/pages/admin/legacy/api/content/[page].ts` — GET returns a page's current
  `content/<page>.json`; POST replaces it, validated against that page's **schema
  module**, not against whatever is currently on disk (see below).
- `src/pages/admin/legacy/api/schema/[page].ts` — GET returns a page's editable-field layout
  (sections, cards, labels) straight from the same schema module the admin panel used to
  keep only in the hand-maintained `public/admin/schema.js`.
- `src/pages/admin/legacy/api/uploads.ts` — accepts one image (≤3MB, `image/*`), writes it into
  `public/uploads/` under a generated name, and returns the path to store in a field.
  Publishing a page prunes any upload an edit just replaced (`pruneReplacedUploads` in
  `store.ts`) — deleted only once the file that stopped referencing it is actually
  written, and only if no other field on the page still points at it.

**Schema modules** (`src/lib/content/schema/`) are the source of truth for which fields a
page has and what shape each one is — not `content/<page>.json`, which used to double as
its own schema (whatever keys happened to be on disk defined what a future publish was
allowed to contain, so a corrupted file could permanently narrow the editable set).
`src/lib/content/schema/registry.ts` maps page name → schema module and is what both
`isEditablePage()` and the two routes above key off; `codec.ts` turns a schema module's
field map into the zod validator content POSTs are checked against
(`getPageValidator`) and expands its section/card key-lists back into the full
`{key, tag, type, label}` objects the admin UI reads (`denormalizeSections`,
`getAdminSchema`). `store.ts`'s `getPageContent<F>()` takes a schema module's field map as
a type parameter, so `c.text('some-key')` in a page's `.astro` frontmatter is checked at
compile time against that page's actual keys — a typo, or calling `.text()` on an image
key, is a type error instead of a blank field at runtime.

A schema module is generated, not hand-written: `node scripts/generate-page-schema.mjs
<page>` reads that page's existing `public/admin/schema.js` entry (field labels/tags/
layout) and `content/<page>.json` (which key is text vs. image) and emits
`src/lib/content/schema/<page>.ts`, failing loudly if the two disagree. Re-run it after
changing a page's field layout in the admin UI rather than hand-editing the generated
file. `public/admin/schema.js` stays in place as a local fallback: `admin.js` fetches
`/admin/legacy/api/schema/<page>` at boot for every `apiBacked` page and overwrites the static
copy with the server's version, only falling back to the bundled one if that fetch fails.

`admin.js` also refreshes its notion of "original" content for `apiBacked` pages from the
live content API (not the frozen `baseline.js` snapshot) before computing what's changed,
so "reset to original" and the dirty-state markers track the real file, and "Save &
Publish" writes directly instead of opening the download modal.

Some fields are text rendered into an attribute rather than element content — e.g.
`data-cms-ph` on an `<input>`, paired with `placeholder` and `data-ar-placeholder`.
`Text.astro`'s contract is element-content-only (`set:html`), so these are still `kind:
"text"` in the schema (the generator's `kindOf()` only looks at `'src' in record`) but
get rendered as a plain inline attribute expression — `placeholder={c.text(key).en}
data-ar-placeholder={c.text(key).ar}` — on the input directly rather than through a
component.

**Migration status:** `about`, `contact`, `register-interest`, `index` and `media` have
schema modules and are `apiBacked`. The other pages still render through
`assets/content/<page>.js` + `assets/js/cms.js` (client-side DOM patching after paint)
and still publish through the admin's original flow — edit into `localStorage`, download
the generated `.js` files, commit them by hand.

`index` and `media` were the first pages migrated whose `public/admin/schema.js` entry
had drifted from the actual page markup — two `believeSlider` cards on `index` (added to
the page and to `content/index.json` at some point without a matching `schema.js`
update) made the generator fail its cross-check. The fix was to add the missing card
entries to `schema.js` by hand, matching the existing cards' shape, rather than
hand-editing the generated output — the generator is meant to catch exactly this kind of
drift, so when it does, fix the source it reads from. `media`'s Events tab
(`#eventsList`) stays wired to `assets/js/events-data.js`; it was never a `schema.js`
field to begin with, so this migration doesn't touch it.

## Collection content (`groups` / `articles` / `events`)

`article`, `technologies` and `media`'s Events tab render from three
repeating record sets — `technologies` reads `assets/js/wg-data.js` (9
programs), `article` reads `assets/js/article-data.js` (7 fixed articles), `media`'s Events
tab reads `assets/js/events-data.js` (4 events) — none of which the schema modules above can
express: `getPageContent`/`zodForFields` are flat, one value per key, with no notion of an
array of similarly-shaped records.

`src/lib/content/collections/` is the id-keyed counterpart: `codec.ts` adds the field kinds a
page never needs (`value` for an untranslated scalar, `boolean`, and `list` — either a list of
objects like `stats`/`recs`/`body`, or a list of `{en,ar}` pairs like `tags`), `registry.ts`
maps `groups`/`articles`/`events` to a generated module the same way `schema/registry.ts` maps
page names, and `store.ts` reads/writes `content/{groups,articles,events}.json` (also
gitignored, seeded from the legacy `window.SAFTA_*` files by `npm run seed:collections`) with
the same mtime-cache and atomic-write helpers page content uses (factored out into
`src/lib/content/json-file.ts` so both share one implementation). `node
scripts/generate-collection-schema.mjs <groups|articles|events>` reads `public/admin/schema.js`'s
`_<name>` entry — the old admin UI's per-slot dot-path fields (`stats.0.n`, `body.1.p`) — and
collapses them into one `list` field declaration per repeating structure, cross-validated
against the seeded content the same way the page generator cross-validates `schema.js` against
`content/<page>.json`.

Unlike a page, removing an existing record id is never accepted regardless of `addable`
(`_articles`' fixed 7-record set rejects it the same as `_groups`/`_events`) — the old admin's
delete button only ever undid a not-yet-published add, never an already-saved record, and
`validateCollectionUpdate` in `collections/store.ts` is what actually enforces that now (a bare
`z.record(...)` validator has no opinion on a shrinking key set on its own — an empty `{}` body
would otherwise silently wipe an addable collection). `src/pages/admin/legacy/api/collection/[name].ts`
exposes the same GET/POST shape as the page content route, gated by the same `/admin` session
middleware.

`article.astro`, `technologies.astro` and `media.astro`'s Events tab now
render server-side from this store via `getCollectionContent<F>(name)`, reusing `Text.astro`/
`Image.astro` as-is (their `TextField`/`ImageField` prop shapes are exactly what `text()`/`image()`
already return) plus the new `Value.astro` for untranslated scalars (`no`, `ch`'s theme, `src`,
`day`, `link`). List fields (`body`, `tags`) have no typed accessor — each template
casts `.list(key)` to that collection's own item shape and maps over it directly, since it's
page-specific rendering logic with exactly one caller. The `?id=`/fallback-to-first-record lookup,
the icon/theme grid tiles on `technologies.astro`, and the `safeHref` link-sanitizing on the events
tab are all ported verbatim from the client-side IIFEs they replace (formerly modules 18, 21, 22,
24 in `assets/js/main.js`, now deleted).

`groups` carries only the five fields the technologies grid renders (`name`, `scope`, `img`,
`no`, `ch`). The per-group detail page that once consumed `status`/`lead`/`head`/`orgs`/
`stats`/`recs`/`note`/`src` was removed along with those fields — nothing linked to it. Because
`content/` is gitignored and is the live data store, a deployment that predates that change
still holds the dropped keys and `zodForItemFields` is `.strict()`, so every admin save to
working groups 400s until `node scripts/prune-orphan-collection-keys.mjs groups --write` is run
in that checkout (the collection counterpart to `prune-orphan-keys.mjs`; dry-run by default,
backs up before writing).

**`public/admin/admin.js`'s edit flow for these three views was deliberately left untouched in this
pass, and that is now a real drift risk worth knowing about.** The admin still edits `_groups`/
`_articles`/`_events` against `public/assets/js/{wg-data,article-data,events-data}.js` (dot-path
fields, "Save & Publish" downloads an updated copy of that file for manual commit) — but the pages
above no longer read those files at all. Publishing an edit through the current admin UI no longer
changes what the live site shows; the two are reconciled only by re-running
`npm run seed:collections -- --force` afterward. Closing this gap — `apiBacked: true` on these
three `schema.js` entries, an admin field engine that speaks the `{en,ar}`-object shape instead of
the legacy dot-path one, and a POST through `/admin/legacy/api/collection/[name]` — is a separate,
not-yet-scheduled pass. Prove the storage primitive on its own with
`node scripts/test-collections.mjs` (esbuild-bundles the collection modules and asserts against
them directly, the same technique used to test the page validators).
