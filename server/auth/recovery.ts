import { randomInt } from 'node:crypto';
import { z } from 'zod';

/** Same rule as sign-up. */
export const newPasswordSchema = z.string().min(10, 'Use at least 10 characters').max(200);

/** No 0/O, 1/I/L or U/V look-alikes: easy to copy by hand. 20 characters ≈ 98 bits. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
const LENGTH = 20;

/** A new code, shown as XXXXX-XXXXX-XXXXX-XXXXX. Only its scrypt hash is stored. */
export function newRecoveryCode(): string {
  let s = '';
  for (let i = 0; i < LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s.match(/.{5}/g)!.join('-');
}

/** Forgiving about case, spaces and dashes; the hash is of this normalized form. */
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
