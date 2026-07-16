import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashScorerPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyScorerPin(pin: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = (await scryptAsync(pin, salt, 64)) as Buffer;
    return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}
