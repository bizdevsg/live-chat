---
title: "Panduan Integrasi API CRM — Live Chat"
author: "Tim Live Chat"
date: "3 September 2026"
---

# Panduan Integrasi API CRM — Live Chat

**Versi dokumen:** 1.0
**Status:** Implementasi berjalan
**Endpoint dasar:** `GET /api/v1/conversations`
**Konsumen:** Sistem CRM (server-to-server)
**Penyedia:** Backend Live Chat

## 1. Ringkasan

Dokumen ini adalah panduan teknis untuk Tim CRM yang perlu mengambil data *conversation* dan
*message* dari Live Chat. Integrasi bersifat **pull, read-only, server-to-server** — CRM
memanggil API Live Chat memakai API key, tidak ada webhook, tidak ada akses database langsung.

Ada dua endpoint:

1. **List Conversations** — cari semua conversation yang ditangani seorang agent, berdasarkan
   email agent tersebut.
2. **Get Conversation Detail** — ambil satu conversation lengkap dengan seluruh message,
   summary, ticket, dan lead terkait.

> **Catatan penting:** Draf awal kebutuhan integrasi ("Kebutuhan API Live Chat dan SSO Dashboard
> untuk Integrasi Clara" v1.1) mendeskripsikan pola *full incremental sync* memakai
> `updated_after`/`cursor`. Setelah dikonfirmasi ulang dengan Tim CRM, kebutuhan aktual adalah
> **lookup on-demand per agent** — bukan sync massal — sehingga itulah yang diimplementasikan
> dan didokumentasikan di sini. Desain sync penuh tetap tersedia sebagai referensi bila
> dibutuhkan lagi di kemudian hari (lihat §9).

## 2. Base URL

| Environment | Base URL |
|---|---|
| **CRM (pakai ini)** | `https://douglas-queue-domain-mounts.trycloudflare.com` |
| Local/internal (Docker Compose) | `http://localhost:4000` |
| Staging | *diisi saat staging tersedia* |
| Production | *diisi saat production tersedia* |

**Untuk Tim CRM:** pakai domain `https://douglas-queue-domain-mounts.trycloudflare.com` di atas
sebagai base URL — ini adalah Cloudflare Tunnel yang meneruskan ke API Live Chat yang jalan di
Docker Compose lokal, jadi sudah bisa diakses lewat internet memakai HTTPS biasa (tidak perlu
`http://` atau bypass sertifikat).

> **Catatan penting:** ini adalah **Cloudflare Quick Tunnel** (domain `trycloudflare.com`),
> sifatnya **sementara** — alamatnya bisa berubah setiap kali tunnel di-restart di sisi Live
> Chat. Cocok untuk uji coba/integrasi awal, tapi **jangan di-hardcode permanen** di sistem
> produksi CRM. Begitu tersedia domain staging/production yang tetap, baris ini akan digantikan.

**Untuk akses lokal/internal** (`http://localhost:4000`), API jalan **HTTP biasa**, bukan HTTPS.
Pastikan memakai `http://`, bukan `https://` — lihat §8.1 untuk detail error yang muncul kalau
salah.

## 3. Autentikasi

Setiap request wajib menyertakan API key server-to-server, lewat salah satu header berikut:

```http
Authorization: Bearer <API_KEY>
```

atau

```http
x-api-key: <API_KEY>
```

### Ketentuan keamanan

- API key **hanya dipakai server-to-server** — jangan pernah ditanam di frontend/browser.
- Satu API key idealnya di-scope ke satu site (`site_id`) — least privilege.
- API key bisa dicabut/dirotasi kapan saja tanpa memengaruhi key lain, lewat konfigurasi
  environment variable `CRM_API_KEYS` di sisi Live Chat.
- Kredensial staging dan production **berbeda**.
- Response error tidak pernah membocorkan API key, stack trace, atau data sensitif lain.

### Kredensial aktif (local/Docker Compose)

> **Rahasia — jangan diteruskan di luar tim yang berwenang.** Key ini sudah dikonfigurasi di
> `CRM_API_KEYS` pada environment local (`.env`), di-scope hanya ke site `solid-gold-main`.
> Untuk staging/production, generate key baru yang berbeda (lihat §3 poin "Kredensial staging
> dan production berbeda").

```text
API Key : x-api-key_kPfwykWZD2TkGmIS1JvKk9bZlg5YOSS9raSK0hzja5MOPlxYxJcMgFBGMQJ9np8F0vYLlyVmFv0rxgaUc3dhpzUg2hfWtJZRz2DJetuqXZ7oRuLObkEfP7LXhYrFSrDZmhDLb6H83zLiautNnn5pAnyCtEAbQf6mOB2LcqMfGMusLKiYue8JGeICZApBU3RL2JOPpB0OCjyJmHXOAGWbJSp1eL7ZklDP508XUKi0zLnhvWVXSrO84446XptZdAJa
Site ID : solid-gold-main
Scope   : read-only — GET /api/v1/conversations dan /api/v1/conversations/:id
```

> **Catatan:** key ini sama persis dengan `CRM_API_KEY` yang dipakai Live Chat untuk arah
> sebaliknya (push lead/ticket dari Live Chat ke CRM di `crm.sg-berjangka.com`) — jadi satu key
> ini dipakai dua arah. Ini valid kalau memang begitu cara CRM menerbitkan credential
> integrasi, tapi artinya kalau key ini bocor, kedua arah integrasi (masuk dan keluar)
> sama-sama harus dirotasi bersamaan.

## 4. Endpoint: List Conversations

```http
GET /api/v1/conversations?email={agent_email}&site_id={site_id}
Authorization: Bearer <API_KEY>
Accept: application/json
```

### Query parameter

| Parameter | Wajib | Contoh | Keterangan |
|---|---|---|---|
| `email` | Ya | `admin@solidgold.local` | Email agent Live Chat. Mengembalikan semua conversation yang di-*assign* ke atau pernah ditangani agent ini. |
| `site_id` | Kondisional | `solid-gold-main` | Wajib diisi **hanya jika** API key yang dipakai punya akses ke lebih dari satu site. |

### Contoh request

```bash
curl --request GET \
  --url 'https://douglas-queue-domain-mounts.trycloudflare.com/api/v1/conversations?email=admin%40solidgold.local' \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer x-api-key_kPfwykWZD2TkGmIS1JvKk9bZlg5YOSS9raSK0hzja5MOPlxYxJcMgFBGMQJ9np8F0vYLlyVmFv0rxgaUc3dhpzUg2hfWtJZRz2DJetuqXZ7oRuLObkEfP7LXhYrFSrDZmhDLb6H83zLiautNnn5pAnyCtEAbQf6mOB2LcqMfGMusLKiYue8JGeICZApBU3RL2JOPpB0OCjyJmHXOAGWbJSp1eL7ZklDP508XUKi0zLnhvWVXSrO84446XptZdAJa'
```

### Contoh response sukses (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "conv-123",
      "status": "AGENT_ACTIVE",
      "handlerType": "HUMAN",
      "priority": "NORMAL",
      "language": "id",
      "intent": null,
      "handoffReason": null,
      "createdAt": "2026-08-27T09:00:00.000Z",
      "updatedAt": "2026-08-27T09:05:00.000Z",
      "lastMessageAt": "2026-08-27T09:05:00.000Z",
      "site": { "id": "site_abc123", "siteKey": "solid-gold-main", "name": "Solid Gold Main" },
      "assignedTeam": { "id": "team_xyz", "name": "CS Team" },
      "assignedAgent": { "id": "user_789", "name": "Andi" },
      "customer": {
        "id": "cust_456",
        "name": "Budi",
        "email": "budi@example.com",
        "phone": "+628123456789"
      },
      "lead": null,
      "messageCount": 2,
      "latestMessage": {
        "id": "msg-002",
        "senderType": "AGENT",
        "messageType": "TEXT",
        "content": "Baik, kami bantu cek sekarang.",
        "createdAt": "2026-08-27T09:02:00.000Z"
      }
    }
  ]
}
```

Kalau tidak ada agent dengan email tersebut, atau agent tidak menangani conversation apa pun,
response tetap **200** dengan `data: []` — bukan error.

## 5. Endpoint: Get Conversation Detail

```http
GET /api/v1/conversations/{conversationId}
Authorization: Bearer <API_KEY>
Accept: application/json
```

Mengembalikan satu conversation secara lengkap: seluruh message (tanpa internal note atau draft
AI), ringkasan (summary), ticket, dan lead terkait.

### Contoh response sukses (200)

```json
{
  "success": true,
  "data": {
    "id": "conv-123",
    "status": "AGENT_ACTIVE",
    "handlerType": "HUMAN",
    "priority": "NORMAL",
    "channel": "WIDGET",
    "language": "id",
    "intent": null,
    "sentiment": null,
    "aiConfidence": null,
    "handoffReason": null,
    "firstMessageAt": "2026-08-27T09:00:00.000Z",
    "firstResponseAt": "2026-08-27T09:01:00.000Z",
    "assignedAt": "2026-08-27T09:00:30.000Z",
    "resolvedAt": null,
    "closedAt": null,
    "createdAt": "2026-08-27T09:00:00.000Z",
    "updatedAt": "2026-08-27T09:05:00.000Z",
    "lastMessageAt": "2026-08-27T09:05:00.000Z",
    "site": { "id": "site_abc123", "siteKey": "solid-gold-main", "name": "Solid Gold Main" },
    "assignedTeam": { "id": "team_xyz", "name": "CS Team" },
    "assignedAgent": { "id": "user_789", "name": "Andi" },
    "customer": {
      "id": "cust_456",
      "name": "Budi",
      "email": "budi@example.com",
      "phone": "+628123456789",
      "accountStatus": "active",
      "externalId": "customer-789"
    },
    "leads": [],
    "context": {
      "pageUrl": "https://solidgold.local/help",
      "pageTitle": "Bantuan",
      "referrer": null,
      "utmSource": null,
      "utmMedium": null,
      "utmCampaign": null
    },
    "latestSummary": {
      "customerGoal": "Minta bantuan terkait akun.",
      "importantFacts": ["Sudah verifikasi email"],
      "actionsTaken": ["Agent cek histori"],
      "openIssues": ["Menunggu follow up"],
      "sensitiveDataDetected": false,
      "trigger": "MANUAL",
      "createdAt": "2026-08-27T09:04:00.000Z"
    },
    "tickets": [],
    "messages": [
      {
        "id": "msg-001",
        "senderType": "VISITOR",
        "senderId": "visitor-123",
        "senderName": null,
        "messageType": "TEXT",
        "content": "Halo, saya butuh bantuan akun.",
        "createdAt": "2026-08-27T09:00:00.000Z",
        "attachments": []
      },
      {
        "id": "msg-002",
        "senderType": "AGENT",
        "senderId": "user_789",
        "senderName": "Andi",
        "messageType": "TEXT",
        "content": "Baik, kami bantu cek sekarang.",
        "createdAt": "2026-08-27T09:02:00.000Z",
        "attachments": []
      }
    ]
  }
}
```

Catatan lapangan penting:

- `messages[]` **tidak** menyertakan internal note (`messageType: INTERNAL_NOTE`) atau draft AI
  yang belum dikirim (`messageType: AI_SUGGESTION`) — keduanya internal, tidak untuk CRM.
- `content` sudah berupa plain text (HTML/tag di-strip di sisi Live Chat).
- Kalau `conversationId` tidak ditemukan → `404 CONVERSATION_NOT_FOUND` (lihat §6).

## 6. Format Error

Semua error memakai bentuk yang sama:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Penjelasan error dalam Bahasa Indonesia",
    "requestId": "req_xxxxxxxxxxxx",
    "details": ["opsional, detail tambahan"]
  }
}
```

