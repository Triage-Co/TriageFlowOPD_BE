import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

/** Hash PIN (scrypt). Never send the hash to clients. */
export async function hashDisplayPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(pin, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyDisplayPin(
  pin: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hex] = parts;
  if (!salt || !hex) return false;
  const derived = (await scrypt(pin, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
