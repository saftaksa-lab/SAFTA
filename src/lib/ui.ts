/**
 * Interface copy that is the same wherever it appears, so it is not content:
 * the admin edits what a page says, not the names of the site's own parts.
 */
import type { Bilingual } from './bilingual.ts';
import type { MEMBER_CATEGORIES } from '../db/content-schema.ts';

/** The first breadcrumb on every inner page. */
export const crumbHome: Bilingual = { ar: 'الرئيسية', en: 'Home' };

/**
 * A member's category as the profile and the map legend print it. The English
 * labels are the ones SAFTA's records always used (`Private sector`…).
 */
export const memberCategoryLabels: Record<(typeof MEMBER_CATEGORIES)[number], Bilingual> = {
  government: { ar: 'حكومي', en: 'Government' },
  academic: { ar: 'أكاديمي', en: 'Academic' },
  private: { ar: 'قطاع خاص', en: 'Private sector' },
  nonprofit: { ar: 'غير ربحي', en: 'Non-profit' },
};
