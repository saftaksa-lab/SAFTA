/**
 * Imports SAFTA's legacy content into the database: Phase 4 of the port in
 * waterstrip's docs/safta-port.md, field by field as docs/safta-key-map.md lists
 * it. Kept until the cutover is done, then deleted with the legacy store.
 *
 *   npm run content:import-legacy -- --dry-run       # the same, through npm
 *   node scripts/import-legacy.ts --dry-run          # check everything, write nothing
 *   node scripts/import-legacy.ts                    # import
 *   node scripts/import-legacy.ts --from <dir>       # read <dir>/content and <dir>/public
 *   node scripts/import-legacy.ts --out envelope.json  # also save the built envelope
 *   node scripts/import-legacy.ts --replace          # overwrite edits made in the dashboard
 *
 * Reads `content/*.json` (and `settings.json`), the two pages whose live text is
 * in `public/assets/content/*.js`, `public/assets/js/members-map-data.js`, and
 * every image those reference, under `public/assets/` or `public/uploads/`. It
 * builds the envelope `content:export` writes and hands it to the same import,
 * so the result is validated exactly as a restore would be.
 *
 * Strict on purpose. A legacy key nothing here reads, a field nothing fills, a
 * value with markup in it or an image that cannot be read fails the run, listed
 * all at once, and nothing is written. Production's keys may have drifted from
 * the copy the key map was built from; this must not guess.
 *
 * Idempotent: singletons are upserted, collections replaced, and media keyed by
 * content hash, so a second run leaves the same state. Once anything has been
 * saved in the dashboard, though, it refuses to run without `--replace`: after
 * cutover, a stray run would otherwise put the stale legacy content back over
 * the admin's edits. Run `npm run setup` first,
 * so the database is migrated, and run it with the site stopped: the server
 * caches content in memory, so a running one keeps serving the old content
 * until it restarts.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';
import {
  FORMAT,
  FORMAT_VERSION,
  hasDashboardEdits,
  importContent,
  type Envelope,
  type ImportReport,
} from '../src/lib/content/io.ts';
import {
  displayName,
  MediaRejectedError,
  normaliseImage,
  writeMediaFile,
  type NormalisedImage,
} from '../src/lib/content/media.ts';
import { MEDIA_MIME_TYPES } from '../src/lib/content/media-paths.ts';
import type { MediaInput } from '../src/lib/content/repo.ts';
import { singletons, type SingletonData, type SingletonKey } from '../src/lib/content/schemas/index.ts';
import { defaultChallengeIcon } from '../src/lib/content/schemas/home.ts';
import { crumbHome, memberCategoryLabels } from '../src/lib/ui.ts';

const USAGE = 'Usage: node scripts/import-legacy.ts [--dry-run] [--replace] [--from <dir>] [--out <file>]';
const args = process.argv.slice(2);
const cli: { dryRun: boolean; replace: boolean; from: string | null; out: string | null } = {
  dryRun: false,
  replace: false,
  from: null,
  out: null,
};
// Strict, because a mistyped `--dry-run` that was ignored would import for real.
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]!;
  if (arg === '--dry-run') cli.dryRun = true;
  else if (arg === '--replace') cli.replace = true;
  else if (arg === '--from' || arg === '--out') {
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg} needs a value. ${USAGE}`);
    cli[arg === '--from' ? 'from' : 'out'] = value;
    i += 1;
  } else {
    throw new Error(`Unknown argument "${arg}". ${USAGE}`);
  }
}
const dryRun = cli.dryRun;
const root = resolve(cli.from ?? '.');
const outFile = cli.out;
const contentDir = resolve(root, 'content');
const publicDir = resolve(root, 'public');

/** Everything wrong with the source, reported together at the end. */
const problems: string[] = [];
const problem = (message: string) => void problems.push(message);

// ---------------------------------------------------------------------------
// Known content fixes. Each applies only while the stored value still matches
// `from` exactly, so a value someone has since corrected is left alone.

const FIXES: Array<{ key: string; field: 'ar' | 'en' | 'alt_ar' | 'src'; from: string; to: string }> = [
  { key: 'contact:t002', field: 'ar', from: 'تواصل معنا kuyiky', to: 'تواصل معنا' },
  // The discover image's Arabic alt text was a copy of the English.
  {
    key: 'index:i018',
    field: 'alt_ar',
    from: 'Open raceway ponds for algae cultivation at KAUST',
    to: 'أحواض مفتوحة لاستزراع الطحالب في كاوست',
  },
  // The working-groups block shows this photo at half the page width; the thumbnail is too small.
  {
    key: 'index:i018',
    field: 'src',
    from: 'assets/img/gallery/kaust-1-thumb.jpg',
    to: 'assets/img/gallery/kaust-1.jpg',
  },
];

function fixed(key: string, field: 'ar' | 'en' | 'alt_ar' | 'src', value: string): string {
  const fix = FIXES.find((f) => f.key === key && f.field === field && f.from === value);
  return fix ? fix.to : value;
}

// ---------------------------------------------------------------------------
// Text

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'" };

interface TextOptions {
  /** The Arabic may be empty: an article's quote and attribution. */
  optional?: boolean;
  /** Strip a trailing required-field marker; the markup renders its own now. */
  stripRequired?: boolean;
  /** Convert the few tags a prose field holds into src/lib/prose.ts syntax. */
  prose?: boolean;
}

