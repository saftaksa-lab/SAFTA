/**
 * The contact and register-interest pages: their heroes, the form labels, and
 * the info panels beside the forms.
 *
 * Required-field markers are not content: the markup renders `<b class="req">*</b>`
 * after every label whose input is `required`. Select options are a fixed set
 * (see `fixedOptions`), because each `value` is what the form submits.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { bilingual, contactEmail, fixedOptions, itemId, optionsFrom } from './fields.ts';
import type { Banner } from './listings.ts';

const heroSchema = z.object({
  ...bilingual('title', 80),
  ...bilingual('lede', 400),
});

// ---------------------------------------------------------------------------
// Contact

export const contactHero = defineSingleton<Banner>({
  key: 'contact_hero',
  version: 1,
  schema: heroSchema,
  migrations: [],
  initial: {
    titleAr: 'تواصل معنا',
    titleEn: 'Contact us',
    ledeAr: 'للاستفسارات وفرص الشراكة وطلبات الدعم، تواصل معنا.',
    ledeEn: 'For inquiries, partnership opportunities or support requests, please contact us.',
  },
});

/** The `<option value>`s the contact form submits. English, as they have always been. */
export const CONTACT_SECTORS = [
  'Agriculture technology',
  'Food technology',
  'Water & irrigation',
  'Controlled environment agriculture',
  'Alternative protein',
  'Supply chain & logistics',
  'Biotechnology',
  'Renewable energy',
  'Data & artificial intelligence',
  'Research & academia',
  'Government & policy',
  'Investment & funding',
  'Non-profit',
  'Other',
] as const;

export const CONTACT_COUNTRIES = [
  'Saudi Arabia',
  'United Arab Emirates',
  'Kuwait',
  'Qatar',
  'Bahrain',
  'Oman',
  'Egypt',
  'Jordan',
  'Netherlands',
  'United Kingdom',
  'United States',
  'Germany',
  'France',
  'China',
  'Japan',
  'India',
  'Australia',
  'Other',
] as const;

const contactFormSchema = z.object({
  ...bilingual('nameLabel', 60),
  ...bilingual('namePlaceholder', 80),
  ...bilingual('emailLabel', 60),
  ...bilingual('emailPlaceholder', 80),
  ...bilingual('phoneLabel', 60),
  ...bilingual('phoneHint', 160),
  ...bilingual('phonePlaceholder', 80),
  ...bilingual('companyLabel', 60),
  ...bilingual('companyPlaceholder', 80),
  ...bilingual('sectorLabel', 60),
  ...bilingual('sectorPrompt', 60),
  sectorOptions: fixedOptions(CONTACT_SECTORS),
  ...bilingual('countryLabel', 60),
  ...bilingual('countryPrompt', 60),
  countryOptions: fixedOptions(CONTACT_COUNTRIES),
  ...bilingual('submitLabel', 40),
  ...bilingual('successMessage', 200),
});

export type ContactForm = z.infer<typeof contactFormSchema>;

