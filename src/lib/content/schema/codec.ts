import { z } from 'zod';

/**
 * The shared shape every page schema module (./about.ts, etc.) declares its fields in.
 * `kind` drives both the zod validator (which record shape is required on disk) and the
 * accessor typing in store.ts (which of `c.text()` / `c.image()` a key is allowed through).
 * `tag`/`type`/`label` are admin-UI-only — how the field is presented for editing.
 */
export type FieldKind = 'text' | 'image';

export interface FieldDef {
  kind: FieldKind;
  tag: string;
  type: string;
  label: string;
}

export type FieldMap = Record<string, FieldDef>;

/** A section/card as a page schema module declares it: field keys only, no duplicated data. */
export interface SectionShape {
  key: string;
  label: string;
  fields: readonly string[];
  cards: readonly { key: string; label: string; fields: readonly string[] }[];
}

/** The same section, wire-ready: each key expanded back into its full field definition —
 *  the shape admin.js's flatFields()/renderPane() actually read (f.key/f.tag/f.type/f.label). */
export interface AdminSection {
  key: string;
  label: string;
  fields: ({ key: string } & FieldDef)[];
  cards: { key: string; label: string; fields: ({ key: string } & FieldDef)[] }[];
}

export function denormalizeSections(fields: FieldMap, sections: readonly SectionShape[]): AdminSection[] {
  const expand = (keys: readonly string[]) => keys.map((key) => ({ key, ...fields[key] }));
  return sections.map((s) => ({
    key: s.key,
    label: s.label,
    fields: expand(s.fields),
    cards: s.cards.map((c) => ({ key: c.key, label: c.label, fields: expand(c.fields) })),
  }));
}

const MAX_FIELD_LENGTH = 20_000;

function str() {
  return z.string().max(MAX_FIELD_LENGTH).default('');
}

const textRecord = z.object({ en: str(), ar: str() });
const imageRecord = z.object({ src: str(), alt: str(), alt_ar: str() });

/**
 * Builds the zod validator for a page's POST body straight from its field map: every
 * registered key is required (a missing key fails validation — there is no such thing as
 * "optional" content, every field the page renders must have a value), no unregistered key
 * is accepted, and each key's record shape follows its `kind`. Because this comes from the
 * schema module instead of whatever happens to be on disk, a corrupted or hand-edited
 * content file can't narrow what a future publish is allowed to contain.
 */
export function zodForFields(fields: FieldMap) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, def] of Object.entries(fields)) {
    shape[key] = def.kind === 'image' ? imageRecord : textRecord;
  }
  return z.object(shape).strict();
}

type KeysOfKind<F extends FieldMap, K extends FieldKind> = {
  [P in keyof F]: F[P] extends { kind: K } ? P : never;
}[keyof F];

/** `getPageContent<F>()`'s return type: `text()`/`image()` narrowed to that page's own keys. */
export interface TypedPageContent<F extends FieldMap> {
  text(key: KeysOfKind<F, 'text'>): { en: string; ar: string };
  image(key: KeysOfKind<F, 'image'>): { src: string; alt: string; altAr: string };
}
