import { Injectable } from "@nestjs/common";
import { AiIntent, HandoffReason, type ClassificationResult } from "@solidchat/shared";

const RULES: Array<{ reason: HandoffReason; test: (message: string, classification: ClassificationResult) => boolean }> = [
  { reason: HandoffReason.PROMPT_INJECTION_DETECTED, test: (_m, c) => c.promptInjectionDetected },
  { reason: HandoffReason.SENSITIVE_DATA_DETECTED, test: (_m, c) => c.containsSensitiveData },
  { reason: HandoffReason.SUSPECTED_FRAUD, test: (m) => /(penipuan|fraud|scam|dugaan tipu)/i.test(m) },
  { reason: HandoffReason.LEGAL_THREAT, test: (m) => /(polisi|somasi|tuntut|pengacara|lapor hukum)/i.test(m) },
  // Login / locked-account / forgot-password rules removed: the knowledge base has its own login
  // troubleshooting flow and the site prompt decides when to offer CS (see fix/handoff-evidence-first).
  { reason: HandoffReason.DEPOSIT_ISSUE, test: (m, c) => c.intent === AiIntent.DEPOSIT && /(belum masuk|gagal|bermasalah|pending)/i.test(m) },
  {
    reason: HandoffReason.WITHDRAWAL_ISSUE,
    // Narrowed to actual complaint phrasing (§bugfix: "berapa lama withdraw?" was
    // false-positiving on the bare "lama"/"pending" tokens and forcing an unwanted
    // handoff for a plain duration question the AI could answer from the knowledge base).
    test: (m, c) => c.intent === AiIntent.WITHDRAWAL && /(belum (masuk|cair|diproses)|gagal|bermasalah|kok lama|sudah.*lama)/i.test(m),
  },
  { reason: HandoffReason.TRANSACTION_DISPUTE, test: (m) => /(selisih dana|transaksi (salah|tidak sesuai)|dispute)/i.test(m) },
  { reason: HandoffReason.PERSONAL_DATA_CHANGE, test: (m) => /(ubah (data|nomor|email) (pribadi|akun)|ganti (nomor hp|email))/i.test(m) },
  { reason: HandoffReason.DOCUMENT_VERIFICATION, test: (m) => /(verifikasi (dokumen|ktp|npwp)|upload ktp)/i.test(m) },
  { reason: HandoffReason.PROFIT_GUARANTEE_REQUEST, test: (m) => /(jaminan profit|pasti untung|garansi profit)/i.test(m) },
  { reason: HandoffReason.BUY_SELL_REQUEST, test: (m) => /(saya (mau|ingin) (beli|jual|buy|sell)|order (buy|sell))/i.test(m) },
  { reason: HandoffReason.PERSONAL_TRADING_DECISION, test: (m) => /(sebaiknya saya (beli|jual)|rekomendasi (buy|sell) untuk saya)/i.test(m) },
  { reason: HandoffReason.SECURITY_RISK, test: (m) => /(akun saya diretas|kena hack|transaksi tidak saya lakukan)/i.test(m) },
  {
    reason: HandoffReason.ANGRY_CUSTOMER,
    test: (_m, c) => c.sentiment === "ANGRY",
  },
  {
    reason: HandoffReason.SERIOUS_COMPLAINT,
    test: (_m, c) => c.intent === AiIntent.COMPLAINT && c.sentiment === "NEGATIVE",
  },
];

/**
 * Deterministic handoff-trigger matcher for the topics that must always escalate (§18).
 * Runs in addition to (not instead of) the AI's own confidence threshold.
 */
@Injectable()
export class HandoffEvaluatorService {
  evaluate(message: string, classification: ClassificationResult): HandoffReason | null {
    const matched = RULES.find((rule) => rule.test(message, classification));
    return matched?.reason ?? null;
  }
}
