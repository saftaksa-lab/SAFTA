/**
 * The panel shell every section editor shares: a disclosure header, the fields,
 * the save bar and a polite status region.
 *
 * Sections start collapsed — six expanded editors make the page unusably long.
 * The body stays mounted while collapsed (hidden, not unmounted) so a half-typed
 * draft survives a toggle, and the header carries an unsaved-changes badge so
 * collapsing never hides the fact that something is pending.
 */
import { useId, useState, type ReactNode } from 'react';
import type { SaveStatus } from './useSingletonEditor.ts';

interface Props {
  title: string;
  lede?: string;
  dirty: boolean;
  status: SaveStatus;
  message: string | null;
  onSave: () => void;
  onReset: () => void;
  children: ReactNode;
}

const statusText: Record<SaveStatus, string> = {
  idle: '',
  saving: 'جارٍ الحفظ…',
  saved: 'تم الحفظ.',
  error: '',
};

export function SectionForm({
  title,
  lede,
  dirty,
  status,
  message,
  onSave,
  onReset,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section className={`panel${open ? '' : ' panel--collapsed'}`}>
      <h2 className="panel__title">
        <button
          className="panel__toggle"
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="panel__toggle-icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" strokeWidth="2" height="12" width="12" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </span>
          <span className="panel__toggle-label">{title}</span>
          {dirty && <span className="panel__badge">تغييرات غير محفوظة</span>}
          {status === 'error' && (
            <span className="panel__badge panel__badge--error">تعذّر الحفظ</span>
          )}
        </button>
      </h2>

      <div className="panel__body" id={bodyId} hidden={!open}>
        {lede && <p className="form__hint">{lede}</p>}

        {message && (
          <p className="form__error" role="alert">
            <span className="form__error-icon" aria-hidden="true">
              !
            </span>
            <span>{message}</span>
          </p>
        )}

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          {children}

          <div className="editor__bar">
            <button
              className="button button--solid"
              type="submit"
              disabled={!dirty || status === 'saving'}
            >
              {status === 'saving' ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button className="editor__reset" type="button" onClick={onReset} disabled={!dirty}>
              تراجع عن التغييرات
            </button>
            <p
              className={`editor__status${status === 'saved' ? ' editor__status--saved' : ''}`}
              role="status"
              aria-live="polite"
            >
              {dirty && status !== 'saving' ? 'تغييرات غير محفوظة' : statusText[status]}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
