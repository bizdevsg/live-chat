import type { AnswerInput } from "@solidchat/shared";

type SmallTalkKind = "GREETING" | "CAPABILITIES" | "IDENTITY" | "THANKS" | "FAREWELL";

const SMALL_TALK_RULES: Array<{ kind: SmallTalkKind; pattern: RegExp }> = [
  { kind: "THANKS", pattern: /^(terima kasih|makasih|thanks|thank you)\b/i },
  { kind: "FAREWELL", pattern: /^(bye|dadah|sampai jumpa|selamat tinggal)\b/i },
  { kind: "IDENTITY", pattern: /^(siapa kamu|anda siapa|who are you|kamu siapa)\b/i },
  {
    kind: "CAPABILITIES",
    pattern: /^(bisa bantu apa|kamu bisa apa|apa yang bisa kamu bantu|help|bantuan|what can you do)\b/i,
  },
  { kind: "GREETING", pattern: /^(halo|hallo|hai|hi|hello|pagi|siang|sore|malam)\b/i },
];

function detectSmallTalkKind(message: string): SmallTalkKind | null {
  const normalized = message.trim();
  if (!normalized) return null;
  return SMALL_TALK_RULES.find((rule) => rule.pattern.test(normalized))?.kind ?? null;
}

function buildIndonesianReply(kind: SmallTalkKind, input: AnswerInput): string {
  switch (kind) {
    case "THANKS":
      return `Sama-sama. Jika ada pertanyaan lain seputar layanan ${input.organizationName}, silakan sampaikan ya.`;
    case "FAREWELL":
      return `Baik, sampai jumpa. Jika nanti Anda membutuhkan bantuan lagi, saya ${input.aiName} siap membantu.`;
    case "IDENTITY":
      return `Saya ${input.aiName}, asisten virtual resmi ${input.organizationName}. Saya dapat membantu informasi umum seputar layanan, registrasi, biaya, aplikasi, dan panduan penggunaan, lalu menghubungkan Anda ke petugas jika diperlukan.`;
    case "CAPABILITIES":
      return `Saya ${input.aiName} dapat membantu informasi umum seputar registrasi akun, panduan aplikasi atau platform, biaya, deposit atau withdrawal secara umum, serta pertanyaan layanan dasar lainnya. Jika pertanyaannya membutuhkan pengecekan khusus, saya akan bantu hubungkan ke petugas.`;
    case "GREETING":
    default:
      return `Halo, saya ${input.aiName}, asisten virtual resmi ${input.organizationName}. Saya bisa membantu informasi umum seputar layanan, registrasi, aplikasi, biaya, dan panduan penggunaan. Ada yang ingin Anda tanyakan?`;
  }
}

function buildEnglishReply(kind: SmallTalkKind, input: AnswerInput): string {
  switch (kind) {
    case "THANKS":
      return `You're welcome. If you have other questions about ${input.organizationName}, feel free to ask.`;
    case "FAREWELL":
      return `Alright, see you. If you need help again later, I am here to assist.`;
    case "IDENTITY":
      return `I am ${input.aiName}, the official virtual assistant for ${input.organizationName}. I can help with general information about services, registration, fees, apps, and usage guidance, then connect you to a human agent if needed.`;
    case "CAPABILITIES":
      return `I can help with general information about account registration, app or platform guidance, fees, general deposit or withdrawal information, and other basic service questions. If your case needs a manual check, I can connect you to a human agent.`;
    case "GREETING":
    default:
      return `Hello, I am ${input.aiName}, the official virtual assistant for ${input.organizationName}. I can help with general information about services, registration, apps, fees, and usage guidance. What would you like to ask?`;
  }
}

export function buildSmallTalkReply(input: AnswerInput): { answer: string; confidence: number } | null {
  const kind = detectSmallTalkKind(input.message);
  if (!kind) return null;

  return {
    answer: input.language === "en" ? buildEnglishReply(kind, input) : buildIndonesianReply(kind, input),
    confidence: 0.96,
  };
}
