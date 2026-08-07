const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || body.success === false) {
    throw new ApiError(body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Terjadi kesalahan.");
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: "GET" }, token),
  post: <T>(path: string, data?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }, token),
};

export { API_URL };
