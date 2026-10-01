/**
 * An external link. Unlike HrefField, an absolute URL is the point — this is
 * for social profiles, not on-site navigation. Empty hides the button on the
 * public site.
 */
import { TextField } from './TextField.tsx';

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  error?: string;
}

export function UrlField({ label = 'الرابط', value, onChange, name, error }: Props) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      name={name}
      error={error}
      hint="رابط كامل يبدأ بـ https://‎. اتركه فارغًا لإخفاء الزر في الموقع."
      optional
      ltr
    />
  );
}
