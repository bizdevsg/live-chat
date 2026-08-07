"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient.get<AuthUser>("/api/v1/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (query.isSuccess) setUser(query.data);
    if (query.isError) setUser(null);
    if (query.isPending) setStatus("loading");
  }, [query.isSuccess, query.isError, query.isPending, query.data, setUser, setStatus]);

  return query;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => apiClient.post("/api/v1/auth/login", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });
}

export function useLogout() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout"),
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
