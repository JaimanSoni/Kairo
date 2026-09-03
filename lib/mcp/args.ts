import { ToolFail } from "./fail";

/**
 * Reading arguments off a model's tool call.
 *
 * Every miss throws a ToolFail whose message is written to be read by the
 * model that made the mistake — "estimateMin must be minutes, between 0 and
 * 1440" gets a corrected retry, "invalid input" gets the same call again.
 */

export type Args = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function optString(args: Args, key: string, max = 500): string | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new ToolFail(`${key} must be a string.`);
  if (v.length > max) throw new ToolFail(`${key} is too long (max ${max} characters).`);
  return v;
}

export function reqString(args: Args, key: string, max = 500): string {
  const v = optString(args, key, max);
  if (v === undefined || !v.trim()) throw new ToolFail(`${key} is required.`);
  return v;
}

/** Distinguishes "absent" from "explicitly null" — clearing a field needs both. */
export function nullableString(args: Args, key: string, max = 500): string | null | undefined {
  if (!(key in args) || args[key] === undefined) return undefined;
  if (args[key] === null) return null;
  return optString(args, key, max);
}

export function optDate(args: Args, key: string): string | undefined {
  const v = optString(args, key, 10);
  if (v === undefined) return undefined;
  if (!DATE_RE.test(v)) throw new ToolFail(`${key} must be a date like 2026-09-04.`);
  if (!isRealDate(v)) throw new ToolFail(`${key} is not a real date.`);
  return v;
}

export function nullableDate(args: Args, key: string): string | null | undefined {
  if (!(key in args) || args[key] === undefined) return undefined;
  if (args[key] === null) return null;
  return optDate(args, key);
}

export function optTime(args: Args, key: string): string | undefined {
  const v = optString(args, key, 5);
  if (v === undefined) return undefined;
  if (!TIME_RE.test(v)) throw new ToolFail(`${key} must be a 24-hour time like 18:30.`);
  return v;
}

export function nullableTime(args: Args, key: string): string | null | undefined {
  if (!(key in args) || args[key] === undefined) return undefined;
  if (args[key] === null) return null;
  return optTime(args, key);
}

export function optBool(args: Args, key: string): boolean | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new ToolFail(`${key} must be true or false.`);
  return v;
}

export function optInt(args: Args, key: string, min: number, max: number): number | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ToolFail(`${key} must be a number.`);
  const n = Math.round(v);
  if (n < min || n > max) throw new ToolFail(`${key} must be between ${min} and ${max}.`);
  return n;
}

export function nullableInt(
  args: Args,
  key: string,
  min: number,
  max: number
): number | null | undefined {
  if (!(key in args) || args[key] === undefined) return undefined;
  if (args[key] === null) return null;
  return optInt(args, key, min, max);
}

export function optEnum<T extends string>(args: Args, key: string, allowed: readonly T[]): T | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw new ToolFail(`${key} must be one of: ${allowed.join(", ")}.`);
  }
  return v as T;
}

export function reqEnum<T extends string>(args: Args, key: string, allowed: readonly T[]): T {
  const v = optEnum(args, key, allowed);
  if (v === undefined) throw new ToolFail(`${key} is required and must be one of: ${allowed.join(", ")}.`);
  return v;
}

export function optStringArray(args: Args, key: string, max: number, itemMax = 500): string[] | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ToolFail(`${key} must be an array of strings.`);
  if (v.length > max) throw new ToolFail(`${key} holds at most ${max} entries.`);
  return v.map((item, i) => {
    if (typeof item !== "string") throw new ToolFail(`${key}[${i}] must be a string.`);
    if (item.length > itemMax) throw new ToolFail(`${key}[${i}] is too long (max ${itemMax}).`);
    return item;
  });
}

export function optObjectArray(args: Args, key: string, max: number): Args[] | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new ToolFail(`${key} must be an array of objects.`);
  if (v.length > max) throw new ToolFail(`${key} holds at most ${max} entries.`);
  return v.map((item, i) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new ToolFail(`${key}[${i}] must be an object.`);
    }
    return item as Args;
  });
}

export function reqEmail(args: Args, key: string): string {
  const v = reqString(args, key, 320).trim().toLowerCase();
  // deliberately loose: the invite path does the real validation, and a
  // stricter guess here only rejects addresses that actually work
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ToolFail(`${key} must be a full email address.`);
  return v;
}

/** Rejects 2026-02-31 — the regex alone cannot. */
export function isRealDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
