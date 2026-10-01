/**
 * How a dashboard section declares its fields.
 *
 * Each editable surface lists its fields here, in code, as plain data — the
 * admin never sees or edits these lists, so they cannot change a page's
 * structure (AGENTS.md, "Admins edit content, never structure"). One renderer
 * (FieldList.tsx) draws any list, which is why SAFTA has no hand-written editor
 * per section. The data crosses from the Astro page into a React island as
 * props, so it must stay serialisable: no functions.
 *
 * `name` is the field's key in the payload. For a bilingual `text` field it is
 * the base name: `title` edits `titleAr` and `titleEn`.
 *
 * scripts/check-admin-specs.ts checks every section's fields against its Zod
 * schema, both ways, so a field the dashboard forgets — or one the schema does
 * not have — fails the check rather than a save.
 */

interface Base {
  name: string;
  label: string;
  hint?: string;
}

export type FieldSpec =
  /** An `xAr`/`xEn` pair. `rows` makes both a textarea; `optional` drops the Arabic requirement. */
  | (Base & { kind: 'text'; rows?: number; optional?: boolean })
  /** One string that is not translated: a year, a day of the month, initials. */
  | (Base & { kind: 'plain'; ltr?: boolean })
  /** An on-site path (`siteHref`). */
  | (Base & { kind: 'href' })
  /** An on-site path or an https URL (`linkHref`). */
  | (Base & { kind: 'link' })
  /** An https URL, or empty for `null`. */
  | (Base & { kind: 'url' })
  /** A YouTube link, or empty for none. */
  | (Base & { kind: 'youtube' })
  | (Base & { kind: 'email' })
  | (Base & { kind: 'checkbox' })
  /** A whole number. */
  | (Base & { kind: 'integer' })
  /** A decimal that may be empty (`null`), e.g. a latitude. */
  | (Base & { kind: 'coordinate' })
  /** One value from a fixed set. */
  | (Base & { kind: 'select'; options: Array<{ value: string; label: string }> })
  /**
   * A media id. `altFrom` names the bilingual field whose Arabic value prefills
   * the alt text on upload; `logo` previews on a checkerboard.
   */
  | (Base & { kind: 'image'; altFrom?: string; variant?: 'photo' | 'logo' })
  /** A `fixedOptions` list: every option's value is fixed, only its labels are content. */
  | (Base & { kind: 'options' })
  /**
   * A repeatable list of items with stable ids. `fixed` lists keep their count
   * and order (a three-slide carousel); the others can add, remove and reorder
   * between `min` and `max`.
   */
  | (Base & {
      kind: 'list';
      /** Heading of each item, e.g. "الشريحة" renders "الشريحة 2". */
      itemLabel: string;
      idPrefix: string;
      min: number;
      max: number;
      fixed?: boolean;
      fields: FieldSpec[];
    });

/** A singleton's panel. */
export interface SectionSpec {
  title: string;
  lede?: string;
  fields: FieldSpec[];
}

/** A collection's panel: the whole list, saved at once. */
export interface CollectionSpec {
  title: string;
  lede?: string;
  /** The endpoint that GETs and PUTs the list. */
  url: string;
  /** Row field shown as each row's heading, e.g. `nameAr`. */
  labelField: string;
  /** Prefix of the slug a new row starts with, e.g. `member` gives `member-13`. */
  idPrefix: string;
  max: number;
  fields: FieldSpec[];
}
