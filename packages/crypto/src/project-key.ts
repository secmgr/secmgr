import { createHmac, hkdfSync } from "node:crypto";
import { open, type Sealed, seal } from "./aead.ts";

export type SecretContext = { projectId: string; environmentId: string; secretId: string; version: number };

const secretAad = ({ projectId, environmentId, secretId, version }: SecretContext) =>
  Buffer.from(`secmgr:secret:v1|${projectId}|${environmentId}|${secretId}|${version}`);

export const dataKeyContext = (projectId: string, version: number) => `project:${projectId}:v${version}`;

export class ProjectKey {
  readonly projectId: string;
  readonly version: number;
  readonly #dataKey: Buffer;
  readonly #fingerprintKey: Buffer;

  constructor(projectId: string, version: number, dataKey: Buffer) {
    this.projectId = projectId;
    this.version = version;
    this.#dataKey = dataKey;
    this.#fingerprintKey = Buffer.from(hkdfSync("sha256", dataKey, Buffer.alloc(0), "secmgr:fingerprint:v1", 32));
  }

  encrypt(value: string, context: Omit<SecretContext, "projectId">): Sealed {
    return seal(this.#dataKey, Buffer.from(value, "utf8"), secretAad({ projectId: this.projectId, ...context }));
  }

  decrypt(sealed: Sealed, context: Omit<SecretContext, "projectId">): string {
    return open(this.#dataKey, sealed, secretAad({ projectId: this.projectId, ...context })).toString("utf8");
  }

  fingerprint(value: string) {
    return createHmac("sha256", this.#fingerprintKey).update(value, "utf8").digest("hex");
  }
}
