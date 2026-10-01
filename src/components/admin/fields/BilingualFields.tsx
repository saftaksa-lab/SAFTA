/**
 * An Arabic content field with its optional English sibling underneath.
 *
 * The Arabic control is the existing required field; the English one is
 * optional, LTR, and when left empty the English site shows the Arabic value
 * (the public components apply that fallback). Both share one label, so every
 * surface reads the same way: "العنوان" then "العنوان (English)".
 */
import { TextField } from './TextField.tsx';
import { TextAreaField } from './TextAreaField.tsx';

interface Props {
  label: string;
  /** The Arabic value and its handler. */
  value: string;
  onChange: (value: string) => void;
  valueEn: string;
  onChangeEn: (value: string) => void;
  /** The Arabic field's dot-joined issue path, e.g. `panels.0.headingAr`. */
  name: string;
  error?: string;
  errorEn?: string;
  hint?: string;
}

const EN_HINT = 'اختياري. إن تُرك فارغًا تعرض النسخة الإنجليزية النص العربي.';

/** `panels.0.headingAr` → `panels.0.headingEn`; `bodyAr1` → `bodyEn1`; `3.tagsAr.0` → `3.tagsEn.0`. */
export function enName(name: string): string {
  return name.replace(/Ar(\d*)((?:\.\d+)?)$/, 'En$1$2');
}

export function BilingualTextField({ valueEn, onChangeEn, errorEn, ...props }: Props) {
  return (
    <>
      <TextField {...props} />
      <TextField
        label={`${props.label} (English)`}
        value={valueEn}
        onChange={onChangeEn}
        name={enName(props.name)}
        error={errorEn}
        hint={EN_HINT}
        optional
        lang="en"
      />
    </>
  );
}

export function BilingualTextAreaField({
  valueEn,
  onChangeEn,
  errorEn,
  rows,
  ...props
}: Props & { rows?: number }) {
  return (
    <>
      <TextAreaField {...props} rows={rows} />
      <TextAreaField
        label={`${props.label} (English)`}
        value={valueEn}
        onChange={onChangeEn}
        name={enName(props.name)}
        error={errorEn}
        hint={EN_HINT}
        rows={rows}
        optional
        lang="en"
      />
    </>
  );
}
