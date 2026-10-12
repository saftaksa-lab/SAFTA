/**
 * The singleton registry. Adding a surface means adding it here — the migration
 * script, the export envelope and the cache all iterate this object, so nothing
 * else needs to learn about a new key.
 */
import {
  homeHero,
  homeDiscover,
  homeChallengesIntro,
  challenges,
  homeAwards,
  homePartners,
} from './home.ts';
import {
  aboutHero,
  aboutMission,
  aboutGlance,
  aboutRoles,
  aboutChallengesIntro,
  aboutFoundingStatement,
} from './about.ts';
import {
  technologiesBanner,
  technologiesIntro,
  mediaBanner,
  articleChrome,
  membersBanner,
  membersIntro,
  membersMap,
  memberChrome,
} from './listings.ts';
import {
  contactHero,
  contactInfo,
  registerHero,
  registerInfo,
} from './forms.ts';
import { reportsBanner, reportsIntro, reportsList } from './reports.ts';
import type { SingletonDefinition } from './types.ts';

/** Iteration type. The payload generic is erased because the surfaces differ. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySingleton = SingletonDefinition<any>;

export const singletons = {
  home_hero: homeHero,
  home_discover: homeDiscover,
  home_challenges_intro: homeChallengesIntro,
  challenges,
  home_awards: homeAwards,
  home_partners: homePartners,
  about_hero: aboutHero,
  about_mission: aboutMission,
  about_glance: aboutGlance,
  about_roles: aboutRoles,
  about_challenges_intro: aboutChallengesIntro,
  about_founding_statement: aboutFoundingStatement,
  technologies_banner: technologiesBanner,
  technologies_intro: technologiesIntro,
  media_banner: mediaBanner,
  article_chrome: articleChrome,
  members_banner: membersBanner,
  members_intro: membersIntro,
  members_map: membersMap,
  member_chrome: memberChrome,
  reports_banner: reportsBanner,
  reports_intro: reportsIntro,
  reports_list: reportsList,
  contact_hero: contactHero,
  contact_info: contactInfo,
  register_hero: registerHero,
  register_info: registerInfo,
} as const;

export type SingletonKey = keyof typeof singletons;

/**
 * Surfaces that no longer exist. `npm run content:migrate` deletes their rows, and
 * an import skips them. Keep a key here once it is retired, so an old database
 * still gets cleaned up.
 */
export const RETIRED_SINGLETONS: readonly string[] = [
  // October 2026: both forms became HubSpot embeds (src/components/HubSpotForm.astro).
  'contact_form',
  'register_form',
];
export type SingletonData<K extends SingletonKey> = (typeof singletons)[K]['initial'];

export const singletonList: AnySingleton[] = Object.values(singletons);

/** Narrows an arbitrary string — a route param, an import envelope key — to a known surface. */
export function isSingletonKey(value: string): value is SingletonKey {
  return Object.prototype.hasOwnProperty.call(singletons, value);
}

// A key that disagrees with its definition would read one row and write another.
for (const [key, def] of Object.entries(singletons)) {
  if (def.key !== key) throw new Error(`Singleton registered as "${key}" declares key "${def.key}".`);
}

export type { SingletonDefinition };
