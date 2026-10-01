/**
 * Checks every dashboard panel (src/components/admin/sections.ts) against the
 * Zod schema it edits, in both directions:
 *
 * - every field the panel declares exists in the schema, with a matching kind;
 * - every key the schema has is edited by the panel (list item `id`s, and a
 *   collection row's `order`, are managed by the dashboard itself).
 *
 * A panel that misses a field would save the old value forever without anyone
 * noticing; one that names a field the schema lacks would fail every save.
 *
 *   node scripts/check-admin-specs.ts
 */
import { z } from 'zod';
import { sections, collections } from '../src/components/admin/sections.ts';
import type { FieldSpec } from '../src/components/admin/spec.ts';
import { singletons } from '../src/lib/content/schemas/index.ts';
import { collectionInputs } from '../src/lib/content/repo.ts';
import { mediaId } from '../src/lib/content/schemas/fields.ts';

type Node = z.core.$ZodType;
type Def = z.core.$ZodTypeDef & {
  shape?: Record<string, Node>;
  element?: Node;
  innerType?: Node;
  in?: Node;
};

/** Strips wrappers (`nullable`, `default`, a refined pipe) down to the type that matters. */
function unwrap(node: Node): Node {
  const def = node._zod.def as Def;
  if (def.innerType) return unwrap(def.innerType);
  if (def.type === 'pipe' && def.in) return unwrap(def.in);
  return node;
}

const kindOf = (node: Node) => (unwrap(node)._zod.def as Def).type;
const shapeOf = (node: Node) => (unwrap(node)._zod.def as Def).shape ?? {};
const elementOf = (node: Node) => (unwrap(node)._zod.def as Def).element!;
const isMedia = (node: Node) => unwrap(node) === mediaId;

/** Which Zod type each spec kind must point at. */
const EXPECTED: Record<FieldSpec['kind'], string> = {
  text: 'string',
  plain: 'string',
  href: 'string',
  link: 'string',
  url: 'string',
  youtube: 'string',
  email: 'string',
  checkbox: 'boolean',
  integer: 'number',
  coordinate: 'number',
  select: 'enum',
  image: 'string',
  options: 'array',
  list: 'array',
};

const problems: string[] = [];

function check(where: string, fields: FieldSpec[], schema: Node, managed: string[]): void {
  const shape = shapeOf(schema);
  const covered = new Set(managed);

  for (const field of fields) {
    const keys = field.kind === 'text' ? [`${field.name}Ar`, `${field.name}En`] : [field.name];
    for (const key of keys) {
      covered.add(key);
      const node = shape[key];
      if (!node) {
        problems.push(`${where}: the panel edits "${key}", which the schema does not have.`);
        continue;
      }
      const actual = kindOf(node);
      if (actual !== EXPECTED[field.kind]) {
        problems.push(`${where}.${key}: panel kind "${field.kind}" but the schema has ${actual}.`);
      }
      if ((field.kind === 'image') !== isMedia(node)) {
        problems.push(`${where}.${key}: image fields and mediaId schema fields must match up.`);
      }
    }
    if (field.kind === 'list' && shape[field.name]) {
      check(`${where}.${field.name}[]`, field.fields, elementOf(shape[field.name]), ['id']);
    }
    if (field.kind === 'select' && shape[field.name]) {
      const values = (unwrap(shape[field.name])._zod.def as unknown as { entries: Record<string, string> }).entries;
      const offered = field.options.map((o) => o.value).sort().join(',');
      const allowed = Object.values(values).sort().join(',');
      if (offered !== allowed) problems.push(`${where}.${field.name}: options [${offered}] but the schema allows [${allowed}].`);
    }
  }

  for (const key of Object.keys(shape)) {
    if (!covered.has(key)) problems.push(`${where}: the schema has "${key}", which the panel never edits.`);
  }
}

for (const [key, spec] of Object.entries(sections)) {
  check(key, spec.fields, singletons[key as keyof typeof singletons].schema, []);
}
for (const [key, spec] of Object.entries(collections)) {
  check(key, spec.fields, collectionInputs[key as keyof typeof collectionInputs], ['order']);
}

if (problems.length) {
  console.error(`[check-admin-specs] ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `[check-admin-specs] ${Object.keys(sections).length} sections and ${Object.keys(collections).length} collections match their schemas.`,
);
