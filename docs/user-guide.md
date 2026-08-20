# Panduan SolidChat AI — Alur Sistem & Pemakaian Dashboard

> Versi web yang lebih enak dibaca (dengan diagram alur bertahap) tersedia sebagai artifact terpisah. Dokumen ini adalah versi markdown untuk referensi di repository.

## Bagian 1 — Alur Sistem

### 1.1 Alur percakapan visitor

1. **Buka website & klik bubble chat** — widget dimuat lewat satu `<script>` tag, tidak mengganggu tampilan halaman.
2. **(Opsional) isi form singkat** — kalau pre-chat form diaktifkan: nama, email, No. HP, persetujuan privasi. Ini menjadi data *Lead*.
3. **Ngobrol dengan AI** (nama asisten diambil dari **AI Configuration** di dashboard, bukan nama tetap) — AI mengambil artikel resmi yang relevan dari Knowledge Base, lalu menjawab berdasarkan artikel itu saja.
4. **Percabangan otomatis** dicek di setiap pesan:
   - **Jalur A — AI lanjut menjawab**: AI menemukan artikel cocok & percaya diri di atas ambang batas → jawaban dikirim beserta rujukan sumber (tersimpan untuk audit).
   - **Jalur B — dialihkan ke CS**: visitor minta bicara dengan manusia, topik menyangkut akun/transaksi/data sensitif, komplain serius, atau AI dua kali tidak yakin berturut-turut → masuk antrian tim yang sesuai.
5. **Agent menerima & membalas** (jalur B) — AI berhenti total membalas begitu agent mengambil alih.
6. **Percakapan selesai** — ditutup oleh agent/visitor; visitor bisa memberi rating 1–5.

**Yang tidak akan pernah terjadi**: AI mengarang informasi di luar artikel resmi, AI meminta OTP/PIN/password, atau AI tetap membalas setelah CS mengambil alih — dicegah di level kode, bukan aturan tertulis saja.

### 1.2 Alur kerja CS / agent

1. Login & set status **Online**.
2. Pantau kolom **Waiting** di Inbox.
3. **Accept** chat yang antre, atau **Take Over** chat yang masih dipegang AI.
4. Baca ringkasan & pakai **✨ Suggested Reply** (draf dari AI — agent yang putuskan kirim/edit/abaikan).
5. Balas, pakai **internal note** untuk koordinasi antar-CS (tidak terlihat customer), **Transfer** ke tim lain, atau **buat Ticket**.
6. **Resolve** — bisa **Reopen** kapan saja.

### 1.3 Alur menjaga Knowledge Base

```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
```

AI hanya boleh memakai artikel berstatus **PUBLISHED** (dan belum kadaluwarsa). Publish memicu proses pemecahan artikel jadi potongan kecil (chunking) + pengindeksan (embedding) secara otomatis.

### 1.4 Alur lead & CRM

1. Visitor isi & menyetujui form pre-chat.
2. Lead tersimpan di SolidChat, status sinkron **Pending**.
3. Dikirim ke CRM di latar belakang (server-to-server, browser visitor tidak pernah terhubung langsung ke CRM), dengan percobaan ulang otomatis.
4. Status akhir **Synced** atau **Failed** — kalau gagal terus, admin klik **Retry** manual di menu Leads.

## Bagian 2 — Panduan Pemakaian Dashboard

| Menu | Path | Ringkasan |
|---|---|---|
| Login | `/login` | Masuk dengan email & password; ada alur lupa password. |
| Overview | `/dashboard` | Ringkasan performa hari ini + grafik volume 30 hari. |
| Inbox | `/inbox` | Pusat kerja CS — 3 kolom: antrian, percakapan, konteks customer. |
| Tickets | `/tickets` | Daftar & detail ticket, komentar internal, ubah status. |
| Customers | `/customers` | Cari nasabah, lihat riwayat percakapan & ticket. |
| Leads | `/leads` | Daftar calon nasabah dari pre-chat form + status sinkron CRM. |
| Knowledge Base | `/knowledge` | Tulis/upload artikel, alur review→approve→publish. |
| AI Configuration | `/ai/configuration` | Provider, model per fungsi, confidence threshold, timeout/retry. |
| AI Runs | `/ai/runs` | Log setiap proses AI untuk audit. |
| Routing Rules | `/routing` | Aturan pembagian chat ke tim (saat ini tampilan baca-saja). |
| CS & Teams | `/teams` | Buat tim, atur kapasitas chat per agent. |
| Users | `/users` | Buat/nonaktifkan user, atur peran, cabut sesi. |
| Response Templates | `/templates` | Balasan siap pakai dengan kode shortcut. |
| Widget Settings | `/widget` | Script pemasangan widget + daftar domain yang diizinkan. |
| Analytics | `/analytics` | Performa AI/agent, top intents, export CSV. |
| Integrations | `/integrations` | Status koneksi CRM & riwayat sinkronisasi. |
| Security | `/security` | Kejadian keamanan (login gagal, domain asing, dsb). |
| Audit Logs | `/audit-logs` | Jejak seluruh tindakan penting — baca saja. |

### Cara pasang widget ke website

1. Salin script di halaman **Widget Settings**.
2. Tempel sebelum tag `</body>` di website Solid Gold.
3. Tambahkan domain website ke **Domain yang Diizinkan** (wajib, atau sesi chat ditolak).

```html
<script
  src="https://chat.sg-berjangka.com/widget.js"
  data-site-id="solid-gold-main"
  data-position="bottom-right"
  data-language="id"
  async>
</script>
```

## Bagian 3 — Ringkasan Teknis

Lihat dokumen detail: [`architecture.md`](architecture.md) · [`deployment.md`](deployment.md) · [`database.md`](database.md) · [`security.md`](security.md) · [`ai-policy.md`](ai-policy.md) · [`api.md`](api.md) · [`websocket.md`](websocket.md) · [README.md](../README.md) (perintah lengkap install/migrate/seed/test/build/deploy).

### Matriks role & izin (ringkas)

| Role | Bisa apa |
|---|---|
| Super Admin | Akses penuh: semua menu, keamanan, audit log, integrasi. |
| Admin | Kelola CS/tim, knowledge base, konfigurasi AI, routing, template, widget, analytics. |
| Supervisor | Pantau & ambil alih chat timnya, transfer, atur pembagian tugas. |
| CS Agent | Terima & balas chat, transfer, buat ticket, catatan internal, suggested reply. |
| Knowledge Editor | Tulis & edit artikel, unggah dokumen, ajukan review — tidak bisa publish sendiri. |
| Auditor | Baca saja: percakapan, ticket, log AI, audit log. |

### Troubleshooting umum

| Gejala | Penyebab & solusi |
|---|---|
| API gagal start, modul `@solidchat/*` tidak ketemu | `shared/ai-core/integrations/database` belum di-build ke `dist/`. Build sesuai urutan di README §6–7. |
| `dist/` API tidak lengkap setelah build | Hapus `tsconfig.tsbuildinfo` lalu build ulang (sudah dicegah permanen dengan mematikan `incremental`). |
| AI selalu bilang "belum punya informasi cukup" | Artikel belum **PUBLISHED**, atau kata kunci pertanyaan tidak muncul di isi artikel. |
| Widget menolak sesi (`DOMAIN_NOT_ALLOWED`) | Domain belum ditambahkan di Widget Settings. |
| Peringatan versi Redis minimum di log | Redis lokal versi lama; tidak menghentikan fungsi, produksi disarankan Redis 7. |
