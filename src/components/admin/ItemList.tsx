/**
 * Repeatable-row chrome: add, remove, move up, move down.
 *
 * Reordering a list is ordering *within* a list, which docs/porting-the-mockup.md
 * explicitly sanctions — it is not layout. Each row renders whatever fields the
 * calling section declares, so this component never learns what a hero panel or
 * an award is made of.
 */
import type { ReactNode } from 'react';

interface Item {
  id: string;
}

interface Props<T extends Item> {
  items: T[];
  onChange: (items: T[]) => void;
  /** Builds a blank row. Called with the id the list allocated for it. */
  makeItem: (id: string) => T;
  /** Prefix for generated ids, e.g. `hero` produces `hero-4`. */
  idPrefix: string;
  min: number;
  max: number;
  /** Row heading, e.g. `(item, i) => \`الشريحة ${i + 1}\``. */
  labelFor: (item: T, index: number) => string;
  addLabel: string;
  children: (item: T, index: number, patch: (fields: Partial<T>) => void) => ReactNode;
}

export function ItemList<T extends Item>({
  items,
  onChange,
  makeItem,
  idPrefix,
  min,
  max,
  labelFor,
  addLabel,
  children,
}: Props<T>) {
  /** First `<prefix>-<n>` not already taken, so a remove-then-add cannot collide. */
  function nextId(): string {
    const taken = new Set(items.map((item) => item.id));
    let n = items.length + 1;
    while (taken.has(`${idPrefix}-${n}`)) n += 1;
    return `${idPrefix}-${n}`;
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    if (items.length <= min) return;
    onChange(items.filter((_, i) => i !== index));
  }

  function add() {
    if (items.length >= max) return;
    onChange([...items, makeItem(nextId())]);
  }

  function patchAt(index: number, fields: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...fields } : item)));
  }

  return (
    <div className="item-list">
      {items.map((item, index) => (
        <section className="item-list__item" key={item.id}>
          <header className="item-list__header">
            <h4 className="item-list__title">{labelFor(item, index)}</h4>
            <div className="item-list__controls">
              <button
                className="item-list__button"
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`نقل ${labelFor(item, index)} لأعلى`}
              >
                ↑
              </button>
              <button
                className="item-list__button"
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`نقل ${labelFor(item, index)} لأسفل`}
              >
                ↓
              </button>
              <button
                className="item-list__button item-list__button--danger"
                type="button"
                onClick={() => remove(index)}
                disabled={items.length <= min}
                aria-label={`حذف ${labelFor(item, index)}`}
              >
                حذف
              </button>
            </div>
          </header>
          <div className="form">{children(item, index, (fields) => patchAt(index, fields))}</div>
        </section>
      ))}

      <button className="item-list__add" type="button" onClick={add} disabled={items.length >= max}>
        + {addLabel}
      </button>
      {items.length >= max && (
        <p className="form__hint">بلغت الحد الأقصى ({max}) لهذا القسم.</p>
      )}
    </div>
  );
}
