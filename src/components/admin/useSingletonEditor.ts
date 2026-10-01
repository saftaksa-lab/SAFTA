/**
 * Draft state, save status and server-side validation errors for one singleton
 * editor panel.
 *
 * The server is the only validator — the same Zod schema the readers trust. This
 * hook does not re-implement the rules client-side; it submits, and maps the
 * issues that come back onto fields by their dot-joined path.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerEditor, unregisterEditor } from './editorRegistry.ts';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ZodIssueLike {
  path: Array<string | number>;
  message: string;
}

interface SaveFailure {
  ok: false;
  message: string;
  issues?: ZodIssueLike[];
}

interface SaveSuccess<T> {
  ok: true;
  data: T;
}

export interface SingletonEditor<T> {
  draft: T;
  /** Replaces the draft. Pass an updater to derive from the current value. */
  update: (next: T | ((current: T) => T)) => void;
  dirty: boolean;
  status: SaveStatus;
  /** Banner-level message — a server error, or a summary of the field errors. */
  message: string | null;
  /** Keyed by dot-joined issue path, e.g. `items.2.titleAr`. */
  errors: Record<string, string>;
  save: () => void;
  reset: () => void;
}

export function useSingletonEditor<T>(key: string, initial: T, title: string): SingletonEditor<T> {
  const [draft, setDraft] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = draft !== saved;

  // A save can resolve after the panel unmounts (a navigation mid-request).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setDraft((current) => (typeof next === 'function' ? (next as (c: T) => T)(current) : next));
    setStatus('idle');
    setMessage(null);
  }, []);

  const reset = useCallback(() => {
    setDraft(saved);
    setStatus('idle');
    setMessage(null);
    setErrors({});
  }, [saved]);

  const save = useCallback(() => {
    setStatus('saving');
    setMessage(null);
    setErrors({});

    const payload = draft;

    void (async () => {
      try {
        const response = await fetch(`/admin/api/content/${key}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as SaveSuccess<T> | SaveFailure;
        if (!alive.current) return;

        if (response.ok && body.ok) {
          // Re-sync to what the server actually stored — it trims strings and
          // applies defaults, so the draft would otherwise read as dirty forever.
          setDraft(body.data);
          setSaved(body.data);
          setStatus('saved');
          setMessage(null);
          return;
        }

        const failure = body as SaveFailure;
        const fieldErrors: Record<string, string> = {};
        for (const issue of failure.issues ?? []) {
          const path = issue.path.join('.');
          if (!(path in fieldErrors)) fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        setStatus('error');
        setMessage(failure.message ?? 'تعذّر الحفظ.');
      } catch {
        if (!alive.current) return;
        setStatus('error');
        setMessage('تعذّر الاتصال بالخادم. تحقّق من الاتصال وحاول مرة أخرى.');
      }
    })();
  }, [draft, key]);

  // Registers this panel with the page-wide "Save All" bar. Unregistering
  // only on unmount (not on every update) avoids a remove/re-add flicker on
  // each keystroke.
  useEffect(() => {
    registerEditor({ key, title, dirty, status, save });
  }, [key, title, dirty, status, save]);
  useEffect(() => () => unregisterEditor(key), [key]);

  return { draft, update, dirty, status, message, errors, save, reset };
}
