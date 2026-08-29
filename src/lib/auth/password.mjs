import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Changing these invalidates every hash already stored in .env — regenerate
// ADMIN_PASSWORD_HASH with `npm run hash-password` if you touch them.
const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;

  let salt, storedHash;
  try {
    salt = Buffer.from(saltHex, 'hex');
    storedHash = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (storedHash.length !== SCRYPT_KEYLEN) return false;

  const computed = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return timingSafeEqual(computed, storedHash);
}