/** One stored string as plain text (or prose), or a problem if it can't be. */
function clean(value: unknown, where: string, options: TextOptions = {}): string {
  if (typeof value !== 'string') {
    problem(`${where}: expected text, found ${JSON.stringify(value)}`);
    return '';
  }
  let text = value;
  if (options.stripRequired) {
    text = text.replace(/\s*<b class="req">\*<\/b>\s*$/, '').replace(/\s+\*\s*$/, '');
  }
  if (options.prose) {
    text = text
      .replace(/<a href="([^"]+)"(?: style="[^"]*")?>([^<]*)<\/a>/g, '[$2]($1)')
      .replace(/<b(?: data-ar="[^"]*")?>([^<]*)<\/b>/g, '**$1**');
  }
  // Checked before decoding, so an escaped `&lt;b&gt;` is text, not a tag.
  if (/<\/?[a-z!]/i.test(text)) {
    problem(`${where}: contains markup this import does not know how to convert: ${JSON.stringify(value)}`);
  }
  text = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
      problem(`${where}: invalid HTML entity ${entity}`);
      return entity;
    }
    const decoded = ENTITIES[name.toLowerCase()];
    if (decoded === undefined) problem(`${where}: unknown HTML entity ${entity}`);
    return decoded ?? entity;
  });
  return text.trim();
}

type Pair<N extends string> = { [K in `${N}Ar` | `${N}En`]: string };

/** A legacy `{ en, ar }` value as the `xAr`/`xEn` pair `name`. */
function pair<N extends string>(value: unknown, name: N, where: string, options: TextOptions = {}): Pair<N> {
  const v = (value ?? {}) as { ar?: unknown; en?: unknown };
  const key = where.split('.')[0]!;
  const ar = clean(typeof v.ar === 'string' ? fixed(key, 'ar', v.ar) : v.ar, `${where} (ar)`, options);
  const en = clean(typeof v.en === 'string' ? fixed(key, 'en', v.en) : v.en, `${where} (en)`, options);
  if (!ar && !options.optional) problem(`${where}: the Arabic is empty, and it is required`);
  return { [`${name}Ar`]: ar, [`${name}En`]: en } as Pair<N>;
}

function plain(value: unknown, where: string): string {
  const text = clean(value, where);
  if (!text) problem(`${where}: empty, and it is required`);
  return text;
}

// ---------------------------------------------------------------------------
// Images

/** Bundled SVGs are rasterized to this long edge before the normal pipeline. */
const SVG_EDGE = 1600;

/**
 * WOFF 1.0 back to the TrueType/OpenType file it wraps: the same tables, each
 * zlib-inflated where it was compressed, behind a plain sfnt header.
 */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('not a WOFF 1.0 file');
  const flavor = woff.readUInt32BE(4);
  const count = woff.readUInt16BE(12);
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= count) {
    searchRange *= 2;
    entrySelector += 1;
  }
  const header = Buffer.alloc(12 + 16 * count);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(count, 4);
  header.writeUInt16BE(searchRange * 16, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE((count - searchRange) * 16, 10);

  const chunks = [header];
  let offset = header.length;
  for (let i = 0; i < count; i += 1) {
    const entry = 44 + i * 20;
    const start = woff.readUInt32BE(entry + 4);
    const compressed = woff.readUInt32BE(entry + 8);
    const original = woff.readUInt32BE(entry + 12);
    const raw = woff.subarray(start, start + compressed);
    const data = compressed < original ? inflateSync(raw) : raw;
    const record = 12 + i * 16;
    header.writeUInt32BE(woff.readUInt32BE(entry), record); // tag
    header.writeUInt32BE(woff.readUInt32BE(entry + 16), record + 4); // checksum
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(data.length, record + 12);
    const padded = Buffer.alloc((data.length + 3) & ~3);
    data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  }
  return Buffer.concat(chunks);
}

/**
 * SVG text is drawn with whatever fonts the machine running the import has,
 * and a server usually has no Arabic font: the placeholders' Arabic came out as
 * boxes. So librsvg gets a private fontconfig holding only IBM Plex Sans Arabic
 * (the SVGs' first choice, already a dependency through fontsource), and the
 * result is the same on every machine. Set before the first SVG is drawn, which
 * is when fontconfig reads it.
 */
function useBundledFonts(): void {
  const source = fileURLToPath(new URL('../node_modules/@fontsource/ibm-plex-sans-arabic/files', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'safta-fonts-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  for (const file of readdirSync(source)) {
    if (!/-(arabic|latin|latin-ext)-\d00-normal\.woff$/.test(file)) continue;
    writeFileSync(join(dir, file.replace(/\.woff$/, '.ttf')), woffToSfnt(readFileSync(join(source, file))));
  }
  const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  writeFileSync(
    join(dir, 'fonts.conf'),
    `<?xml version="1.0"?>\n<fontconfig><dir>${xml(dir)}</dir><cachedir>${xml(join(dir, 'cache'))}</cachedir></fontconfig>\n`,
  );
  process.env.FONTCONFIG_FILE = join(dir, 'fonts.conf');
}

useBundledFonts();

const mediaRows = new Map<string, MediaInput>();
const images = new Map<string, NormalisedImage>();
const svgUploads: string[] = [];

async function rasterizeSvg(bytes: Buffer): Promise<Buffer> {
  const meta = await sharp(bytes).metadata();
  const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!edge) throw new MediaRejectedError('the SVG has no size');
  return sharp(bytes, { density: (72 * SVG_EDGE) / edge })
    .resize({ width: SVG_EDGE, height: SVG_EDGE, fit: 'inside' })
    .png()
    .toBuffer();
}

