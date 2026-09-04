import { authTokenStore, type StoredAuthTokens } from "./auth-token-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId: string };
}

interface AuthTokensResponse extends StoredAuthTokens {
  expiresIn: number;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshPromise ??= fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: authTokenStore.getRefreshToken() ?? undefined }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = (await res.json().catch(() => ({}))) as ApiEnvelope<AuthTokensResponse>;
      if (!body.success || !body.data?.accessToken || !body.data?.refreshToken) return false;
      authTokenStore.setTokens({
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
      });
      return true;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const accessToken = authTokenStore.getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && retry && !path.includes("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, false);
  }

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || body.success === false) {
    if (response.status === 401) authTokenStore.clear();
    throw new ApiError(
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.message ?? "Terjadi kesalahan tak terduga.",
      response.status,
      body.error?.requestId,
    );
  }

  if ((path === "/api/v1/auth/login" || path === "/api/v1/auth/refresh") && body.data && typeof body.data === "object") {
    const authData = body.data as Partial<AuthTokensResponse>;
    if (authData.accessToken && authData.refreshToken) {
      authTokenStore.setTokens({
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    }
  }

  return body.data as T;
}

/**
 * Force a one-shot access-token refresh (deduped with any in-flight HTTP refresh).
 * Used by the socket layer so a rejected handshake can recover without a page reload.
 */
export async function refreshAccessToken(): Promise<boolean> {
  return tryRefresh();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};

export { API_URL };
