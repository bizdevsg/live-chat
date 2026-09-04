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

## Yang belum diimplementasikan

- **SSO Dashboard Live Chat via akun CRM (§4A draf v1.1)** — CRM belum bertindak sebagai
  OAuth/OIDC provider, jadi flow login agent lewat CRM belum bisa dibangun. Kolom
  `users.clara_user_id` sudah disiapkan di skema (nullable) untuk dipakai begitu SSO tersedia,
  tapi saat ini tidak diisi/dipakai oleh endpoint manapun.
- **Full incremental sync (`updated_after`/`cursor`)** — lihat catatan di atas; belum dibutuhkan
  untuk kasus pakai saat ini, tapi desainnya (draf v1.1) sudah pernah divalidasi dan siap dipakai
  kalau kebutuhannya muncul lagi.