/**
 * A stored image path as a media id, or `null` for an empty one. Bundled files
 * (`assets/…`) are imported too: they are the logos and photos on the site.
 * The first slot to use a file decides its alt text.
 */
async function image(src: unknown, alt: { ar: string; en: string }, where: string): Promise<string | null> {
  if (src === '' || src === undefined || src === null) return null;
  if (typeof src !== 'string') {
    problem(`${where}: expected an image path, found ${JSON.stringify(src)}`);
    return null;
  }
  const relative = src.replace(/^\//, '').replace(/[?#].*$/, '');
  const path = resolve(publicDir, relative);
  if (!/^(assets|uploads)\//.test(relative) || !path.startsWith(publicDir + sep)) {
    problem(`${where}: image path ${JSON.stringify(src)} is not under public/assets or public/uploads`);
    return null;
  }
  if (!existsSync(path)) {
    problem(`${where}: image ${relative} does not exist`);
    return null;
  }
  // A symlink must not lead out of public/ either.
  if (!realpathSync(path).startsWith(realpathSync(publicDir) + sep)) {
    problem(`${where}: image ${relative} resolves to a file outside public/`);
    return null;
  }
  const isSvg = extname(relative).toLowerCase() === '.svg';
  if (isSvg && relative.startsWith('uploads/')) {
    // Uploaded SVGs are refused, not rasterized: they came from outside the repo.
    svgUploads.push(`${where}: ${relative}`);
    return null;
  }

  let normalised: NormalisedImage;
  try {
    const bytes = readFileSync(path);
    normalised = await normaliseImage(isSvg ? await rasterizeSvg(bytes) : bytes);
  } catch (error) {
    const reason = error instanceof MediaRejectedError ? error.message : String(error);
    problem(`${where}: image ${relative} could not be imported: ${reason}`);
    return null;
  }

  if (!mediaRows.has(normalised.id)) {
    if (!alt.ar) problem(`${where}: image ${relative} has no Arabic alt text`);
    images.set(normalised.id, normalised);
    mediaRows.set(normalised.id, {
      id: normalised.id,
      ext: normalised.ext,
      mimeType: MEDIA_MIME_TYPES[normalised.ext],
      bytes: normalised.bytes,
      width: normalised.width,
      height: normalised.height,
      altAr: alt.ar,
      altEn: alt.en,
      originalName: displayName(basename(relative)),
    });
  }
  return normalised.id;
}

/** A page image's stored alt text, or `fallback` where it is empty (decorative slides). */
function pageAlt(value: unknown, key: string, fallback: { ar: string; en: string }) {
  const v = (value ?? {}) as { alt?: unknown; alt_ar?: unknown };
  const ar = typeof v.alt_ar === 'string' ? clean(fixed(key, 'alt_ar', v.alt_ar), `${key} (alt_ar)`) : '';
  const en = typeof v.alt === 'string' ? clean(v.alt, `${key} (alt)`) : '';
  return { ar: ar || fallback.ar, en: en || fallback.en };
}

// ---------------------------------------------------------------------------
// Legacy page files: a flat map of `t005-<slug>` keys

class LegacyPage {
  name: string;
  entries = new Map<string, unknown>();
  used = new Set<string>();

  constructor(name: string, data: Record<string, unknown>) {
    this.name = name;
    for (const [key, value] of Object.entries(data)) {
      const prefix = key.split('-')[0]!;
      if (this.entries.has(prefix)) problem(`${name}: two keys start with ${prefix}`);
      this.entries.set(prefix, value);
    }
  }

  raw(prefix: string): unknown {
    if (!this.entries.has(prefix)) {
      problem(`${this.name}:${prefix}: missing`);
      return undefined;
    }
    this.used.add(prefix);
    return this.entries.get(prefix);
  }

  text<N extends string>(prefix: string, name: N, options: TextOptions = {}): Pair<N> {
    return pair(this.raw(prefix), name, `${this.name}:${prefix}`, options);
  }

  async image(prefix: string, fallbackAlt: { ar: string; en: string }): Promise<string | null> {
    const value = this.raw(prefix) as { src?: unknown } | undefined;
    const where = `${this.name}:${prefix}`;
    const src = typeof value?.src === 'string' ? fixed(where, 'src', value.src) : value?.src;
    return image(src, pageAlt(value, where, fallbackAlt), where);
  }

  /** Read and discarded, with the reason kept here rather than in a comment elsewhere. */
  drop(prefixes: string[], _reason: string): void {
    for (const prefix of prefixes) this.raw(prefix);
  }

  /** A key that only repeats `other` (possibly with the languages swapped). */
  same(prefix: string, other: string, options: { swapped?: boolean } = {}): void {
    const a = this.raw(prefix) as { ar?: unknown; en?: unknown } | undefined;
    const b = this.raw(other) as { ar?: unknown; en?: unknown } | undefined;
    const [ar, en] = options.swapped ? [b?.en, b?.ar] : [b?.ar, b?.en];
    if (a?.ar !== ar || a?.en !== en) {
      problem(
        `${this.name}:${prefix} should repeat ${other}${options.swapped ? ' with the languages swapped' : ''}, ` +
          `but it is ${JSON.stringify(a)} against ${JSON.stringify(b)}. Decide which is right and make them match.`,
      );
    }
  }

  /** The Home breadcrumb is interface copy now (src/lib/ui.ts), so it must not have been edited. */
  crumb(prefix: string): void {
    const value = this.raw(prefix) as { ar?: unknown; en?: unknown } | undefined;
    if (value?.ar !== crumbHome.ar || value?.en !== crumbHome.en) {
      problem(
        `${this.name}:${prefix}: the Home breadcrumb is ${JSON.stringify(value)}, not ` +
          `${JSON.stringify(crumbHome)}. It now lives in src/lib/ui.ts; change it there.`,
      );
    }
  }

  /** Every key must have been read by now. */
  finish(): void {
    for (const prefix of this.entries.keys()) {
      if (!this.used.has(prefix)) problem(`${this.name}:${prefix}: not mapped to any field`);
    }
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    problem(`${path}: could not be read: ${String(cause)}`);
    return {};
  }
}

function jsonPage(name: string): LegacyPage {
  return new LegacyPage(name, readJson(resolve(contentDir, `${name}.json`)) as Record<string, unknown>);
}

/**
 * `public/assets/content/<name>.js`, which the old dashboard wrote as
 * `window.SAFTA_C["<name>"] = <JSON>;`. Parsed as JSON, never run.
 */
function scriptPage(name: string): LegacyPage {
  const path = resolve(publicDir, 'assets/content', `${name}.js`);
  try {
    const source = readFileSync(path, 'utf8');
    const marker = source.indexOf(`window.SAFTA_C["${name}"] =`);
    if (marker === -1) throw new Error(`no window.SAFTA_C["${name}"] assignment`);
    const start = source.indexOf('{', marker);
    const end = source.lastIndexOf('}');
    return new LegacyPage(`${name}.js`, JSON.parse(source.slice(start, end + 1)));
  } catch (cause) {
    problem(`${path}: could not be read: ${String(cause)}`);
    return new LegacyPage(`${name}.js`, {});
  }
}

/** A collection file's records, in file order, with any unexpected field reported. */
function records(name: string, fields: string[]): Array<[string, Record<string, unknown>]> {
  const data = readJson(resolve(contentDir, `${name}.json`));
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    problem(`${name}.json: expected an object of records keyed by id`);
    return [];
  }
  const list: Array<[string, Record<string, unknown>]> = [];
  for (const [id, record] of Object.entries(data)) {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      problem(`${name}.json ${id}: expected a record, found ${JSON.stringify(record)}`);
      continue;
    }
    for (const field of Object.keys(record)) {
      if (!fields.includes(field)) problem(`${name}.json ${id}.${field}: not mapped to any field`);
    }
    list.push([id, record as Record<string, unknown>]);
  }
  return list;
}

