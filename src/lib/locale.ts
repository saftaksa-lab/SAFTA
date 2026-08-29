export type Locale = 'en' | 'ar';

/**
 * `Astro.params.locale` is typed as plain `string` (or `string | undefined`) by Astro's
 * dynamic-route params, so a `!==` comparison against a literal doesn't narrow it — TS has
 * no way to represent "string, but not 'en'". A type predicate does, so pages that guard
 * on this can pass `locale` on to BaseLayout's `Locale`-typed prop without a cast.
 */
export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'ar';
}
