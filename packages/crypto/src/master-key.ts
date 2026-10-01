import { createHash, randomBytes } from "node:crypto";
import { KEY_BYTES, open, seal } from "./aead.ts";

export type WrappedKey = { wrapped: Buffer; provider: string; keyId: string };

export interface MasterKey {
  readonly provider: string;
  readonly keyId: string;
  wrap(dataKey: Buffer, context: string): Promise<WrappedKey>;
  unwrap(key: WrappedKey, context: string): Promise<Buffer>;
}

const wrapAad = (context: string) => Buffer.from(`secmgr:data-key:v1|${context}`);

export class LocalMasterKey implements MasterKey {
  readonly provider = "local";
  readonly keyId: string;
  readonly #key: Buffer;

  constructor(base64: string) {
    const key = Buffer.from(base64.trim(), "base64");
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `SECMGR_MASTER_KEY must be ${KEY_BYTES} random bytes in base64. Generate one with: openssl rand -base64 32`,
      );
    }
    this.#key = key;
    this.keyId = createHash("sha256").update(key).digest("hex").slice(0, 16);
  }

  async wrap(dataKey: Buffer, context: string): Promise<WrappedKey> {
    const { ciphertext, nonce } = seal(this.#key, dataKey, wrapAad(context));
    return { wrapped: Buffer.concat([nonce, ciphertext]), provider: this.provider, keyId: this.keyId };
  }

  async unwrap({ wrapped, provider, keyId }: WrappedKey, context: string): Promise<Buffer> {
    if (provider !== this.provider || keyId !== this.keyId) {
      throw new Error(
        `This data key was wrapped by ${provider} key ${keyId}, but the server has ${this.provider} key ${this.keyId}`,
      );
    }
    return open(this.#key, { nonce: wrapped.subarray(0, 12), ciphertext: wrapped.subarray(12) }, wrapAad(context));
  }
}

export function masterKeyFromEnv(env: Record<string, string | undefined> = process.env): MasterKey {
  const provider = env.SECMGR_KEY_PROVIDER || "local";
  if (provider !== "local") throw new Error(`SECMGR_KEY_PROVIDER "${provider}" is not supported yet. Use "local"`);
  const key = env.SECMGR_MASTER_KEY;
  if (!key) throw new Error("SECMGR_MASTER_KEY is not set. Generate one with: openssl rand -base64 32");
  return new LocalMasterKey(key);
}

export const generateDataKey = () => randomBytes(KEY_BYTES);
