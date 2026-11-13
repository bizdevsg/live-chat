import type { ChatTurn } from "@solidchat/shared";

export type HandoffAction = "NONE" | "OFFER" | "TRANSFER" | "OUT_OF_SCOPE";

const HUMAN_TARGET = String.raw`(?:manusia|orang\s+asli|agent|agen|cs|customer\s*service|petugas|operator|admin|staf|staff|human|live\s*agent)`;

/** The visitor explicitly asks for a person ("mau bicara dengan CS", "hubungkan ke agent", "talk to a human"). */
const HUMAN_REQUEST_PATTERN = new RegExp(
  String.raw`\b(?:bicara|berbicara|ngobrol|chat|bertemu|hubung\w*|sambung\w*|telp\w*|telepon\w*|panggil\w*|alih\w*|minta|mau|ingin|pengen|butuh|connect|transfer|talk|speak)\b.{0,30}\b${HUMAN_TARGET}\b`,
  "i",
);

const APPROVAL_WORD = String.raw`(?:iya+|ya+|y|ok(?:e|ay)?|baik|boleh|mau|setuju|silakan|silahkan|lanjut(?:kan)?|yes|yup|sure|tentu|gas)`;
const APPROVAL_FILLER = String.raw`(?:kak|min|dong|deh|aja|saja|tolong|please|banget|sekali)`;
/** The whole message is a short "yes" ("iya", "ya mau", "boleh kak", "setuju"). */
const APPROVAL_PATTERN = new RegExp(
  String.raw`^[\s,.!]*(?:${APPROVAL_WORD}[\s,.!]*)+(?:${APPROVAL_FILLER}[\s,.!]*)*$`,
  "i",
);

/** The AI's previous turn offered to connect the visitor to a person. */
const OFFER_TO_CONNECT_PATTERN = new RegExp(
  String.raw`(?:hubung\w*|sambung\w*|alih\w*|teruskan|connect|transfer)\b.{0,60}\b${HUMAN_TARGET}\b|\b${HUMAN_TARGET}\b.{0,60}(?:hubung\w*|sambung\w*|alih\w*|bantu)`,
  "i",
);

export function asksForHuman(message: string): boolean {
  return HUMAN_REQUEST_PATTERN.test(message);
}

/** True when `message` is a bare "yes" AND the AI turn right before it offered a handoff. */
export function approvesHandoffOffer(message: string, history: ChatTurn[]): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 40 || !APPROVAL_PATTERN.test(trimmed)) return false;

  let index = history.length - 1;
  // Skip the visitor message being answered, then any system notes, to find the AI turn it replies to.
  while (index >= 0 && (history[index]?.senderType === "VISITOR" || history[index]?.senderType === "CUSTOMER")) index -= 1;
  while (index >= 0 && history[index]?.senderType === "SYSTEM") index -= 1;
  const previous = history[index];
  if (!previous || previous.senderType !== "AI") return false;
  return previous.content.includes("?") && OFFER_TO_CONNECT_PATTERN.test(previous.content);
}

export interface HandoffResolution {
  classifierAction: HandoffAction;
  finalAction: HandoffAction;
  overriddenByEvidence: boolean;
  evidenceCount: number;
}

/**
 * The classifier decides handoff WITHOUT seeing the knowledge base, so it over-offers agents for
 * questions the KB can answer. When retrieval found evidence, only an explicit request for a person
 * (or a "yes" to the AI's own earlier offer) keeps a TRANSFER; OFFER / OUT_OF_SCOPE / unrequested
 * TRANSFER fall through to the normal answer path. With no evidence the classifier's action stands.
 */
export function resolveHandoffAction(input: {
  classifierAction: HandoffAction;
  evidenceCount: number;
  message: string;
  history: ChatTurn[];
}): HandoffResolution {
  const { classifierAction, evidenceCount, message, history } = input;
  const base = { classifierAction, evidenceCount };
  if (/(jaminan profit|pasti untung|garansi profit)/i.test(message) && !asksForHuman(message)) {
    return { ...base, finalAction: "NONE", overriddenByEvidence: classifierAction !== "NONE" };
  }
  if (classifierAction === "NONE" || evidenceCount === 0) {
    return { ...base, finalAction: classifierAction, overriddenByEvidence: false };
  }
  if (classifierAction === "TRANSFER" && (asksForHuman(message) || approvesHandoffOffer(message, history))) {
    return { ...base, finalAction: "TRANSFER", overriddenByEvidence: false };
  }
  return { ...base, finalAction: "NONE", overriddenByEvidence: true };
}
