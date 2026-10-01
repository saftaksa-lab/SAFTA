/**
 * Cross-island coordination for the dashboard's section editors.
 *
 * Each section editor is its own React island (`client:load`), so they share
 * no component tree. This module is the one thing that is actually shared: a
 * plain in-memory store that every `useSingletonEditor` registers itself
 * into, and that `SaveAllBar` reads to show a page-wide unsaved-changes alert
 * and drive a single "save all" action.
 */
export interface RegisteredEditor {
  key: string;
  title: string;
  dirty: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  save: () => void;
}

type Listener = () => void;

const editors = new Map<string, RegisteredEditor>();
const listeners = new Set<Listener>();
let snapshot: RegisteredEditor[] = [];

function notify() {
  snapshot = Array.from(editors.values());
  for (const listener of listeners) listener();
}

export function registerEditor(entry: RegisteredEditor) {
  editors.set(entry.key, entry);
  notify();
}

export function unregisterEditor(key: string) {
  if (!editors.delete(key)) return;
  notify();
}

export function subscribeEditors(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEditorsSnapshot() {
  return snapshot;
}

export function saveAllDirty() {
  for (const editor of snapshot) {
    if (editor.dirty && editor.status !== 'saving') editor.save();
  }
}
