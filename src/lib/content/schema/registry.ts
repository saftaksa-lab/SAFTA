import { denormalizeSections, zodForFields } from './codec';
import ABOUT_PAGE from './about';
import CONTACT_PAGE from './contact';
import REGISTER_INTEREST_PAGE from './register-interest';
import INDEX_PAGE from './index';
import MEDIA_PAGE from './media';

/**
 * Every page with a generated schema module — the single source of truth for which pages
 * are admin-writable (`isEditablePage`), what a POST to them must look like
 * (`getPageValidator`), and what the admin UI renders to edit them (`getAdminSchema`).
 * Add a page here after running `node scripts/generate-page-schema.mjs <page>`.
 */
const PAGES = {
  about: ABOUT_PAGE,
  contact: CONTACT_PAGE,
  'register-interest': REGISTER_INTEREST_PAGE,
  index: INDEX_PAGE,
  media: MEDIA_PAGE,
};

export type PageName = keyof typeof PAGES;

export function isEditablePage(page: string): page is PageName {
  return Object.prototype.hasOwnProperty.call(PAGES, page);
}

export function getPageValidator(page: PageName) {
  return zodForFields(PAGES[page].fields);
}

/**
 * The JSON the admin UI actually consumes — sections/cards with each field expanded back
 * into {key, kind, tag, type, label}, matching the shape public/admin/schema.js has always
 * served (see flatFields() in admin.js), even though the schema module itself only stores
 * each field once in `fields` and references it by key from `sections`.
 */
export function getAdminSchema(page: PageName) {
  const p = PAGES[page];
  return {
    label: p.label,
    file: p.file,
    apiBacked: p.apiBacked,
    sections: denormalizeSections(p.fields, p.sections),
  };
}
