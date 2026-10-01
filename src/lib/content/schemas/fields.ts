/**
 * Field builders shared by the singleton schemas and the collection inputs.
 *
 * These exist so every surface validates the same way — an href is an href
 * everywhere, a list item id has one shape — rather than each schema
 * re-deriving the rules and drifting.
 *
 * Copied from waterstrip (see docs/content-storage.md for the commit) and
 * extended with SAFTA's own field kinds: `bilingual`, `youtubeUrl`,
 * `contactEmail`, `linkHref` and `fixedOptions`.
 */
import { z } from 'zod';
import { youtubeEmbedUrl } from '../../youtube.ts';

const REQUIRED = 'هذا الحقل مطلوب.';

/**
 * Required Arabic copy. Trimmed, so whitespace-only fails `min`.
 *
 * The messages are Arabic because they are rendered verbatim next to the field
 * in the dashboard, which stays Arabic-only (the public site also has English).
 */
export function arText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, min === 1 ? REQUIRED : `الحد الأدنى ${min} حرفًا.`)
    .max(max, `الحد الأقصى ${max} حرفًا.`);
}

/**
 * Optional English copy, the `xEn` sibling of an `xAr` field. Empty means "not
 * translated yet": the English page falls back to the Arabic value. The limit
 * matches the Arabic sibling's `max`.
 */
export function enText(max: number) {
  return z.string().trim().max(max, `الحد الأقصى ${max} حرفًا.`);
}

type Bilingual<N extends string, A, E> = { [K in `${N}Ar`]: A } & { [K in `${N}En`]: E };

/**
 * One `xAr`/`xEn` pair, spread into a `z.object` shape:
 * `z.object({ ...bilingual('title', 120) })` declares `titleAr` (required) and
 * `titleEn` (optional, falls back to Arabic). Declaring the pair in one place is
 * what keeps the two limits equal.
 */
export function bilingual<N extends string>(name: N, max: number) {
  return {
    [`${name}Ar`]: arText(1, max),
    [`${name}En`]: enText(max),
  } as Bilingual<N, ReturnType<typeof arText>, ReturnType<typeof enText>>;
}

/** As `bilingual`, but the Arabic may be empty too — an article's optional quote. */
export function optionalBilingual<N extends string>(name: N, max: number) {
  return {
    [`${name}Ar`]: enText(max),
    [`${name}En`]: enText(max),
  } as Bilingual<N, ReturnType<typeof enText>, ReturnType<typeof enText>>;
}

/**
 * A relative path or an on-site anchor. No absolute URLs and no
 * protocol-relative ones: the CMS is not a link manager pointing at arbitrary
 * origins. Stored without the `/en` or `/ar` prefix; the page adds it.
 */
export const siteHref = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(200, 'الحد الأقصى 200 حرف.')
  .refine(
    (v) => !/^[a-z]+:/i.test(v) && !v.startsWith('//'),
    'يجب أن يكون مسارًا داخليًا — الروابط الخارجية غير مسموحة.',
  );

/** A required external link: an absolute https URL. */
export const externalUrl = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(500, 'الحد الأقصى 500 حرف.')
  .refine((v) => /^https:\/\/[^\s/]+/i.test(v), 'يجب أن يكون رابطًا كاملاً يبدأ بـ https://‎.');

/**
 * An event's link: either an on-site path (as `siteHref`) or an https URL to
 * another site. Anything with another scheme — `javascript:` above all — is
 * refused, which is what SAFTA's old `safeHref` did at render time.
 */
export const linkHref = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(500, 'الحد الأقصى 500 حرف.')
  .refine(
    (v) => /^https:\/\/[^\s/]+/i.test(v) || (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('//')),
    'يجب أن يكون مسارًا داخليًا مثل ‎/register-interest‎ أو رابطًا يبدأ بـ https://‎.',
  );

/**
 * A YouTube link for the about page's video, in any shape an admin pastes —
 * see src/lib/youtube.ts. Empty means "no video": the page drops the block.
 */
