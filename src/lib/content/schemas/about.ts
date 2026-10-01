/**
 * The about page's editable surfaces. Its challenges grid reads the shared
 * `challenges` list from ./home.ts.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { bilingual, itemId, mediaId, youtubeUrl } from './fields.ts';

// ---------------------------------------------------------------------------
// about_hero

const aboutHeroSchema = z.object({
  ...bilingual('title', 80),
  ...bilingual('lede', 400),
});

export type AboutHero = z.infer<typeof aboutHeroSchema>;

export const aboutHero = defineSingleton<AboutHero>({
  key: 'about_hero',
  version: 1,
  schema: aboutHeroSchema,
  migrations: [],
  initial: {
    titleAr: 'عن التحالف',
    titleEn: 'About SAFTA',
    ledeAr:
      'منصة وطنية للتعاون والتنسيق وتبادل المعرفة في ابتكار تقنيات الزراعة والغذاء، دعمًا لرؤية السعودية 2030.',
    ledeEn:
      'A national platform for collaboration, coordination and knowledge exchange in agrifood technology innovation, in support of Saudi Vision 2030.',
  },
});

// ---------------------------------------------------------------------------
// about_mission

const paragraph = z.object({
  id: itemId,
  ...bilingual('text', 1200),
});

const aboutMissionSchema = z.object({
  ...bilingual('eyebrow', 60),
  ...bilingual('heading', 160),
  paragraphs: z.array(paragraph).min(1, 'أضف فقرة واحدة على الأقل.').max(4),
  /** One link for both languages. Empty hides the video block. */
  youtubeUrl,
});

export type AboutMission = z.infer<typeof aboutMissionSchema>;

export const aboutMission = defineSingleton<AboutMission>({
  key: 'about_mission',
  version: 1,
  schema: aboutMissionSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'الرسالة والرؤية',
    eyebrowEn: 'Mission & Vision',
    headingAr: 'منصة وطنية لتسريع تبنّي تقنيات الزراعة والغذاء',
    headingEn: 'A national platform accelerating agrifood technology adoption',
    paragraphs: [
      {
        id: 'mission-1',
        textAr:
          'تأسّس التحالف السعودي لتقنيات الزراعة والغذاء كمنصّة وطنية للتعاون والتنسيق وتبادل المعرفة في مجال الابتكار. ومهمّته تسريع تبنّي التقنيات الزراعية والغذائية دعمًا لرؤية السعودية 2030 — بجمع الجهات الحكومية والمؤسسات الأكاديمية والقطاع الخاص والمنظمات غير الربحية للتصدّي بشكل جماعي لتحديات الأمن الغذائي والاستدامة وتوسيع تبنّي حلول التقنية الزراعية في مختلف أنحاء المملكة.',
        textEn:
          'The Saudi AgriFood Technology Alliance was established as a national platform for collaboration, coordination and knowledge exchange in the field of innovation. Its mission is to accelerate the adoption of agricultural and food technologies in support of Saudi Vision 2030 — bringing together government bodies, academic institutions, the private sector and non-profit organizations to collectively address the challenges of food security, sustainability and the broader adoption of agri-tech solutions across the Kingdom.',
      },
      {
        id: 'mission-2',
        textAr:
          'يُعدّ التحالف أحد أبرز مخرجات الخطة التنفيذية للبحث والابتكار في وزارة البيئة والمياه والزراعة، وقد صُمّم ليقود تحوّلًا في قطاع الغذاء والزراعة الوطني عبر التنسيق الاستراتيجي بين أصحاب المصلحة الملتزمين بدفع تبنّي التقنية، وتبادل المعرفة، وصياغة سياسات وأطر تنظيمية سليمة.',
        textEn:
          'The Alliance is one of the key outcomes of the Ministry of Environment, Water and Agriculture’s Research and Innovation Executive Plan. It is designed to lead a transformation of the national food and agriculture sector through strategic coordination among stakeholders committed to advancing technology adoption, sharing knowledge, and shaping sound policies and regulatory frameworks.',
      },
    ],
    youtubeUrl: '',
  },
});

