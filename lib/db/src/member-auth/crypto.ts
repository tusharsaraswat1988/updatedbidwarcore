import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a plaintext password using scrypt with a 16-byte random salt.
 * Returns format: salt:derivedKeyHex
 */
export async function hashMemberPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored scrypt hash.
 * Timing-safe against timing attacks.
 */
export async function verifyMemberPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuf = Buffer.from(key, "hex");
    if (derivedKey.length !== keyBuf.length) {
      timingSafeEqual(derivedKey, derivedKey);
      return false;
    }
    return timingSafeEqual(derivedKey, keyBuf);
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash for session tokens or sensitive opaque tokens.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