/** `initial` supplies the fields with no legacy source: ids, links, numbers. */
const initial = <K extends SingletonKey>(key: K) => singletons[key].initial as SingletonData<K>;

const nameAlt = (n: { nameAr: string; nameEn: string }) => ({ ar: n.nameAr, en: n.nameEn });
const titleAlt = (t: { titleAr: string; titleEn: string }) => ({ ar: t.titleAr, en: t.titleEn });

// ---------------------------------------------------------------------------
// Page singletons

const index = jsonPage('index');
const about = jsonPage('about');
const technologies = scriptPage('technologies');
const media = jsonPage('media');
const articlePage = scriptPage('article');
const membersPage = jsonPage('members-page');
const member = jsonPage('member');
const contact = jsonPage('contact');
const register = jsonPage('register-interest');

const settingsPath = resolve(contentDir, 'settings.json');
const settings = (existsSync(settingsPath) ? readJson(settingsPath) : {}) as { hideAwards?: unknown };
for (const key of Object.keys(settings)) {
  if (key !== 'hideAwards') problem(`settings.json ${key}: not mapped to any field`);
}
if (settings.hideAwards !== undefined && typeof settings.hideAwards !== 'boolean') {
  problem(`settings.json hideAwards: expected true or false, found ${JSON.stringify(settings.hideAwards)}`);
}

// Home --------------------------------------------------------------------

const heroKeys = [
  { image: 'i001', eyebrow: 't004', heading: 't005', cta: 't006', tab: 't013' },
  { image: 'i002', eyebrow: 't007', heading: 't008', cta: 't009', tab: 't014' },
  { image: 'i003', eyebrow: 't010', heading: 't011', cta: 't012', tab: 't015' },
];
const homeHero: SingletonData<'home_hero'> = { panels: [] };
for (const [i, keys] of heroKeys.entries()) {
  // The tab labels were always the eyebrows (as in waterstrip).
  index.same(keys.tab, keys.eyebrow);
  const heading = index.text(keys.heading, 'heading');
  homeHero.panels.push({
    id: initial('home_hero').panels[i]!.id,
    ...index.text(keys.eyebrow, 'eyebrow'),
    ...heading,
    ...index.text(keys.cta, 'ctaLabel'),
    ctaHref: initial('home_hero').panels[i]!.ctaHref,
    // Decorative, stored with no alt text: the slide's heading describes it.
    imageId: await index.image(keys.image, { ar: heading.headingAr, en: heading.headingEn }),
  });
}

// The legacy page had two tiles; the home page now keeps only the working-groups one.
const discoverTitle = index.text('t019', 'title');
const homeDiscover: SingletonData<'home_discover'> = {
  ...index.text('t016', 'eyebrow'),
  ...index.text('t017', 'intro'),
  ...discoverTitle,
  ...index.text('t020', 'lede'),
  bodyAr: initial('home_discover').bodyAr,
  bodyEn: initial('home_discover').bodyEn,
  ctaLabelAr: initial('home_discover').ctaLabelAr,
  ctaLabelEn: initial('home_discover').ctaLabelEn,
  href: initial('home_discover').href,
  imageId: await index.image('i018', { ar: discoverTitle.titleAr, en: discoverTitle.titleEn }),
};
index.drop(['i021', 't022', 't023'], 'The "What we do" tile was removed from the home page (SAFTA, October 2026).');

