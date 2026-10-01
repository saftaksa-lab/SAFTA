/**
 * A single-line content field. Control appearance comes from
 * 4-elements/forms.css; the surrounding labelling from 6-components/form.css.
 */
import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Dot-joined issue path, used to look the error up and to name the control. */
  name: string;
  error?: string;
  hint?: string;
  /** No required marker. Only English (`xEn`) fields are optional. */
  optional?: boolean;
  /** Set on English inputs, which also switch the control to LTR. */
  lang?: 'en';
  /** Isolates a Latin-only value (a path, a URL) inside the RTL form. */
  ltr?: boolean;
}

export function TextField({ label, value, onChange, name, error, hint, ltr, optional, lang }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="form__field">
      <label className="form__label" htmlFor={id}>
        {label}
        {!optional && (
          <span className="form__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        dir={ltr || lang === 'en' ? 'ltr' : undefined}
        lang={lang}
      />
      {hint && (
        <p className="form__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="form__message" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
