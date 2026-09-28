const DEFAULT_OFFICIAL_SOURCE_HOSTS = ["sg-berjangka.com"];

export function parseOfficialSourceHosts(value?: string | null): string[] {
  const hosts = value
    ?.split(",")
    .map((host) => host.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  return hosts?.length ? [...new Set(hosts)] : DEFAULT_OFFICIAL_SOURCE_HOSTS;
}

export function normalizeOfficialSourceUrl(value: string | null | undefined, allowedHosts: string[]): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL sumber resmi tidak valid.");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("URL sumber resmi wajib menggunakan HTTPS tanpa kredensial.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (!allowed) {
    throw new Error(`Domain URL sumber tidak diizinkan. Gunakan domain resmi: ${allowedHosts.join(", ")}.`);
  }

  return trimmed;
}
