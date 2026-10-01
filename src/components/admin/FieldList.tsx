/**
 * Renders a section's declared fields (spec.ts) against its draft.
 *
 * Every error is looked up by its dot-joined issue path, which is the field's
 * path in the payload — `panels.1.headingAr` — so the server's Zod issues land
 * on the right control without the renderer knowing any schema.
 *
 * Numeric fields keep whatever the admin typed until it parses: "24." stays a
 * string while they type the next digit, and a value that never parses reaches
 * the server as a string, which rejects it with a message on that field.
 */
import { BilingualTextAreaField, BilingualTextField } from './fields/BilingualFields.tsx';
import { CheckboxField } from './fields/CheckboxField.tsx';
import { HrefField } from './fields/HrefField.tsx';
import { ImageField } from './fields/ImageField.tsx';
import { SelectField } from './fields/SelectField.tsx';
import { TextAreaField } from './fields/TextAreaField.tsx';
import { TextField } from './fields/TextField.tsx';
import { ItemList } from './ItemList.tsx';
import type { FieldSpec } from './spec.ts';
import type { MediaView } from '../../lib/content/cache.ts';

export type Draft = Record<string, unknown>;

interface Props {
  fields: FieldSpec[];
  value: Draft;
  /** Merges the given keys into `value`. */
  patch: (fields: Draft) => void;
  /** Issue-path prefix of `value`, e.g. `panels.1.` — empty at the root. */
  path: string;
  errors: Record<string, string>;
  media: Record<string, MediaView>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function parseInteger(raw: string): unknown {
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
}

function parseCoordinate(raw: string): unknown {
  const v = raw.trim();
  if (v === '') return null;
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : raw;
}

/** A blank item for a list, with nested lists filled to their minimum. */
export function blankItem(fields: FieldSpec[], id?: string): Draft {
  const item: Draft = id === undefined ? {} : { id };
  for (const field of fields) {
    switch (field.kind) {
      case 'text':
        item[`${field.name}Ar`] = '';
        item[`${field.name}En`] = '';
        break;
      case 'checkbox':
        item[field.name] = false;
        break;
      case 'image':
      case 'url':
      case 'coordinate':
        item[field.name] = null;
        break;
      case 'integer':
        item[field.name] = 0;
        break;
      case 'select':
        item[field.name] = field.options[0]?.value ?? '';
        break;
      case 'list':
        item[field.name] = Array.from({ length: field.min }, (_, i) =>
          blankItem(field.fields, `${field.idPrefix}-${i + 1}`),
        );
        break;
      case 'options':
        item[field.name] = [];
        break;
      default:
        item[field.name] = '';
    }
  }
  return item;
}

export function FieldList({ fields, value, patch, path, errors, media }: Props) {
  return (
    <>
      {fields.map((field) => (
        <Field key={field.name} field={field} value={value} patch={patch} path={path} errors={errors} media={media} />
      ))}
    </>
  );
}

function Field({
  field,
  value,
  patch,
  path,
  errors,
  media,
}: Omit<Props, 'fields'> & { field: FieldSpec }) {
  const name = `${path}${field.name}`;
  const error = errors[name];
  const v = value[field.name];

  switch (field.kind) {
    case 'text': {
      const ar = `${field.name}Ar`;
      const en = `${field.name}En`;
      if (field.optional) {
        // Both languages optional: two separate fields, neither marked required.
        const arProps = {
          label: field.label,
          value: str(value[ar]),
          onChange: (next: string) => patch({ [ar]: next }),
          name: `${path}${ar}`,
          error: errors[`${path}${ar}`],
          hint: field.hint ?? 'اختياري.',
          optional: true,
        };
        const enProps = {
          label: `${field.label} (English)`,
          value: str(value[en]),
          onChange: (next: string) => patch({ [en]: next }),
          name: `${path}${en}`,
          error: errors[`${path}${en}`],
          hint: 'اختياري. إن تُرك فارغًا تعرض النسخة الإنجليزية النص العربي.',
          optional: true,
          lang: 'en' as const,
        };
        return field.rows ? (
          <>
            <TextAreaField {...arProps} rows={field.rows} />
            <TextAreaField {...enProps} rows={field.rows} />
          </>
        ) : (
          <>
            <TextField {...arProps} />
            <TextField {...enProps} />
          </>
        );
      }
      const shared = {
        label: field.label,
        value: str(value[ar]),
        onChange: (next: string) => patch({ [ar]: next }),
        name: `${path}${ar}`,
        error: errors[`${path}${ar}`],
        hint: field.hint,
        valueEn: str(value[en]),
        onChangeEn: (next: string) => patch({ [en]: next }),
        errorEn: errors[`${path}${en}`],
      };
      return field.rows ? (
        <BilingualTextAreaField {...shared} rows={field.rows} />
      ) : (
        <BilingualTextField {...shared} />
      );
    }

    case 'plain':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint}
          ltr={field.ltr}
        />
      );

