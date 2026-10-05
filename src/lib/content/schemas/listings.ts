/**
 * The chrome around SAFTA's four collections: the working-groups page, the
 * news/events hub and its article page, and the members directory and profile.
 * The records themselves are tables (src/db/content-schema.ts); these are the
 * banners, intros and labels the pages wrap them in.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { bilingual, contactEmail, itemId, mediaId } from './fields.ts';

export const bannerSchema = z.object({
  ...bilingual('title', 80),
  ...bilingual('lede', 400),
});

export type Banner = z.infer<typeof bannerSchema>;

export const introSchema = z.object({
  ...bilingual('eyebrow', 60),
  ...bilingual('heading', 120),
  ...bilingual('lede', 600),
});

export type Intro = z.infer<typeof introSchema>;

// ---------------------------------------------------------------------------
// The working-groups page (`/technologies`)

export const technologiesBanner = defineSingleton<Banner>({
  key: 'technologies_banner',
  version: 1,
  schema: bannerSchema,
  migrations: [],
  initial: {
    titleAr: 'مجموعات العمل',
    titleEn: 'Working Groups',
    ledeAr: 'مجموعات العمل النشطة في التحالف، مصنّفة حسب التحدي القطاعي الذي تعالجه.',
    ledeEn: 'The Alliance’s active working groups, grouped by the sector challenge each one addresses.',
  },
});

const technologiesIntroSchema = introSchema.extend({
  /**
   * Prose (src/lib/prose.ts): `**bold**` and `[label](/path)` only. The note
   * opens with a bold "Source:" label.
   */
  ...bilingual('sourceNote', 600),
});

export type TechnologiesIntro = z.infer<typeof technologiesIntroSchema>;

export const technologiesIntro = defineSingleton<TechnologiesIntro>({
  key: 'technologies_intro',
  version: 1,
  schema: technologiesIntroSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'النطاق',
    eyebrowEn: 'Scope',
    headingAr: '9 مجموعات عمل نشطة',
    headingEn: '9 active working groups',
    ledeAr:
      'تسع مجموعات عمل يقودها خبراء من الجهات الأعضاء، تُعنى بصناعة الأفكار واقتراح الحلول والسياسات التي تسرّع تبنّي التقنيات في منظومة الزراعة والغذاء.',
    ledeEn:
      'Nine working groups led by experts from member organizations — generating ideas and proposing the solutions and policies that accelerate technology adoption across the agrifood system.',
    sourceNoteAr:
      '**المصدر:** جدول مجموعات العمل الرسمي والتقرير السنوي الأول 2024–2025. أوراق السياسات نفسها لم تُعتمد للنشر العام بعد.',
    sourceNoteEn:
      '**Source:** the official working-groups register and the First Annual Report 2024–2025. The policy notes themselves are not yet approved for public release.',
  },
});

// ---------------------------------------------------------------------------
// The news and events hub (`/media`) and the article page

export const mediaBanner = defineSingleton<Banner>({
  key: 'media_banner',
  version: 1,
  schema: bannerSchema,
  migrations: [],
  initial: {
    titleAr: 'الأخبار والفعاليات',
    titleEn: 'News & Events',
    ledeAr: 'آخر أخبار التحالف وفعالياته ومعارضه.',
    ledeEn: 'The latest news, events and exhibitions from across the Alliance.',
  },
});

const articleChromeSchema = z.object({
  /** The hero shown when an article has no image of its own. */
  defaultImageId: mediaId.nullable(),
  ...bilingual('crumbMedia', 60),
  ...bilingual('backLabel', 60),
  /** Its link stays `/register-interest`. */
  ...bilingual('registerLabel', 60),
});

export type ArticleChrome = z.infer<typeof articleChromeSchema>;

export const articleChrome = defineSingleton<ArticleChrome>({
  key: 'article_chrome',
  version: 1,
  schema: articleChromeSchema,
  migrations: [],
  initial: {
    defaultImageId: null,
    crumbMediaAr: 'المركز الإعلامي',
    crumbMediaEn: 'Media',
    backLabelAr: 'عودة إلى المركز الإعلامي',
    backLabelEn: 'Back to Media',
    registerLabelAr: 'سجّل اهتمامك',
    registerLabelEn: 'Register your interest',
  },
});

// ---------------------------------------------------------------------------
// The members directory and the member profile

export const membersBanner = defineSingleton<Banner>({
  key: 'members_banner',
  version: 1,
  schema: bannerSchema,
  migrations: [],
  initial: {
    titleAr: 'الأعضاء',
    titleEn: 'Members of the Alliance',
    ledeAr: 'جهات حكومية وأكاديمية ومن القطاع الخاص وغير ربحية تعمل معًا في تقنيات الزراعة والغذاء.',
    ledeEn:
      'Government, academic, private sector and non-profit entities working together on agrifood technology.',
  },
});

