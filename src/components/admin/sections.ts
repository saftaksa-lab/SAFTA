/**
 * Every dashboard panel: which fields each surface shows, in what order, with
 * what label. The schemas in src/lib/content/schemas/ decide what is valid;
 * this file only decides how it is presented. See spec.ts.
 *
 * `satisfies Record<SingletonKey, …>` is what makes a new singleton without a
 * panel a type error. scripts/check-admin-specs.ts then checks each panel's
 * fields against its schema.
 */
import type { SingletonKey } from '../../lib/content/schemas/index.ts';
import type { CollectionSpec, FieldSpec, SectionSpec } from './spec.ts';

// Shared shapes ---------------------------------------------------------------

const eyebrow: FieldSpec = { kind: 'text', name: 'eyebrow', label: 'العنوان الفرعي' };
const heading: FieldSpec = { kind: 'text', name: 'heading', label: 'العنوان', rows: 2 };
const lede: FieldSpec = { kind: 'text', name: 'lede', label: 'النص التعريفي', rows: 3 };

const banner = (title: string): SectionSpec => ({
  title,
  lede: 'العنوان والنص في أعلى الصفحة.',
  fields: [{ kind: 'text', name: 'title', label: 'عنوان الصفحة' }, lede],
});

const intro = (title: string): SectionSpec => ({ title, fields: [eyebrow, heading, lede] });

const PROSE_HINT =
  'نص عادي. للخط العريض: **نص**، وللرابط: [النص](‎/terms‎). لا تُقبل وسوم HTML.';

/** One of a report's two link lists. The label is in that list's language only. */
const reportLinks = (name: string, label: string, hint: string, itemLabel: string): FieldSpec => ({
  kind: 'list',
  name,
  label,
  hint,
  itemLabel,
  idPrefix: 'rl',
  min: 0,
  max: 10,
  fields: [
    { kind: 'plain', name: 'label', label: 'نص الرابط' },
    {
      kind: 'plain',
      name: 'url',
      label: 'الرابط',
      hint: 'رابط كامل يبدأ بـ https://‎، ويُفتح في نافذة جديدة.',
      ltr: true,
    },
  ],
});

// Singletons -------------------------------------------------------------------

