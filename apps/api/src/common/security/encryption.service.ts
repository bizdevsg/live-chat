import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

/** AES-256-GCM at-rest encryption for integration credentials (§28, §31). Never returns plaintext once stored. */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>("ENCRYPTION_KEY") ?? "";
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  maskForDisplay(_plaintext: string): string {
    return "••••••••";
  }
}