// ---------------------------------------------------------------------------
// about_glance

const stat = z.object({
  id: itemId,
  value: z.number().int('عدد صحيح فقط.').min(0).max(999999),
  ...bilingual('label', 60),
});

const aboutGlanceSchema = z.object({
  /** Replaces the hardcoded `hidden` attribute. True until the figures are confirmed. */
  hidden: z.boolean(),
  /** The scrolling tape. The markup repeats it, mixing both languages. */
  ...bilingual('soon', 30),
  ...bilingual('heading', 60),
  /** Fixed at four: the markup is a four-column grid. */
  stats: z.array(stat).length(4),
});

export type AboutGlance = z.infer<typeof aboutGlanceSchema>;

export const aboutGlance = defineSingleton<AboutGlance>({
  key: 'about_glance',
  version: 1,
  schema: aboutGlanceSchema,
  migrations: [],
  initial: {
    hidden: true,
    soonAr: 'قريبًا',
    soonEn: 'Soon',
    headingAr: 'نظرة عامة',
    headingEn: 'At a glance',
    stats: [
      { id: 'stat-1', value: 24, labelAr: 'مجموعة عمل مستهدفة', labelEn: 'Targeted working groups' },
      { id: 'stat-2', value: 4, labelAr: 'أدوار مؤسسية أساسية', labelEn: 'Core institutional roles' },
      { id: 'stat-3', value: 4, labelAr: 'قطاعات ممثَّلة', labelEn: 'Sectors represented' },
      { id: 'stat-4', value: 3, labelAr: 'استراتيجيات وطنية متوائمة', labelEn: 'National strategies aligned' },
    ],
  },
});

// ---------------------------------------------------------------------------
// about_roles — the intro and the role cards (the legacy `roles` collection)

const role = z.object({
  id: itemId,
  ...bilingual('title', 80),
  ...bilingual('description', 400),
});

const aboutRolesSchema = z.object({
  ...bilingual('eyebrow', 60),
  ...bilingual('heading', 120),
  ...bilingual('lede', 600),
  items: z.array(role).min(1, 'أضف دورًا واحدًا على الأقل.').max(8),
});

export type AboutRoles = z.infer<typeof aboutRolesSchema>;