    case 'href':
      return (
        <HrefField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
        />
      );

    case 'link':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint ?? 'مسار داخلي مثل ‎/register-interest‎، أو رابط كامل يبدأ بـ https://‎.'}
          ltr
        />
      );

    case 'url':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next.trim() === '' ? null : next })}
          name={name}
          error={error}
          hint={field.hint ?? 'رابط كامل يبدأ بـ https://‎. اختياري.'}
          optional
          ltr
        />
      );

    case 'youtube':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint ?? 'رابط فيديو من يوتيوب. اتركه فارغًا لإخفاء الفيديو.'}
          optional
          ltr
        />
      );

    case 'email':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint}
          ltr
        />
      );

    case 'checkbox':
      return (
        <CheckboxField
          label={field.label}
          value={v === true}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint}
        />
      );

    case 'integer':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: parseInteger(next) })}
          name={name}
          error={error}
          hint={field.hint}
          ltr
        />
      );

    case 'coordinate':
      return (
        <TextField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: parseCoordinate(next) })}
          name={name}
          error={error}
          hint={field.hint}
          optional
          ltr
        />
      );

    case 'select':
      return (
        <SelectField
          label={field.label}
          value={str(v)}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint}
          options={field.options}
        />
      );

    case 'image': {
      const alt = field.altFrom ? str(value[`${field.altFrom}Ar`]) : '';
      return (
        <ImageField
          label={field.label}
          value={typeof v === 'string' ? v : null}
          onChange={(next) => patch({ [field.name]: next })}
          name={name}
          error={error}
          hint={field.hint}
          defaultAlt={alt}
          known={media}
          variant={field.variant}
        />
      );
    }

    case 'options': {
      const options = (Array.isArray(v) ? v : []) as Draft[];
      return (
        <fieldset className="form__group">
          <legend className="form__label">{field.label}</legend>
          {field.hint && <p className="form__hint">{field.hint}</p>}
          {error && <p className="form__message">{error}</p>}
          <div className="item-list">
            {options.map((option, i) => (
              <section className="item-list__item" key={str(option.value)}>
                <header className="item-list__header">
                  <h4 className="item-list__title">
                    <bdi dir="ltr">{str(option.value)}</bdi>
                  </h4>
                </header>
                <div className="form">
                  <BilingualTextField
                    label="النص الظاهر"
                    value={str(option.labelAr)}
                    onChange={(next) =>
                      patch({ [field.name]: options.map((o, j) => (j === i ? { ...o, labelAr: next } : o)) })
                    }
                    name={`${name}.${i}.labelAr`}
                    error={errors[`${name}.${i}.labelAr`]}
                    valueEn={str(option.labelEn)}
                    onChangeEn={(next) =>
                      patch({ [field.name]: options.map((o, j) => (j === i ? { ...o, labelEn: next } : o)) })
                    }
                    errorEn={errors[`${name}.${i}.labelEn`]}
                  />
                </div>
              </section>
            ))}
          </div>
        </fieldset>
      );
    }

    case 'list': {
      const items = (Array.isArray(v) ? v : []) as Array<Draft & { id: string }>;
      const setItems = (next: Array<Draft & { id: string }>) => patch({ [field.name]: next });
      const body = (item: Draft, i: number, patchItem: (fields: Draft) => void) => (
        <FieldList
          fields={field.fields}
          value={item}
          patch={patchItem}
          path={`${name}.${i}.`}
          errors={errors}
          media={media}
        />
      );

      return (
        <fieldset className="form__group">
          <legend className="form__label">{field.label}</legend>
          {field.hint && <p className="form__hint">{field.hint}</p>}
          {error && <p className="form__message">{error}</p>}
          {field.fixed ? (
            <div className="item-list">
              {items.map((item, i) => (
                <section className="item-list__item" key={item.id}>
                  <header className="item-list__header">
                    <h4 className="item-list__title">{`${field.itemLabel} ${i + 1}`}</h4>
                  </header>
                  <div className="form">
                    {body(item, i, (fields) =>
                      setItems(items.map((it, j) => (j === i ? { ...it, ...fields } : it))),
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <ItemList<Draft & { id: string }>
              items={items}
              onChange={setItems}
              makeItem={(id) => blankItem(field.fields, id) as Draft & { id: string }}
              idPrefix={field.idPrefix}
              min={field.min}
              max={field.max}
              labelFor={(_, i) => `${field.itemLabel} ${i + 1}`}
              addLabel={`إضافة ${field.itemLabel}`}
            >
              {(item, i, patchItem) => body(item, i, patchItem as (fields: Draft) => void)}
            </ItemList>
          )}
        </fieldset>
      );
    }
  }
}
