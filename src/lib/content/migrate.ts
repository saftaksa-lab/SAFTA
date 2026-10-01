/**
 * Runs singleton payloads up their migration ladder.
 *
 * Pure and side-effect free: the callers that persist the result are
 * `scripts/migrate-content.ts` (for rows already in the database) and
 * `io.ts` (for records arriving from an older export).
 */
import type { AnySingleton } from './schemas/index.ts';

export class ContentMigrationError extends Error {}

/**
 * Applies every migration between `fromVersion` and the definition's current
 * version, then validates the result. Returns the parsed, current-version payload.
 */
export function upgrade(def: AnySingleton, fromVersion: number, data: unknown): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new ContentMigrationError(
      `${def.key}: schema version must be a positive integer, got ${fromVersion}.`,
    );
  }

  if (fromVersion > def.version) {
    throw new ContentMigrationError(
      `${def.key}: payload is version ${fromVersion} but this build only understands ` +
        `version ${def.version}. It was written by a newer version of the app — ` +
        `upgrade the app rather than downgrading the data.`,
    );
  }

  let current = data;
  for (let v = fromVersion; v < def.version; v += 1) {
    const step = def.migrations[v - 1];
    if (!step) {
      throw new ContentMigrationError(`${def.key}: missing migration from version ${v}.`);
    }
    try {
      current = step(current);
    } catch (cause) {
      throw new ContentMigrationError(
        `${def.key}: migration from version ${v} to ${v + 1} failed: ${String(cause)}`,
      );
    }
  }

  const parsed = def.schema.safeParse(current);
  if (!parsed.success) {
    throw new ContentMigrationError(
      `${def.key}: payload does not match version ${def.version} after migration: ` +
        parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}

/** True when a stored row is behind the shape this build expects. */
export function needsUpgrade(def: AnySingleton, storedVersion: number): boolean {
  return storedVersion < def.version;
}
