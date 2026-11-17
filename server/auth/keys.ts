import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Key for encrypting integration tokens at rest (AES-256-GCM).
 * Uses APP_ENCRYPTION_KEY when set (recommended for any shared deployment).
 * Otherwise a random key is generated once and kept in a separate file
 * next to the database, so a copied database file alone doesn't expose tokens.
 */
export function resolveEncryptionKey(envKey: string | undefined, keyFile: string): string {
  if (envKey) {
    if (Buffer.from(envKey, 'base64').length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
    return envKey;
  }
  if (existsSync(keyFile)) {
    const key = readFileSync(keyFile, 'utf8').trim();
    if (Buffer.from(key, 'base64').length === 32) return key;
    throw new Error(`${keyFile} is not a valid key. Delete it to generate a new one (connected integrations will need reconnecting).`);
  }
  mkdirSync(dirname(keyFile), { recursive: true });
  const key = randomBytes(32).toString('base64');
  writeFileSync(keyFile, key, { mode: 0o600 });
  try {
    chmodSync(keyFile, 0o600);
  } catch {
    /* Windows ignores POSIX modes; the file is inside the user's own profile folder */
  }
  return key;
}
