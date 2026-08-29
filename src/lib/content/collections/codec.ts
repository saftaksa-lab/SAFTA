import { z } from 'zod';

/**
 * The item-field shape a collection schema module (./groups.ts, ./articles.ts, ./events.ts)
 * declares its records in. Unlike a page's flat FieldMap (../schema/codec.ts), a collection
 * is `Record<id, item>` where each `item` is itself a FieldMap-shaped object — so this codec
 * is a separate, sibling family rather than an extension of the page one: it needs kinds
 * (`value`, `boolean`, `list`) and recursion that no page field has ever needed, and folding
 * the two together would mean every page-field consumer growing branches it never hits.
 */
export type ItemFieldKind = 'text' | 'image' | 'value' | 'boolean' | 'list';

export interface ItemFieldDef {
  kind: ItemFieldKind;
  // No `tag` here (unlike ../schema/codec.ts's FieldDef) — the dot-path fields this is
  // generated from (public/admin/schema.js's _groups/_articles/_events entries) carry no
  // DOM-tag concept, only `path`/`arPath`/`label`/`type`. Add it once a render component
  // actually needs to pick a tag per field.
  type: string;
  label: string;
  /** Only meaningful when kind === 'list' and the array holds objects (e.g. stats, recs). */
  itemFields?: ItemFieldMap;
  /** Only meaningful when kind === 'list' and the array holds scalars (e.g. tags). Mutually
   *  exclusive with itemFields — a list field declares exactly one of the two. */
  itemKind?: 'text' | 'value';
}

export type ItemFieldMap = Record<string, ItemFieldDef>;

/** A generated collection module's shape, as ./registry.ts consumes it. */
export interface CollectionShape {
  label: string;
  file: string;
  store: string;
  addable: boolean;
  fields: ItemFieldMap;
  newItem: Record<string, unknown>;
}

const MAX_FIELD_LENGTH = 20_000;

function str() {
  return z.string().max(MAX_FIELD_LENGTH).default('');
}

const textRecord = z.object({ en: str(), ar: str() });
// Collection image fields (groups'/articles' `img`) are a bare uploaded-file path in the
// legacy data — no alt/alt_ar ever existed for them (arPath is always null), unlike a
// page's ImageField. Don't fabricate alt-text fields the source data has no place for.
const imageValue = z.object({ src: str() });

/**
 * Builds one item's validator recursively from its field map — the same "every declared key
 * required, no undeclared key accepted" contract zodForFields uses for pages, extended with
 * the three kinds pages never have. A 'list' field validates as an array of whatever its own
 * item shape is (object via itemFields, recursing back into this same function; or scalar via
 * itemKind), with no length constraint — every repeating structure here is variable-length in
 * the real data (stats/recs/body/tags all vary per record), so the array itself carries no
 * fixed size.
 */
export function zodForItemFields(fields: ItemFieldMap): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, def] of Object.entries(fields)) {
    shape[key] = zodForItemField(def);
  }
  return z.object(shape).strict();
}

function zodForItemField(def: ItemFieldDef): z.ZodTypeAny {
  switch (def.kind) {
    case 'image':
      return imageValue;
    case 'value':
      return str();
    case 'boolean':
      return z.boolean().default(false);
    case 'list': {
      if (def.itemFields) return z.array(zodForItemFields(def.itemFields)).default([]);
      if (def.itemKind === 'value') return z.array(str()).default([]);
      return z.array(textRecord).default([]);
    }
    case 'text':
    default:
      return textRecord;
  }
}

/**
 * The whole collection's validator: an id-keyed record of items. Id uniqueness is automatic
 * (object keys); whether the id *set* itself is allowed to change (addable collections like
 * groups/events vs. the fixed 7-article set) is not a shape question zod can express, so it's
 * enforced separately by validateCollectionUpdate in ./store.ts.
 */
export function zodForCollection(fields: ItemFieldMap) {
  return z.record(z.string().min(1), zodForItemFields(fields));
}

type KeysOfKind<F extends ItemFieldMap, K extends ItemFieldKind> = {
  [P in keyof F]: F[P] extends { kind: K } ? P : never;
}[keyof F];

export interface TextPair {
  en: string;
  ar: string;
}

export interface ImageValue {
  src: string;
}

/** getCollectionContent<F>()'s per-item accessor type: narrowed to that collection's own keys. */
export interface TypedItemContent<F extends ItemFieldMap> {
  text(key: KeysOfKind<F, 'text'>): TextPair;
  image(key: KeysOfKind<F, 'image'>): ImageValue;
  value(key: KeysOfKind<F, 'value'>): string;
  flag(key: KeysOfKind<F, 'boolean'>): boolean;
  list(key: KeysOfKind<F, 'list'>): unknown[];
}