`requestId` berguna untuk dilampirkan saat melapor ke Tim Live Chat jika terjadi error yang
tidak jelas penyebabnya.

### Daftar status HTTP & kode error

| HTTP | Kode | Kondisi | Tindakan yang disarankan |
|---|---|---|---|
| 200 | — | Request berhasil | Proses data |
| 400 | `VALIDATION_ERROR` | Query parameter tidak valid (misal `email` bukan format email) | Perbaiki request, jangan retry otomatis |
| 401 | `UNAUTHORIZED` | API key hilang atau tidak valid | Hentikan retry, periksa credential |
| 403 | `FORBIDDEN` | Credential tidak punya akses ke `site_id` yang diminta | Hentikan retry, perbaiki `site_id` atau scope credential |
| 404 | `NOT_FOUND` / `CONVERSATION_NOT_FOUND` | Endpoint atau `conversationId` tidak ditemukan | Periksa URL/ID |
| 429 | `RATE_LIMITED` | Rate limit terlampaui | Retry mengikuti header `Retry-After` (detik) |
| 500–599 | `INTERNAL_ERROR` | Gangguan server | Retry dengan exponential backoff |

## 7. Rate Limit & Reliability

```text
Rate limit       : 120 request/menit (per koneksi)
Timeout disarankan: 10–30 detik
Retry            : exponential backoff untuk 429 dan 5xx; hentikan retry untuk 400/401/403/404
```