const homeChallengesIntro: SingletonData<'home_challenges_intro'> = index.text('t024', 'title');
index.drop(['t025'], 'The challenges intro paragraph was removed from the home page (SAFTA, October 2026).');

const awardKeys = [
  ['t049', 't050'],
  ['t051', 't052'],
  ['t053', 't054'],
  ['t055', 't056'],
  ['t057', 't058'],
] as const;
const homeAwards: SingletonData<'home_awards'> = {
  hidden: settings.hideAwards === true,
  ...index.text('t041', 'soonLabel'),
  ...index.text('t045', 'eyebrow'),
  ...index.text('t046', 'heading'),
  ...index.text('t047', 'lede'),
  ...index.text('t048', 'ctaLabel'),
  categories: awardKeys.map(([title, description], i) => ({
    id: initial('home_awards').categories[i]!.id,
    ...index.text(title, 'title'),
    ...index.text(description, 'description'),
  })),
};

const challengeItems: SingletonData<'challenges'>['items'] = [];
for (const [id, r] of records('challenges', ['title', 'description', 'image'])) {
  const where = `challenges.json ${id}`;
  const title = pair(r.title, 'title', `${where}.title`);
  challengeItems.push({
    id,
    ...title,
    ...pair(r.description, 'description', `${where}.description`),
    icon: defaultChallengeIcon(id),
    imageId: await image((r.image as { src?: unknown } | undefined)?.src, titleAlt(title), `${where}.image`),
  });
}

const partnerItems: SingletonData<'home_partners'>['items'] = [];
for (const [id, r] of records('partners', ['name', 'logo', 'url'])) {
  const where = `partners.json ${id}`;
  const name = pair(r.name, 'name', `${where}.name`);
  partnerItems.push({
    id,
    ...name,
    logoId: await image((r.logo as { src?: unknown } | undefined)?.src, nameAlt(name), `${where}.logo`),
    // An empty link sends the logo to /members, as the strip always has.
    url: typeof r.url === 'string' && r.url.trim() !== '' ? r.url.trim() : null,
  });
}
// About -------------------------------------------------------------------


const youtube = about.raw('t008') as { ar?: unknown; en?: unknown } | undefined;
if (youtube?.ar !== '' && youtube?.ar !== youtube?.en) {
  problem(`about:t008: the Arabic and English YouTube links differ; there is one link now`);
}

about.same('t013', 't011');
about.same('t012', 't011', { swapped: true });
about.same('t014', 't011', { swapped: true });
about.drop(['t023'], '"See the working groups": not on any page');

const foundingEyebrow = about.text('t051', 'eyebrow');

