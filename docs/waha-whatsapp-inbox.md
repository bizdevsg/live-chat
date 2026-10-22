# Dedicated WhatsApp Inbox via WAHA

Integrasi ini menyediakan workspace WhatsApp yang terpisah sepenuhnya dari Inbox Live Chat.
WAHA tetap menjadi sumber data chat, contact, profile picture, message history, dan delivery state.
SolidChat hanya mem-proxy API tersebut dengan autentikasi organisasi dan menyediakan UI operator.

Tidak ada AI orchestration, knowledge routing, assignment Live Chat, atau pembuatan `Conversation`
SolidChat pada alur WhatsApp ini. Semua balasan dikirim manual oleh user Dashboard.

## Cakupan

- Satu session/nomor WhatsApp per organization.
- Inbox hanya menampilkan personal chat; group, Status, Channel, dan newsletter tidak ditampilkan.
- Nama tampilan, nomor, foto profil, daftar chat, riwayat, unread count, dan acknowledgement berasal dari WAHA.
- Pesan teks dapat dibaca dan dibalas dari Dashboard; media ditampilkan sebagai metadata lampiran.
- NOWEB Store diaktifkan dengan `enabled: true` dan `fullSync: true` saat session dibuat agar Chat Overview dan sinkronisasi riwayat tersedia pada versi WAHA yang dijalankan.
- QR dan pengaturan koneksi tersedia untuk user dengan permission `integration.manage`.
- Workspace chat tersedia untuk user dengan permission `conversation.handle`.

## Environment SolidChat API

```env
WAHA_API_URL=https://waha.internal.example.com
WAHA_API_KEY=REPLACE_WITH_WAHA_API_KEY
WAHA_WEBHOOK_URL=https://live-chat.example.com/api/v1/whatsapp/webhooks/waha
WAHA_WEBHOOK_HMAC_KEY=REPLACE_WITH_32_PLUS_RANDOM_CHARACTERS
```

`WAHA_API_KEY` dan `WAHA_WEBHOOK_HMAC_KEY` adalah secret server-side. Jangan mengekspos keduanya
ke browser, mobile app, source code, log, atau URL. Gunakan private Docker network atau HTTPS.

## Alur koneksi

1. User dengan `integration.manage` membuka pengaturan pada menu **WhatsApp** dan memilih engine.
2. SolidChat membuat atau memperbarui session WAHA, mengaktifkan NOWEB Store, dan memasang webhook
   ber-HMAC SHA-512.
3. Dashboard mengambil QR melalui backend. Operator memindainya dari menu Perangkat tertaut.
4. SolidChat membaca nama akun dan nomor dari `session.me` WAHA.

## Alur inbox

1. Dashboard mengambil daftar personal chat dari `GET /api/{session}/chats/overview`.
2. Nama dan nomor contact dibaca dari Contact API WAHA; foto dibaca dari Profile Picture API.
3. Riwayat dibaca dari `GET /api/{session}/chats/{chatId}/messages`.
4. Balasan manual dikirim langsung melalui `POST /api/sendText`.
5. Chat aktif ditandai dibaca melalui endpoint read messages WAHA.
6. Webhook SolidChat hanya menyinkronkan status session; event message tidak masuk ke Live Chat/AI.

## Operasional

- Setelah mengubah environment, restart/redeploy API agar konfigurasi terbaca.
- Volume `/app/.sessions` WAHA harus persisten karena menyimpan login dan NOWEB Store.
- Jangan mengubah konfigurasi NOWEB Store setelah QR dipindai karena dapat mengganggu history sync.
- Dashboard melakukan polling ringan agar pesan yang dikirim dari ponsel juga terlihat.