export const contactForm = defineSingleton<ContactForm>({
  key: 'contact_form',
  version: 1,
  schema: contactFormSchema,
  migrations: [],
  initial: {
    nameLabelAr: 'الاسم الكامل',
    nameLabelEn: 'Full Name',
    namePlaceholderAr: 'مثال: سارة الأحمد',
    namePlaceholderEn: 'e.g. Sara Al-Ahmed',
    emailLabelAr: 'البريد الإلكتروني',
    emailLabelEn: 'Email',
    emailPlaceholderAr: 'name@company.com',
    emailPlaceholderEn: 'name@company.com',
    phoneLabelAr: 'رقم الجوال',
    phoneLabelEn: 'Phone number',
    phoneHintAr: 'أضف رمز الدولة. مثال: ‎+96659xxxxxxx',
    phoneHintEn: 'Kindly add the country code. Exp: +96659xxxxxxx',
    phonePlaceholderAr: '‎+966',
    phonePlaceholderEn: '+966',
    companyLabelAr: 'اسم الجهة أو الشركة',
    companyLabelEn: 'Company name',
    companyPlaceholderAr: 'مثال: الكثبان الخضراء',
    companyPlaceholderEn: 'e.g. Green Dunes',
    sectorLabelAr: 'القطاع',
    sectorLabelEn: 'Sector',
    sectorPromptAr: 'الرجاء الاختيار',
    sectorPromptEn: 'Please Select',
    sectorOptions: optionsFrom([
      ['Agriculture technology', 'تقنيات الزراعة', 'Agriculture technology'],
      ['Food technology', 'تقنيات الأغذية', 'Food technology'],
      ['Water & irrigation', 'المياه والري', 'Water & irrigation'],
      ['Controlled environment agriculture', 'الزراعة البيئية المحكومة', 'Controlled environment agriculture'],
      ['Alternative protein', 'البروتين البديل', 'Alternative protein'],
      ['Supply chain & logistics', 'سلاسل الإمداد والخدمات اللوجستية', 'Supply chain & logistics'],
      ['Biotechnology', 'التقنية الحيوية', 'Biotechnology'],
      ['Renewable energy', 'الطاقة المتجددة', 'Renewable energy'],
      ['Data & artificial intelligence', 'البيانات والذكاء الاصطناعي', 'Data & artificial intelligence'],
      ['Research & academia', 'البحث والأوساط الأكاديمية', 'Research & academia'],
      ['Government & policy', 'الجهات الحكومية والسياسات', 'Government & policy'],
      ['Investment & funding', 'الاستثمار والتمويل', 'Investment & funding'],
      ['Non-profit', 'غير ربحي', 'Non-profit'],
      ['Other', 'أخرى', 'Other'],
    ]),
    countryLabelAr: 'الدولة',
    countryLabelEn: 'Country',
    countryPromptAr: 'الرجاء الاختيار',
    countryPromptEn: 'Please Select',
    countryOptions: optionsFrom([
      ['Saudi Arabia', 'المملكة العربية السعودية', 'Saudi Arabia'],
      ['United Arab Emirates', 'الإمارات العربية المتحدة', 'United Arab Emirates'],
      ['Kuwait', 'الكويت', 'Kuwait'],
      ['Qatar', 'قطر', 'Qatar'],
      ['Bahrain', 'البحرين', 'Bahrain'],
      ['Oman', 'عُمان', 'Oman'],
      ['Egypt', 'مصر', 'Egypt'],
      ['Jordan', 'الأردن', 'Jordan'],
      ['Netherlands', 'هولندا', 'Netherlands'],
      ['United Kingdom', 'المملكة المتحدة', 'United Kingdom'],
      ['United States', 'الولايات المتحدة', 'United States'],
      ['Germany', 'ألمانيا', 'Germany'],
      ['France', 'فرنسا', 'France'],
      ['China', 'الصين', 'China'],
      ['Japan', 'اليابان', 'Japan'],
      ['India', 'الهند', 'India'],
      ['Australia', 'أستراليا', 'Australia'],
      ['Other', 'دولة أخرى', 'Other'],
    ]),
    submitLabelAr: 'إرسال',
    submitLabelEn: 'Submit',
    successMessageAr: 'تم استلام طلبك. سنتواصل معك قريبًا.',
    successMessageEn: 'Your request has been received. We will be in touch shortly.',
  },
});

const contactInfoSchema = z.object({
  ...bilingual('heading', 80),
  ...bilingual('lede', 300),
  ...bilingual('generalLabel', 80),
  email: contactEmail,
  ...bilingual('membershipLabel', 60),
  /** Its link stays `/register-interest`. */
  ...bilingual('membershipLinkLabel', 60),
  ...bilingual('mediaLabel', 60),
  /** Its link stays `/media`. */
  ...bilingual('mediaLinkLabel', 60),
  ...bilingual('responseLabel', 60),
  ...bilingual('responseText', 160),
  /** The LinkedIn and X links stay in the markup for now. */
  ...bilingual('followLabel', 60),
});

export type ContactInfo = z.infer<typeof contactInfoSchema>;

export const contactInfo = defineSingleton<ContactInfo>({
  key: 'contact_info',
  version: 1,
  schema: contactInfoSchema,
  migrations: [],
  initial: {
    headingAr: 'التواصل المباشر',
    headingEn: 'Direct contact',
    ledeAr: 'اختر القناة الأنسب لطلبك — أو استخدم النموذج وسنوجّهه للجهة الصحيحة.',
    ledeEn: 'Pick the channel that fits your request — or use the form and we will route it for you.',
    generalLabelAr: 'الاستفسارات العامة والدعم',
    generalLabelEn: 'General enquiries and support',
    email: 'info@safta.sa',
    membershipLabelAr: 'العضوية',
    membershipLabelEn: 'Membership',
    membershipLinkLabelAr: 'سجّل اهتمامك بالانضمام',
    membershipLinkLabelEn: 'Register your interest',
    mediaLabelAr: 'الاستفسارات الإعلامية',
    mediaLabelEn: 'Media enquiries',
    mediaLinkLabelAr: 'المركز الإعلامي',
    mediaLinkLabelEn: 'Media Centre',
    responseLabelAr: 'مدة الرد',
    responseLabelEn: 'Response time',
    responseTextAr: 'ثلاثة أيام عمل في المتوسط.',
    responseTextEn: 'Three working days on average.',
    followLabelAr: 'تابعنا',
    followLabelEn: 'Follow us',
  },
});

