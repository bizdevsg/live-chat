import sanitizeHtml from "sanitize-html";
import { parse as parseCsv } from "csv-parse/sync";
import { BadRequestException } from "@nestjs/common";

/** Extracts plain text from an uploaded knowledge document per §20's supported formats. */
export async function extractTextFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "text/csv" || lowerName.endsWith(".csv")) {
    const rows = parseCsv(buffer, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    return rows
      .map((row) => {
        const question = row.question ?? row.Question ?? row.pertanyaan ?? "";
        const answer = row.answer ?? row.Answer ?? row.jawaban ?? "";
        return question && answer ? `Q: ${question}\nA: ${answer}` : Object.values(row).join(" — ");
      })
      .join("\n\n");
  }

  if (mimeType === "text/html" || lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
    const html = buffer.toString("utf-8");
    return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return buffer.toString("utf-8");
  }

  throw new BadRequestException(`Format file tidak didukung: ${mimeType || fileName}`);
}