export const sections = {
  // Home ---------------------------------------------------------------------
  home_hero: {
    title: 'الواجهة الرئيسية',
    lede: 'ثلاث شرائح ثابتة. العنوان الفرعي لكل شريحة هو أيضًا اسم تبويبها، وعنوان الشريحة الأولى هو عنوان الصفحة الرئيسي.',
    fields: [
      {
        kind: 'list',
        name: 'panels',
        label: 'الشرائح',
        itemLabel: 'الشريحة',
        idPrefix: 'hero',
        min: 3,
        max: 3,
        fixed: true,
        fields: [
          { kind: 'text', name: 'eyebrow', label: 'العنوان الفرعي (واسم التبويب)' },
          { kind: 'text', name: 'heading', label: 'العنوان', rows: 2 },
          { kind: 'text', name: 'ctaLabel', label: 'نص الزر' },
          { kind: 'href', name: 'ctaHref', label: 'رابط الزر' },
          {
            kind: 'image',
            name: 'imageId',
            label: 'صورة الخلفية',
            hint: 'صورة أفقية عريضة لا يقل عرضها عن 1920 بكسل، ويظهر النص فوقها.',
            altFrom: 'heading',
          },
        ],
      },
    ],
  },
  home_discover: {
    title: 'تعرّف على التحالف',
    lede: 'المقدّمة، ثم قسم مجموعات العمل: صورة في إطار مستقل والنص والزر بجانبها.',
    fields: [
      eyebrow,
      { kind: 'text', name: 'intro', label: 'النص', rows: 3 },
      { kind: 'text', name: 'title', label: 'عنوان قسم مجموعات العمل' },
      { kind: 'text', name: 'lede', label: 'النص التعريفي', rows: 2 },
      { kind: 'text', name: 'body', label: 'الوصف', rows: 3 },
      { kind: 'text', name: 'ctaLabel', label: 'نص الزر' },
      { kind: 'href', name: 'href', label: 'رابط الزر' },
      {
        kind: 'image',
        name: 'imageId',
        label: 'الصورة',
        hint: 'صورة طولية أو مربعة، تظهر بجانب النص.',
        altFrom: 'title',
      },
    ],
  },
  home_challenges_intro: {
    title: 'التحديات: العنوان',
    lede: 'بطاقات التحديات نفسها في قسم «التحديات» أدناه، وتظهر في الصفحة الرئيسية وصفحة عن التحالف.',
    fields: [{ kind: 'text', name: 'title', label: 'عنوان القسم' }],
  },
  challenges: {
    title: 'التحديات',
    lede: 'تظهر بطاقاتٍ بأيقونة في الصفحة الرئيسية، وفي شبكة التحديات بصفحة عن التحالف.',
    fields: [
      {
        kind: 'list',
        name: 'items',
        label: 'التحديات',
        itemLabel: 'التحدي',
        idPrefix: 'challenge',
        min: 1,
        max: 12,
        fields: [
          { kind: 'text', name: 'title', label: 'العنوان' },
          { kind: 'text', name: 'description', label: 'الوصف', rows: 3 },
          {
            kind: 'select',
            name: 'icon',
            label: 'الأيقونة',
            hint: 'تظهر بجانب العنوان في بطاقة الصفحة الرئيسية.',
            options: [
              { value: 'droplet', label: 'قطرة ماء' },
              { value: 'sun', label: 'شمس' },
              { value: 'bug', label: 'حشرة' },
              { value: 'sprout', label: 'نبتة' },
              { value: 'trash', label: 'سلة مهملات' },
              { value: 'globe', label: 'كرة أرضية' },
              { value: 'cpu', label: 'شريحة إلكترونية' },
              { value: 'leaf', label: 'ورقة شجر' },
              { value: 'chart', label: 'رسم بياني' },
              { value: 'users', label: 'أشخاص' },
            ],
          },
          {
            kind: 'image',
            name: 'imageId',
            label: 'الصورة',
            hint: 'تظهر في صفحة عن التحالف فقط؛ بطاقات الصفحة الرئيسية بلا صور.',
            altFrom: 'title',
          },
        ],
      },
    ],
  },
  home_awards: {
    title: 'جوائز التميّز',
    fields: [
      {
        kind: 'checkbox',
        name: 'hidden',
        label: 'إخفاء قسم الجوائز من الموقع',
        hint: 'يُخفي القسم وروابطه في القائمة.',
      },
      { kind: 'text', name: 'soonLabel', label: 'شارة «قريبًا»' },
      eyebrow,
      { kind: 'text', name: 'heading', label: 'العنوان' },
      lede,
      { kind: 'text', name: 'ctaLabel', label: 'نص الزر', hint: 'يفتح الزر صفحة «سجّل اهتمامك».' },
      {
        kind: 'list',
        name: 'categories',
        label: 'فئات الجائزة',
        hint: 'يظهر رقم كل فئة حسب ترتيبها.',
        itemLabel: 'الفئة',
        idPrefix: 'award',
        min: 1,
        max: 12,
        fields: [
          { kind: 'text', name: 'title', label: 'الاسم' },
          { kind: 'text', name: 'description', label: 'الوصف', rows: 2 },
        ],
      },
    ],
  },
  home_partners: {
    title: 'شريط الشركاء',
    lede: 'شعارات الشركاء أسفل الصفحة الرئيسية.',
    fields: [
      {
        kind: 'list',
        name: 'items',
        label: 'الشركاء',
        itemLabel: 'الشريك',
        idPrefix: 'partner',
        min: 0,
        max: 16,
        fields: [
          { kind: 'text', name: 'name', label: 'الاسم', hint: 'ويُستخدم نصًا بديلًا للشعار.' },
          { kind: 'image', name: 'logoId', label: 'الشعار', altFrom: 'name', variant: 'logo' },
          {
            kind: 'url',
            name: 'url',
            label: 'رابط موقع الشريك',
            hint: 'رابط كامل يبدأ بـ https://‎. إن تُرك فارغًا يفتح الشعار صفحة الأعضاء.',
          },
        ],
      },
    ],
  },

  // About ----------------------------------------------------------------------
  about_hero: banner('أعلى الصفحة'),
  about_mission: {
    title: 'الرسالة والرؤية',
    fields: [
      eyebrow,
      heading,
      {
        kind: 'list',
        name: 'paragraphs',
        label: 'الفقرات',
        itemLabel: 'الفقرة',
        idPrefix: 'mission',
        min: 1,
        max: 4,
        fields: [{ kind: 'text', name: 'text', label: 'النص', rows: 6 }],
      },
      { kind: 'youtube', name: 'youtubeUrl', label: 'رابط فيديو يوتيوب' },
    ],
  },
  about_glance: {
    title: 'نظرة عامة (الأرقام)',
    fields: [
      {
        kind: 'checkbox',
        name: 'hidden',
        label: 'إخفاء القسم من الموقع',
        hint: 'القسم مخفي حتى تُعتمد الأرقام.',
      },
      { kind: 'text', name: 'soon', label: 'نص الشريط المتحرّك' },
      { kind: 'text', name: 'heading', label: 'العنوان' },
      {
        kind: 'list',
        name: 'stats',
        label: 'الأرقام',
        itemLabel: 'الرقم',
        idPrefix: 'stat',
        min: 4,
        max: 4,
        fixed: true,
        fields: [
          { kind: 'integer', name: 'value', label: 'القيمة', hint: 'عدد صحيح.' },
          { kind: 'text', name: 'label', label: 'الوصف' },
        ],
      },
    ],
  },
  about_roles: {
    title: 'الأدوار المؤسسية',
    fields: [
      eyebrow,
      { kind: 'text', name: 'heading', label: 'العنوان' },
      lede,
      {
        kind: 'list',
        name: 'items',
        label: 'الأدوار',
        itemLabel: 'الدور',
        idPrefix: 'role',
        min: 1,
        max: 8,
        fields: [
          { kind: 'text', name: 'title', label: 'العنوان' },
          { kind: 'text', name: 'description', label: 'الوصف', rows: 3 },
        ],
      },
    ],
  },
  about_challenges_intro: {
    title: 'التحديات: المقدّمة',
    lede: 'بطاقات التحديات تُحرَّر من صفحة «الصفحة الرئيسية».',
    fields: [eyebrow, { kind: 'text', name: 'heading', label: 'العنوان' }, lede],
  },
  about_founding_statement: {
    title: 'البيان التأسيسي',
    fields: [
      { kind: 'image', name: 'imageId', label: 'الصورة', altFrom: 'eyebrow' },
      eyebrow,
      { kind: 'text', name: 'quote', label: 'نص البيان', rows: 4 },
      { kind: 'text', name: 'ctaLabel', label: 'نص الزر', hint: 'يفتح الزر صفحة الأعضاء.' },
    ],
  },

  // Working groups, media, members ---------------------------------------------
  technologies_banner: banner('أعلى الصفحة'),
  technologies_intro: {
    title: 'المقدّمة',
    fields: [
      eyebrow,
      { kind: 'text', name: 'heading', label: 'العنوان' },
      lede,
      { kind: 'text', name: 'sourceNote', label: 'ملاحظة المصدر', rows: 3, hint: PROSE_HINT },
    ],
  },
  media_banner: banner('أعلى الصفحة'),
  article_chrome: {
    title: 'صفحة الخبر',
    lede: 'النصوص الثابتة حول كل خبر.',
    fields: [
      {
        kind: 'image',
        name: 'defaultImageId',
        label: 'الصورة الافتراضية',
        hint: 'تظهر في أعلى الخبر الذي ليست له صورة.',
        altFrom: 'crumbMedia',
      },
      { kind: 'text', name: 'crumbMedia', label: 'اسم المركز الإعلامي في مسار التنقل' },
      { kind: 'text', name: 'backLabel', label: 'نص زر العودة' },
      { kind: 'text', name: 'registerLabel', label: 'نص زر التسجيل', hint: 'يفتح الزر صفحة «سجّل اهتمامك».' },
    ],
  },
  reports_banner: banner('أعلى الصفحة'),
  reports_intro: intro('المقدّمة'),
  reports_list: {
    title: 'التقارير',
    lede: 'قائمة التقارير في صفحة «التقارير». لكل تقرير روابط عربية تظهر في النسخة العربية من الموقع فقط، وروابط إنجليزية تظهر في النسخة الإنجليزية فقط.',
    fields: [
      {
        kind: 'list',
        name: 'items',
        label: 'التقارير',
        itemLabel: 'التقرير',
        idPrefix: 'rp',
        min: 0,
        max: 30,
        fields: [
          { kind: 'text', name: 'title', label: 'العنوان' },
          { kind: 'text', name: 'description', label: 'الوصف', rows: 3 },
          reportLinks('linksAr', 'الروابط العربية', 'تظهر في النسخة العربية من الموقع فقط.', 'رابط عربي'),
          reportLinks('linksEn', 'الروابط الإنجليزية', 'تظهر في النسخة الإنجليزية من الموقع فقط. اكتب نص الرابط بالإنجليزية.', 'رابط إنجليزي'),
        ],
      },
    ],
  },
  members_banner: banner('أعلى الصفحة'),
  members_intro: intro('المقدّمة'),
  members_map: {
    title: 'خريطة الأعضاء',
    lede: 'النصوص حول الخريطة. مواقع الأعضاء تُحرَّر من سجل كل عضو.',
    fields: [
      { kind: 'text', name: 'heading', label: 'العنوان' },
      lede,
      { kind: 'text', name: 'sourceNote', label: 'الملاحظة أسفل الخريطة', rows: 2 },
    ],
  },
  member_chrome: {
    title: 'صفحة العضو',
    lede: 'النصوص الثابتة في صفحة كل عضو، وهي واحدة لجميع الأعضاء.',
    fields: [
      { kind: 'text', name: 'crumbMembers', label: 'اسم صفحة الأعضاء في مسار التنقل' },
      { kind: 'text', name: 'title', label: 'العنوان' },
      { kind: 'text', name: 'roleLabel', label: 'تسمية «الدور»' },
      { kind: 'text', name: 'sectorLabel', label: 'تسمية «مجال التركيز»' },
      { kind: 'text', name: 'sinceLabel', label: 'تسمية «عضو منذ»' },
      { kind: 'text', name: 'overviewHeading', label: 'عنوان النبذة' },
      { kind: 'text', name: 'collaborationHeading', label: 'عنوان مجالات التعاون' },
      {
        kind: 'list',
        name: 'collaborationItems',
        label: 'مجالات التعاون',
        itemLabel: 'المجال',
        idPrefix: 'collab',
        min: 0,
        max: 6,
        fields: [{ kind: 'text', name: 'text', label: 'النص', rows: 2 }],
      },
      { kind: 'text', name: 'contactEyebrow', label: 'التواصل: العنوان الفرعي' },
      { kind: 'text', name: 'contactHeading', label: 'التواصل: العنوان' },
      { kind: 'text', name: 'contactText', label: 'التواصل: النص', rows: 3 },
      { kind: 'text', name: 'contactCtaLabel', label: 'التواصل: نص الزر' },
      { kind: 'email', name: 'contactEmail', label: 'التواصل: البريد الإلكتروني' },
      { kind: 'text', name: 'backLabel', label: 'نص زر العودة' },
    ],
  },

  // Contact ------------------------------------------------------------------
  contact_hero: banner('أعلى الصفحة'),
  contact_form: {
    title: 'نموذج التواصل',
    lede: 'تسميات حقول النموذج. علامة الحقل المطلوب (*) تُضاف تلقائيًا.',
    fields: [
      { kind: 'text', name: 'nameLabel', label: 'الاسم: التسمية' },
      { kind: 'text', name: 'namePlaceholder', label: 'الاسم: النص المؤقت' },
      { kind: 'text', name: 'emailLabel', label: 'البريد: التسمية' },
      { kind: 'text', name: 'emailPlaceholder', label: 'البريد: النص المؤقت' },
      { kind: 'text', name: 'phoneLabel', label: 'الجوال: التسمية' },
      { kind: 'text', name: 'phoneHint', label: 'الجوال: الإرشاد' },
      { kind: 'text', name: 'phonePlaceholder', label: 'الجوال: النص المؤقت' },
      { kind: 'text', name: 'messageLabel', label: 'الرسالة: التسمية' },
      { kind: 'text', name: 'messagePlaceholder', label: 'الرسالة: النص المؤقت', rows: 2 },
      { kind: 'text', name: 'submitLabel', label: 'نص زر الإرسال' },
      { kind: 'text', name: 'successMessage', label: 'رسالة النجاح', rows: 2 },
    ],
  },
  contact_info: {
    title: 'التواصل المباشر',
    fields: [
      { kind: 'text', name: 'heading', label: 'العنوان' },
      { kind: 'text', name: 'lede', label: 'النص', rows: 2 },
      { kind: 'text', name: 'generalLabel', label: 'الاستفسارات العامة: التسمية' },
      { kind: 'email', name: 'email', label: 'الاستفسارات العامة: البريد الإلكتروني' },
      { kind: 'text', name: 'membershipLabel', label: 'العضوية: التسمية' },
      { kind: 'text', name: 'membershipLinkLabel', label: 'العضوية: نص الرابط', hint: 'يفتح صفحة «سجّل اهتمامك».' },
      { kind: 'text', name: 'mediaLabel', label: 'الإعلام: التسمية' },
      { kind: 'text', name: 'mediaLinkLabel', label: 'الإعلام: نص الرابط', hint: 'يفتح صفحة الأخبار والفعاليات.' },
      { kind: 'text', name: 'responseLabel', label: 'مدة الرد: التسمية' },
      { kind: 'text', name: 'responseText', label: 'مدة الرد: النص' },
      { kind: 'text', name: 'followLabel', label: 'تسمية «تابعنا»' },
    ],
  },

  // Register interest ----------------------------------------------------------
  register_hero: banner('أعلى الصفحة'),
  register_form: {
    title: 'نموذج التسجيل',
    lede: 'تسميات حقول النموذج. علامة الحقل المطلوب (*) تُضاف تلقائيًا.',
    fields: [
      { kind: 'text', name: 'nameLabel', label: 'الاسم: التسمية' },
      { kind: 'text', name: 'entityLabel', label: 'اسم الجهة: التسمية' },
      { kind: 'text', name: 'entityTypeLabel', label: 'نوع الجهة: التسمية' },
      { kind: 'text', name: 'entityTypePrompt', label: 'نوع الجهة: الخيار الأول الفارغ' },
      {
        kind: 'options',
        name: 'entityTypeOptions',
        label: 'نوع الجهة: الخيارات',
        hint: 'الخيارات ثابتة. يمكن تعديل النص الظاهر لكل خيار فقط.',
      },
      { kind: 'text', name: 'emailLabel', label: 'البريد: التسمية' },
      { kind: 'text', name: 'phoneLabel', label: 'الجوال: التسمية' },
      { kind: 'text', name: 'websiteLabel', label: 'الموقع الإلكتروني: التسمية' },
      { kind: 'text', name: 'websitePlaceholder', label: 'الموقع الإلكتروني: النص المؤقت' },
      { kind: 'text', name: 'areaLabel', label: 'مجال الاهتمام: التسمية' },
      { kind: 'text', name: 'areaPrompt', label: 'مجال الاهتمام: الخيار الأول الفارغ' },
      {
        kind: 'options',
        name: 'areaOptions',
        label: 'مجال الاهتمام: الخيارات',
        hint: 'الخيارات ثابتة. يمكن تعديل النص الظاهر لكل خيار فقط.',
      },
      { kind: 'text', name: 'areaHint', label: 'مجال الاهتمام: الإرشاد' },
      { kind: 'text', name: 'messageLabel', label: 'الرسالة: التسمية' },
      { kind: 'text', name: 'portfolioLabel', label: 'الملف المرفق: التسمية' },
      { kind: 'text', name: 'portfolioHint', label: 'الملف المرفق: الإرشاد' },
      { kind: 'text', name: 'chooseFileLabel', label: 'نص زر اختيار الملف' },
      { kind: 'text', name: 'noFileLabel', label: 'نص «لم يُختر ملف»' },
      { kind: 'text', name: 'consent', label: 'نص الإقرار', rows: 3, hint: PROSE_HINT },
      { kind: 'text', name: 'submitLabel', label: 'نص زر الإرسال' },
      { kind: 'text', name: 'successMessage', label: 'رسالة النجاح', rows: 2 },
    ],
  },
  register_info: {
    title: 'ماذا بعد؟',
    fields: [
      { kind: 'text', name: 'heading', label: 'العنوان' },
      { kind: 'text', name: 'lede', label: 'النص', rows: 2 },
      {
        kind: 'list',
        name: 'steps',
        label: 'الخطوات',
        hint: 'يظهر رقم كل خطوة حسب ترتيبها.',
        itemLabel: 'الخطوة',
        idPrefix: 'step',
        min: 1,
        max: 6,
        fields: [
          { kind: 'text', name: 'title', label: 'العنوان' },
          { kind: 'text', name: 'text', label: 'النص', rows: 2 },
        ],
      },
      { kind: 'text', name: 'questionsLabel', label: 'تسمية «عندك سؤال؟»' },
      { kind: 'email', name: 'email', label: 'البريد الإلكتروني' },
    ],
  },
} satisfies Record<SingletonKey, SectionSpec>;

