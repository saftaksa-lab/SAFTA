// Hand-written, not `generate-page-schema.mjs` output: content/member.json had drifted from
// public/admin/schema.js (a renamed key, a few orphaned ones) and needed a one-time manual
// fix anyway — see the key set below and content/member.json's corrected shape.
import type { FieldMap } from './codec';

export const MEMBER_FIELDS = {
  "t001-الرئيسية": { kind: "text", tag: "a", type: "text", label: "الرئيسية" },
  "t002-الأعضاء": { kind: "text", tag: "a", type: "text", label: "الأعضاء" },
  "t003-ملف-العضو": { kind: "text", tag: "h1", type: "text", label: "ملف العضو" },
  "t007-الدور-في-التحالف": { kind: "text", tag: "b", type: "text", label: "الدور في التحالف" },
  "t009-مجال-التركيز": { kind: "text", tag: "b", type: "text", label: "مجال التركيز" },
  "t011-عضو-منذ": { kind: "text", tag: "b", type: "text", label: "عضو منذ" },
  "t012-نبذة": { kind: "text", tag: "h2", type: "text", label: "نبذة" },
  "t013-مجالات-التعاون": { kind: "text", tag: "h2", type: "text", label: "مجالات التعاون" },
  "t014-التبنّي-المنسّق-لتقنيات-ال": { kind: "text", tag: "li", type: "text", label: "التبنّي المنسّق لتقنيات الزراعة والغذاء على مستوى القطاع." },
  "t015-التبادل-العلمي-والبحثي-مع-": { kind: "text", tag: "li", type: "text", label: "التبادل العلمي والبحثي مع الشركاء المحليين والدوليين." },
  "t016-بناء-القدرات-البشرية-ونقل-": { kind: "text", tag: "li", type: "text", label: "بناء القدرات البشرية ونقل المعرفة." },
  "t017-التواصل": { kind: "text", tag: "p", type: "text", label: "التواصل" },
  "t018-تواصل-مع-هذه-الجهة-عبر-الت": { kind: "text", tag: "h2", type: "text", label: "تواصل مع هذه الجهة عبر التحالف" },
  "t019-تُوجَّه-الطلبات-المتعلقة-ب": { kind: "text", tag: "p", type: "long", label: "تُوجَّه الطلبات المتعلقة بهذه الجهة عبر أمانة التحالف، فنحيلها إلى جهة" },
  "t020-افتح-نموذج-التواصل": { kind: "text", tag: "span", type: "text", label: "افتح نموذج التواصل" },
  "t021-العودة-إلى-كل-المتحالفين": { kind: "text", tag: "span", type: "text", label: "العودة إلى كل الأعضاء" },
} as const satisfies FieldMap;

export const MEMBER_SECTIONS = [
  {
    key: "section-1",
    label: "ترويسة الصفحة",
    fields: ["t001-الرئيسية", "t002-الأعضاء", "t003-ملف-العضو"],
    cards: [],
  },
  {
    key: "section-2",
    label: "تفاصيل العضو",
    fields: [
      "t012-نبذة",
      "t013-مجالات-التعاون",
      "t014-التبنّي-المنسّق-لتقنيات-ال",
      "t015-التبادل-العلمي-والبحثي-مع-",
      "t016-بناء-القدرات-البشرية-ونقل-",
      "t017-التواصل",
      "t018-تواصل-مع-هذه-الجهة-عبر-الت",
      "t019-تُوجَّه-الطلبات-المتعلقة-ب",
      "t020-افتح-نموذج-التواصل",
      "t021-العودة-إلى-كل-المتحالفين",
    ],
    cards: [
      { key: "section-2::70", label: "الدور في التحالف", fields: ["t007-الدور-في-التحالف"] },
      { key: "section-2::73", label: "مجال التركيز", fields: ["t009-مجال-التركيز"] },
      { key: "section-2::76", label: "عضو منذ", fields: ["t011-عضو-منذ"] },
    ],
  },
] as const;

const MEMBER_PAGE = {
  label: "صفحة العضو",
  file: "member.html",
  apiBacked: true as const,
  fields: MEMBER_FIELDS,
  sections: MEMBER_SECTIONS,
};

export default MEMBER_PAGE;
