// Hand-written, not `generate-page-schema.mjs` output: that generator reads/writes
// content/<page>.json, but content/members.json is already the _members collection's data
// file (src/lib/content/collections/members.ts) — this page's own copy is kept in
// content/members-page.json instead (see `contentFile` below and store.ts's getContentFile).
import type { FieldMap } from './codec';

export const MEMBERS_FIELDS = {
  "t001-الرئيسية": { kind: "text", tag: "a", type: "text", label: "الرئيسية" },
  "t002-الأعضاء": { kind: "text", tag: "h1", type: "text", label: "الأعضاء" },
  "t003-جهات-حكومية-وأكاديمية-ومن-": { kind: "text", tag: "p", type: "long", label: "جهات حكومية وأكاديمية ومن القطاع الخاص وغير ربحية تعمل معًا في تقنيات " },
  "t004-التحالف": { kind: "text", tag: "p", type: "text", label: "التحالف" },
  "t005-الأعضاء": { kind: "text", tag: "h2", type: "text", label: "الأعضاء" },
  "t006-جهات-حكومية-ومؤسسات-أكاديم": { kind: "text", tag: "p", type: "long", label: "جهات حكومية ومؤسسات أكاديمية وشركات من القطاع الخاص ومنظمات غير ربحية " },
} as const satisfies FieldMap;

export const MEMBERS_SECTIONS = [
  {
    key: "section-1",
    label: "ترويسة الصفحة",
    fields: ["t001-الرئيسية", "t002-الأعضاء", "t003-جهات-حكومية-وأكاديمية-ومن-"],
    cards: [],
  },
  {
    key: "section-2",
    label: "بطاقات الأعضاء",
    fields: ["t004-التحالف", "t005-الأعضاء", "t006-جهات-حكومية-ومؤسسات-أكاديم"],
    cards: [],
  },
] as const;

const MEMBERS_PAGE = {
  label: "الأعضاء",
  file: "members.html",
  apiBacked: true as const,
  contentFile: "members-page.json",
  fields: MEMBERS_FIELDS,
  sections: MEMBERS_SECTIONS,
};

export default MEMBERS_PAGE;
