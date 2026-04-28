import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5; // 10 hex chars per code

/**
 * Generates a set of one-time backup codes (plain text).
 * Returns both the plain codes (to show the user once) and their bcrypt hashes (to store).
 */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(BACKUP_CODE_BYTES).toString('hex'),
  );
  const hashed = await Promise.all(plain.map((code) => bcrypt.hash(code, 10)));
  return { plain, hashed };
}

/**
 * Checks whether a provided backup code matches any stored hash.
 * Returns the index of the matched code, or -1 if none match.
 */
export async function findMatchingBackupCode(provided: string, hashes: string[]): Promise<number> {
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(provided, hashes[i])) return i;
  }
  return -1;
}
