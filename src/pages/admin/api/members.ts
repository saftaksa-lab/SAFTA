/** Reads and replaces the members list. See ./_collection.ts. */
import { listAllMembers } from '../../../lib/content/cache.ts';
import { replaceMembers } from '../../../lib/content/repo.ts';
import { collectionEndpoint } from './_collection.ts';

export const { GET, PUT } = collectionEndpoint('members', listAllMembers, replaceMembers);
