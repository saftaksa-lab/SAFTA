/**
 * What an image slot shows when its media id is `null` (or names a row that
 * does not exist): the artwork the site shipped with for that slot.
 *
 * The legacy import turns these same files into media rows, so after it runs
 * every slot below holds a real id and this is only reached when an admin
 * clears an image. Maps are keyed by the *stable item id* in the singleton
 * payload, not by list position, so reordering or removing an item cannot
 * shuffle the artwork; an item an admin adds has no entry and gets the shared
 * placeholder.
 *
 * Paths are relative on purpose: BaseLayout sets `<base href="/">`.
 */
import { getMedia } from './content/cache.ts';

/** Shown for any list item without an entry in its map. */
export const PLACEHOLDER_IMG = 'assets/img/placeholders/ph-what-we-do.svg';

export const heroImages: Record<string, string> = {
  'hero-1': 'assets/img/green-dunes/gd-02-beds-hero.webp',
  'hero-2': 'assets/img/green-dunes/gd-03-rows-hero.webp',
  'hero-3': 'assets/img/green-dunes/gd-09-racks-hero.webp',
};

export const discoverImages: Record<string, string> = {
  'discover-1': 'assets/img/gallery/kaust-1-thumb.jpg',
  'discover-2': 'assets/img/gallery/kaust-4-thumb.jpg',
};

export const challengeImages: Record<string, string> = {
  'water-scarcity': 'assets/img/placeholders/ph-water-scarcity.svg',
  'harsh-climate': 'assets/img/placeholders/ph-climate.svg',
  'pest-risks': 'assets/img/placeholders/ph-pests.svg',
  'soil-degradation': 'assets/img/placeholders/ph-soil.svg',
  'food-waste': 'assets/img/placeholders/ph-food-waste.svg',
  'import-dependency': 'assets/img/placeholders/ph-what-we-do.svg',
  'tech-gaps': 'assets/img/placeholders/ph-insight-01.svg',
};

export const partnerLogos: Record<string, string> = {
  mewa: 'assets/img/partners/mewa.png',
  kaust: 'assets/img/partners/kaust.png',
  estidamah: 'assets/img/partners/estidamah.png',
  arasco: 'assets/img/partners/arasco.png',
  almarai: 'assets/img/partners/almarai.png',
  tanmiah: 'assets/img/partners/tanmiah.png',
  npras: 'assets/img/partners/npras.png',
};

export const FOUNDING_STATEMENT_IMG = 'assets/img/placeholders/ph-membership.svg';

/** An article's hero and news card when neither it nor `article_chrome` has an image. */
export const ARTICLE_IMG = 'assets/img/green-dunes/gd-09-racks-hero.webp';

export function imageFor(map: Record<string, string>, id: string): string {
  return map[id] ?? PLACEHOLDER_IMG;
}

/** Spread onto an `<img>`. Dimensions are present only for uploads, which store them. */
export interface ResolvedImage {
  src: string;
  width?: number;
  height?: number;
  /** The media row's alt text (English, falling back to Arabic); empty for a fallback. */
  alt: string;
}

/** The uploaded image when `mediaId` resolves, `fallback` otherwise. */
export function resolveImage(mediaId: string | null, fallback: string): ResolvedImage {
  const media = mediaId ? getMedia(mediaId) : null;
  return media
    ? { src: media.url, width: media.width, height: media.height, alt: media.altEn || media.altAr }
    : { src: fallback, alt: '' };
}

/** As `resolveImage`, but `null` when there is no upload — for slots that draw something else instead. */
export function uploadedImage(mediaId: string | null): ResolvedImage | null {
  const media = mediaId ? getMedia(mediaId) : null;
  return media ? resolveImage(mediaId, '') : null;
}
