#!/usr/bin/env node
// Generates src/lib/content/collections/<name>.ts from public/admin/schema.js's `_<name>`
// entry (kind:"data" — the admin UI's existing dot-path field layout), cross-checked against
// content/<name>.json (run `node scripts/seed-collections.mjs` first if that's missing). The
// counterpart to scripts/generate-page-schema.mjs for collections: fails loudly on any
// mismatch between the two sources rather than emitting a schema already out of sync with
// the content store — including a top-level key present in the data but never declared as a
// field (that's what makes an undocumented field like `ch`/`src`/`ph` a build error instead
// of a silent gap the next time this needs to be regenerated).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveShape, reshapeRecord } from './lib/legacy-collection-shape.mjs';

const name = process.argv[2];
const KNOWN = { groups: '_groups', articles: '_articles', events: '_events' };
if (!name || !KNOWN[name]) {
  console.error(`usage: node scripts/generate-collection-schema.mjs <${Object.keys(KNOWN).join('|')}>`);
  process.exit(1);
}

const schemaSrc = readFileSync(resolve('public/admin/schema.js'), 'utf8');
const schemaMatch = schemaSrc.match(/=\s*(\{[\s\S]*?\});?\s*$/m);
if (!schemaMatch) {
  console.error('could not locate the assigned object literal in public/admin/schema.js');
  process.exit(1);
}
const allSchemas = JSON.parse(schemaMatch[1]);
const schemaKey = KNOWN[name];
const pageSchema = allSchemas[schemaKey];
if (!pageSchema) {
  console.error(`no "${schemaKey}" entry in public/admin/schema.js`);
  process.exit(1);
}
if (pageSchema.kind !== 'data') {
  console.error(`"${schemaKey}" is not a kind:"data" entry — this generator only handles collections`);
  process.exit(1);
}

let content;
try {
  content = JSON.parse(readFileSync(resolve(`content/${name}.json`), 'utf8'));
} catch (err) {
  console.error(
    `content/${name}.json is missing or invalid — run \`node scripts/seed-collections.mjs ${name}\` first.`,
  );
  console.error(err.message);
  process.exit(1);
}

const shape = deriveShape(pageSchema.sections || []);

// Cross-validate: every top-level key the schema declares must actually appear on at least
// one record, and every top-level key any record has must be declared in the schema. A list
// field is allowed to be empty on every record it appears on (gm-crops's `stats`) — that's
// still "declared", just never populated — so this only compares key *names*, not per-record
// contents.
const declaredKeys = Object.keys(shape).sort();
const dataKeys = [...new Set(Object.values(content).flatMap((r) => Object.keys(r)))].sort();
const missingFromSchema = dataKeys.filter((k) => !declaredKeys.includes(k));
const missingFromData = declaredKeys.filter((k) => !dataKeys.includes(k));
if (missingFromSchema.length || missingFromData.length) {
  console.error(`schema.js's "${schemaKey}" and content/${name}.json disagree on the field set:`);
  if (missingFromSchema.length) console.error('  in content, not declared in schema.js:', missingFromSchema);
  if (missingFromData.length) console.error('  declared in schema.js, not in any record:', missingFromData);
  process.exit(1);
}

// For every list-of-objects field, confirm every record's items — wherever that record has
// any — use exactly the declared item shape. Records are free to have zero items (that's a
// length difference, not a shape difference); the ones that have items must agree on keys.
for (const [key, desc] of Object.entries(shape)) {
  if (desc.kind !== 'list' || !desc.itemFields) continue;
  const declaredSub = Object.keys(desc.itemFields).sort();
  for (const [id, record] of Object.entries(content)) {
    for (const item of record[key] ?? []) {
      // Reshaped item keys are the sub-field names themselves (en/ar live one level deeper
      // inside each text sub-field), so this compares directly against declaredSub.
      const actualSub = Object.keys(item).sort();
      if (JSON.stringify(actualSub) !== JSON.stringify(declaredSub)) {
        console.error(
          `"${key}" item shape disagrees for record "${id}": expected [${declaredSub}], got [${actualSub}]`,
        );
        process.exit(1);
      }
    }
  }
}

const ident = name.toUpperCase();

function emitFieldDef(desc, indent) {
  const parts = [`kind: ${JSON.stringify(desc.kind)}`, `type: ${JSON.stringify(desc.type)}`, `label: ${JSON.stringify(desc.label)}`];
  if (desc.kind === 'list') {
    if (desc.itemFields) {
      parts.push(`itemFields: {\n${emitItemFields(desc.itemFields, indent + '  ')}\n${indent}}`);
    } else {
      parts.push(`itemKind: ${JSON.stringify(desc.itemKind)}`);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

function emitItemFields(fields, indent) {
  return Object.entries(fields)
    .map(([k, desc]) => `${indent}${JSON.stringify(k)}: ${emitFieldDef(desc, indent)},`)
    .join('\n');
}

function emitFields() {
  return Object.entries(shape)
    .map(([k, desc]) => `  ${JSON.stringify(k)}: ${emitFieldDef(desc, '  ')},`)
    .join('\n');
}

// pageSchema.newRecord (when present — only _groups/_events declare one) is a partial,
// flat-shaped legacy record; reshape it through the same pipeline as a real record so
// newItem is stored in the same nested form the codec/store expect. Missing sub-fields
// reshape to their kind's empty value ('', false, [], {en:'',ar:''}), which zod's own
// per-field .default(...) would also produce, so this is redundant with validation but
// keeps the emitted newItem literal already fully shaped rather than sparse.
const newItemRaw = reshapeRecord(pageSchema.newRecord ?? {}, shape);

const out = `// GENERATED by \`node scripts/generate-collection-schema.mjs ${name}\` from
// public/admin/schema.js's "${schemaKey}" entry + content/${name}.json. Re-run after
// changing the admin's field layout for this collection rather than hand-editing the field
// map below — the generator fails loudly if the two sources disagree, hand edits here can't.
import type { ItemFieldMap } from './codec';

export const ${ident}_FIELDS = {
${emitFields()}
} as const satisfies ItemFieldMap;

const ${ident}_COLLECTION = {
  label: ${JSON.stringify(pageSchema.label)},
  file: ${JSON.stringify(pageSchema.file)},
  store: ${JSON.stringify(pageSchema.store)},
  addable: ${pageSchema.addable === true},
  fields: ${ident}_FIELDS,
  newItem: ${JSON.stringify(newItemRaw)},
};

export default ${ident}_COLLECTION;
`;

const outPath = resolve(`src/lib/content/collections/${name}.ts`);
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${declaredKeys.length} fields)`);
