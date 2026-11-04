/**
 * Placeholders agents can use in response templates, e.g. "{{greeting}}, saya {{agent}}".
 * They are resolved in the browser at the moment a template is inserted into the reply box;
 * the stored template keeps the raw placeholders. Unknown placeholders are left untouched.
 */

export interface TemplateContext {
  agentName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  now?: Date;
}

export interface TemplateVariable {
  key: string;
  description: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "agent", description: "Nama lengkap agent yang membalas", example: "Canka Monita" },
  { key: "agent_first", description: "Nama depan agent", example: "Canka" },
  { key: "customer", description: "Nama customer (jika belum diketahui: Bapak/Ibu)", example: "Budi Santoso" },
  { key: "customer_first", description: "Nama depan customer (jika belum diketahui: Bapak/Ibu)", example: "Budi" },
  { key: "customer_email", description: "Email customer", example: "budi@email.com" },
  { key: "customer_phone", description: "Nomor telepon customer", example: "08123456789" },
  { key: "greeting", description: "Salam sesuai jam: pagi, siang, sore, atau malam", example: "Selamat siang" },
  { key: "date", description: "Tanggal hari ini", example: "4 November 2026" },
  { key: "time", description: "Jam saat ini", example: "10.30" },
];

const CUSTOMER_FALLBACK = "Bapak/Ibu";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstName(value?: string) {
  return value ? value.split(/\s+/)[0] : undefined;
}

export function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour >= 4 && hour <= 10) return "Selamat pagi";
  if (hour >= 11 && hour <= 14) return "Selamat siang";
  if (hour >= 15 && hour <= 17) return "Selamat sore";
  return "Selamat malam";
}

export function renderTemplateVariables(content: string, context: TemplateContext): string {
  const now = context.now ?? new Date();
  const agent = clean(context.agentName);
  const customer = clean(context.customerName);

  const values: Record<string, string> = {
    agent: agent ?? "Agent",
    agent_first: firstName(agent) ?? "Agent",
    customer: customer ?? CUSTOMER_FALLBACK,
    customer_first: firstName(customer) ?? CUSTOMER_FALLBACK,
    customer_email: clean(context.customerEmail) ?? "-",
    customer_phone: clean(context.customerPhone) ?? "-",
    greeting: getGreeting(now),
    date: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  };

  return content.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => values[key.toLowerCase()] ?? match);
}
