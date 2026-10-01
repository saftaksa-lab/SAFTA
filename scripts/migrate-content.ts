/**
 * Brings every singleton row up to the schema version this build expects, and
 * inserts rows for surfaces that do not have one yet.
 *
 * Runs in `npm run setup`, immediately after `db:migrate`, so the app may assume
 * current-version content everywhere. Migration is eager on purpose: migrating
 * lazily on read would mean every read path carries version branches forever.
 *
 * Idempotent — safe to run on every start.
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { contentSingleton } from '../src/db/content-schema.ts';
import { singletonList } from '../src/lib/content/schemas/index.ts';
import { upgrade, needsUpgrade } from '../src/lib/content/migrate.ts';
import { ensureSingletons } from '../src/lib/content/repo.ts';

const created = ensureSingletons();
for (const key of created) {
  console.log(`[content] Created "${key}" at its initial value.`);
}

let migrated = 0;
db.transaction((tx) => {
  for (const def of singletonList) {
    const row = tx
      .select()
      .from(contentSingleton)
      .where(eq(contentSingleton.key, def.key))
      .get();
    if (!row || !needsUpgrade(def, row.schemaVersion)) continue;

    const data = upgrade(def, row.schemaVersion, row.data);
    tx.update(contentSingleton)
      .set({ schemaVersion: def.version, data, updatedAt: new Date() })
      .where(eq(contentSingleton.key, def.key))
      .run();

    console.log(`[content] Migrated "${def.key}" ${row.schemaVersion} -> ${def.version}.`);
    migrated += 1;
  }
});

if (!created.length && !migrated) {
  console.log('[content] All singletons are at their current version — nothing to do.');
}

process.exit(0);
