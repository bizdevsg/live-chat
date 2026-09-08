import { BadRequestException } from "@nestjs/common";

const IMAGE_SIGNATURES = {
  "image/png": (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/webp": (buffer: Buffer) => buffer.length >= 12 && buffer.subarray(0, 4).equals(Buffer.from("RIFF")) && buffer.subarray(8, 12).equals(Buffer.from("WEBP")),
} as const;

const IMAGE_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
} as const;

export type SupportedImageMimeType = keyof typeof IMAGE_SIGNATURES;

/** Reject a file whose declared MIME type does not match its actual image signature. */
export function assertValidImageUpload(file: Express.Multer.File | undefined): asserts file is Express.Multer.File & { mimetype: SupportedImageMimeType } {
  const mimeType = file?.mimetype as SupportedImageMimeType | undefined;
  if (!file || !mimeType || !(mimeType in IMAGE_SIGNATURES) || !IMAGE_SIGNATURES[mimeType](file.buffer)) {
    throw new BadRequestException("Upload hanya mendukung gambar PNG, JPEG, atau WEBP yang valid.");
  }
}

/** Storage keys use a trusted extension, never a user-controlled filename suffix. */
export function imageExtension(mimeType: SupportedImageMimeType): string {
  return IMAGE_EXTENSIONS[mimeType];
}