// ---------------------------------------------------------------------------
// Register interest

export const registerHero = defineSingleton<Banner>({
  key: 'register_hero',
  version: 1,
  schema: heroSchema,
  migrations: [],
  initial: {
    titleAr: 'سجّل اهتمامك',
    titleEn: 'Register your interest',
    ledeAr: 'عرّفنا بجهتك والتحدي الذي ترغب بالعمل عليه، وسنتواصل معك بحزمة العضوية.',
    ledeEn:
      'Tell us who you are and which challenge you want to work on. We will follow up with the membership pack.',
  },
});

/**
 * These selects had no `value` before, so they submitted their visible text —
 * Arabic once the page switched language. The English label is now the fixed
 * value, matching what an English visitor already submitted.
 */
export const REGISTER_ENTITY_TYPES = [
  'Government entity',
  'Academic institution',
  'Private sector company',
  'Non-profit organization',
  'Individual innovator',
] as const;

export const REGISTER_AREAS = [
  'Harsh climate conditions',
  'Water scarcity',
  'Pest risks',
  'Soil degradation',
  'Food waste',
  'Other / not sure yet',
] as const;

const registerFormSchema = z.object({
  ...bilingual('nameLabel', 60),
  ...bilingual('entityLabel', 60),
  ...bilingual('entityTypeLabel', 60),
  ...bilingual('entityTypePrompt', 60),
  entityTypeOptions: fixedOptions(REGISTER_ENTITY_TYPES),
  ...bilingual('emailLabel', 60),
  ...bilingual('phoneLabel', 60),
  ...bilingual('websiteLabel', 60),
  ...bilingual('websitePlaceholder', 80),
  ...bilingual('areaLabel', 60),
  ...bilingual('areaPrompt', 60),
  areaOptions: fixedOptions(REGISTER_AREAS),
  ...bilingual('areaHint', 200),
  ...bilingual('messageLabel', 80),
  ...bilingual('portfolioLabel', 80),
  ...bilingual('portfolioHint', 160),
  ...bilingual('chooseFileLabel', 40),
  ...bilingual('noFileLabel', 40),
  /** Prose (src/lib/prose.ts), for the links to the terms and the privacy policy. */
  ...bilingual('consent', 600),
  ...bilingual('submitLabel', 40),
  ...bilingual('successMessage', 200),
});

export type RegisterForm = z.infer<typeof registerFormSchema>;

