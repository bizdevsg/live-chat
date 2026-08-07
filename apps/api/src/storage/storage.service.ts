import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import { nanoid } from "nanoid";

export interface UploadedObject {
  storageKey: string;
  bucket: string;
}

/**
 * MinIO/S3 wrapper. Buckets are never made public (§33) — reads always go through
 * `getSignedUrl`, which issues a short-lived URL rather than exposing objects directly.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = new URL(this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000");
    this.client = new Client({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port) || (endpoint.protocol === "https:" ? 443 : 80),
      useSSL: endpoint.protocol === "https:",
      accessKey: this.config.get<string>("S3_ACCESS_KEY") ?? "",
      secretKey: this.config.get<string>("S3_SECRET_KEY") ?? "",
    });
    this.bucket = this.config.get<string>("S3_BUCKET") ?? "solidchat";
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, this.config.get<string>("S3_REGION") ?? "us-east-1");
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
    } catch (error) {
      this.logger.warn(`MinIO not reachable at startup (will retry lazily on first use): ${(error as Error).message}`);
    }
  }

  buildStorageKey(prefix: string, fileName: string): string {
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    return `${prefix}/${nanoid(24)}${ext}`;
  }

  async upload(storageKey: string, buffer: Buffer, mimeType: string): Promise<UploadedObject> {
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, { "Content-Type": mimeType });
    return { storageKey, bucket: this.bucket };
  }

  async getSignedDownloadUrl(storageKey: string, expirySeconds = 300): Promise<string> {
    return this.client.presignedGetObject(this.bucket, storageKey, expirySeconds);
  }

  async remove(storageKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, storageKey);
  }
}
