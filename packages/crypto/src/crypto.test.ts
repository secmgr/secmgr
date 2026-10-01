import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "node:test";
import {
  DecryptError,
  dataKeyContext,
  generateDataKey,
  generateToken,
  hashToken,
  LocalMasterKey,
  masterKeyFromEnv,
  openShare,
  ProjectKey,
  randomString,
  sealForShare,
  tokensMatch,
} from "./index.ts";

const master = new LocalMasterKey(randomBytes(32).toString("base64"));
const where = { environmentId: "env-staging", secretId: "secret-1", version: 3 };

describe("master key", () => {
  test("wraps and unwraps a data key for its project", async () => {
    const dataKey = generateDataKey();
    const wrapped = await master.wrap(dataKey, dataKeyContext("p1", 1));
    assert.equal(wrapped.provider, "local");
    assert.equal(wrapped.keyId, master.keyId);
    assert.ok(!wrapped.wrapped.includes(dataKey));
    assert.deepEqual(await master.unwrap(wrapped, dataKeyContext("p1", 1)), dataKey);
  });

  test("refuses a data key moved to another project", async () => {
    const wrapped = await master.wrap(generateDataKey(), dataKeyContext("p1", 1));
    await assert.rejects(master.unwrap(wrapped, dataKeyContext("p2", 1)), DecryptError);
  });

  test("names the key it expected when another master key wrapped the data key", async () => {
    const other = new LocalMasterKey(randomBytes(32).toString("base64"));
    const wrapped = await other.wrap(generateDataKey(), "c");
    await assert.rejects(master.unwrap(wrapped, "c"), new RegExp(`wrapped by local key ${other.keyId}`));
  });

  test("reads SECMGR_MASTER_KEY and rejects short keys", () => {
    assert.throws(() => masterKeyFromEnv({}), /SECMGR_MASTER_KEY is not set/);
    assert.throws(() => masterKeyFromEnv({ SECMGR_MASTER_KEY: "c2hvcnQ=" }), /must be 32 random bytes/);
    assert.throws(() => masterKeyFromEnv({ SECMGR_KEY_PROVIDER: "aws", SECMGR_MASTER_KEY: "x" }), /not supported yet/);
    assert.equal(masterKeyFromEnv({ SECMGR_MASTER_KEY: randomBytes(32).toString("base64") }).provider, "local");
  });
});

describe("project key", () => {
  const dataKey = generateDataKey();
  const key = new ProjectKey("p1", 1, dataKey);

  test("encrypts a value and reads it back", () => {
    const sealed = key.encrypt("sk_live_51NxYz", where);
    assert.ok(!sealed.ciphertext.includes(Buffer.from("sk_live")));
    assert.equal(key.decrypt(sealed, where), "sk_live_51NxYz");
  });

  test("uses a fresh nonce for every value", () => {
    const a = key.encrypt("same", where);
    const b = key.encrypt("same", where);
    assert.notDeepEqual(a.nonce, b.nonce);
    assert.notDeepEqual(a.ciphertext, b.ciphertext);
  });

  test("keeps empty values and unicode intact", () => {
    for (const value of ["", "héllo wörld", "line 1\nline 2", "x".repeat(10_000)]) {
      assert.equal(key.decrypt(key.encrypt(value, where), where), value);
    }
  });

  test("refuses a ciphertext copied to another secret, environment, version or project", () => {
    const sealed = key.encrypt("secret", where);
    const moved = [
      { ...where, secretId: "secret-2" },
      { ...where, environmentId: "env-production" },
      { ...where, version: 4 },
    ];
    for (const context of moved) assert.throws(() => key.decrypt(sealed, context), DecryptError);
    assert.throws(() => new ProjectKey("p2", 1, dataKey).decrypt(sealed, where), DecryptError);
  });

  test("detects a changed byte", () => {
    const sealed = key.encrypt("secret", where);
    sealed.ciphertext[0] = (sealed.ciphertext[0] ?? 0) ^ 1;
    assert.throws(() => key.decrypt(sealed, where), DecryptError);
  });

  test("fingerprints match for equal values in one project only", () => {
    assert.equal(key.fingerprint("abc"), key.fingerprint("abc"));
    assert.notEqual(key.fingerprint("abc"), key.fingerprint("abd"));
    assert.match(key.fingerprint("abc"), /^[0-9a-f]{64}$/);
    const other = new ProjectKey("p2", 1, generateDataKey());
    assert.notEqual(key.fingerprint("abc"), other.fingerprint("abc"));
  });
});

describe("tokens", () => {
  test("look like smg_live_ and are stored only as a hash", () => {
    const { token, hash, prefix, suffix } = generateToken();
    assert.match(token, /^smg_live_[0-9A-Za-z]{40}$/);
    assert.equal(prefix, token.slice(0, 13));
    assert.equal(suffix, token.slice(-4));
    assert.equal(hash, hashToken(token));
    assert.ok(tokensMatch(token, hash));
    assert.ok(!tokensMatch(`${token}x`, hash));
  });

  test("never repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateToken().token));
    assert.equal(seen.size, 500);
  });

  test("random strings use every character of the alphabet evenly enough", () => {
    const counts = new Map<string, number>();
    for (const c of randomString(62_000)) counts.set(c, (counts.get(c) ?? 0) + 1);
    assert.equal(counts.size, 62);
    for (const count of counts.values()) assert.ok(count > 800 && count < 1200);
  });
});

describe("share links", () => {
  test("open with the key from the link and nothing else", () => {
    const shared = sealForShare("whsec_9f8e7d");
    assert.match(shared.key, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(openShare(shared.key, shared), "whsec_9f8e7d");
    assert.throws(() => openShare(sealForShare("x").key, shared), DecryptError);
  });

  test("open in the browser with WebCrypto", async () => {
    const shared = sealForShare("postgres://lumen:pw@db.internal:5432/lumen");
    const bytes = (b: Buffer) => new Uint8Array(b);
    const raw = bytes(Buffer.from(shared.key, "base64url"));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(shared.nonce) },
      key,
      bytes(shared.ciphertext),
    );
    assert.equal(new TextDecoder().decode(plain), "postgres://lumen:pw@db.internal:5432/lumen");
  });
});
