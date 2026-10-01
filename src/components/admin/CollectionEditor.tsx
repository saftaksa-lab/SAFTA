/**
 * The panel for a whole collection — members, working groups, articles or
 * events — edited as one list and saved with one PUT (see useCollectionEditor.ts
 * and the `replace*` functions in repo.ts).
 *
 * Rows carry an `id` only for ItemList's bookkeeping; it is the slug the row
 * loaded with, and it never reaches the server. The server sets each row's
 * `order` from its position in the list, so moving a row up or down is saved.
 */
import { useCallback } from 'react';
import { useCollectionEditor } from './useCollectionEditor.ts';
import { SectionForm } from './SectionForm.tsx';
import { ItemList } from './ItemList.tsx';
import { FieldList, blankItem, type Draft } from './FieldList.tsx';
import type { CollectionSpec } from './spec.ts';
import type { MediaView } from '../../lib/content/cache.ts';

type Row = Draft & { id: string };

interface Props {
  collectionKey: string;
  spec: CollectionSpec;
  /** Rows as stored, without the server-owned `updatedAt`/`updatedBy`. */
  initial: Draft[];
  media: Record<string, MediaView>;
}

function toPayload(rows: Row[]) {
  return rows.map(({ id: _id, ...rest }) => rest);
}

export default function CollectionEditor({ collectionKey, spec, initial, media }: Props) {
  const { draft, update, dirty, status, message, errors, save, reset } = useCollectionEditor<Row[]>(
    spec.url,
    initial.map((row) => ({ ...row, id: String(row.slug) })),
    toPayload,
    collectionKey,
    spec.title,
  );

  const makeItem = useCallback(
    (id: string): Row => ({ ...blankItem(spec.fields), slug: id, published: true, id }),
    [spec.fields],
  );

  return (
    <SectionForm
      title={spec.title}
      lede={spec.lede}
      dirty={dirty}
      status={status}
      message={message}
      onSave={save}
      onReset={reset}
    >
      <ItemList<Row>
        items={draft}
        onChange={(rows) => update(rows)}
        makeItem={makeItem}
        idPrefix={spec.idPrefix}
        min={0}
        max={spec.max}
        labelFor={(row, i) => String(row[spec.labelField] || row.slug || i + 1)}
        addLabel="إضافة سجل"
      >
        {(row, i, patch) => (
          <FieldList
            fields={spec.fields}
            value={row}
            patch={patch as (fields: Draft) => void}
            path={`${i}.`}
            errors={errors}
            media={media}
          />
        )}
      </ItemList>
    </SectionForm>
  );
}
