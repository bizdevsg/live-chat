"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CRM_SSO_ENABLED = process.env.NEXT_PUBLIC_CRM_SSO_ENABLED === "true";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bagian B: kalau callback SSO Clara gagal, tampilkan pesan generik saja — detail penyebab ada
  // di log server (dicari lewat requestId), bukan di sini. Dibaca langsung dari location.search
  // (bukan useSearchParams) supaya halaman ini tidak perlu dibungkus <Suspense>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ssoError") === "1") {
      const requestId = params.get("requestId");
      setError(
        `Login dengan Clara gagal. Coba lagi, atau hubungi admin${requestId ? ` (kode: ${requestId})` : ""}.`,
      );
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login gagal.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-gold-500">SolidChat AI</div>
          <p className="mt-1 text-sm text-zinc-500">Dashboard Admin &amp; CS — Solid Gold Berjangka</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={showPassword}
                title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-400 transition hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500/60"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Memproses…" : "Masuk"}
          </Button>
        </form>
        {CRM_SSO_ENABLED && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              atau
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
            <a href={`${API_URL}/api/v1/auth/clara/login`}>
              <Button type="button" variant="secondary" className="w-full">
                Masuk dengan Clara
              </Button>
            </a>
          </>
        )}
        <div className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/forgot-password" className="hover:text-gold-500">
            Lupa password?
          </Link>
        </div>
      </Card>
    </div>
  );
}
