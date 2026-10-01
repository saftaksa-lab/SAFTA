/**
 * A single boolean content field. Control appearance comes from
 * 4-elements/forms.css; the surrounding labelling from 6-components/form.css.
 */
import { useId } from 'react';

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Dot-joined issue path, used to look the error up and to name the control. */
  name: string;
  error?: string;
  hint?: string;
}

export function CheckboxField({ label, value, onChange, name, error, hint }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="form__field form__field--checkbox">
      <label className="form__label" htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {label}
      </label>
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
