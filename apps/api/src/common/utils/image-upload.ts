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

const PDF_MIME_TYPE = "application/pdf";
export type SupportedAttachmentMimeType = SupportedImageMimeType | typeof PDF_MIME_TYPE;

/** PDF readers tolerate a few junk bytes before the header, so look for "%PDF-" in the first 1 KiB. */
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
}

/** Chat attachments: images (PNG/JPEG/WEBP) or PDF. Avatars keep using the image-only check above. */
export function assertValidAttachmentUpload(file: Express.Multer.File | undefined): asserts file is Express.Multer.File & { mimetype: SupportedAttachmentMimeType } {
  if (file?.mimetype === PDF_MIME_TYPE) {
    if (!isPdf(file.buffer)) throw new BadRequestException("File PDF tidak valid.");
    return;
  }
  if (!file || !(file.mimetype in IMAGE_SIGNATURES) || !IMAGE_SIGNATURES[file.mimetype as SupportedImageMimeType](file.buffer)) {
    throw new BadRequestException("Upload hanya mendukung gambar PNG, JPEG, WEBP, atau file PDF yang valid.");
  }
}

/** Storage key file name: `image.png` or `document.pdf` — extension is trusted, never from the upload name. */
export function attachmentStorageName(mimeType: SupportedAttachmentMimeType): string {
  return mimeType === PDF_MIME_TYPE ? "document.pdf" : `image${imageExtension(mimeType)}`;
}

/** PDFs go out as FILE messages; images stay IMAGE. */
export function attachmentMessageType(mimeType: SupportedAttachmentMimeType): "FILE" | "IMAGE" {
  return mimeType === PDF_MIME_TYPE ? "FILE" : "IMAGE";
}
