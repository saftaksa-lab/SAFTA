/**
 * The reports page (`/reports`), ported from waterstrip: a banner and intro like
 * the other inner pages, then the list of reports. Each report has a bilingual
 * title and description, plus two separate link lists — Arabic links (shown on
 * the Arabic site) and English links (shown on the English site). The link lists
 * do not fall back to each other: a report with no links in the page's language
 * shows its title and description only. A link's label is written in that list's
 * language, so it has no `xAr`/`xEn` pair.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { arText, bilingual, externalUrl, itemId } from './fields.ts';
import { bannerSchema, introSchema, type Banner, type Intro } from './listings.ts';

export const reportsBanner = defineSingleton<Banner>({
  key: 'reports_banner',
  version: 1,
  schema: bannerSchema,
  migrations: [],
  initial: {
    titleAr: 'التقارير',
    titleEn: 'Reports',
    ledeAr: 'تقارير التحالف ودراساته في تقنيات الزراعة والغذاء.',
    ledeEn: 'The Alliance’s reports and studies on agrifood technology.',
  },
});

export const reportsIntro = defineSingleton<Intro>({
  key: 'reports_intro',
  version: 1,
  schema: introSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'المنشورات',
    eyebrowEn: 'Publications',
    headingAr: 'التقارير والدراسات',
    headingEn: 'Reports and studies',
    ledeAr: 'اطّلع على التقارير والدراسات المرتبطة بتبنّي التقنيات في منظومة الزراعة والغذاء.',
    ledeEn: 'Read reports and studies on technology adoption across the agrifood system.',
  },
});

const link = z.object({
  id: itemId,
  // Arabic or English depending on the list; arText is just required, trimmed text.
  label: arText(1, 120),
  url: externalUrl,
});

const report = z.object({
  id: itemId,
  ...bilingual('title', 160),
  ...bilingual('description', 600),
  linksAr: z.array(link).max(10),
  linksEn: z.array(link).max(10),
});

const reportsListSchema = z.object({
  items: z.array(report).max(30),
});

export type ReportLink = z.infer<typeof link>;
export type Report = z.infer<typeof report>;
export type ReportsList = z.infer<typeof reportsListSchema>;

/** Starts empty: the page shows its empty-state line until an admin adds a report. */
export const reportsList = defineSingleton<ReportsList>({
  key: 'reports_list',
  version: 1,
  schema: reportsListSchema,
  migrations: [],
  initial: { items: [] },
});
