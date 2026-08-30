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

`/admin` (`public/admin/`) is the editor UI. For pages on the new stores it now writes
straight through three API routes gated by the same session middleware as the rest of
`/admin`:

- `src/pages/admin/api/content/[page].ts` — GET returns a page's current
  `content/<page>.json`; POST replaces it, validated against that page's **schema
  module**, not against whatever is currently on disk (see below).
- `src/pages/admin/api/schema/[page].ts` — GET returns a page's editable-field layout
  (sections, cards, labels) straight from the same schema module the admin panel used to
  keep only in the hand-maintained `public/admin/schema.js`.
- `src/pages/admin/api/uploads.ts` — accepts one image (≤3MB, `image/*`), writes it into
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
`/admin/api/schema/<page>` at boot for every `apiBacked` page and overwrites the static
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

`article`, `working-group`, `technologies` and `media`'s Events tab render from three
repeating record sets — `working-group`/`technologies` share `assets/js/wg-data.js` (9
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
would otherwise silently wipe an addable collection). `src/pages/admin/api/collection/[name].ts`
exposes the same GET/POST shape as the page content route, gated by the same `/admin` session
middleware.

`article.astro`, `working-group.astro`, `technologies.astro` and `media.astro`'s Events tab now
render server-side from this store via `getCollectionContent<F>(name)`, reusing `Text.astro`/
`Image.astro` as-is (their `TextField`/`ImageField` prop shapes are exactly what `text()`/`image()`
already return) plus the new `Value.astro` for untranslated scalars (`no`, `ch`'s theme, `src`,
`day`, `link`). List fields (`stats`, `recs`, `body`, `tags`) have no typed accessor — each template
casts `.list(key)` to that collection's own item shape and maps over it directly, since it's
page-specific rendering logic with exactly one caller. The `?id=`/fallback-to-first-record lookup,
the icon/theme grid tiles on `technologies.astro`, and the `safeHref` link-sanitizing on the events
tab are all ported verbatim from the client-side IIFEs they replace (formerly modules 18, 21, 22,
24 in `assets/js/main.js`, now deleted).

**`public/admin/admin.js`'s edit flow for these three views was deliberately left untouched in this
pass, and that is now a real drift risk worth knowing about.** The admin still edits `_groups`/
`_articles`/`_events` against `public/assets/js/{wg-data,article-data,events-data}.js` (dot-path
fields, "Save & Publish" downloads an updated copy of that file for manual commit) — but the pages
above no longer read those files at all. Publishing an edit through the current admin UI no longer
changes what the live site shows; the two are reconciled only by re-running
`npm run seed:collections -- --force` afterward. Closing this gap — `apiBacked: true` on these
three `schema.js` entries, an admin field engine that speaks the `{en,ar}`-object shape instead of
the legacy dot-path one, and a POST through `/admin/api/collection/[name]` — is a separate,
not-yet-scheduled pass. Prove the storage primitive on its own with
`node scripts/test-collections.mjs` (esbuild-bundles the collection modules and asserts against
them directly, the same technique used to test the page validators).

**Known issue, unrelated to any of the above:** Vite's built-in `dotenv-expand` treats any
`$word` in a `.env` value as a variable reference and blanks it if undefined. A
`scrypt$<salt>$<hash>` value from `npm run hash-password` trips this whenever either hex
segment happens to start with a letter (`a`–`f`) rather than a digit — roughly 60% of
freshly generated hashes, by chance alone — silently truncating `ADMIN_PASSWORD_HASH` at
build time and locking out the admin account with no error at build or login time. Not
introduced by anything above; flagged here because it was found while testing the schema
API and is worth fixing before the next password rotation (e.g. by base64- or
hex-encoding the stored hash, or escaping `$` as `$$` when writing `.env`).
