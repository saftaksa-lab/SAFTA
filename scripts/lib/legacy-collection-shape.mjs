// Shared by scripts/seed-collections.mjs and scripts/generate-collection-schema.mjs.
//
// public/admin/schema.js's `_groups`/`_articles`/`_events` entries describe each field with
// a dot-path (`stats.0.n`, `body.1.p`, `tags.0`) plus an optional `arPath` for its Arabic
// counterpart. That addressing was a per-record, per-slot enumeration in the old admin UI —
// this module collapses it, once, into a per-collection shape: for each top-level key, what
// kind it is (text pair / untranslated value / image / boolean / list-of-object /
// list-of-scalar) and, for lists, what one item looks like. Both the schema generator (which
// turns that shape into an ItemFieldMap) and the seed script (which reshapes raw legacy
// records into the nested {en,ar} / array-of-items form the new codec validates against) need
// the exact same shape, so it lives here once instead of twice.

/**
 * @param {Array<{cards: Array<{fields: Array<{path: string, arPath: string|null, label: string, type: string}>}>}>} sections
 */
export function deriveShape(sections) {
  const allFields = sections.flatMap((s) => s.cards.flatMap((c) => c.fields));
  const byTop = new Map();
  for (const f of allFields) {
    const top = f.path.split('.')[0];
    if (!byTop.has(top)) byTop.set(top, []);
    byTop.get(top).push(f);
  }

  const shape = {};
  for (const [top, fields] of byTop) {
    const depths = new Set(fields.map((f) => f.path.split('.').length));

    if (depths.has(1)) {
      const f = fields.find((x) => x.path === top);
      shape[top] = scalarDescriptor(f);
      continue;
    }

    if (depths.has(2)) {
      // list of scalars: "tags.0", "tags.1", arPath "tags_ar.0"/... or null
      const first = fields.find((f) => f.path === `${top}.0`) ?? fields[0];
      shape[top] = {
        kind: 'list',
        itemKind: first.arPath ? 'text' : 'value',
        label: baseLabel(first.label),
        type: first.type,
      };
      continue;
    }

    if (depths.has(3)) {
      // list of objects: "stats.0.n"/"stats.0.l" (arPath "stats.0.l_ar" or null). Not every
      // record has a slot 0 (an empty array declares no fields at all for that section), so
      // fall back to whatever index this collection's fields actually start at.
      const idx = firstIndex(fields, top);
      const itemFieldSource = fields.filter((f) => f.path.startsWith(`${top}.${idx}.`));
      const itemFields = {};
      for (const f of itemFieldSource) {
        const sub = f.path.split('.')[2];
        itemFields[sub] = f.arPath
          ? { kind: 'text', arKey: f.arPath.split('.').pop(), label: baseLabel(f.label), type: f.type }
          : { kind: 'value', label: baseLabel(f.label), type: f.type };
      }
      shape[top] = {
        kind: 'list',
        itemFields,
        label: baseLabel(itemFieldSource[0]?.label ?? top),
        type: 'list',
      };
      continue;
    }
  }
  return shape;
}

function scalarDescriptor(f) {
  if (f.type === 'image') return { kind: 'image', label: f.label, type: f.type };
  if (f.type === 'boolean') return { kind: 'boolean', label: f.label, type: f.type };
  if (f.arPath) return { kind: 'text', arKey: f.arPath, label: f.label, type: f.type };
  return { kind: 'value', label: f.label, type: f.type };
}

function firstIndex(fields, top) {
  const indices = fields
    .map((f) => f.path.match(new RegExp(`^${top}\\.(\\d+)\\.`)))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  return indices.length ? Math.min(...indices) : 0;
}

/** "الأرقام 1 — الرقم" → "الرقم"; "الوسوم 1" → "الوسوم" — strips the per-slot ordinal so a
 *  list field's label describes the sub-field, not one specific record's specific slot. */
function baseLabel(label) {
  const dashed = label.match(/—\s*(.+)$/);
  if (dashed) return dashed[1].trim();
  const trailingNum = label.match(/^(.*?)\s+\d+$/);
  return trailingNum ? trailingNum[1].trim() : label;
}

/** Reshapes one raw legacy record (flat `_ar` sibling keys, parallel `tags`/`tags_ar`
 *  arrays) into the nested shape src/lib/content/collections/codec.ts validates against. */
export function reshapeRecord(raw, shape) {
  const out = {};
  for (const [key, desc] of Object.entries(shape)) {
    out[key] = reshapeValue(raw, key, desc);
  }
  return out;
}

function reshapeValue(raw, key, desc) {
  switch (desc.kind) {
    case 'text':
      return { en: raw[key] ?? '', ar: raw[desc.arKey] ?? '' };
    case 'value':
      return raw[key] ?? '';
    case 'boolean':
      return Boolean(raw[key]);
    case 'image':
      return { src: raw[key] ?? '' };
    case 'list': {
      const arr = Array.isArray(raw[key]) ? raw[key] : [];
      if (desc.itemKind === 'text') {
        const arArr = Array.isArray(raw[`${key}_ar`]) ? raw[`${key}_ar`] : [];
        return arr.map((en, i) => ({ en, ar: arArr[i] ?? '' }));
      }
      if (desc.itemKind === 'value') return arr.slice();
      // itemFields (object list): each element is itself a flat-sibling record one level in.
      return arr.map((item) => reshapeRecord(item, desc.itemFields));
    }
    default:
      throw new Error(`unhandled shape kind "${desc.kind}" for "${key}"`);
  }
}