export const membersIntro = defineSingleton<Intro>({
  key: 'members_intro',
  version: 1,
  schema: introSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'التحالف',
    eyebrowEn: 'The Alliance',
    headingAr: 'الأعضاء',
    headingEn: 'Members of the Alliance',
    ledeAr:
      'جهات حكومية ومؤسسات أكاديمية وشركات من القطاع الخاص ومنظمات غير ربحية تعمل معًا للنهوض بتقنيات الزراعة والغذاء في المملكة.',
    ledeEn:
      'Government entities, academic institutions, private sector companies and non-profit organizations working together to advance agrifood technology in the Kingdom.',
  },
});

const membersMapSchema = z.object({
  ...bilingual('heading', 120),
  ...bilingual('lede', 400),
  ...bilingual('sourceNote', 300),
});

export type MembersMap = z.infer<typeof membersMapSchema>;

/**
 * The text around the members map. The map was never shown on SAFTA's site, so
 * nothing carries over: this is first-draft copy, to be reviewed when the
 * `.memmap` block is rebuilt in Phase 3.
 */
export const membersMap = defineSingleton<MembersMap>({
  key: 'members_map',
  version: 1,
  schema: membersMapSchema,
  migrations: [],
  initial: {
    headingAr: 'أعضاء التحالف على الخريطة',
    headingEn: 'Our members on the map',
    ledeAr: 'مواقع الجهات الأعضاء في المملكة وخارجها، ملوّنة حسب نوع الجهة.',
    ledeEn: 'Where the Alliance’s member organizations are based, coloured by type of organization.',
    sourceNoteAr: 'تُعرض الجهات التي حُدّد موقعها فقط.',
    sourceNoteEn: 'Only members with a recorded location are shown.',
  },
});

const collaborationItem = z.object({
  id: itemId,
  ...bilingual('text', 200),
});

const memberChromeSchema = z.object({
  ...bilingual('crumbMembers', 60),
  ...bilingual('title', 60),
  ...bilingual('roleLabel', 60),
  ...bilingual('sectorLabel', 60),
  ...bilingual('sinceLabel', 60),
  ...bilingual('overviewHeading', 60),
  ...bilingual('collaborationHeading', 80),
  /** The same on every profile. */
  collaborationItems: z.array(collaborationItem).max(6),
  ...bilingual('contactEyebrow', 60),
  ...bilingual('contactHeading', 120),
  ...bilingual('contactText', 400),
  ...bilingual('contactCtaLabel', 60),
  contactEmail,
  ...bilingual('backLabel', 60),
});

export type MemberChrome = z.infer<typeof memberChromeSchema>;

export const memberChrome = defineSingleton<MemberChrome>({
  key: 'member_chrome',
  version: 1,
  schema: memberChromeSchema,
  migrations: [],
  initial: {
    crumbMembersAr: 'المتحالفون',
    crumbMembersEn: 'Members',
    titleAr: 'ملف العضو',
    titleEn: 'Member profile',
    roleLabelAr: 'الدور في التحالف',
    roleLabelEn: 'Role in the Alliance',
    sectorLabelAr: 'مجال التركيز',
    sectorLabelEn: 'Sector focus',
    sinceLabelAr: 'عضو منذ',
    sinceLabelEn: 'Member since',
    overviewHeadingAr: 'نبذة',
    overviewHeadingEn: 'Overview',
    collaborationHeadingAr: 'مجالات التعاون',
    collaborationHeadingEn: 'Areas of collaboration',
    collaborationItems: [
      {
        id: 'collab-1',
        textAr: 'التبنّي المنسّق لتقنيات الزراعة والغذاء على مستوى القطاع.',
        textEn: 'Coordinated adoption of agrifood technologies across the sector.',
      },
      {
        id: 'collab-2',
        textAr: 'التبادل العلمي والبحثي مع الشركاء المحليين والدوليين.',
        textEn: 'Scientific and research exchange with national and international partners.',
      },
      {
        id: 'collab-3',
        textAr: 'بناء القدرات البشرية ونقل المعرفة.',
        textEn: 'Human capacity building and knowledge transfer.',
      },
    ],
    contactEyebrowAr: 'التواصل',
    contactEyebrowEn: 'Get in touch',
    contactHeadingAr: 'تواصل مع هذه الجهة عبر التحالف',
    contactHeadingEn: 'Reach this member through the Alliance',
    contactTextAr:
      'تُوجَّه الطلبات المتعلقة بهذه الجهة عبر أمانة التحالف، فنحيلها إلى جهة الاتصال المناسبة لديها.',
    contactTextEn:
      'Requests relating to this member are routed through the Alliance Secretariat, which forwards them to the right contact point.',
    contactCtaLabelAr: 'افتح نموذج التواصل',
    contactCtaLabelEn: 'Open the contact form',
    contactEmail: 'info@safta.sa',
    backLabelAr: 'العودة إلى كل المتحالفين',
    backLabelEn: 'Back to all members',
  },
});
