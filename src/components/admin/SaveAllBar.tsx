/**
 * Page-wide unsaved-changes alert and "Save All" action. Mounted once in
 * AdminLayout so it covers every dashboard page; it renders nothing until at
 * least one section editor reports itself dirty via editorRegistry.ts.
 */
import { useSyncExternalStore } from 'react';
import { getEditorsSnapshot, saveAllDirty, subscribeEditors } from './editorRegistry.ts';

function countLabel(count: number): string {
  if (count === 1) return 'في قسم واحد';
  if (count === 2) return 'في قسمين';
  return `في ${count} أقسام`;
}

export default function SaveAllBar() {
  const editors = useSyncExternalStore(subscribeEditors, getEditorsSnapshot, getEditorsSnapshot);
  const dirtyEditors = editors.filter((editor) => editor.dirty);
  const saving = dirtyEditors.some((editor) => editor.status === 'saving');

  if (dirtyEditors.length === 0) return null;

  return (
    <div className="save-all-bar" role="status">
      <span className="save-all-bar__icon" aria-hidden="true">
        !
      </span>
      <p className="save-all-bar__message">
        لديك تغييرات غير محفوظة {countLabel(dirtyEditors.length)}
      </p>
      <button
        type="button"
        className="button button--solid save-all-bar__button"
        onClick={saveAllDirty}
        disabled={saving}
      >
        {saving ? 'جارٍ الحفظ…' : 'حفظ الكل'}
      </button>
    </div>
  );
}