## 8. Troubleshooting

### 8.1 Error `write EPROTO ... WRONG_VERSION_NUMBER`

Muncul kalau request memakai `https://` ke server yang sebenarnya jalan HTTP biasa (misal
`https://localhost:4000` di local/Docker Compose — seharusnya `http://`). Ini **tidak berlaku**
kalau memakai domain Cloudflare Tunnel di §2 (`https://douglas-queue-domain-mounts.trycloudflare.com`)
— tunnel itu memang HTTPS asli di sisi Cloudflare, jadi `https://` di situ sudah benar. Solusi
umum: pastikan skema URL sesuai target — `http://` untuk `localhost:4000`, `https://` untuk
domain tunnel/staging/production.

### 8.2 Error `property email should not exist`

Muncul kalau ada query parameter di luar `email`/`site_id` yang dikirim (misal sisa parameter
dari integrasi lama seperti `updated_after`). API menolak parameter yang tidak dikenal secara
eksplisit. Solusi: kirim hanya `email` (dan `site_id` bila perlu).

### 8.3 Error `updated_after harus ISO-8601 dengan timezone`

Parameter ini **sudah tidak dipakai** di kontrak saat ini (lihat catatan di §1) — kalau masih
muncul di client Anda, kemungkinan besar client masih memakai kode/koleksi request versi lama.
Hapus parameter tersebut dari request.

### 8.4 Karakter `+` pada nilai query hilang/berubah jadi spasi

Berlaku kalau ada nilai lain yang mengandung `+` (misal nomor telepon atau offset timezone) yang
dikirim tanpa di-encode — server membaca `+` sebagai spasi (aturan standar
`application/x-www-form-urlencoded`). Selalu URL-encode nilai query (`+` → `%2B`, `@` → `%40`,
dst.), atau pakai library HTTP client yang meng-encode otomatis (`URLSearchParams`, `axios`,
`fetch` dengan `URL`).

## 9. Roadmap / Belum Diimplementasikan

- **SSO Dashboard Live Chat via akun CRM** — menunggu CRM menyediakan endpoint OAuth/OIDC
  (authorization endpoint, token endpoint, client ID). Kolom `claraUserId` sudah disiapkan di
  skema database Live Chat untuk dipakai begitu SSO tersedia.
- **Full incremental sync** (`updated_after`/`cursor`, pagination) — desainnya sudah pernah
  divalidasi dan siap diaktifkan sebagai endpoint terpisah kalau kebutuhannya berubah dari
  lookup-per-agent menjadi sync massal.

## 10. Kontak

```text
PIC Tim Live Chat : (isi)
PIC Tim CRM       : (isi)
```