// Collections -----------------------------------------------------------------

const slugField = (example: string): FieldSpec => ({
  kind: 'plain',
  name: 'slug',
  label: 'المعرّف (slug)',
  hint: `يحدّد رابط الصفحة ويجب أن يبقى فريدًا. حروف لاتينية صغيرة وأرقام وشرطات فقط، مثل ${example}.`,
  ltr: true,
});

const publishedField: FieldSpec = { kind: 'checkbox', name: 'published', label: 'منشور على الموقع' };

export const collections = {
  members: {
    title: 'الأعضاء',
    lede: 'كل عضو بطاقة في صفحة الأعضاء وصفحة تفصيلية خاصة، وعلامة على الخريطة إن حُدّد موقعه.',
    url: '/admin/api/members',
    labelField: 'nameAr',
    idPrefix: 'member',
    max: 80,
    fields: [
      slugField('mewa'),
      { kind: 'text', name: 'name', label: 'اسم الجهة' },
      {
        kind: 'select',
        name: 'category',
        label: 'نوع الجهة',
        hint: 'يحدّد لون العلامة على الخريطة وفلتر الصفحة.',
        options: [
          { value: 'government', label: 'حكومي' },
          { value: 'academic', label: 'أكاديمي' },
          { value: 'private', label: 'قطاع خاص' },
          { value: 'nonprofit', label: 'غير ربحي' },
        ],
      },
      { kind: 'image', name: 'logoId', label: 'الشعار', altFrom: 'name', variant: 'logo' },
      {
        kind: 'plain',
        name: 'initials',
        label: 'الأحرف المختصرة',
        hint: 'تظهر بدل الشعار إن لم يكن موجودًا، مثل MEWA.',
        ltr: true,
      },
      { kind: 'text', name: 'role', label: 'الدور في التحالف' },
      { kind: 'text', name: 'sector', label: 'مجال التركيز' },
      { kind: 'plain', name: 'since', label: 'عضو منذ', hint: 'كما يُكتب، مثل 2026.', ltr: true },
      { kind: 'text', name: 'bio', label: 'نبذة', rows: 4 },
      {
        kind: 'coordinate',
        name: 'lat',
        label: 'خط العرض',
        hint: 'بين ‎-90‎ و90، مثل 24.7136. اتركه مع خط الطول فارغين لإخفاء العضو من الخريطة.',
      },
      { kind: 'coordinate', name: 'lng', label: 'خط الطول', hint: 'بين ‎-180‎ و180، مثل 46.6753.' },
      { kind: 'text', name: 'city', label: 'المدينة', optional: true },
      { kind: 'text', name: 'country', label: 'الدولة', optional: true },
      publishedField,
    ],
  },
  workingGroups: {
    title: 'مجموعات العمل',
    url: '/admin/api/working-groups',
    labelField: 'nameAr',
    idPrefix: 'group',
    max: 40,
    fields: [
      slugField('palm-weevil'),
      { kind: 'plain', name: 'number', label: 'الرقم الظاهر', hint: 'مثل 01.', ltr: true },
      {
        kind: 'select',
        name: 'challenge',
        label: 'التحدي',
        hint: 'يحدّد لون البطاقة فقط، ولا يظهر نصه في الموقع.',
        options: [
          { value: 'pests', label: 'الآفات (pests)' },
          { value: 'waste', label: 'سلاسل الإمداد والفاقد (waste)' },
          { value: 'climate', label: 'المناخ والإنتاج (climate)' },
          { value: 'soil', label: 'التربة والكربون (soil)' },
        ],
      },
      { kind: 'text', name: 'name', label: 'الاسم' },
      { kind: 'text', name: 'scope', label: 'النطاق', rows: 4 },
      {
        kind: 'image',
        name: 'imageId',
        label: 'الصورة',
        hint: 'اختيارية. من دونها تظهر أيقونة المجموعة.',
        altFrom: 'name',
      },
      publishedField,
    ],
  },
  articles: {
    title: 'الأخبار',
    url: '/admin/api/articles',
    labelField: 'titleAr',
    idPrefix: 'article',
    max: 100,
    fields: [
      slugField('mou-water'),
      { kind: 'text', name: 'kind', label: 'النوع', hint: 'مثل «أخبار».' },
      { kind: 'text', name: 'date', label: 'التاريخ', hint: 'كما يُكتب، مثل 28 يوليو 2026.' },
      { kind: 'text', name: 'readTime', label: 'مدة القراءة' },
      {
        kind: 'image',
        name: 'imageId',
        label: 'الصورة',
        hint: 'اختيارية. من دونها تظهر الصورة الافتراضية لصفحة الخبر.',
        altFrom: 'title',
      },
      { kind: 'text', name: 'title', label: 'العنوان', rows: 2 },
      { kind: 'text', name: 'lede', label: 'المقدّمة', rows: 3 },
      {
        kind: 'list',
        name: 'blocks',
        label: 'فقرات الخبر',
        itemLabel: 'الفقرة',
        idPrefix: 'block',
        min: 1,
        max: 20,
        fields: [
          { kind: 'text', name: 'heading', label: 'العنوان الفرعي' },
          { kind: 'text', name: 'body', label: 'النص', rows: 5 },
        ],
      },
      { kind: 'text', name: 'quote', label: 'الاقتباس', rows: 3, optional: true },
      { kind: 'text', name: 'quoteBy', label: 'قائل الاقتباس', optional: true },
      {
        kind: 'list',
        name: 'tags',
        label: 'الوسوم',
        itemLabel: 'الوسم',
        idPrefix: 'tag',
        min: 0,
        max: 6,
        fields: [{ kind: 'text', name: 'label', label: 'الوسم' }],
      },
      publishedField,
    ],
  },
  events: {
    title: 'الفعاليات',
    url: '/admin/api/events',
    labelField: 'titleAr',
    idPrefix: 'event',
    max: 100,
    fields: [
      slugField('ev-riyadh-forum'),
      { kind: 'plain', name: 'day', label: 'اليوم', hint: 'كما يُكتب، مثل 18.', ltr: true },
      { kind: 'text', name: 'month', label: 'الشهر', hint: 'مثل «سبتمبر 2026».' },
      { kind: 'text', name: 'title', label: 'العنوان' },
      { kind: 'text', name: 'description', label: 'الوصف', rows: 2 },
      { kind: 'link', name: 'href', label: 'الرابط' },
      publishedField,
    ],
  },
} satisfies Record<string, CollectionSpec>;

export type CollectionKey = keyof typeof collections;
