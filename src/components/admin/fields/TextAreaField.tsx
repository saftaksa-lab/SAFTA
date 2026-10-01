/** A multi-line content field — headings and ledes that run to a paragraph. */
import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  error?: string;
  hint?: string;
  /** No required marker. Only English (`xEn`) fields are optional. */
  optional?: boolean;
  /** Set on English inputs, which also switch the control to LTR. */
  lang?: 'en';
  rows?: number;
}

export function TextAreaField({
  label,
  value,
  onChange,
  name,
  error,
  hint,
  rows = 3,
  optional,
  lang,
}: Props) {
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
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        dir={lang === 'en' ? 'ltr' : undefined}
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
