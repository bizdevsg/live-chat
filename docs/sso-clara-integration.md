---
title: "Kesiapan & Kontrak Integrasi SSO — Live Chat sebagai Klien Clara"
author: "Tim Live Chat"
date: "7 September 2026"
---

# SSO Clara → Dashboard Live Chat — Sisi Live Chat

**Versi dokumen:** 1.0
**Status:** Diimplementasikan di kode, belum diuji end-to-end (menunggu client secret & redirect URI final)
**Sumber kebutuhan:** *CLARA · Live Chat — Unified Specification* v1.0 (3 September 2026), Bagian B

## 1. Ringkasan

Live Chat sudah mengimplementasikan sisi OAuth 2.0 *client* (Authorization Code + PKCE) untuk
login agent ke Dashboard memakai akun Clara. Dokumen ini melengkapi spesifikasi Tim Clara dengan
detail konkret dari sisi Live Chat: endpoint yang dibuat, apa yang divalidasi, dan apa yang masih
dibutuhkan dari Tim Clara sebelum pengujian end-to-end bisa dimulai.

## 2. Endpoint yang dibuat di Live Chat

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/auth/clara/login` | Memulai login: membuat `state`/`nonce`/PKCE, redirect ke `{issuer}/oauth/authorize` |
| GET | `/api/v1/auth/clara/callback` | Menerima `code`+`state`, menukar token, memvalidasi ID token, membuat session Dashboard |

Base path mengikuti API Live Chat yang sudah ada (`/api/v1/auth/...`), bukan root atau `/login` —
sesuai ketentuan Bagian B.

## 3. Redirect URI yang perlu didaftarkan di Clara

Nilai *exact* (termasuk skema, host, path, tanpa trailing slash) tergantung environment:

```text
Staging    : https://<domain-staging-live-chat>/api/v1/auth/clara/callback
Production : https://<domain-production-live-chat>/api/v1/auth/clara/callback
```

Domain final belum ditentukan (lihat `docs/crm-integration.md`, bagian "Yang masih menunggu").
Untuk pengujian sementara di local/Docker Compose, host tersedia di `api-chat.local` — silakan
minta Tim Live Chat menyediakan tunnel HTTPS sementara kalau diperlukan pengujian lintas jaringan
sebelum domain tetap tersedia (bukan pengganti permanen, sama seperti prinsip yang sudah dipakai
Tim Clara untuk `trycloudflare.com`).

## 4. Apa yang divalidasi Live Chat pada ID token

Sesuai Bagian B "Validasi ID Token":

- Algoritma **hanya HS256** — token dengan `alg` lain ditolak, tidak "dipercaya" dari header.
- Signature diverifikasi pakai `CRM_SSO_CLIENT_SECRET` (client secret yang sama dengan yang
  dipakai menukar `code` di `/oauth/token`).
- `iss` harus sama persis dengan `CRM_SSO_ISSUER` yang dikonfigurasi.
- `aud` harus sama dengan `CRM_SSO_CLIENT_ID` (`live-chat-dashboard`).
- `exp` diperiksa otomatis oleh library JWT.
- `nonce` harus sama dengan nilai yang Live Chat kirim saat `/oauth/authorize`.
- `isActive` harus `true`.
- `organizationId` harus ada; kalau `CRM_SSO_ALLOWED_ORGANIZATION_ID` dikonfigurasi, harus cocok.
- `role` harus termasuk daftar `CRM_SSO_ALLOWED_ROLES` (default: `sales,manager,head,superadmin`).

## 5. Pemetaan identitas — akun dibuat otomatis dari Clara

Sesuai niat integrasi ini, Live Chat **tidak mengharuskan akun dibuat manual dulu**. Urutannya:

1. Klaim `sub` dicari di `users.clara_user_id` (Live Chat). Kalau ketemu dan akun aktif → login
   berhasil, session Dashboard dibuat.
2. Kalau belum ada yang tertaut, Live Chat mencari akun aktif dengan `email` yang sama dengan
   klaim `email` ID token. Kalau ketemu → `clara_user_id` akun itu diisi dengan `sub` (tautan
   permanen, sekali saja), lalu login lanjut seperti poin 1.
3. Kalau tidak ada akun Live Chat yang cocok sama sekali → **Live Chat membuat akun baru
   otomatis**, dengan role hasil pemetaan `claims.role` lewat `CRM_SSO_ROLE_MAP` (default:
   `sales→cs_agent, manager→supervisor, head→admin, superadmin→super_admin`). Nama & email diisi
   dari ID token; tidak ada password lokal (hash acak) sampai di-set manual lewat "lupa password".
4. Kalau `clara_user_id` akun yang cocok ternyata sudah tertaut ke `sub` lain, atau akun (lama
   maupun baru dicocokkan) nonaktif, atau role Clara tidak ada di `CRM_SSO_ROLE_MAP` → login
   ditolak dengan pesan generik (yang terakhir ini kesalahan konfigurasi, bukan ditebak rolenya).

Implikasinya buat Tim Clara: pastikan klaim `email` di ID token selalu terisi dan valid (dipakai
untuk pencocokan/penamaan akun baru), dan `role` selalu salah satu dari
`sales`/`manager`/`head`/`superadmin` seperti yang sudah didokumentasikan.

## 6. Session & cookie

Session yang dibuat dari login SSO identik dengan session dari login email/password biasa —
cookie `access_token` (15 menit) dan `refresh_token` (30 hari, scoped ke `/api/v1/auth`),
`HttpOnly; Secure; SameSite=Lax` (atau `SameSite=None` kalau lintas origin dan HTTPS). TTL ini
mengikuti konfigurasi login biasa (`JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN`) — Live Chat
belum menetapkan TTL khusus terpisah untuk sesi hasil SSO; ini salah satu keputusan yang masih
terbuka (lihat §7).

## 7. Yang masih dibutuhkan dari Tim Clara / keputusan internal

- [ ] `CRM_SSO_CLIENT_SECRET` — dikirim lewat kanal rahasia, bukan email/chat/dokumen.
- [ ] Konfirmasi redirect URI staging & production final dari Live Chat sudah didaftarkan exact
      match di sisi Clara.
- [ ] Kesepakatan `CRM_SSO_ALLOWED_ORGANIZATION_ID` (organizationId Clara yang sah untuk agent
      Live Chat) — opsional, tapi disarankan diisi sebagai defense-in-depth.
- [ ] Keputusan Live Chat: session TTL Dashboard eksplisit untuk sesi SSO, kalau perlu berbeda
      dari login biasa.
- [ ] Validasi operasional: apakah pemetaan role default (`sales→cs_agent, manager→supervisor,
      head→admin, superadmin→super_admin`) sudah sesuai kebutuhan nyata, atau perlu disesuaikan
      lewat `CRM_SSO_ROLE_MAP` sebelum dipakai production.
- [ ] Technical contact kedua tim (§10 `CRM-Integration-Guide.md`).
- [ ] Pengujian end-to-end & negative test bersama (checklist staging di spesifikasi Clara,
      halaman 23) setelah empat poin pertama selesai.

## 8. Konfigurasi Live Chat (referensi)

```dotenv
CRM_SSO_ISSUER=https://crm.sg-berjangka.com/api
CRM_SSO_CLIENT_ID=live-chat-dashboard
CRM_SSO_CLIENT_SECRET=<dari Tim Clara, lewat kanal rahasia>
CRM_SSO_REDIRECT_URI=https://<domain-live-chat>/api/v1/auth/clara/callback
CRM_SSO_ALLOWED_ROLES=sales,manager,head,superadmin
CRM_SSO_ALLOWED_ORGANIZATION_ID=
CRM_SSO_STATE_TTL_SECONDS=600
CRM_SSO_POST_LOGIN_PATH=/dashboard
CRM_SSO_DEFAULT_ORGANIZATION_SLUG=solid-gold
CRM_SSO_ROLE_MAP=sales:cs_agent,manager:supervisor,head:admin,superadmin:super_admin
NEXT_PUBLIC_CRM_SSO_ENABLED=false   # ganti ke true di Dashboard setelah §7 selesai
```

## 9. Kontak

```text
PIC Tim Live Chat : (isi)
PIC Tim Clara     : (isi)
```
