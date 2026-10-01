/**
 * One value from a fixed set, such as a member's category. The options come
 * from code; the admin only picks among them.
 */
import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Dot-joined issue path, used to look the error up and to name the control. */
  name: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  hint?: string;
}

export function SelectField({ label, value, onChange, name, options, error, hint }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="form__field">
      <label className="form__label" htmlFor={id}>
        {label}
        <span className="form__required" aria-hidden="true">
          *
        </span>
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
