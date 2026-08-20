import { create } from "zustand";
import type { Permission } from "@/lib/permissions";
import type { UserAccountSettings } from "@/lib/account-settings";

export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  accountSettings: UserAccountSettings;
}

interface AuthState {
  user: AuthUser | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  hasPermission: (...permissions: Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setStatus: (status) => set({ status }),
  hasPermission: (...permissions) => {
    const user = get().user;
    if (!user) return false;
    return permissions.some((p) => user.permissions.includes(p));
  },
}));
