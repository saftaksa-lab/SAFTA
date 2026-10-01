/**
 * Content import/export CLI.
 *
 *   node scripts/content.ts export [file]       # defaults to stdout
 *   node scripts/content.ts import <file>       # transactional; validates first
 *   node scripts/content.ts import <file> --dry-run
 *   node scripts/content.ts reset --yes          # wipe all content and uploaded media
 *
 * There is no `seed` command yet: SAFTA's `content/` folder still holds the legacy
 * JSON store. A fresh database starts from each singleton's initial value, and the
 * collections stay empty until the legacy import (Phase 4 of the port) fills them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { exportContent, importContent, resetContent } from '../src/lib/content/io.ts';

const [command, ...rest] = process.argv.slice(2);
const dryRun = rest.includes('--dry-run');
const confirmed = rest.includes('--yes');
const fileArg = rest.find((a) => !a.startsWith('--'));

function readEnvelope(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new Error(`Could not read ${path}: ${String(cause)}`);
  }
}

function describe(path: string, report: ReturnType<typeof importContent>) {
  const verb = report.dryRun ? 'Would import' : 'Imported';
  console.log(`[content] ${verb} ${path}:`);
  for (const s of report.singletons) {
    const note = s.migrated ? ` (migrated ${s.from} -> ${s.to})` : '';
    console.log(`  singleton ${s.key}${note}`);
  }
  console.log(`  events: ${report.events}`);
  console.log(`  working groups: ${report.workingGroups}`);
  console.log(`  articles: ${report.articles}`);
  console.log(`  members: ${report.members}`);
  console.log(`  media: ${report.media}`);
  for (const key of report.skippedSingletons) {
    console.log(`  skipped unknown singleton "${key}" — not a surface this build knows`);
  }
  if (report.missingBlobs.length) {
    console.warn(
      `  warning: ${report.missingBlobs.length} media file(s) are not under UPLOAD_PATH yet. ` +
        'The rows imported; copy the files across (rsync data/uploads/) to resolve them:',
    );
    for (const id of report.missingBlobs) console.warn(`    ${id}`);
  }
  for (const ref of report.danglingMedia) {
    console.warn(
      `  warning: ${ref.key} ${ref.path} references media ${ref.id}, which has no row — ` +
        'the page shows placeholder artwork there.',
    );
  }
}

switch (command) {
  case 'export': {
    const json = JSON.stringify(exportContent(), null, 2) + '\n';
    if (fileArg) {
      writeFileSync(fileArg, json);
      console.log(`[content] Exported to ${fileArg}.`);
    } else {
      process.stdout.write(json);
    }
    break;
  }

  case 'import': {
    if (!fileArg) throw new Error('Usage: node scripts/content.ts import <file> [--dry-run]');
    describe(fileArg, importContent(readEnvelope(fileArg), { dryRun }));
    break;
  }

  case 'reset': {
    if (!confirmed) {
      throw new Error(
        'This deletes every singleton, event, working group, article, member, and ' +
          'uploaded media file. Re-run with --yes to confirm: node scripts/content.ts reset --yes',
      );
    }
    const report = resetContent();
    console.log('[content] Reset:');
    console.log(`  singletons: ${report.singletons}`);
    console.log(`  events: ${report.events}`);
    console.log(`  working groups: ${report.workingGroups}`);
    console.log(`  articles: ${report.articles}`);
    console.log(`  members: ${report.members}`);
    console.log(`  media rows: ${report.media} (${report.mediaFilesDeleted} file(s) deleted)`);
    break;
  }

  default:
    throw new Error(`Unknown command "${command ?? ''}". See the header of this file.`);
}

process.exit(0);
