import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api-client";

let socket: Socket | null = null;

/** One shared connection to the /dashboard namespace; auth rides on the httpOnly cookie (`withCredentials`). */
export function getDashboardSocket(): Socket {
  socket ??= io(`${API_URL}/dashboard`, {
    withCredentials: true,
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnectDashboardSocket() {
  socket?.disconnect();
  socket = null;
}
