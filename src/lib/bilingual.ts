/**
 * Turning content fields into what SAFTA's public markup renders.
 *
 * The public pages are sent in English, with the Arabic riding along in
 * `data-ar` for assets/js/i18n.js to swap in (see Text.astro). Content stores
 * each text field as an `xAr` / `xEn` pair where only Arabic is required, so
 * the English side falls back to Arabic here, once, rather than in every page.
 */
import type { Locale } from './locale.ts';

/** One text field in both languages, as stored: `en` may be empty. */
export interface Bilingual {
  ar: string;
  en: string;
}

/** `pick(hero, 'heading')` → `{ ar: hero.headingAr, en: hero.headingEn }`. */
export function pick<N extends string>(
  source: { [K in `${N}Ar` | `${N}En`]: string },
  name: N,
): Bilingual {
  return { ar: source[`${name}Ar`], en: source[`${name}En`] };
}

/** The English text to render, or the Arabic when it has not been translated. */
export function english(field: Bilingual): string {
  return field.en.trim() === '' ? field.ar : field.en;
}

/** Plain text for an `innerHTML` swap: i18n.js assigns `data-ar` as markup. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A stored on-site path (`/about`, `/`) as a link on this locale's pages
 * (`/en/about`, `/en`). Absolute `https://` URLs and in-page anchors are left
 * alone.
 */
export function localizeHref(locale: Locale, href: string): string {
  if (/^https:\/\//i.test(href) || href.startsWith('#') || href.startsWith('mailto:')) return href;
  // A path copied from the site already has its prefix (`/en/about`); drop it, or the
  // link would become `/ar/en/about`.
  // `/` and `/?q` are the home page, which is `/ar` with no trailing slash.
  const path = (href.startsWith('/') ? href : `/${href}`)
    .replace(/^\/(?:en|ar)(?=[/?#]|$)/, '')
    .replace(/^\/(?=[?#]|$)/, '');
  return `/${locale}${path}`;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
