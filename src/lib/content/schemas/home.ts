/**
 * The home page's editable surfaces, plus the challenges list it shares with
 * the about page.
 *
 * Field sources are in waterstrip's docs/safta-key-map.md. Initial values are
 * the text SAFTA shipped with; images start empty (`null`) and are filled by the
 * legacy import, or by an upload.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { bilingual, externalUrl, itemId, mediaId, siteHref } from './fields.ts';

// ---------------------------------------------------------------------------
// home_hero

const heroPanel = z.object({
  id: itemId,
  /** Doubles as the carousel tab label, so it stays short. */
  ...bilingual('eyebrow', 40),
  ...bilingual('heading', 200),
  ...bilingual('ctaLabel', 40),
  ctaHref: siteHref,
  /** The slide background. Decorative: the heading carries the meaning. */
  imageId: mediaId.nullable(),
});

const homeHeroSchema = z.object({
  /** Fixed at three: the markup has three slides and three tabs. The first heading is the page `h1`. */
  panels: z.array(heroPanel).length(3),
});

export type HomeHero = z.infer<typeof homeHeroSchema>;

export const homeHero = defineSingleton<HomeHero>({
  key: 'home_hero',
  version: 1,
  schema: homeHeroSchema,
  migrations: [],
  initial: {
    panels: [
      {
        id: 'hero-1',
        eyebrowAr: 'رؤى سافتا',
        eyebrowEn: 'SAFTA Insights',
        headingAr: 'معرفة تطبيقية تدعم قرارات تبنّي تقنيات الزراعة والغذاء في المملكة.',
        headingEn:
          "Applied knowledge that supports technology-adoption decisions across the Kingdom's agrifood sector.",
        ctaLabelAr: 'استعرض الرؤى',
        ctaLabelEn: 'Explore Insights',
        ctaHref: '/about',
        imageId: null,
      },
      {
        id: 'hero-2',
        eyebrowAr: 'الشراكات',
        eyebrowEn: 'Partnerships',
        headingAr: 'الجهات الحكومية والبحثية والقطاع الخاص — تحالف واحد.',
        headingEn: 'Government, research and industry — working as one alliance.',
        ctaLabelAr: 'تعرّف على المتحالفين',
        ctaLabelEn: 'Meet the members',
        ctaHref: '/members',
        imageId: null,
      },
      {
        id: 'hero-3',
        eyebrowAr: 'الإعلانات',
        eyebrowEn: 'Announcements',
        headingAr: 'التحالف يفتح باب العضوية في مجموعات عمله للجهات المهتمة بتقنيات الزراعة والغذاء.',
        headingEn:
          'SAFTA is opening working-group membership to organizations across the agrifood technology sector.',
        ctaLabelAr: 'اعرف المزيد',
        ctaLabelEn: 'Learn more',
        ctaHref: '/media',
        imageId: null,
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// home_discover

const homeDiscoverSchema = z.object({
  ...bilingual('eyebrow', 60),
  ...bilingual('intro', 400),
  // The working-groups block below the intro: a boxed image with this copy beside it.
  ...bilingual('title', 60),
  ...bilingual('lede', 200),
  ...bilingual('body', 500),
  ...bilingual('ctaLabel', 60),
  href: siteHref,
  imageId: mediaId.nullable(),
});

export type HomeDiscover = z.infer<typeof homeDiscoverSchema>;

const DISCOVER_BODY = {
  bodyAr:
    'تضم مجموعات العمل خبراء من الجهات الحكومية والمؤسسات البحثية والقطاع الخاص، يعملون معًا على تطوير حلول تقنية لتحديات قطاع الزراعة والغذاء.',
  bodyEn:
    'Each working group brings together experts from government, research and industry to develop technology solutions to the sector’s challenges.',
  ctaLabelAr: 'استعرض مجموعات العمل',
  ctaLabelEn: 'Explore the working groups',
};

export const homeDiscover = defineSingleton<HomeDiscover>({
  key: 'home_discover',
  version: 2,
  schema: homeDiscoverSchema,
  migrations: [
    // v1 → v2: the two-tile row became one working-groups block (SAFTA, October 2026).
    // The first tile carries over; the second ("What we do") is dropped.
    (data) => {
      const v1 = data as {
        eyebrowAr: string;
        eyebrowEn: string;
        introAr: string;
        introEn: string;
        tiles: Array<{
          eyebrowAr: string;
          eyebrowEn: string;
          headingAr: string;
          headingEn: string;
          href: string;
          imageId: string | null;
        }>;
      };
      const tile = v1.tiles[0]!;
      return {
        eyebrowAr: v1.eyebrowAr,
        eyebrowEn: v1.eyebrowEn,
        introAr: v1.introAr,
        introEn: v1.introEn,
        titleAr: tile.eyebrowAr,
        titleEn: tile.eyebrowEn,
        ledeAr: tile.headingAr,
        ledeEn: tile.headingEn,
        ...DISCOVER_BODY,
        href: tile.href,
        imageId: tile.imageId,
      };
    },
  ],
  initial: {
    eyebrowAr: 'تعرّف على التحالف',
    eyebrowEn: 'Discover SAFTA',
    introAr:
      'نحن التحالف الوطني السعودي لتقنيات الزراعة والغذاء — نجمع الجهات الحكومية والمؤسسات البحثية والقطاع الخاص لتعزيز الأمن الغذائي.',
    introEn:
      'We are Saudi Arabia’s national alliance for agrifood technology — bringing together government entities, research institutions and the private sector to strengthen food security.',
    titleAr: 'مجموعات العمل',
    titleEn: 'Working groups',
    ledeAr: '9 مجموعات عمل تعالج تحديات الزراعة والغذاء في المملكة',
    ledeEn: '9 working groups tackling the Kingdom’s agrifood challenges',
    ...DISCOVER_BODY,
    href: '/technologies',
    imageId: null,
  },
});

// ---------------------------------------------------------------------------
// home_challenges_intro

const homeChallengesIntroSchema = z.object({
  /** The section heading above the challenge cards. */
  ...bilingual('title', 60),
});

export type HomeChallengesIntro = z.infer<typeof homeChallengesIntroSchema>;

export const homeChallengesIntro = defineSingleton<HomeChallengesIntro>({
  key: 'home_challenges_intro',
  version: 2,
  schema: homeChallengesIntroSchema,
  migrations: [
    // v1 → v2: the intro paragraph was removed and the eyebrow became the heading (SAFTA, October 2026).
    (data) => {
      const v1 = data as { eyebrowAr: string; eyebrowEn: string };
      return { titleAr: v1.eyebrowAr, titleEn: v1.eyebrowEn };
    },
  ],
  initial: {
    titleAr: 'التحديات',
    titleEn: 'Challenges',
  },
});

// ---------------------------------------------------------------------------
// challenges — read by the home cards and the about grid

/** The icons a challenge card can show. The drawings are in src/lib/challenge-icons.ts. */
export const CHALLENGE_ICONS = [
  'droplet',
  'sun',
  'bug',
  'sprout',
  'trash',
  'globe',
  'cpu',
  'leaf',
  'chart',
  'users',
] as const;
export type ChallengeIcon = (typeof CHALLENGE_ICONS)[number];

const SHIPPED_ICONS: Record<string, ChallengeIcon> = {
  'water-scarcity': 'droplet',
  'harsh-climate': 'sun',
  'pest-risks': 'bug',
  'soil-degradation': 'sprout',
  'food-waste': 'trash',
  'import-dependency': 'globe',
  'tech-gaps': 'cpu',
};

/** The icon a challenge starts with: the shipped one for the seven SAFTA launched with, a leaf otherwise. */
export function defaultChallengeIcon(id: string): ChallengeIcon {
  return SHIPPED_ICONS[id] ?? 'leaf';
}

const challenge = z.object({
  id: itemId,
  ...bilingual('title', 120),
  ...bilingual('description', 400),
  /** Shown on the home page cards. */
  icon: z.enum(CHALLENGE_ICONS),
  /** Shown on the about page grid only; the home cards have no image. */
  imageId: mediaId.nullable(),
});

const challengesSchema = z.object({
  items: z.array(challenge).min(1, 'أضف تحديًا واحدًا على الأقل.').max(12),
});

export type Challenges = z.infer<typeof challengesSchema>;
export type Challenge = z.infer<typeof challenge>;

export const challenges = defineSingleton<Challenges>({
  key: 'challenges',
  version: 2,
  schema: challengesSchema,
  migrations: [
    // v1 → v2: the home slider became a grid of icon cards (SAFTA, October 2026).
    (data) => {
      const v1 = data as { items: Array<{ id: string }> };
      return { items: v1.items.map((item) => ({ ...item, icon: defaultChallengeIcon(item.id) })) };
    },
  ],
  initial: {
    items: [
      {
        id: 'water-scarcity',
        titleAr: 'شُح الموارد المائية',
        titleEn: 'Water scarcity',
        descriptionAr: 'الزراعة هي أكبر مستهلك للمياه في المملكة، ما يجعل رفع الكفاءة أولوية وطنية.',
        descriptionEn:
          'Agriculture is the largest consumer of water in the Kingdom, making efficiency a national priority.',
        icon: 'droplet',
        imageId: null,
      },
      {
        id: 'harsh-climate',
        titleAr: 'قسوة الظروف المناخية',
        titleEn: 'Harsh climate conditions',
        descriptionAr: 'ارتفاع درجات الحرارة ومحدودية الأراضي الصالحة للزراعة يقيّدان ما يمكن زراعته وأين.',
        descriptionEn: 'High temperatures and limited arable land constrain what can be grown, and where.',
        icon: 'sun',
        imageId: null,
      },
      {
        id: 'pest-risks',
        titleAr: 'مخاطر الآفات الزراعية',
        titleEn: 'Pest risks',
        descriptionAr: 'خسائر المحاصيل بسبب الآفات والأمراض تخفض الإنتاجية وترفع تكاليف المدخلات.',
        descriptionEn: 'Crop losses from pests and disease reduce yields and increase input costs.',
        icon: 'bug',
        imageId: null,
      },
      {
        id: 'soil-degradation',
        titleAr: 'تدهور التربة',
        titleEn: 'Soil degradation',
        descriptionAr: 'الملوحة وتراجع المادة العضوية يقلّلان القدرة الإنتاجية للأراضي الزراعية.',
        descriptionEn: 'Salinity and declining organic matter reduce the productive capacity of farmland.',
        icon: 'sprout',
        imageId: null,
      },
      {
        id: 'food-waste',
        titleAr: 'هدر الغذاء',
        titleEn: 'Food waste',
        descriptionAr: 'الفاقد بين الحصاد والاستهلاك يضعف العائد من كل لتر ماء مستخدم.',
        descriptionEn: 'Losses between harvest and consumption weaken the return on every litre of water used.',
        icon: 'trash',
        imageId: null,
      },
      {
        id: 'import-dependency',
        titleAr: 'الاعتماد على الاستيراد وانكشاف الأمن الغذائي',
        titleEn: 'Import dependency and food security exposure',
        descriptionAr:
          'اعتماد نسبة كبيرة من الإمداد الغذائي على الاستيراد يتركه عرضة لتقلّبات الأسعار العالمية واضطرابات سلاسل الإمداد.',
        descriptionEn:
          'A large share of the food supply is imported, leaving it exposed to global price swings and disruptions along trade routes.',
        icon: 'globe',
        imageId: null,
      },
      {
        id: 'tech-gaps',
        titleAr: 'فجوات التقنية والإرشاد الزراعي',
        titleEn: 'Technology and extension gaps',
        descriptionAr:
          'تفاوت الوصول إلى التقنيات الحديثة والإرشاد الزراعي يبطئ تبنّيها في المزارع، وخصوصًا الحيازات الصغيرة.',
        descriptionEn:
          'Uneven access to modern technology and agricultural extension slows adoption on farms, smaller holdings most of all.',
        icon: 'cpu',
        imageId: null,
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// home_awards

const awardCategory = z.object({
  id: itemId,
  ...bilingual('title', 80),
  ...bilingual('description', 300),
});

const homeAwardsSchema = z.object({
  /** When true, the section and its nav links are left out. Replaces `settings.json` `hideAwards`. */
  hidden: z.boolean(),
  ...bilingual('soonLabel', 40),
  ...bilingual('eyebrow', 60),
  ...bilingual('heading', 120),
  ...bilingual('lede', 500),
  /** Its link stays `/register-interest` in the markup. */
  ...bilingual('ctaLabel', 60),
  /** The number shown on each card (`01`…) is its position. */
  categories: z.array(awardCategory).min(1, 'أضف فئة واحدة على الأقل.').max(12),
});

export type HomeAwards = z.infer<typeof homeAwardsSchema>;

export const homeAwards = defineSingleton<HomeAwards>({
  key: 'home_awards',
  version: 1,
  schema: homeAwardsSchema,
  migrations: [],
  initial: {
    hidden: false,
    soonLabelAr: 'قريبًا',
    soonLabelEn: 'Launching Soon',
    eyebrowAr: 'التميّز',
    eyebrowEn: 'Excellence',
    headingAr: 'جوائز سافتا للتميّز',
    headingEn: 'SAFTA Excellence Awards',
    ledeAr:
      'جائزة سنوية تكرّم الجهات والفرق التي حقّقت أثرًا ملموسًا في تقنيات الزراعة والغذاء بالمملكة — يرشّحها الأعضاء وتقيّمها لجنة تحكيم مستقلة.',
    ledeEn:
      'An annual award recognising the entities and teams delivering measurable impact in the Kingdom’s agrifood technology — nominated by members and assessed by an independent panel.',
    ctaLabelAr: 'سجّل اهتمامك بالترشّح',
    ctaLabelEn: 'Register your interest to nominate',
    categories: [
      {
        id: 'award-1',
        titleAr: 'ابتكار العام',
        titleEn: 'Innovation of the Year',
        descriptionAr: 'حل تقني أثبت أثره في الإنتاجية أو كفاءة الموارد.',
        descriptionEn: 'A technology solution with proven impact on productivity or resource efficiency.',
      },
      {
        id: 'award-2',
        titleAr: 'كفاءة الموارد المائية',
        titleEn: 'Water Stewardship',
        descriptionAr: 'أفضل خفض موثّق في استهلاك مياه الري.',
        descriptionEn: 'The best documented reduction in irrigation water use.',
      },
      {
        id: 'award-3',
        titleAr: 'مجموعة العمل المتميزة',
        titleEn: 'Working Group of the Year',
        descriptionAr: 'المجموعة الأعلى إنتاجية في مخرجاتها البحثية والتطبيقية.',
        descriptionEn: 'The group with the strongest research and applied output.',
      },
      {
        id: 'award-4',
        titleAr: 'الشركة الناشئة الواعدة',
        titleEn: 'Emerging AgriFood Startup',
        descriptionAr: 'شركة ناشئة سعودية ذات حل قابل للتوسّع.',
        descriptionEn: 'A Saudi startup with a scalable solution.',
      },
      {
        id: 'award-5',
        titleAr: 'أثر الكوادر الوطنية',
        titleEn: 'National Talent Impact',
        descriptionAr: 'برنامج بنى قدرات وطنية في القطاع.',
        descriptionEn: 'A programme that built national capability in the sector.',
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// home_partners

const partner = z.object({
  id: itemId,
  /** Also the logo's alt text. */
  ...bilingual('name', 160),
  logoId: mediaId.nullable(),
  /** The partner's own site. `null` links to `/members`, as the strip does today. */
  url: externalUrl.nullable(),
});

const homePartnersSchema = z.object({
  items: z.array(partner).max(16),
});

export type HomePartners = z.infer<typeof homePartnersSchema>;

export const homePartners = defineSingleton<HomePartners>({
  key: 'home_partners',
  version: 1,
  schema: homePartnersSchema,
  migrations: [],
  initial: {
    items: [
      ['mewa', 'وزارة البيئة والمياه والزراعة', 'Ministry of Environment, Water & Agriculture'],
      ['kaust', 'جامعة الملك عبدالله للعلوم والتقنية', 'King Abdullah University of Science & Technology'],
      [
        'estidamah',
        'المركز الوطني للبحوث والتطوير للزراعة المستدامة (استدامة)',
        'National Research & Development Center for Sustainable Agriculture (Estidamah)',
      ],
      ['arasco', 'أراسكو', 'ARASCO'],
      ['almarai', 'المراعي', 'Almarai'],
      ['tanmiah', 'مجموعة تنمية الغذائية', 'Tanmiah Food Group'],
      [
        'npras',
        'المنصة الوطنية لتحليلات البحث والابتكار للاستدامة',
        'NPRAS — National Platform of R&I Analytics for Sustainability',
      ],
    ].map(([id, nameAr, nameEn]) => ({ id, nameAr, nameEn, logoId: null, url: null })),
  },
});
