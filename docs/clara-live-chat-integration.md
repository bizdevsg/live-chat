# Integrasi Clara CRM ↔ Live Chat

Dokumen ini mencatat implementasi sisi Live Chat untuk kontrak Clara Live Chat Lead Intake v1.1.

## 1. Live Chat → Clara: webhook percakapan

Setiap perubahan percakapan yang relevan dijadwalkan ke antrean `clara-webhook`. Perubahan dalam jendela 7,5 detik digabungkan sebelum snapshot terbaru dikirim. Payload berisi maksimal 1.000 pesan terbaru dan tidak pernah memuat pesan `SYSTEM`, internal note, AI suggestion, pesan terhapus, atau attachment biner.

Konfigurasi:

```dotenv
CLARA_WEBHOOK_URL=https://crm.sg-berjangka.com/api/webhooks/live-chat/events
CLARA_WEBHOOK_SITE_CONFIGS=[{"siteKey":"solid-gold-main","claraSiteId":"<id-dari-Clara>","secret":"<minimal-32-karakter>"}]
```

`siteKey` adalah `Site.siteKey` lokal. `claraSiteId` dikirim sebagai `X-Clara-Site-Id`. Setiap percobaan menghitung ulang timestamp dan HMAC-SHA256 dari byte body yang sama persis dengan yang dikirim.

Respons `200` dianggap sukses, termasuk status Clara `duplicate`. Respons `401`, `413`, `415`, dan `422` gagal permanen. `429`, `503`, dan `5xx` dicoba kembali dengan exponential backoff dari 5 detik sampai 15 menit, sekitar 24 jam, serta menghormati `Retry-After` sampai 15 menit.

## 2. Clara → Live Chat: SSO yang sudah ada

Live Chat tetap menjadi OIDC client Clara melalui:

- Login: `GET /api/v1/auth/clara/login`
- Callback: `GET /api/v1/auth/clara/callback`
- Redirect URI production yang disarankan: `https://api-chat.sg-berjangka.com/api/v1/auth/clara/callback`
- Role map default: `sales→cs_agent`, `manager→supervisor`, `head→admin`, `superadmin→super_admin`

Konfigurasi lengkap tetap berada di `docs/sso-clara-integration.md`.

## 3. Live Chat → Clara: Live Chat sebagai OIDC provider

Issuer harus berupa base API tanpa trailing slash, misalnya `https://api-chat.sg-berjangka.com/api/v1`. Endpoint yang diberikan kepada Clara:

- Discovery: `{issuer}/.well-known/openid-configuration`
- Authorize: `{issuer}/oauth/authorize`
- Token: `{issuer}/oauth/token`
- Userinfo: `{issuer}/oauth/userinfo`

Provider hanya mendukung Authorization Code, PKCE `S256`, client authentication HTTP Basic, dan ID token `HS256`. Authorization code disimpan dalam bentuk key hash di Redis, hanya dapat dipakai sekali, dan berlaku maksimal 120 detik. Respons token memakai `Cache-Control: no-store`.

```dotenv
LIVE_CHAT_OIDC_ISSUER=https://api-chat.sg-berjangka.com/api/v1
LIVE_CHAT_OIDC_CLIENT_ID=clara-crm
LIVE_CHAT_OIDC_CLIENT_SECRET=<minimal-32-karakter-random>
LIVE_CHAT_OIDC_REDIRECT_URI=https://<dashboard-clara>/api/auth/live-chat/callback
LIVE_CHAT_OIDC_ALLOWED_ROLES=cs_agent,supervisor,admin,super_admin
```

Jika agent belum login, authorize mengarahkan browser ke login Dashboard dengan `returnTo` yang dibatasi ke endpoint authorize milik API. Tombol SSO Clara disembunyikan pada alur ini untuk mencegah loop.

## 4. Identitas extension

Dashboard menerbitkan token agent khusus extension melalui:

- `POST /api/v1/auth/extension-token` — menerbitkan token 15 menit.
- `DELETE /api/v1/auth/extension-token` — mencabut seluruh token extension agent tersebut.

Token memakai audience `solidchat-extension` dan secret terpisah dari token Dashboard. Setiap request memeriksa versi pencabutan di Redis dan status aktif user di database.

Extension mengirim snapshot hasil pembacaan platform ke:

```http
POST /api/v1/extension/{whatsapp|instagram|tiktok}/snapshots
Authorization: Bearer <extension-token>
```

Body minimum:

```json
{
  "siteId": "solid-gold-main",
  "conversationId": "platform-conversation-id",
  "customerName": "Budi",
  "messages": [
    {
      "id": "platform-message-id",
      "senderType": "customer",
      "text": "Halo",
      "sentAt": "2026-10-20T01:00:00Z"
    }
  ]
}
```

Field `lead` opsional menerima `phone`, `city`, `purpose`, `productInterest`, dan `consentGiven`. Backend selalu mengambil assignee dari token extension; nilai assignee dari body tidak diterima. ID eksternal diubah secara deterministik menjadi ID internal yang stabil sehingga pengiriman ulang idempotent.

WhatsApp Assistant juga menerima Bearer token ini. Shared API key lama hanya berfungsi bila `WHATSAPP_ASSISTANT_ALLOW_LEGACY_API_KEY=true`; default-nya mati.

## 5. Checklist aktivasi staging

1. Isi secret staging melalui secret manager, bukan repository atau frontend.
2. Berikan issuer, authorize path, token path, redirect URI, organization ID, dan role map kepada Tim Clara.
3. Cocokkan HMAC dengan test vector simulator Clara.
4. Kirim percakapan nyata pertama ke site staging dan periksa lead, channel, pesan, serta assignee bersama Tim Clara.
5. Uji code sekali pakai, PKCE salah, user nonaktif, redirect URI salah, dan pencabutan token extension.
6. Aktifkan production hanya setelah webhook dan SSO staging lulus.
