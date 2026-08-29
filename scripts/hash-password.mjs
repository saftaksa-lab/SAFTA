#!/usr/bin/env node
// Generates a scrypt hash for ADMIN_PASSWORD_HASH in .env.
//
// Usage:
//   npm run hash-password                  (interactive — recommended)
//   npm run hash-password -- 'MyP@ssword'  (leaves the password in shell history, avoid outside local testing)
//
// Node's readline has no input masking, so the interactive prompt echoes the
// password to the terminal. Run it in a private terminal and clear scrollback
// afterward if that matters to you.
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/lib/auth/password.mjs';

async function main() {
  const argPassword = process.argv[2];
  const password = argPassword ?? (await promptForPassword());

  if (!password) {
    console.error('No password provided.');
    process.exit(1);
  }

  const hash = hashPassword(password);
  console.log('\nPaste this into .env as ADMIN_PASSWORD_HASH:\n');
  console.log(hash);
  console.log();
}

async function promptForPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question('Password to hash: ');
  } finally {
    rl.close();
  }
}

main();
