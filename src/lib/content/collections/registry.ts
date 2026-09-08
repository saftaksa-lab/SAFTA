import { zodForCollection } from './codec';
import GROUPS_COLLECTION from './groups';
import ARTICLES_COLLECTION from './articles';
import EVENTS_COLLECTION from './events';
import MEMBERS_COLLECTION from './members';
import ROLES_COLLECTION from './roles';

/**
 * Every collection with a generated schema module — the id-keyed counterpart to
 * ../schema/registry.ts's PAGES. Add an entry here after running
 * `node scripts/generate-collection-schema.mjs <name>`.
 */
const COLLECTIONS = {
  groups: GROUPS_COLLECTION,
  articles: ARTICLES_COLLECTION,
  events: EVENTS_COLLECTION,
  members: MEMBERS_COLLECTION,
  roles: ROLES_COLLECTION,
};

export type CollectionName = keyof typeof COLLECTIONS;

export function isEditableCollection(name: string): name is CollectionName {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name);
}

export function getCollectionValidator(name: CollectionName) {
  return zodForCollection(COLLECTIONS[name].fields);
}

export function getCollectionMeta(name: CollectionName) {
  const c = COLLECTIONS[name];
  return { label: c.label, file: c.file, addable: c.addable, deletable: c.deletable, newItem: c.newItem };
}

export function getCollectionFields(name: CollectionName) {
  return COLLECTIONS[name].fields;
}
