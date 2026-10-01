import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { KEY_BYTES, open, type Sealed, seal } from "./aead.ts";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomString(length: number, alphabet = ALPHABET) {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit) out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export const TOKEN_PREFIX = "smg_";

export function generateToken(kind: "live" | "test" = "live") {
  const token = `${TOKEN_PREFIX}${kind}_${randomString(40)}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 13), suffix: token.slice(-4) };
}

export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export function tokensMatch(token: string, hash: string) {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SharedSecret = Sealed & { key: string };

export function sealForShare(value: string): SharedSecret {
  const key = randomBytes(KEY_BYTES);
  return { ...seal(key, Buffer.from(value, "utf8")), key: key.toString("base64url") };
}

export function openShare(key: string, sealed: Sealed) {
  return open(Buffer.from(key, "base64url"), sealed).toString("utf8");
}
