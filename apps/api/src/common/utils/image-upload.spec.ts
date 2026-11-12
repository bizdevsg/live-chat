import { BadRequestException } from "@nestjs/common";
import { assertValidAttachmentUpload, assertValidImageUpload, attachmentMessageType, attachmentStorageName } from "./image-upload";

const file = (mimetype: string, buffer: Buffer) => ({ mimetype, buffer }) as Express.Multer.File;

describe("attachment upload validation", () => {
  const pdf = file("application/pdf", Buffer.from("%PDF-1.7\n%...."));

  it("accepts a real PDF as a FILE message with a trusted .pdf key", () => {
    expect(() => assertValidAttachmentUpload(pdf)).not.toThrow();
    expect(attachmentMessageType("application/pdf")).toBe("FILE");
    expect(attachmentStorageName("application/pdf")).toBe("document.pdf");
  });

  it("rejects a file declared as PDF without a PDF header", () => {
    expect(() => assertValidAttachmentUpload(file("application/pdf", Buffer.from("<html>")))).toThrow(BadRequestException);
  });

  it("keeps images as IMAGE messages", () => {
    const png = file("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(() => assertValidAttachmentUpload(png)).not.toThrow();
    expect(attachmentMessageType("image/png")).toBe("IMAGE");
  });

  it("rejects other types", () => {
    expect(() => assertValidAttachmentUpload(file("application/zip", Buffer.from("PK")))).toThrow(BadRequestException);
  });

  it("still rejects PDF for image-only uploads such as avatars", () => {
    expect(() => assertValidImageUpload(pdf)).toThrow(BadRequestException);
  });
});