const built = {
  home_hero: homeHero,
  home_discover: homeDiscover,
  home_challenges_intro: homeChallengesIntro,
  home_awards: homeAwards,
  challenges: { items: challengeItems },
  home_partners: { items: partnerItems },

  about_hero: { ...about.text('t002', 'title'), ...about.text('t003', 'lede') },
  about_mission: {
    ...about.text('t004', 'eyebrow'),
    ...about.text('t005', 'heading'),
    paragraphs: ['t006', 't007'].map((key, i) => ({
      id: initial('about_mission').paragraphs[i]!.id,
      ...about.text(key, 'text'),
    })),
    youtubeUrl: clean(youtube?.en, 'about:t008 (en)'),
  },
  about_glance: {
    // Replaces the hardcoded `hidden` attribute.
    hidden: true,
    ...about.text('t011', 'soon'),
    ...about.text('t015', 'heading'),
    stats: ['t016', 't017', 't018', 't019'].map((key, i) => ({
      id: initial('about_glance').stats[i]!.id,
      value: initial('about_glance').stats[i]!.value,
      ...about.text(key, 'label'),
    })),
  },
  about_roles: {
    ...about.text('t039', 'eyebrow'),
    ...about.text('t040', 'heading'),
    ...about.text('t041', 'lede'),
    items: records('roles', ['title', 'description']).map(([id, r]) => ({
      id,
      ...pair(r.title, 'title', `roles.json ${id}.title`),
      ...pair(r.description, 'description', `roles.json ${id}.description`),
    })),
  },
  about_challenges_intro: {
    ...about.text('t020', 'eyebrow'),
    ...about.text('t021', 'heading'),
    ...about.text('t022', 'lede'),
  },
  about_founding_statement: {
    imageId: await about.image('i050', { ar: foundingEyebrow.eyebrowAr, en: foundingEyebrow.eyebrowEn }),
    ...foundingEyebrow,
    ...about.text('t052', 'quote'),
    ...about.text('t053', 'ctaLabel'),
  },

  technologies_banner: { ...technologies.text('t002', 'title'), ...technologies.text('t003', 'lede') },
  technologies_intro: {
    ...technologies.text('t004', 'eyebrow'),
    ...technologies.text('t005', 'heading'),
    ...technologies.text('t006', 'lede'),
    ...technologies.text('t007', 'sourceNote', { prose: true }),
  },

  media_banner: { ...media.text('t002', 'title'), ...media.text('t003', 'lede') },

  article_chrome: {
    defaultImageId: null as string | null,
    ...articlePage.text('t003', 'crumbMedia'),
    ...articlePage.text('t004', 'backLabel'),
    ...articlePage.text('t005', 'registerLabel'),
  },

  members_banner: { ...membersPage.text('t002', 'title'), ...membersPage.text('t003', 'lede') },
  members_intro: {
    ...membersPage.text('t004', 'eyebrow'),
    ...membersPage.text('t005', 'heading'),
    ...membersPage.text('t006', 'lede'),
  },
  // New with the rebuilt map: nothing to carry over.
  members_map: initial('members_map'),

  member_chrome: {
    ...member.text('t002', 'crumbMembers'),
    ...member.text('t003', 'title'),
    ...member.text('t007', 'roleLabel'),
    ...member.text('t009', 'sectorLabel'),
    ...member.text('t011', 'sinceLabel'),
    ...member.text('t012', 'overviewHeading'),
    ...member.text('t013', 'collaborationHeading'),
    collaborationItems: ['t014', 't015', 't016'].map((key, i) => ({
      id: initial('member_chrome').collaborationItems[i]!.id,
      ...member.text(key, 'text'),
    })),
    ...member.text('t017', 'contactEyebrow'),
    ...member.text('t018', 'contactHeading'),
    ...member.text('t019', 'contactText'),
    ...member.text('t020', 'contactCtaLabel'),
    contactEmail: initial('member_chrome').contactEmail,
    ...member.text('t021', 'backLabel'),
  },

  contact_hero: { ...contact.text('t002', 'title'), ...contact.text('t003', 'lede') },
  contact_form: {
    ...contact.text('t004', 'nameLabel', { stripRequired: true }),
    ...contact.text('p005', 'namePlaceholder'),
    ...contact.text('t006', 'emailLabel', { stripRequired: true }),
    ...contact.text('p007', 'emailPlaceholder'),
    ...contact.text('t008', 'phoneLabel'),
    ...contact.text('t009', 'phoneHint'),
    ...contact.text('p010', 'phonePlaceholder'),
    // The legacy form had no message field; it starts from the defaults.
    messageLabelAr: initial('contact_form').messageLabelAr,
    messageLabelEn: initial('contact_form').messageLabelEn,
    messagePlaceholderAr: initial('contact_form').messagePlaceholderAr,
    messagePlaceholderEn: initial('contact_form').messagePlaceholderEn,
    ...contact.text('t059', 'submitLabel'),
    ...contact.text('t060', 'successMessage'),
  },
  contact_info: {
    ...contact.text('t061', 'heading'),
    ...contact.text('t062', 'lede'),
    ...contact.text('t063', 'generalLabel'),
    email: initial('contact_info').email,
    ...contact.text('t064', 'membershipLabel'),
    ...contact.text('t065', 'membershipLinkLabel'),
    ...contact.text('t066', 'mediaLabel'),
    ...contact.text('t067', 'mediaLinkLabel'),
    ...contact.text('t068', 'responseLabel'),
    ...contact.text('t069', 'responseText'),
    ...contact.text('t070', 'followLabel'),
  },

  register_hero: { ...register.text('t002', 'title'), ...register.text('t003', 'lede') },
  register_form: {
    ...register.text('t004', 'nameLabel', { stripRequired: true }),
    ...register.text('t005', 'entityLabel', { stripRequired: true }),
    ...register.text('t006', 'entityTypeLabel', { stripRequired: true }),
    ...register.text('t007', 'entityTypePrompt'),
    entityTypeOptions: options(register, 8, initial('register_form').entityTypeOptions),
    ...register.text('t013', 'emailLabel', { stripRequired: true }),
    ...register.text('t014', 'phoneLabel'),
    ...register.text('t015', 'websiteLabel'),
    ...register.text('p016', 'websitePlaceholder'),
    ...register.text('t017', 'areaLabel', { stripRequired: true }),
    ...register.text('t018', 'areaPrompt'),
    areaOptions: options(register, 19, initial('register_form').areaOptions),
    ...register.text('t025', 'areaHint'),
    ...register.text('t026', 'messageLabel'),
    ...register.text('t027', 'portfolioLabel'),
    ...register.text('t028', 'portfolioHint'),
    ...register.text('t029', 'chooseFileLabel'),
    ...register.text('t030', 'noFileLabel'),
    ...register.text('t031', 'consent', { prose: true }),
    ...register.text('t032', 'submitLabel'),
    ...register.text('t033', 'successMessage'),
  },
  register_info: {
    ...register.text('t034', 'heading'),
    ...register.text('t035', 'lede'),
    steps: [
      ['t036', 't037'],
      ['t038', 't039'],
      ['t040', 't041'],
      ['t042', 't043'],
    ].map(([title, text], i) => ({
      id: initial('register_info').steps[i]!.id,
      ...register.text(title!, 'title'),
      ...register.text(text!, 'text'),
    })),
    ...register.text('t044', 'questionsLabel'),
    email: initial('register_info').email,
  },
} satisfies { [K in SingletonKey]: SingletonData<K> };

/**
 * A select's labels from consecutive keys starting at `t<first>`. The submitted
 * `value`s are fixed in code (see `fixedOptions`), so they come from `initial`.
 */
function options<V extends string>(
  page: LegacyPage,
  first: number,
  fixed: Array<{ value: V; labelAr: string; labelEn: string }>,
) {
  return fixed.map((option, i) => ({
    value: option.value,
    ...page.text(`t${String(first + i).padStart(3, '0')}`, 'label'),
  }));
}

built.article_chrome.defaultImageId = await articlePage.image('i001', {
  ar: built.article_chrome.crumbMediaAr,
  en: built.article_chrome.crumbMediaEn,
});

