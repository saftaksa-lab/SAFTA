import { readJsonCachedWithRevision, writeJsonAtomic } from './json-file';

/**
 * Site-wide feature flags, separate from the per-page content schema in ./schema — these
 * toggle whole sections on or off rather than editing text, so they don't fit the
 * text/image FieldMap that schema/codec.ts validates against.
 */
export interface SiteSettings {
  hideAwards: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = { hideAwards: false };
const FILE = 'settings.json';

class MissingSettingsError extends Error {}

/**
 * Unlike page content, settings.json isn't seeded — a fresh checkout with no file just
 * means every flag is at its default, so a missing file is not an error here.
 */
export async function getSiteSettingsWithRevision(): Promise<{ data: SiteSettings; rev: string }> {
  try {
    const { data, rev } = await readJsonCachedWithRevision<Partial<SiteSettings>>(
      FILE,
      () => new MissingSettingsError(),
    );
    return { data: { ...DEFAULT_SETTINGS, ...data }, rev };
  } catch (err) {
    if (err instanceof MissingSettingsError) return { data: DEFAULT_SETTINGS, rev: 'default' };
    throw err;
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return (await getSiteSettingsWithRevision()).data;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<{ data: SiteSettings; rev: string }> {
  const current = await getSiteSettings();
  const next: SiteSettings = { ...current, ...patch };
  const rev = await writeJsonAtomic(FILE, next);
  return { data: next, rev };
}
