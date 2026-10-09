# SolidChat WhatsApp Assistant

Chrome/Chromium extension berbentuk native side panel untuk membantu CS/Admin membalas chat WhatsApp Web menggunakan AI dan knowledge base SolidChat.

## Kemampuan

- Memindai maksimal 50 pesan terakhir dari chat WhatsApp yang sedang aktif.
- Menerima prompt bebas seperti "Bantu bikin jawaban untuk ini" atau "Buat lebih singkat dan empatik".
- Mengambil knowledge `PUBLIC` dan `AGENT_ONLY` dari site yang dikonfigurasi di server.
- Memakai system prompt khusus dari file Markdown `system-prompt.md` yang dibundel langsung di dalam extension, terpisah dari prompt Widget/Live Chat.
- Menampilkan confidence dan judul knowledge yang dipakai.
- Memasukkan draft ke composer WhatsApp tanpa langsung mengirim.
- Auto-reply opt-in untuk chat aktif, dengan jeda, batas per jam, deduplikasi, pembatalan saat agent membalas, dan blokir otomatis untuk konteks sensitif atau confidence rendah.

## Instalasi lokal

1. Pastikan API SolidChat aktif dan `OPENAI_API_KEY` server valid.
2. Buka `chrome://extensions` (atau halaman Extensions pada browser Chromium).
3. Aktifkan **Developer mode**.
4. Pilih **Load unpacked** dan arahkan ke folder `extensions/whatsapp-assistant`.
5. Buka `https://web.whatsapp.com`, klik ikon extension, lalu pin jika diperlukan.
6. Paket hasil build resmi sudah membawa API URL, Site ID, dan Extension Key. Side panel langsung menyambung otomatis saat dibuka; pengguna tidak mengisi pengaturan dan tidak login ke SolidChat.

Default API URL adalah `https://live-chat.sg-berjangka.com`. Untuk development gunakan `http://localhost:4000`.

## Batasan dan keamanan

- Extension hanya memproses chat yang sedang terbuka. Otomasi seluruh inbox memerlukan WhatsApp Business Cloud API.
- Jika tab WhatsApp sudah terbuka sebelum extension dipasang atau diperbarui, side panel otomatis menyuntikkan content script dan mengulang koneksi tanpa meminta refresh manual.
- Pemindai mendukung penanda bubble WhatsApp Web baru (`conv-msg-*`, `msg-container`, `tail-in`, dan `tail-out`) sekaligus mempertahankan fallback untuk struktur DOM lama.
- API URL, Site ID, dan Extension Key diisikan pada paket resmi saat proses build dan hanya dipakai oleh service worker untuk endpoint khusus WhatsApp Assistant. Nilainya tidak berada di source repository maupun ditampilkan di UI.
- API key OpenAI tidak pernah dikirim ke extension; seluruh request AI diproses backend.
- Backend tidak membaca atau menyimpan system prompt extension di database; database hanya menyediakan konfigurasi site dan knowledge yang relevan.
- Perubahan `system-prompt.md` memerlukan reload/rebuild extension. Karena file dibundel di client, isinya dapat dilihat oleh pengguna yang memiliki paket extension.
- Transcript dikirim ke backend hanya ketika agent meminta jawaban atau ketika auto-reply aktif menerima pesan baru.
- Auto-reply mati otomatis saat berpindah chat dan tidak mengirim jika klasifikasi mendeteksi data sensitif, prompt injection, komplain, deposit, withdrawal, security, permintaan manusia, jawaban kosong, atau confidence rendah.
- WhatsApp Web dapat mengubah struktur DOM sewaktu-waktu. Selector scanner/composer mungkin perlu disesuaikan setelah perubahan UI WhatsApp.