export const youtubeUrl = z
  .string()
  .trim()
  .max(500, 'الحد الأقصى 500 حرف.')
  .refine((v) => v === '' || youtubeEmbedUrl(v) !== null, 'ليس رابط فيديو يوتيوب صالحًا.');

/** A public contact address shown on the site. */
export const contactEmail = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(200, 'الحد الأقصى 200 حرف.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'بريد إلكتروني غير صالح.');

/**
 * A list item's stable identity. Generated when an admin adds an item and never
 * re-keyed afterwards, so reordering and removal cannot shuffle anything keyed
 * by it.
 */
export const itemId = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'معرّف غير صالح.');

/** A collection row's slug: the URL segment, or the `?id=` value today. */
export const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'حروف لاتينية صغيرة وأرقام وشرطات فقط، مثل mewa.');

/**
 * A `<select>` whose options are fixed in code. Each option's `value` is what
 * the form submits, so it never changes; only the visible label is content.
 * The list must hold every value exactly once, in the declared order — options
 * cannot be added, removed or reordered from the dashboard.
 */
export function fixedOptions<const V extends readonly [string, ...string[]]>(values: V, max = 80) {
  const option = z.object({ value: z.enum(values), ...bilingual('label', max) });
  return z
    .array(option)
    .length(values.length, 'قائمة الخيارات ثابتة.')
    .refine((list) => list.every((o, i) => o.value === values[i]), 'قائمة الخيارات ثابتة.');
}

/** Builds a `fixedOptions` initial value from `[value, labelAr, labelEn]` rows. */
export function optionsFrom<V extends string>(rows: ReadonlyArray<readonly [V, string, string]>) {
  return rows.map(([value, labelAr, labelEn]) => ({ value, labelAr, labelEn }));
}

/**
 * A reference to a `media` row: the SHA-256 of the stored file. Never a path, a
 * URL or a filename.
 *
 * Zod checks the *shape* only. Whether the row exists is the repository's job
 * (`setSingleton`), because a migration must tolerate a dangling id — an import
 * can legitimately arrive before its image files do. Every image field must be
 * built from this exact schema object: `collectMediaIds` finds references by
 * identity, not by field name.
 */
export const mediaId = z.string().regex(/^[0-9a-f]{64}$/, 'معرّف صورة غير صالح.');

export interface MediaRef {
  path: Array<string | number>;
  id: string;
}

/**
 * Walks a schema and a payload that satisfies it in step, returning every
 * non-null value sitting at a `mediaId` position.
 *
 * Driven by the schema rather than by key names, so an image field is checked
 * whatever it is called (`imageId`, `logoId`), and a string that merely looks
 * like a hash is not. Collection inputs are Zod objects too, so this walks a
 * member row as readily as a singleton.
 */
export function collectMediaIds(schema: z.core.$ZodType, data: unknown): MediaRef[] {
  const refs: MediaRef[] = [];

  function walk(node: z.core.$ZodType, value: unknown, path: Array<string | number>): void {
    if (value === null || value === undefined) return;
    if (node === mediaId) {
      if (typeof value === 'string') refs.push({ path, id: value });
      return;
    }

    const def = node._zod.def as z.core.$ZodTypeDef & {
      shape?: Record<string, z.core.$ZodType>;
      element?: z.core.$ZodType;
      innerType?: z.core.$ZodType;
      in?: z.core.$ZodType;
    };

    switch (def.type) {
      case 'object':
        if (typeof value !== 'object') return;
        for (const [key, child] of Object.entries(def.shape ?? {})) {
          walk(child, (value as Record<string, unknown>)[key], [...path, key]);
        }
        return;
      case 'array':
        if (!Array.isArray(value) || !def.element) return;
        value.forEach((item, i) => walk(def.element!, item, [...path, i]));
        return;
      case 'nullable':
      case 'optional':
      case 'default':
      case 'prefault':
      case 'readonly':
      case 'nonoptional':
      case 'catch':
        if (def.innerType) walk(def.innerType, value, path);
        return;
      case 'pipe':
        if (def.in) walk(def.in, value, path);
        return;
      default:
        return;
    }
  }

  walk(schema, data, []);
  return refs;
}
