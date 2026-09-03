const ACCESS_TOKEN_KEY = "solidchat_dashboard_access_token";
const REFRESH_TOKEN_KEY = "solidchat_dashboard_refresh_token";

function canUseStorage() {
  return typeof window !== "undefined";
}

export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const authTokenStore = {
  getAccessToken() {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens: StoredAuthTokens) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
