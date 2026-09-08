# Integrasi CRM — Status Implementasi

Dokumen ini menjelaskan endpoint `GET /api/v1/conversations` yang dipakai CRM untuk mengambil
data conversation dari Live Chat, dan bagaimana implementasi ini berbeda dari draf "Kebutuhan
API Live Chat dan SSO Dashboard untuk Integrasi Clara" v1.1.

## Keputusan: lookup by agent email, bukan full incremental sync

Draf v1.1 (§3–§12) awalnya mendeskripsikan pola **pull penuh**: `updated_after`/`cursor`,
mengambil semua conversation yang berubah lalu Clara menyimpan salinannya sendiri. Sempat
diimplementasikan sesuai draf tersebut, tapi kebutuhan aktual dari Tim CRM (dikonfirmasi via
email terpisah, bukan dokumen ini) ternyata berbeda: **lookup on-demand per agent**, bukan sync
massal. Endpoint saat ini sudah disesuaikan ke kebutuhan itu.

Implikasinya, bagian-bagian berikut di draf v1.1 **tidak berlaku** untuk endpoint saat ini:
`updated_after`/`cursor`/pagination (§5, §10), kontrak `senderClaraUserId`/`assignee.claraUserId`
(§8A, §9 — CRM belum melakukan SSO ke Live Chat, jadi belum ada identitas Clara yang bisa
dipetakan), dan bentuk response `{data, pagination}` (§6 — dipakai envelope standar
`{success, data}`).

Kalau nanti Tim CRM tetap butuh full incremental sync (bukan cuma lookup per-agent), draf v1.1
masih relevan sebagai kontrak acuan dan bisa diimplementasikan sebagai endpoint terpisah tanpa
mengganggu endpoint lookup-by-email ini.

## Kontrak endpoint saat ini

```http
GET /api/v1/conversations?email=agent@example.com
Authorization: Bearer <LIVE_CHAT_API_KEY>
Accept: application/json
```

- `email` (wajib): email agent Live Chat. Mengembalikan semua conversation yang di-assign ke
  atau pernah ditangani agent tersebut (array, tanpa pagination).
- `site_id` (kondisional): `Site.siteKey`. Wajib diisi hanya jika API key yang dipakai punya
  akses ke lebih dari satu site.

```http
GET /api/v1/conversations/{conversationId}
Authorization: Bearer <LIVE_CHAT_API_KEY>
```

Detail satu conversation: seluruh message (tanpa internal note / draft AI), summary, ticket,
dan lead terkait.

### Autentikasi & scoping (tetap berlaku dari draf §4, §4.1)

- Header `Authorization: Bearer <API_KEY>` atau `x-api-key: <API_KEY>`.
- Satu credential idealnya satu site, dikonfigurasi via env `CRM_API_KEYS`:
  ```json
  [{ "key": "<API_KEY_UNTUK_CRM>", "siteIds": ["solid-gold-main"], "label": "crm-prod" }]
  ```
- `CRM_INBOUND_API_KEY`/`CRM_API_KEY` tetap didukung sebagai fallback lama (akses ke semua
  site — tidak direkomendasikan untuk kredensial baru).
- Request dengan `site_id` di luar scope credential ditolak `403 FORBIDDEN`.
- Response error konsisten: `{"error":{"code":"...","message":"..."}}` — lihat daftar kode di
  `docs/api.md`.

## SSO Dashboard Live Chat via akun Clara — status per 7 September 2026

> **Koreksi:** bagian ini sebelumnya menyatakan *"CRM belum bertindak sebagai OAuth/OIDC
> provider, jadi flow login agent lewat CRM belum bisa dibangun"* — seolah Live Chat menunggu
> Clara. Setelah menerima *"CLARA · Live Chat — Unified Specification"* v1.0 (3 September 2026)
> dari Tim Clara, ternyata sebaliknya: endpoint SSO Clara **sudah aktif di production** dan lulus
> smoke test (discovery, proteksi token, allowlist redirect URI). Yang sebenarnya ditunggu adalah
> callback dari sisi Live Chat. Catatan lama di atas sudah usang dan digantikan bagian ini.

