import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const PIN_RE = /^\d{4,8}$/;

export function makeSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashPin(pin: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