for (const page of [about, technologies, media, membersPage, member, contact, register]) {
  page.crumb('t001');
}
// article.js numbers from its image, so its Home crumb is t002.
articlePage.crumb('t002');

media.drop(
  ['i005', 't006', 't007', 'i008', 't009', 't010', 'i011', 't012', 't013', 'i014', 't015', 't016'],
  'four static news cards from before articles became a collection; no page reads them',
);

// ---------------------------------------------------------------------------
// Collections

/** The map pins, matched to members by id. */
interface MapRecord {
  id: string;
  ini: string;
  cat: string;
  cat_ar: string;
  city: string;
  city_ar: string;
  country: string;
  country_ar: string;
  lat: number;
  lng: number;
}
/**
 * `window.SAFTA_MEMBERS_MAP = [ { id: 'mewa', lat: 24.7, … }, … ];` read as data.
 * It is JavaScript, not JSON, but it is never run: `--from` may point at a copy
 * from elsewhere, and node:vm is no sandbox. Each record may hold only
 * `key: 'string'` and `key: number` pairs; anything else is a problem.
 */
function readMapPins(path: string): MapRecord[] {
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch (cause) {
    problem(`${path}: could not be read: ${String(cause)}`);
    return [];
  }
  const list = /window\.SAFTA_MEMBERS_MAP\s*=\s*\[([\s\S]*?)\];/.exec(source);
  if (!list) {
    problem(`${path}: no window.SAFTA_MEMBERS_MAP = [...] list`);
    return [];
  }
  const PAIR = /^\s*([A-Za-z_]\w*)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?))\s*,?/;
  const unescape = (text: string) => text.replace(/\\(.)/g, '$1');
  const pins: MapRecord[] = [];
  // Line comments and whitespace may sit between records; nothing else may.
  let rest = list[1]!.replace(/\/\/[^\n]*/g, '');
  while ((rest = rest.trim()) !== '') {
    const close = rest.indexOf('}');
    if (!rest.startsWith('{') || close === -1) {
      problem(`${path}: unexpected text in the list: ${JSON.stringify(rest.slice(0, 60))}`);
      return pins;
    }
    let body = rest.slice(1, close);
    const record: Record<string, string | number> = {};
    let match: RegExpExecArray | null;
    while ((match = PAIR.exec(body))) {
      const [whole, key, single, double, number] = match;
      record[key!] = number !== undefined ? Number(number) : unescape(single ?? double ?? '');
      body = body.slice(whole.length);
    }
    if (body.trim() !== '') {
      problem(`${path}: a record holds something other than plain values: ${JSON.stringify(body.trim().slice(0, 60))}`);
      return pins;
    }
    pins.push(record as unknown as MapRecord);
    rest = rest.slice(close + 1).replace(/^\s*,/, '');
  }
  return pins;
}

const mapPath = resolve(publicDir, 'assets/js/members-map-data.js');
const pins = new Map<string, MapRecord>();
for (const pin of readMapPins(mapPath)) {
  if (pins.has(pin.id)) problem(`members-map-data.js ${pin.id}: listed twice`);
  pins.set(pin.id, pin);
}

const categoryByEnglish = new Map(
  Object.entries(memberCategoryLabels).map(([value, label]) => [label.en, { value, label }]),
);

const members: unknown[] = [];
const memberRecords = records('members', ['name', 'logo', 'ini', 'cat', 'role', 'sector', 'since', 'short', 'bio']);
for (const [i, [id, r]] of memberRecords.entries()) {
  const where = `members.json ${id}`;
  const cat = (r.cat ?? {}) as { en?: unknown; ar?: unknown };
  const category = categoryByEnglish.get(cat.en as string);
  if (!category) {
    problem(`${where}.cat: "${String(cat.en)}" is not one of ${[...categoryByEnglish.keys()].join(', ')}`);
  } else if (cat.ar !== category.label.ar) {
    problem(`${where}.cat: the Arabic "${String(cat.ar)}" should be "${category.label.ar}"`);
  }

  const pin = pins.get(id);
  pins.delete(id);
  if (pin && (pin.ini !== r.ini || pin.cat !== cat.en)) {
    problem(`members-map-data.js ${id}: its ini/cat (${pin.ini}, ${pin.cat}) disagree with members.json`);
  }

  const name = pair(r.name, 'name', `${where}.name`);
  members.push({
    slug: id,
    category: category?.value ?? '',
    ...name,
    logoId: await image((r.logo as { src?: unknown } | undefined)?.src, nameAlt(name), `${where}.logo`),
    initials: plain(r.ini, `${where}.ini`),
    ...pair(r.role, 'role', `${where}.role`),
    ...pair(r.sector, 'sector', `${where}.sector`),
    since: plain(r.since, `${where}.since`),
    ...pair(r.bio, 'bio', `${where}.bio`),
    // `short` is dropped: English only, and nothing renders it.
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
    cityAr: pin ? clean(pin.city_ar, `members-map-data.js ${id}.city_ar`) : '',
    cityEn: pin ? clean(pin.city, `members-map-data.js ${id}.city`) : '',
    countryAr: pin ? clean(pin.country_ar, `members-map-data.js ${id}.country_ar`) : '',
    countryEn: pin ? clean(pin.country, `members-map-data.js ${id}.country`) : '',
    order: i,
    published: true,
  });
}
for (const id of pins.keys()) problem(`members-map-data.js ${id}: no member has this id`);