Sisi Live Chat (consumer/client OAuth) sekarang sudah diimplementasikan:

- `GET /api/v1/auth/clara/login` — memulai login: membuat `state`/`nonce`/PKCE (S256), menyimpan
  sementara di Redis (TTL `CRM_SSO_STATE_TTL_SECONDS`, default 600 detik), lalu redirect ke
  `{CRM_SSO_ISSUER}/oauth/authorize`.
- `GET /api/v1/auth/clara/callback` — memvalidasi `state` (sekali pakai), menukar `code` ke
  `/oauth/token` dengan `code_verifier`, memvalidasi ID token (HS256, `iss`/`aud`/`exp`/`nonce`,
  `isActive`, `organizationId`, `role` sesuai `CRM_SSO_ALLOWED_ROLES`), lalu membuat session
  Dashboard biasa (cookie `access_token`/`refresh_token`, sama seperti login email/password) dan
  redirect agent ke `CRM_SSO_POST_LOGIN_PATH`. Kegagalan apa pun redirect ke halaman login dengan
  pesan generik + `requestId` korelasi — tidak pernah membocorkan detail ke user maupun log.
- Kolom `users.clara_user_id` kini diisi otomatis saat login SSO pertama seorang agent, dengan
  mencocokkan **email** ID token ke akun Live Chat yang sudah ada dan aktif. Setelah tertaut,
  `claraUserId` (klaim `sub`) menjadi satu-satunya sumber kebenaran identitas untuk login
  berikutnya — email tidak dipakai lagi sesudah tautan pertama itu.
- **Akun agent dibuat otomatis saat login pertama** — sesuai niat awal integrasi ini: akun agent
  datang dari Clara, jadi Live Chat tidak perlu proses "buat user dulu" secara manual. Kalau
  `claraUserId` maupun email dari ID token belum cocok dengan akun manapun, Live Chat langsung
  membuat akun baru dengan role hasil pemetaan `CRM_SSO_ROLE_MAP` (default:
  `sales→cs_agent, manager→supervisor, head→admin, superadmin→super_admin`) di bawah organization
  `CRM_SSO_DEFAULT_ORGANIZATION_SLUG`. Role Clara yang diizinkan (`CRM_SSO_ALLOWED_ROLES`) tapi
  tidak ada di peta dianggap kesalahan konfigurasi — login ditolak, bukan ditebak rolenya. Akun
  baru tidak punya password lokal (hash acak) sampai seseorang sengaja pakai "lupa password".

Detail kontrak endpoint, urutan pekerjaan, dan checklist penerimaan ada di
`docs/sso-clara-integration.md` — dokumen itu yang dikirim ke Tim Clara.

### Yang masih menunggu sebelum bisa diuji end-to-end

- **Client secret** (`CRM_SSO_CLIENT_SECRET`) dari Tim Clara, lewat kanal rahasia — belum ada di
  `.env` manapun.
- **Redirect URI staging & production** yang stabil dari Live Chat, didaftarkan ke Clara secara
  *exact match* (§16). Saat ini belum ada domain staging/production tetap.
- **Keputusan produk**: pemetaan role default di atas belum divalidasi dengan operasional
  sebenarnya (misalnya apakah semua "sales" Clara memang setara `cs_agent` di semua tim), dan
  session TTL Dashboard (`JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` saat ini dipakai apa
  adanya — belum ada keputusan eksplisit khusus untuk sesi hasil SSO).
- **Technical contact** kedua tim (§10 `CRM-Integration-Guide.md` masih placeholder).

## Full incremental sync (`updated_after`/`cursor`)

Lihat catatan di bagian "Keputusan: lookup by agent email" di atas; belum dibutuhkan untuk kasus
pakai saat ini, tapi desainnya (draf v1.1) sudah pernah divalidasi dan siap dipakai kalau
kebutuhannya muncul lagi.
