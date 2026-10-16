import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";

@Injectable()
export class WhatsAppAssistantPromptService {
  private readonly promptPath = join(__dirname, "prompts", "whatsapp-assistant.md");

  getPrompt(): string {
    try {
      const prompt = readFileSync(this.promptPath, "utf8").trim();
      if (!prompt) throw new Error("Prompt is empty");
      return prompt;
    } catch {
      throw new InternalServerErrorException("System prompt WhatsApp Assistant tidak tersedia di backend.");
    }
  }
}