export const aboutRoles = defineSingleton<AboutRoles>({
  key: 'about_roles',
  version: 1,
  schema: aboutRolesSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'الأدوار المؤسسية',
    eyebrowEn: 'Institutional Roles',
    headingAr: 'أربعة أدوار توجّه عمل التحالف',
    headingEn: 'Four roles that guide the Alliance',
    ledeAr:
      'انبثق التحالف عن الخطة التنفيذية للبحث والابتكار بوزارة البيئة والمياه والزراعة، وتتمحور تدخلاته المؤسسية حول أربعة أدوار أساسية: توجيه الابتكار، وبناء الشراكات، وتعزيز الطلب على التقنية، وتمكين الشركات الناشئة.',
    ledeEn:
      'The Alliance grew out of the Ministry’s Research and Innovation Executive Plan. Its institutional interventions centre on four core roles: steering innovation, building partnerships, driving demand for technology, and enabling startups.',
    items: [
      {
        id: 'guiding-innovation',
        titleAr: 'توجيه الابتكار',
        titleEn: 'Guiding innovation',
        descriptionAr: 'رصد التقنيات الناشئة والمستقبلية، وتنسيق الجهود بين أصحاب المصلحة في المنظومة الوطنية.',
        descriptionEn:
          'Monitoring emerging and future technologies, and coordinating efforts among stakeholders across the national ecosystem.',
      },
      {
        id: 'building-partnerships',
        titleAr: 'بناء الشراكات',
        titleEn: 'Building partnerships',
        descriptionAr: 'إنشاء وتعزيز الروابط بين الجهات الوطنية والدولية لتعظيم الاستفادة من التعاون في البحث والابتكار.',
        descriptionEn:
          'Establishing and strengthening links between national and international entities to maximize the benefits of collaboration in research and innovation.',
      },
      {
        id: 'stimulating-demand',
        titleAr: 'تحفيز الطلب على الابتكار',
        titleEn: 'Stimulating demand for innovation',
        descriptionAr: 'تسهيل تبنّي التقنية وإزالة العوائق التنظيمية والنظامية التي تقف في طريقها.',
        descriptionEn: 'Facilitating technology adoption and removing the regulatory and legal barriers that stand in its way.',
      },
      {
        id: 'enabling-supply',
        titleAr: 'تمكين عرض الابتكار',
        titleEn: 'Enabling the supply of innovation',
        descriptionAr: 'تمكين الشركات الناشئة والمبتكرين في قطاعات البيئة والمياه والزراعة، وتعزيز قدراتهم.',
        descriptionEn:
          'Empowering startups and innovators across the environment, water and agriculture sectors, and strengthening their capabilities.',
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// about_challenges_intro

const aboutChallengesIntroSchema = z.object({
  ...bilingual('eyebrow', 60),
  ...bilingual('heading', 120),
  ...bilingual('lede', 600),
});

export type AboutChallengesIntro = z.infer<typeof aboutChallengesIntroSchema>;

export const aboutChallengesIntro = defineSingleton<AboutChallengesIntro>({
  key: 'about_challenges_intro',
  version: 1,
  schema: aboutChallengesIntroSchema,
  migrations: [],
  initial: {
    eyebrowAr: 'السياق الوطني',
    eyebrowEn: 'National Context',
    headingAr: 'تحديات تجعل الابتكار ضرورة',
    headingEn: 'Challenges that make innovation urgent',
    ledeAr:
      'تواجه أنظمة الزراعة والغذاء في المملكة تحديات كبيرة، تخلق مجتمعةً دافعًا واضحًا لتبنّي التقنيات المتقدمة — بما يوازن بين تحقيق الأمن الغذائي والحفاظ على الموارد الطبيعية.',
    ledeEn:
      'Saudi Arabia’s agriculture and food systems face significant challenges. Together they create a clear impetus to adopt advanced technologies — balancing food security with the preservation of natural resources.',
  },
});

// ---------------------------------------------------------------------------
// about_founding_statement

const aboutFoundingStatementSchema = z.object({
  imageId: mediaId.nullable(),
  ...bilingual('eyebrow', 60),
  ...bilingual('quote', 600),
  /** Its link stays `/members` in the markup. */
  ...bilingual('ctaLabel', 60),
});

export type AboutFoundingStatement = z.infer<typeof aboutFoundingStatementSchema>;

export const aboutFoundingStatement = defineSingleton<AboutFoundingStatement>({
  key: 'about_founding_statement',
  version: 1,
  schema: aboutFoundingStatementSchema,
  migrations: [],
  initial: {
    imageId: null,
    eyebrowAr: 'البيان التأسيسي',
    eyebrowEn: 'Founding statement',
    quoteAr:
      '«يمثّل تأسيسه فرصة تاريخية لتسخير الذكاء الجماعي والقدرات المتنوعة والطموحات المشتركة لأعضائه من داخل المملكة وحول العالم — للعمل معًا نحو مستقبل زراعي وغذائي مستدام للسعودية وما بعدها.»',
    quoteEn:
      '“Its founding marks a historic opportunity to harness the collective intelligence, diverse capabilities and shared ambitions of members from within the Kingdom and around the world — working together toward a sustainable agricultural and food future for Saudi Arabia and beyond.”',
    ctaLabelAr: 'تعرّف على المتحالفين',
    ctaLabelEn: 'Meet the members',
  },
});
