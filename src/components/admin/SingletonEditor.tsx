/**
 * The panel for one singleton surface: its declared fields (spec.ts), saved
 * with a PUT to /admin/api/content/<key>.
 */
import { useSingletonEditor } from './useSingletonEditor.ts';
import { SectionForm } from './SectionForm.tsx';
import { FieldList, type Draft } from './FieldList.tsx';
import type { SectionSpec } from './spec.ts';
import type { MediaView } from '../../lib/content/cache.ts';

interface Props {
  sectionKey: string;
  spec: SectionSpec;
  initial: Draft;
  /** Media rows the page already resolved for the saved content. */
  media: Record<string, MediaView>;
}

export default function SingletonEditor({ sectionKey, spec, initial, media }: Props) {
  const { draft, update, dirty, status, message, errors, save, reset } = useSingletonEditor<Draft>(
    sectionKey,
    initial,
    spec.title,
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
      <FieldList
        fields={spec.fields}
        value={draft}
        patch={(fields) => update((current) => ({ ...current, ...fields }))}
        path=""
        errors={errors}
        media={media}
      />
    </SectionForm>
  );
}
