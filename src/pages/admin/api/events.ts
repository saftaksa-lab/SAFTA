/** Reads and replaces the events list. See ./_collection.ts. */
import { listAllEvents } from '../../../lib/content/cache.ts';
import { replaceEvents } from '../../../lib/content/repo.ts';
import { collectionEndpoint } from './_collection.ts';

export const { GET, PUT } = collectionEndpoint('events', listAllEvents, replaceEvents);