export const registerForm = defineSingleton<RegisterForm>({
  key: 'register_form',
  version: 1,
  schema: registerFormSchema,
  migrations: [],
  initial: {
    nameLabelAr: 'الاسم الكامل',
    nameLabelEn: 'Full name',
    entityLabelAr: 'اسم الجهة',
    entityLabelEn: 'Entity name',
    entityTypeLabelAr: 'نوع الجهة',
    entityTypeLabelEn: 'Entity type',
    entityTypePromptAr: 'اختر…',
    entityTypePromptEn: 'Select…',
    entityTypeOptions: optionsFrom([
      ['Government entity', 'جهة حكومية', 'Government entity'],
      ['Academic institution', 'مؤسسة أكاديمية', 'Academic institution'],
      ['Private sector company', 'شركة من القطاع الخاص', 'Private sector company'],
      ['Non-profit organization', 'منظمة غير ربحية', 'Non-profit organization'],
      ['Individual innovator', 'مبتكر فرد', 'Individual innovator'],
    ]),
    emailLabelAr: 'البريد الإلكتروني للعمل',
    emailLabelEn: 'Work email',
    phoneLabelAr: 'رقم الجوال',
    phoneLabelEn: 'Phone number',
    websiteLabelAr: 'الموقع الإلكتروني',
    websiteLabelEn: 'Website',
    websitePlaceholderAr: 'https://',
    websitePlaceholderEn: 'https://',
    areaLabelAr: 'مجال الاهتمام',
    areaLabelEn: 'Area of interest',
    areaPromptAr: 'اختر…',
    areaPromptEn: 'Select…',
    areaOptions: optionsFrom([
      ['Harsh climate conditions', 'قسوة الظروف المناخية', 'Harsh climate conditions'],
      ['Water scarcity', 'شُح الموارد المائية', 'Water scarcity'],
      ['Pest risks', 'مخاطر الآفات الزراعية', 'Pest risks'],
      ['Soil degradation', 'تدهور التربة', 'Soil degradation'],
      ['Food waste', 'هدر الغذاء', 'Food waste'],
      ['Other / not sure yet', 'أخرى / غير محدد بعد', 'Other / not sure yet'],
    ]),
    areaHintAr: 'مرتبط بالتحديات الوطنية الخمسة التي يعمل عليها التحالف.',
    areaHintEn: 'Maps to the five national challenges the Alliance works on.',
    messageLabelAr: 'لماذا ترغب بالانضمام؟',
    messageLabelEn: 'Why do you want to join?',
    portfolioLabelAr: 'ملف الأعمال أو العرض التعريفي',
    portfolioLabelEn: 'Portfolio or company profile',
    portfolioHintAr: 'PDF أو PPTX أو DOCX · حتى 10 م.ب · اختياري',
    portfolioHintEn: 'PDF, PPTX or DOCX · up to 10MB · optional',
    chooseFileLabelAr: 'اختر ملفًا',
    chooseFileLabelEn: 'Choose file',
    noFileLabelAr: 'لم يُختر أي ملف',
    noFileLabelEn: 'No file chosen',
    consentAr:
      'أُقرّ بأنني مخوّل بتقديم هذا الطلب نيابةً عن الجهة المذكورة أعلاه، وأوافق على [الشروط والأحكام](/terms) و[سياسة الخصوصية](/privacy).',
    consentEn:
      'I confirm I am authorized to submit this request on behalf of the entity named above, and I accept the [Terms & Conditions](/terms) and [Privacy Policy](/privacy).',
    submitLabelAr: 'إرسال التسجيل',
    submitLabelEn: 'Submit registration',
    successMessageAr: 'شكرًا لك — تم تسجيل طلبك بنجاح.',
    successMessageEn: 'Thank you — your registration has been recorded.',
  },
});

const step = z.object({
  id: itemId,
  ...bilingual('title', 60),
  ...bilingual('text', 300),
});

const registerInfoSchema = z.object({
  ...bilingual('heading', 80),
  ...bilingual('lede', 300),
  /** The number shown on each step is its position. */
  steps: z.array(step).min(1, 'أضف خطوة واحدة على الأقل.').max(6),
  ...bilingual('questionsLabel', 60),
  email: contactEmail,
});

export type RegisterInfo = z.infer<typeof registerInfoSchema>;

export const registerInfo = defineSingleton<RegisterInfo>({
  key: 'register_info',
  version: 1,
  schema: registerInfoSchema,
  migrations: [],
  initial: {
    headingAr: 'ماذا بعد؟',
    headingEn: 'What happens next',
    ledeAr: 'أربع خطوات من إرسال الطلب حتى إدراج جهتك في دليل المتحالفين.',
    ledeEn: 'Four steps from submitting your request to being listed in the Members directory.',
    steps: [
      {
        id: 'step-1',
        titleAr: 'المراجعة',
        titleEn: 'Review',
        textAr: 'يراجع فريق التحالف طلبك ويتحقّق من اكتمال بياناته.',
        textEn: 'The Alliance team reviews your request and checks that it is complete.',
      },
      {
        id: 'step-2',
        titleAr: 'التواصل',
        titleEn: 'Contact',
        textAr: 'نتواصل معك عبر البريد الإلكتروني الذي زوّدتنا به.',
        textEn: 'We reach out to you at the email address you provided.',
      },
      {
        id: 'step-3',
        titleAr: 'خطاب العضوية',
        titleEn: 'Letter of Interest',
        textAr: 'تتلقّى الجهات المؤهّلة خطاب الاهتمام بالعضوية للتوقيع.',
        textEn: 'Eligible entities receive the Membership Letter of Interest to sign.',
      },
      {
        id: 'step-4',
        titleAr: 'الإدراج',
        titleEn: 'Listing',
        textAr: 'بعد التوقيع تُدرَج جهتك في دليل المتحالفين على الموقع.',
        textEn: 'Once signed, your entity is listed in the Members directory.',
      },
    ],
    questionsLabelAr: 'عندك سؤال؟',
    questionsLabelEn: 'Any questions?',
    email: 'info@safta.sa',
  },
});
