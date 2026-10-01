import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptError extends Error {
  constructor(message = "The value could not be decrypted. The data or its context was changed") {
    super(message);
  }
}

export type Sealed = { ciphertext: Buffer; nonce: Buffer };

export function seal(key: Buffer, plaintext: Buffer, aad?: Buffer): Sealed {
  if (key.length !== KEY_BYTES) throw new Error(`Keys must be ${KEY_BYTES} bytes`);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext, nonce };
}

export function open(key: Buffer, { ciphertext, nonce }: Sealed, aad?: Buffer): Buffer {
  if (key.length !== KEY_BYTES) throw new Error(`Keys must be ${KEY_BYTES} bytes`);
  if (nonce.length !== NONCE_BYTES || ciphertext.length < TAG_BYTES) throw new DecryptError();
  const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - TAG_BYTES));
  try {
    return Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - TAG_BYTES)), decipher.final()]);
  } catch {
    throw new DecryptError();
  }
}
