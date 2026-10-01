/**
 * The contract every editable singleton surface declares.
 *
 * `version` is the shape the code expects right now. `migrations` upgrades older
 * payloads to it: entry `i` takes a version `i + 1` payload and returns a version
 * `i + 2` one, so `migrations.length + 1 === version` always holds — the registry
 * asserts it at module load.
 *
 * Changing a shape means bumping `version` and *appending* a migration. Never edit
 * or drop an existing one: an export taken before the change must still import
 * (docs/content-storage.md#import-and-export).
 */
import type { ZodType } from 'zod';

export interface SingletonDefinition<T = unknown> {
  key: string;
  version: number;
  schema: ZodType<T>;
  migrations: Array<(data: unknown) => unknown>;
  /** Used to seed the row when it does not exist yet. Must satisfy `schema`. */
  initial: T;
}

/** Helper that preserves the payload type through the definition. */
export function defineSingleton<T>(def: SingletonDefinition<T>): SingletonDefinition<T> {
  if (def.migrations.length !== def.version - 1) {
    throw new Error(
      `Singleton "${def.key}" declares version ${def.version} but has ` +
        `${def.migrations.length} migration(s); expected ${def.version - 1}.`,
    );
  }
  return def;
}
