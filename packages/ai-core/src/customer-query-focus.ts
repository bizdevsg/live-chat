import { AiIntent } from "@solidchat/shared";

const CUSTOMER_SERVICE_TOPIC_PATTERN =
  /\b(?:deposit|setor|top ?up|withdraw(?:al)?|tarik dana|penarikan|akun|registrasi|daftar|verifikasi|biaya|fee|komisi|platform|mt4|mt5|aplikasi|mobile ?app|keamanan|security|2fa|cabang|kantor|alamat|customer service|petugas|gold futures|solid gold)\b/i;

const TECHNICAL_REQUEST_VERB_PATTERN =
  /\b(?:buatkan|buat|bikin|tuliskan|generate|write|create|develop|bangun|susunkan|hitungkan|calculate|berikan|show)\b/i;

const TECHNICAL_ARTIFACT_PATTERN =
  /\b(?:script|skrip|code|kode|python|javascript|typescript|java|sql|query|regex|html|css|json|array|function|class|program|algoritma|algorithm|moving average|indicator|backtest|excel formula)\b/i;

const MIXED_REQUEST_SPLIT_PATTERN = /\b(?:tapi|namun|sebelum itu|sebelumnya|before that|however|but)\b|[.!?;\n]+/i;

export function hasCustomerServiceTopic(message: string): boolean {
  return CUSTOMER_SERVICE_TOPIC_PATTERN.test(message);
}

export function hasOutOfScopeTechnicalRequest(message: string): boolean {
  return TECHNICAL_REQUEST_VERB_PATTERN.test(message) && TECHNICAL_ARTIFACT_PATTERN.test(message);
}

export function shouldPrioritizeCustomerServiceSubrequest(message: string, intent: AiIntent): boolean {
  const classifiedAsServiceIntent = intent !== AiIntent.GENERAL_INQUIRY && intent !== AiIntent.OTHER;
  return hasOutOfScopeTechnicalRequest(message) && (classifiedAsServiceIntent || hasCustomerServiceTopic(message));
}

export function extractCustomerServiceQuery(message: string, intent: AiIntent): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized || !shouldPrioritizeCustomerServiceSubrequest(normalized, intent)) return normalized;

  const focusedSegments = normalized
    .split(MIXED_REQUEST_SPLIT_PATTERN)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .filter((segment) => hasCustomerServiceTopic(segment) && !hasOutOfScopeTechnicalRequest(segment));

  if (focusedSegments.length > 0) {
    return focusedSegments.join(". ").replace(/[,\s]+$/, "");
  }

  const technicalMatch = normalized.match(TECHNICAL_ARTIFACT_PATTERN);
  if (technicalMatch && technicalMatch.index !== undefined) {
    const head = normalized.slice(0, technicalMatch.index).trim().replace(/[,\s]+$/, "");
    if (head && hasCustomerServiceTopic(head)) return head;
  }

  return normalized;
}
