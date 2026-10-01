/**
 * A link target. Site-relative paths and on-site anchors only — the server
 * rejects absolute URLs, because the CMS is not a link manager. `#` is the
 * placeholder for a page that has not been ported yet.
 */
import { TextField } from './TextField.tsx';

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  error?: string;
}

export function HrefField({ label = 'الرابط', value, onChange, name, error }: Props) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      name={name}
      error={error}
      hint="مسار داخلي مثل ‎/about‎ أو مرساة مثل ‎#awards‎. الروابط الخارجية غير مسموحة."
      ltr
    />
  );
}