const workingGroups: unknown[] = [];
for (const [i, [id, r]] of records('groups', ['name', 'scope', 'img', 'no', 'ch']).entries()) {
  const where = `groups.json ${id}`;
  const name = pair(r.name, 'name', `${where}.name`);
  workingGroups.push({
    slug: id,
    number: plain(r.no, `${where}.no`),
    challenge: r.ch,
    ...name,
    ...pair(r.scope, 'scope', `${where}.scope`),
    imageId: await image((r.img as { src?: unknown } | undefined)?.src, nameAlt(name), `${where}.img`),
    order: i,
    published: true,
  });
}

const articleFields = ['kind', 'date', 'read', 'ph', 'img', 'title', 'lede', 'body', 'quote', 'quoteBy', 'tags'];
const articles: unknown[] = [];
for (const [i, [id, r]] of records('articles', articleFields).entries()) {
  const where = `articles.json ${id}`;
  const title = pair(r.title, 'title', `${where}.title`);
  const body = Array.isArray(r.body) ? (r.body as Array<{ h?: unknown; p?: unknown }>) : [];
  const tags = Array.isArray(r.tags) ? (r.tags as unknown[]) : [];
  articles.push({
    slug: id,
    ...pair(r.kind, 'kind', `${where}.kind`),
    ...pair(r.date, 'date', `${where}.date`),
    ...pair(r.read, 'readTime', `${where}.read`),
    // `ph` is dropped: a dashboard label only.
    imageId: await image((r.img as { src?: unknown } | undefined)?.src, titleAlt(title), `${where}.img`),
    ...title,
    ...pair(r.lede, 'lede', `${where}.lede`),
    blocks: body.map((block, n) => ({
      id: `block-${n + 1}`,
      ...pair(block.h, 'heading', `${where}.body[${n}].h`),
      ...pair(block.p, 'body', `${where}.body[${n}].p`),
    })),
    ...pair(r.quote, 'quote', `${where}.quote`, { optional: true }),
    ...pair(r.quoteBy, 'quoteBy', `${where}.quoteBy`, { optional: true }),
    tags: tags.map((tag, n) => ({ id: `tag-${n + 1}`, ...pair(tag, 'label', `${where}.tags[${n}]`) })),
    order: i,
    published: true,
  });
}

const events = records('events', ['day', 'month', 'title', 'desc', 'link']).map(([id, r], i) => {
  const where = `events.json ${id}`;
  return {
    slug: id,
    day: plain(r.day, `${where}.day`),
    ...pair(r.month, 'month', `${where}.month`),
    ...pair(r.title, 'title', `${where}.title`),
    ...pair(r.desc, 'description', `${where}.desc`),
    href: plain(r.link, `${where}.link`),
    order: i,
    published: true,
  };
});

for (const page of [index, about, technologies, media, articlePage, membersPage, member, contact, register]) {
  page.finish();
}

// ---------------------------------------------------------------------------
// Report, then import

if (svgUploads.length) {
  problem(
    'These uploaded SVGs are refused (SVG can carry script). Convert each to PNG, upload it in ' +
      'place of the SVG in the old dashboard, and run this again:\n      ' +
      svgUploads.join('\n      '),
  );
}

if (problems.length) {
  console.error(`[import-legacy] ${problems.length} problem(s) in ${root}; nothing was written:`);
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}

const envelope: Envelope = {
  format: FORMAT,
  formatVersion: FORMAT_VERSION,
  exportedAt: new Date().toISOString(),
  singletons: Object.fromEntries(
    Object.entries(built).map(([key, data]) => [key, { schemaVersion: singletons[key as SingletonKey].version, data }]),
  ),
  collections: { events, media: [...mediaRows.values()], workingGroups, articles, members },
};

if (outFile) {
  writeFileSync(outFile, JSON.stringify(envelope, null, 2) + '\n');
  console.log(`[import-legacy] Envelope written to ${outFile}.`);
}

// Validate everything before writing anything, files included.
let report: ImportReport;
try {
  report = importContent(envelope, { dryRun: true });
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[import-legacy] The built content does not validate; nothing was written:\n  ${reason}`);
  process.exit(1);
}
const newFiles = new Set(report.missingBlobs);

const edited = hasDashboardEdits();
if (edited && !cli.replace) {
  const message =
    'The database holds content saved in the dashboard. Importing replaces every collection ' +
    'and page section with the legacy content, losing those edits. Re-run with --replace to do it anyway.';
  if (!dryRun) {
    console.error(`[import-legacy] ${message} Nothing was written.`);
    process.exit(1);
  }
  console.warn(`[import-legacy] warning: ${message}`);
}

if (!dryRun) {
  // Files first, rows second, as in ingestImage: a row must never point at a
  // missing file, and a file left behind by a failure here is harmless.
  for (const id of newFiles) await writeMediaFile(images.get(id)!);
  report = importContent(envelope);
}

const verb = dryRun ? 'Would import' : 'Imported';
console.log(`[import-legacy] ${verb} from ${root}:`);
console.log(`  singletons: ${report.singletons.length}`);
console.log(`  members: ${report.members} (${members.filter((m) => (m as { lat: unknown }).lat !== null).length} on the map)`);
console.log(`  working groups: ${report.workingGroups}`);
console.log(`  articles: ${report.articles}`);
console.log(`  events: ${report.events}`);
console.log(`  media: ${report.media} (${newFiles.size} new file(s) ${dryRun ? 'to write' : 'written'})`);
for (const ref of report.danglingMedia) {
  console.warn(`  warning: ${ref.key} ${ref.path} references media ${ref.id}, which has no row`);
}
process.exit(0);
