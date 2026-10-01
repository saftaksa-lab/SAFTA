/**
 * Draft state, save status and server-side validation errors for a bulk
 * collection editor — the working-groups list today.
 *
 * Deliberately not `useSingletonEditor`: that hook PUTs to
 * `/admin/api/content/<SingletonKey>`, which is singleton-specific. A
 * collection editor saves its own array to its own endpoint on its own
 * button, so it stays a separate, smaller hook rather than widening the
 * singleton one to fit. It still registers with the same page-wide
 * "Save All" bar (editorRegistry.ts) so an unsaved collection draft raises
 * the same site-wide alert a dirty singleton does.
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

export interface CollectionEditor<T> {
  draft: T;
  update: (next: T | ((current: T) => T)) => void;
  dirty: boolean;
  status: SaveStatus;
  message: string | null;
  /** Keyed by dot-joined issue path, e.g. `2.nameAr`. */
  errors: Record<string, string>;
  save: () => void;
  reset: () => void;
}

export function useCollectionEditor<T>(
  url: string,
  initial: T,
  toPayload: (draft: T) => unknown,
  key: string,
  title: string,
): CollectionEditor<T> {
  const [draft, setDraft] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = draft !== saved;

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

    const payload = toPayload(draft);

    void (async () => {
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as SaveSuccess<unknown> | SaveFailure;
        if (!alive.current) return;

        if (response.ok && body.ok) {
          setStatus('saved');
          setMessage(null);
          setSaved(draft);
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
  }, [draft, url, toPayload]);

  // Registers this panel with the page-wide "Save All" bar, same as
  // useSingletonEditor — see editorRegistry.ts.
  useEffect(() => {
    registerEditor({ key, title, dirty, status, save });
  }, [key, title, dirty, status, save]);
  useEffect(() => () => unregisterEditor(key), [key]);

  return { draft, update, dirty, status, message, errors, save, reset };
}
