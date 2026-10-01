/**
 * An image slot: preview, choose, describe, upload, remove.
 *
 * Uploading and saving are separate on purpose. The upload endpoint stores the
 * file and returns its media id; this field puts that id into the section draft,
 * and nothing reaches the public page until the section's own save — the same
 * save-bar contract every other field follows. The notice after an upload says so.
 *
 * Validation is the server's: the size check here only spares an 8 MB round trip.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { MediaView } from '../../../lib/content/cache.ts';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

interface Props {
  label: string;
  /** The media id in the draft, or null for "show the placeholder". */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Dot-joined issue path, used to look the error up. */
  name: string;
  error?: string;
  /** What this slot wants — orientation, minimum size. */
  hint?: string;
  /** Prefills the alt-text box, usually the item's own heading or name. */
  defaultAlt: string;
  /** Media rows the page already resolved for the saved content. */
  known: Record<string, MediaView>;
  /** `logo` previews with `contain` on a checkerboard, so transparency is visible. */
  variant?: 'photo' | 'logo';
}

interface Pending {
  file: File;
  preview: string;
}

interface UploadResponse {
  ok: boolean;
  message?: string;
  duplicate?: boolean;
  media?: MediaView;
}

export function ImageField({
  label,
  value,
  onChange,
  name,
  error,
  hint,
  defaultAlt,
  known,
  variant = 'photo',
}: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const altId = `${id}-alt`;
  const altEnId = `${id}-alt-en`;
  const fileInput = useRef<HTMLInputElement>(null);

  // Rows uploaded in this session, so a preview survives undo/redo of the draft.
  const [uploaded, setUploaded] = useState<Record<string, MediaView>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [alt, setAlt] = useState('');
  const [altEn, setAltEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Tied to the id it describes, so undoing the draft hides a stale notice.
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.preview);
  }, [pending]);

  const current = value ? (uploaded[value] ?? known[value] ?? null) : null;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  function clearPicker() {
    setPending(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function pick(file: File | undefined) {
    setUploadError(null);
    setNotice(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setUploadError('حجم الملف يتجاوز الحد المسموح (8 ميغابايت).');
      clearPicker();
      return;
    }
    setPending({ file, preview: URL.createObjectURL(file) });
    setAlt(defaultAlt);
    setAltEn('');
  }

  async function upload() {
    if (!pending || busy) return;
    setBusy(true);
    setUploadError(null);

    const body = new FormData();
    body.append('file', pending.file);
    body.append('altAr', alt);
    body.append('altEn', altEn);

    try {
      const response = await fetch('/admin/api/media', { method: 'POST', body });
      const result = (await response.json()) as UploadResponse;
      if (!response.ok || !result.ok || !result.media) {
        setUploadError(result.message ?? 'تعذّر رفع الصورة.');
        return;
      }
      const media = result.media;
      setUploaded((rows) => ({ ...rows, [media.id]: media }));
      onChange(media.id);
      setNotice({
        id: media.id,
        text: result.duplicate
          ? 'هذه الصورة مرفوعة مسبقًا، فاستُخدمت النسخة المحفوظة بنصّها البديل. اضغط «حفظ» لنشرها.'
          : 'رُفعت الصورة. اضغط «حفظ» لنشرها في الموقع.',
      });
      clearPicker();
    } catch {
      setUploadError('تعذّر الاتصال بالخادم. تحقّق من الاتصال وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  // The alt fields sit inside the section's <form>: Enter there means
  // "upload", never "save the whole section".
  function uploadOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void upload();
    }
  }

  return (
    <div className="form__field image-field">
      <p className="form__label" id={labelId}>
        {label}
      </p>

      <div role="group" aria-labelledby={labelId} aria-describedby={describedBy || undefined}>
        <div className={`image-field__frame image-field__frame--${variant}`}>
          {pending ? (
            <img src={pending.preview} alt="" />
          ) : current ? (
            <img src={current.url} alt={current.altAr} width={current.width} height={current.height} />
          ) : (
            <span className="image-field__empty">
              {value ? 'الصورة المحددة غير متوفرة.' : 'لا توجد صورة مرفوعة — تظهر الصورة الافتراضية.'}
            </span>
          )}
        </div>

        <input
          ref={fileInput}
          className="u-visually-hidden"
          type="file"
          accept={ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {pending ? (
          <div className="image-field__pending">
            <p className="image-field__filename">
              <bdi>{pending.file.name}</bdi>
            </p>
            <label className="form__label" htmlFor={altId}>
              النص البديل
              <span className="form__required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={altId}
              name={`${name}.altAr`}
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onKeyDown={uploadOnEnter}
            />
            <p className="form__hint">صف ما تُظهره الصورة لمن لا يراها، في جملة قصيرة.</p>
            <label className="form__label" htmlFor={altEnId}>
              النص البديل (English)
            </label>
            <input
              id={altEnId}
              name={`${name}.altEn`}
              type="text"
              dir="ltr"
              lang="en"
              value={altEn}
              onChange={(e) => setAltEn(e.target.value)}
              onKeyDown={uploadOnEnter}
            />
            <p className="form__hint">اختياري. إن تُرك فارغًا تستخدم النسخة الإنجليزية النص العربي.</p>
            <div className="image-field__actions">
              <button
                className="button button--solid"
                type="button"
                onClick={() => void upload()}
                disabled={busy}
              >
                {busy ? 'جارٍ الرفع…' : 'رفع الصورة'}
              </button>
              <button
                className="image-field__link"
                type="button"
                onClick={clearPicker}
                disabled={busy}
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="image-field__actions">
            <button
              className="image-field__button"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              {value ? 'استبدال الصورة' : 'اختيار صورة'}
            </button>
            {value && (
              <button
                className="image-field__button image-field__button--danger"
                type="button"
                onClick={() => {
                  setNotice(null);
                  onChange(null);
                }}
              >
                إزالة الصورة
              </button>
            )}
          </div>
        )}
      </div>

      <p className="form__hint" id={hintId}>
        {hint ? `${hint} ` : ''}JPEG أو PNG أو WebP أو AVIF، بحد أقصى 8 ميغابايت. لا تُقبل ملفات SVG.
      </p>
      {notice && notice.id === value && (
        <p className="image-field__notice" role="status">
          {notice.text}
        </p>
      )}
      {uploadError && (
        <p className="form__message" role="alert">
          {uploadError}
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
