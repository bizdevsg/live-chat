import { io, type Socket } from "socket.io-client";
import { API_URL, refreshAccessToken } from "./api-client";
import { authTokenStore } from "./auth-token-store";

let socket: Socket | null = null;
let refreshingForSocket = false;

/**
 * One shared connection to the /dashboard namespace. Auth is a Bearer access token read
 * from localStorage. The token is short-lived, so `auth` is a callback — socket.io invokes
 * it on every (re)connection attempt, always picking up the freshest token (the HTTP layer
 * keeps it rotated). If a handshake is still rejected (token expired between calls), refresh
 * once and let the automatic reconnect retry with the new token — no page reload needed.
 */
export function getDashboardSocket(): Socket {
  if (socket) return socket;

  socket = io(`${API_URL}/dashboard`, {
    auth: (cb) => cb({ accessToken: authTokenStore.getAccessToken() ?? undefined }),
    withCredentials: true,
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect_error", async () => {
    if (refreshingForSocket) return;
    refreshingForSocket = true;
    try {
      await refreshAccessToken();
    } finally {
      refreshingForSocket = false;
    }
  });

  return socket;
}

export function disconnectDashboardSocket() {
  socket?.disconnect();
  socket = null;
}
