/** Reads and replaces the articles list. See ./_collection.ts. */
import { listAllArticles } from '../../../lib/content/cache.ts';
import { replaceArticles } from '../../../lib/content/repo.ts';
import { collectionEndpoint } from './_collection.ts';

export const { GET, PUT } = collectionEndpoint('articles', listAllArticles, replaceArticles);
