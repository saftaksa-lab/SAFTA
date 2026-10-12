/**
 * The contact and register-interest pages: their heroes and the info panels
 * beside the forms. The forms themselves are HubSpot embeds
 * (src/components/HubSpotForm.astro), so their labels are not content here.
 */
import { z } from 'zod';
import { defineSingleton } from './types.ts';
import { bilingual, contactEmail, itemId } from './fields.ts';
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
