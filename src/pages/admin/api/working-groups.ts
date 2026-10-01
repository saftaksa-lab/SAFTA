/** Reads and replaces the working groups list. See ./_collection.ts. */
import { listAllWorkingGroups } from '../../../lib/content/cache.ts';
import { replaceWorkingGroups } from '../../../lib/content/repo.ts';
import { collectionEndpoint } from './_collection.ts';

export const { GET, PUT } = collectionEndpoint('working groups', listAllWorkingGroups, replaceWorkingGroups);
