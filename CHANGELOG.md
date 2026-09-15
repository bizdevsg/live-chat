# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

## [Unreleased]

### Added
- Menambahkan pengeditan nama, upload, tampil, dan hapus foto profil pengguna pada Dashboard, termasuk penyimpanan avatar privat dan URL unduhan bertanda tangan.

### Changed
- Menyetel launcher icon widget menjadi 150px tanpa transformasi scale tambahan.
- Menyederhanakan queue timeout percakapan menjadi timeout balasan agent dan menonaktifkan lifecycle penutupan otomatis saat AI tidak aktif.
- Menyesuaikan Inbox Superadmin agar menggunakan tab Waiting dan All Chats, serta memperbarui aset dan dependensi workspace terkait.
### Changed
- Memperbarui `package.json`.

## [0.9.3] - 2026-09-15
### Changed
- Memperbarui `package.json`.

## [0.9.2] - 2026-09-15
### Added
- Menambahkan `scripts/deploy.sh`.
- Menambahkan `apps/dashboard/src/components/inbox/rich-text.tsx`.

### Changed
- Memperbarui `.githooks/commit-msg`.
- Memperbarui `.githooks/pre-commit`.
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `apps/api/src/market-data/market-data.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/widget-loader/build.mjs`.
- Memperbarui `package.json`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/ai-core/src/retrieval/knowledge-retriever.ts`.
- Menghapus dua instance `Logger` dan dua parameter socket yang tidak digunakan pada API, tanpa mengubah alur orkestrasi AI maupun event typing widget.
- Menyesuaikan Inbox Superadmin agar hanya menampilkan tab `Waiting` dan `All Chats`; tab `All Chats` memuat seluruh percakapan dalam organisasi, sedangkan `My Chats` dan `Closed` tetap khusus untuk role lain.
- Merender balasan AI dan agent di detail Inbox memakai renderer rich text ringkas yang sama dengan Widget, sehingga bold, italic, inline code, dan list tampil rapi tanpa jarak paragraf berlebih.

### Fixed
- Memahami follow-up harga antar-instrumen seperti “Kalau oil” dari konteks pertanyaan harga sebelumnya dan memprioritaskan simbol yang disebut di pesan terbaru, sehingga quote Brent (`BCO10_BBJ`) ditampilkan tanpa mengulang instrumen sebelumnya.
- Membaca field payload market feed `date_time`, `oprice`, `hprice`, dan `lprice` agar evidence harga AI memuat waktu quote serta nilai open, high, dan low yang akurat.
- Membatasi konteks harga market agar tanda tanya umum tidak lagi memicu quote sebelumnya; pertanyaan non-market seperti “perusahaan apa?” kini kembali diproses oleh AI knowledge sesuai topiknya.
- Membetulkan arah harga feed menjadi Bid=`sell` dan Ask=`buy` sehingga spread quote tidak lagi bernilai negatif, serta menafsirkan `date_time` sebagai WIB untuk mencegah quote stale dianggap masih baru.
- Memetakan istilah Hang Seng/Hong Kong dan Nikkei/Japan 225 ke simbol quote WebSocket (`HKK50_BBJ`/`HKK5U_BBJ` dan `JPK50_BBJ`/`JPK5U_BBJ`) agar AI dapat menyertakan harga real-time saat customer menanyakannya.
- Memisahkan dokumen peta knowledge dan catatan Compliance yang bertanda INTERNAL dari retrieval customer agar hanya fakta publik yang menjadi evidence jawaban AI.
- Memperbaiki badge verifikasi pada avatar halaman Profile yang sebelumnya terpotong oleh `overflow-hidden`.
- Memperbaiki routing intent harga agar penyebutan simbol atau nama "Solid Gold" pada pertanyaan legalitas, spesifikasi kontrak, maupun knowledge lain tidak lagi otomatis dibalas quote market.
- Memperbaiki validasi grounding knowledge agar klaim yang sebenarnya tersalin dari evidence tidak salah ditolak oleh reviewer AI; jawaban CDD dan fakta KB terverifikasi tetap dapat diberikan.
- Mempersempit intent quote realtime: pertanyaan kuantitatif seperti ukuran kontrak atau minimum lot tidak lagi keliru dianggap pertanyaan harga hanya karena memakai kata "berapa".
- Mempertahankan chunk knowledge dengan kecocokan istilah langsung meski skor embedding rendah, dan menginstruksikan AI untuk menjawab seluruh fakta evidence yang relevan alih-alih menyatakan data tidak tersedia hanya karena detail tambahan tidak ada.
- Menampilkan nama Brent Oil untuk simbol `BCO10_BBJ`/`BCOF_BBJ` dan merapikan presisi desimal spread quote agar hasil WebSocket mudah dibaca customer.
- Mencegah jawaban knowledge menambahkan klaim yang mengecilkan risiko trading; respons kini wajib netral dan berbasis evidence saat membahas Akun Mini maupun CDD.
- Mengabaikan simbol non-kontrak `*-NC` dari evidence AI dan mewajibkan AI menjawab langsung menggunakan evidence quote market live seperti `HKK50_BBJ`.
- Menjaga quote WebSocket tetap valid berdasarkan waktu snapshot diterima, serta membawa konteks percakapan untuk pertanyaan lanjutan seperti “detail yang tadi”; AI kini wajib memberi Bid/Ask/Last dan menambahkan Open/High/Low/Spread saat customer meminta rincian harga.
- Menjawab harga market live secara deterministik dari snapshot WebSocket agar angka quote `HKK50_BBJ` tidak dapat keliru ditolak oleh grounding-review AI; respons kini selalu menampilkan Bid, Ask, Last, Open, High, Low, Spread, dan waktu pembaruan yang tersedia.
- Merapatkan jarak antarparagraf rich text pada bubble Inbox agar pesan berformat tidak memiliki ruang kosong berlebihan.
- Memperbarui instruksi AI agar jawaban mengikuti bahasa utama pada pesan terakhir customer, menggunakan bahasa situs hanya sebagai fallback, dan menangani pesan campuran secara natural.

## [0.9.0] - 2026-09-14
### Added
- Menambahkan lifecycle timeout untuk percakapan yang ditangani AI: pengingat setelah 5 menit tanpa pesan visitor, peringatan penutupan 20 detik sebelum batas 10 menit, dan penutupan otomatis pada menit ke-10. Timer direset setiap visitor mengirim pesan baru dan diproses di server melalui queue agar tetap berjalan saat widget ditutup.

### Changed
- Memaksa mode layar penuh widget pada perangkat mobile yang membuka halaman host tanpa `meta viewport`, sehingga tidak kembali ke ukuran panel desktop.
- Memastikan overlay formulir penilaian tidak lagi menahan klik pada tombol Pesan Baru dan kontrol chat lainnya di belakangnya.
- Membatasi overlay formulir penilaian widget pada area riwayat percakapan saja agar header dan tombol Pesan Baru tetap terlihat serta dapat diakses.
- Membatasi tinggi panel desktop widget hingga 720px sambil mempertahankan penyesuaian otomatis pada viewport desktop yang lebih pendek.
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/conversations/conversation-timeout.constants.ts`.
- Memperbarui `apps/api/src/conversations/conversation-timeout.processor.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/dashboard/package.json`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/layout.tsx`.
- Memperbarui `apps/widget-loader/src/loader.ts`.
- Memperbarui `apps/widget/package.json`.
- Memperbarui `apps/widget/src/App.tsx`.
- Memperbarui `apps/widget/src/components/Composer.tsx`.
- Memperbarui `apps/widget/src/components/RatingForm.tsx`.
- Memperbarui `package.json`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/shared/src/queues.ts`.
- Memperbarui `pnpm-lock.yaml`.
- Memperbesar ikon bubble live chat agar lebih terlihat dan mudah diakses pengunjung.
- Menambahkan lapisan gelap tipis pada overlay formulir penilaian agar fokus customer tetap pada rating tanpa menutupi percakapan sepenuhnya.
- Menambahkan pemilih emoji berbasis `emoji-mart` pada kolom pesan widget dan Inbox Dashboard untuk menyisipkan emoji ke posisi kursor saat membalas chat.
- Menampilkan percakapan yang ditutup otomatis oleh timeout AI pada tab Closed di Dashboard, sehingga riwayat chat tetap dapat ditinjau tim meski belum pernah dibalas agent.
- Mengarahkan AI untuk memberikan URL halaman resmi yang paling spesifik terhadap topik customer hanya jika tautan tersebut terverifikasi dalam knowledge base, tanpa membuat atau menebak URL.
- Mengubah formulir penilaian widget menjadi overlay transparan di atas percakapan agar riwayat chat tetap terlihat saat customer memberi rating.
- Menyesuaikan tinggi panel widget desktop dengan tinggi viewport serta menjadikan widget layar penuh pada lebar mobile, termasuk dalam mode responsif browser.

## [0.8.2] - 2026-09-11
### Added
- Menambahkan `apps/dashboard/public/conversation-bg.png`.

### Changed
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `package.json`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.

## [0.8.1] - 2026-09-11
### Added
- Menambahkan `apps/api/src/agent/agent.service.spec.ts`.

### Changed
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/auth/auth.controller.ts`.
- Memperbarui `apps/api/src/auth/auth.module.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/api/src/realtime/dashboard.gateway.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/dashboard/src/components/layout/agent-status-toggle.tsx`.

## [0.8.0] - 2026-09-10
### Changed
- Mengubah pembaruan status availability agent di dashboard menjadi request HTTP yang persisten, sehingga status Online/Busy tetap tersimpan dan dikirim ke widget meski WebSocket belum tersambung.
- Memindahkan aksi End Chat dari menu titik tiga ke tombol langsung di header widget, dengan dialog konfirmasi tetap dipertahankan.
- Memperbarui `.github/workflows/auto-version-release.yml`.
- Memperbarui `apps/widget-loader/src/loader.ts`.
- Memperbarui `apps/widget/nginx.conf`.
- Memperbarui `apps/widget/src/components/Composer.tsx`.
- Memperbarui `apps/widget/src/components/Header.tsx`.
- Memperbarui `apps/widget/src/components/MessageList.tsx`.
- Memperbarui `apps/widget/src/index.css`.
- Memperbarui `apps/widget/tailwind.config.js`.
- Mengganti palet dasar widget pada header, panel percakapan, dan tampilan mobile menjadi abu-abu gelap `#2e2e2e`, termasuk overlay di atas gambar latar percakapan, dan mencegah cache pada HTML iframe agar perubahan tema segera termuat tanpa mengubah warna brand yang dikonfigurasi per situs.
- Mengubah latar header widget menjadi gradient abu-abu gelap agar tampilannya lebih berdimensi.
- Mengurangi opasitas overlay area percakapan agar wallpaper chat kembali terlihat di balik tema `#2e2e2e`.

## [0.6.2] - 2026-09-09
### Added
- Menambahkan `.githooks/commit-msg`.
- Menambahkan `scripts/bump-version-from-commit.mjs`.

### Changed
- Memindahkan pembaruan versi ke hook commit lokal: `package.json` dan `CHANGELOG.md` kini diperbarui serta di-stage sebelum push, sementara GitHub Actions hanya membuat tag dan release dari versi yang telah dikomit.
- Membatasi tinggi panel widget desktop hingga 720px dan membedakan browser desktop sempit dari perangkat sentuh agar widget tidak memenuhi layar saat jendela diperkecil.
- Menurunkan batas tinggi panel widget desktop menjadi 560px agar tampilan chat lebih ringkas.
- Menurunkan posisi bubble launcher dari 40px menjadi 20px dari bawah layar agar lebih dekat ke tepi viewport.
- Mengembalikan tinggi maksimum panel widget desktop menjadi 720px dengan jarak 16px dari bawah viewport.
- Menyesuaikan jarak panel widget desktop menjadi 8px dari bawah viewport.
- Menyesuaikan jarak panel widget desktop menjadi 15px dari bawah viewport.
- Memperbarui `.github/workflows/auto-version-release.yml`.
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/widget/src/components/MessageList.tsx` agar desain bubble membedakan visitor (olive), AI (oranye), dan agent (hijau), sehingga pengirim mudah dikenali.
- Memperbarui `apps/widget/src/components/MessageList.tsx`.
- Memperbarui `package.json`.
- Memperbarui `scripts/setup-githooks.mjs`.
- Mengubah transfer conversation di dashboard menjadi transfer langsung ke agent aktif, serta mengganti label aksi Accept menjadi Take Over untuk memperjelas pengambilalihan chat.
- Menyamakan bubble percakapan pada detail inbox dashboard dengan widget melalui label dan border berwarna per pengirim; posisi balasan agent di kanan tetap dipertahankan untuk alur kerja operator.

## [0.6.1] - 2026-09-09
### Added
- Menambahkan `apps/api/src/leads/leads.service.spec.ts`.
- Menambahkan `apps/widget/public/bg-widget.png`.
- Menambahkan `apps/widget/src/components/conversation-bg.png`.

### Changed
- Memperbarui `apps/api/src/leads/leads.module.ts`.
- Memperbarui `apps/api/src/leads/leads.service.ts`.
- Memperbarui `apps/widget/src/components/MessageList.tsx`.
- Mengganti nama `apps/widget/public/bg-widget.png` menjadi `apps/widget/src/assets/bg-widget.png`.
- Mengganti nama `apps/widget/src/assets/bg-widget.png` menjadi `apps/widget/src/components/conversation-bg.png`.

### Fixed
- Stabilize widget background and visitor sessions.

### Removed
- Menghapus `apps/widget/public/Gemini_Generated_Image_8ugtnu8ugtnu8ugt.jpg`.
- Menghapus `apps/widget/public/bg-live-chat.png`.

## [0.6.0] - 2026-09-09
### Added
- Menambahkan `apps/widget/public/Gemini_Generated_Image_8ugtnu8ugtnu8ugt.jpg`.
- Swap live chat background image and tweak agent bubble padding.

### Changed
- Memperbarui `apps/widget/src/components/MessageList.tsx`.

## [0.5.0] - 2026-09-08
### Added
- Image upload.
- Menambahkan `apps/api/src/common/utils/image-upload.ts`.
- Menambahkan `apps/widget/public/bg-live-chat.png`.

### Changed
- Memperbarui `.env.example`.
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/api/src/storage/storage.service.ts`.
- Memperbarui `apps/api/src/widget/widget.controller.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/dashboard/src/lib/types.ts`.
- Memperbarui `apps/widget-loader/src/loader.ts`.
- Memperbarui `apps/widget/src/App.tsx`.
- Memperbarui `apps/widget/src/components/Composer.tsx`.
- Memperbarui `apps/widget/src/components/MessageList.tsx`.
- Memperbarui `apps/widget/src/hooks/use-conversation.ts`.
- Memperbarui `apps/widget/src/lib/api.ts`.
- Memperbarui `docker-compose.yml`.
- Merge branch 'dev' of https://github.com/bizdevsg/live-chat into dev.

## [0.4.7] - 2026-09-08
### Changed
- Memperbarui `apps/api/src/main.ts`.
- Memperbarui `pnpm-lock.yaml`.

### Fixed
- Trust loopback proxy, configurable bind host, sync lockfile.

## [0.4.6] - 2026-09-08
### Added
- Menambahkan `apps/dashboard/src/components/layout/permission-route-guard.tsx`.

### Changed
- Memperbarui `apps/api/src/admin/overview.controller.ts`.
- Memperbarui `apps/api/src/analytics/analytics.controller.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/layout.tsx`.
- Memperbarui `apps/dashboard/src/components/layout/nav-items.ts`.
- Memperbarui `package.json`.
- Merge branch 'dev' of https://github.com/bizdevsg/live-chat into dev.

### Fixed
- .github.
- Role access.

## [0.4.5] - 2026-09-08
### Changed
- Memperbarui `package.json`.

### Fixed
- .github.

## [0.4.4] - 2026-09-06
### Added
- Menambahkan `apps/api/src/auth/auth-cookies.util.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/clara-id-token.util.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/clara-sso-state.service.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/clara-sso.config.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/clara-sso.controller.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/clara-sso.service.ts`.
- Menambahkan `apps/api/src/auth/clara-sso/pkce.util.ts`.
- Menambahkan `db/db-live-chat.sql`.
- Menambahkan `docs/sso-clara-integration.md`.
- Menambahkan implementasi sisi klien SSO Clara → Dashboard Live Chat: `GET /api/v1/auth/clara/login` dan `/callback` (Authorization Code + PKCE, validasi ID token HS256, tautan `users.clara_user_id`), auto-provisioning akun agent baru dengan pemetaan role via `CRM_SSO_ROLE_MAP`, tombol "Masuk dengan Clara" di halaman login (di balik flag `NEXT_PUBLIC_CRM_SSO_ENABLED`), dan `docs/sso-clara-integration.md`.

### Changed
- Memperbarui `.dockerignore`.
- Memperbarui `.env.example`.
- Memperbarui `.gitignore`.
- Memperbarui `apps/api/src/auth/auth.controller.ts`.
- Memperbarui `apps/api/src/auth/auth.module.ts`.
- Memperbarui `apps/api/src/auth/auth.service.ts`.
- Memperbarui `apps/api/src/common/security/security-event.service.ts`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/dashboard/Dockerfile`.
- Memperbarui `apps/dashboard/src/app/login/page.tsx`.
- Memperbarui `docker-compose.yml`.
- Memperbarui `docs/crm-integration.md`.
- Memperbarui `package.json`.
- Memperbarui `packages/shared/src/enums.ts`.
- Memperbarui `scripts/changelog-utils.mjs`.
- Memperbarui `scripts/resolve-version-bump.mjs`.

### Fixed
- Db.
- Remove tmp folder.

### Removed
- Menghapus `tmp/pdf-qa-live/page-1.png`.
- Menghapus `tmp/pdf-qa-live/page-2.png`.
- Menghapus `tmp/pdf-qa-live/page-3.png`.
- Menghapus `tmp/pdf-qa-live/page-4.png`.
- Menghapus `tmp/pdf-qa-live/page-5.png`.
- Menghapus `tmp/pdf-qa-live/page-6.png`.
- Menghapus `tmp/pdf-qa-new/page-1.png`.
- Menghapus `tmp/pdf-qa-new/page-2.png`.
- Menghapus `tmp/pdf-qa-new/page-3.png`.
- Menghapus `tmp/pdf-qa-new/page-4.png`.
- Menghapus `tmp/pdf-qa-new/page-5.png`.
- Menghapus `tmp/pdf-qa/page-1.png`.
- Menghapus `tmp/pdf-qa/page-2.png`.
- Menghapus `tmp/pdf-qa/page-3.png`.
- Menghapus `tmp/pdf-qa/page-4.png`.
- Menghapus `tmp/pdf-qa/page-5.png`.
- Menghapus `tmp/pdf-qa/page-6.png`.

## [0.4.2] - 2026-09-04
### Added
- Menambahkan `.pnpm-store/v11/index.db-shm`.
- Menambahkan `.pnpm-store/v11/index.db-wal`.
- Menambahkan `.pnpm-store/v11/index.db`.
- Menambahkan `output/pdf/panduan-agent-solidchat.pdf`.
- Menambahkan `output/pdf/panduan-operasional-agent-solidchat.pdf`.
- Menambahkan `scripts/create_agent_tutorial_pdf.py`.
- Menambahkan `scripts/create_live_agent_guide.py`.
- Menambahkan `tmp/pdf-qa-live/page-1.png`.
- Menambahkan `tmp/pdf-qa-live/page-2.png`.
- Menambahkan `tmp/pdf-qa-live/page-3.png`.
- Menambahkan `tmp/pdf-qa-live/page-4.png`.
- Menambahkan `tmp/pdf-qa-live/page-5.png`.
- Menambahkan `tmp/pdf-qa-live/page-6.png`.
- Menambahkan `tmp/pdf-qa-new/page-1.png`.
- Menambahkan `tmp/pdf-qa-new/page-2.png`.
- Menambahkan `tmp/pdf-qa-new/page-3.png`.
- Menambahkan `tmp/pdf-qa-new/page-4.png`.
- Menambahkan `tmp/pdf-qa-new/page-5.png`.
- Menambahkan `tmp/pdf-qa/page-1.png`.
- Menambahkan `tmp/pdf-qa/page-2.png`.
- Menambahkan `tmp/pdf-qa/page-3.png`.
- Menambahkan `tmp/pdf-qa/page-4.png`.
- Menambahkan `tmp/pdf-qa/page-5.png`.
- Menambahkan `tmp/pdf-qa/page-6.png`.

### Changed
- Memperbarui `.dockerignore`.
- Memperbarui `.github/workflows/auto-version-release.yml`.
- Memperbarui `.gitignore`.
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/layout.tsx`.
- Memperbarui `apps/worker/src/cleanup/cleanup.processor.spec.ts`.
- Memperbarui `apps/worker/src/cleanup/cleanup.processor.ts`.
- Memperbarui `apps/worker/src/scheduler.service.ts`.

### Removed
- Menghapus `tmp/pdf-qa-live/page-1.png`.
- Menghapus `tmp/pdf-qa-live/page-2.png`.
- Menghapus `tmp/pdf-qa-live/page-3.png`.
- Menghapus `tmp/pdf-qa-live/page-4.png`.
- Menghapus `tmp/pdf-qa-live/page-5.png`.
- Menghapus `tmp/pdf-qa-live/page-6.png`.
- Menghapus `tmp/pdf-qa-new/page-1.png`.
- Menghapus `tmp/pdf-qa-new/page-2.png`.
- Menghapus `tmp/pdf-qa-new/page-3.png`.
- Menghapus `tmp/pdf-qa-new/page-4.png`.
- Menghapus `tmp/pdf-qa-new/page-5.png`.
- Menghapus `tmp/pdf-qa/page-1.png`.
- Menghapus `tmp/pdf-qa/page-2.png`.
- Menghapus `tmp/pdf-qa/page-3.png`.
- Menghapus `tmp/pdf-qa/page-4.png`.
- Menghapus `tmp/pdf-qa/page-5.png`.
- Menghapus `tmp/pdf-qa/page-6.png`.

## [0.4.1] - 2026-09-04
### Added
- Menambahkan `apps/dashboard/public/notification/new-massages/universfield-new-notification-022-370046.mp3`.
- Menambahkan `apps/dashboard/public/notification/on-conversesion/universfield-new-notification-012-363675.mp3`.
- Menambahkan `apps/dashboard/src/lib/browser-notifications.ts`.
- Menambahkan notifikasi native browser untuk dashboard saat berada di tab lain atau diminimalkan.

### Changed
- Memperbarui `.github/workflows/auto-version-release.yml`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/layout.tsx`.
- Memperbarui `apps/dashboard/src/components/account/account-settings-panel.tsx`.
- Memperbarui `apps/dashboard/src/lib/notification-sounds.ts`.
- Memperbarui `apps/widget/src/lib/notification-sound.ts`.
- Memperbarui `package.json`.
- Menambahkan kontrol aktivasi izin notifikasi browser pada pengaturan profil agent.

### Fixed
- Memastikan notifikasi browser kompatibel dengan definisi API yang digunakan saat build dashboard.
- Memetakan notifikasi conversation inbox dan pesan customer ke kategori suara yang sesuai.
- Memperbaiki pemutaran suara notifikasi agar tetap dapat di-unlock setelah pengaturan akun dimuat.
- Notifikasi dashboard.

## [0.4.0] - 2026-09-04
### Added
- Timer hitung mundur "Kembali ke AI dalam MM:SS" di sisi agent.
- Agent bisa menangani hingga 5 percakapan sekaligus.

### Fixed
- Accept percakapan oleh agent kini race-safe lewat klaim atomik.
- Handoff ke agent masuk antrean FCFS, tidak lagi dipantulkan ke AI saat semua agent sibuk.
- Percakapan yang sudah berakhir diaktifkan lagi saat pre-chat dikirim; `departmentId` dari widget lama diterima dan diabaikan.
- Job id timeout agent-reply diperbaiki (BullMQ menolak karakter ":") sehingga auto-return ke AI kembali berjalan.
- Sinkronisasi changelog otomatis.

## [0.3.1] - 2026-08-31
### Fixed
- Sound notifikasi widget.

## [0.3.0] - 2026-08-31
### Added
- Menambahkan `scripts/changelog-utils.mjs`.
- Menambahkan `scripts/resolve-version-bump.mjs`.
- Menambahkan workflow `.github/workflows/auto-version-release.yml`.
- Tambah export CRM.

### Changed
- Memperbarui `.github/release-drafter.yml` agar sinkron dengan branch `dev`.
- Memperbarui `package.json` untuk script versioning otomatis.
- Memperbarui `scripts/release-version.mjs`.
- Memperbarui `scripts/update-changelog.mjs`.

## [0.2.0] - 2026-08-31
### Added
- Menambahkan `scripts/release-version.mjs`.

### Changed
- Memperbarui `.github/workflows/release-drafter.yml`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/main.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `package.json`.
- Memperbarui `scripts/update-changelog.mjs`.

## [0.1.0] - 2026-08-31
### Added
- Menambahkan `.githooks/pre-commit`.
- Menambahkan `scripts/setup-githooks.mjs`.
- Menambahkan `scripts/update-changelog.mjs`.

### Changed
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/main.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `package.json`.

[Unreleased]: https://github.com/bizdevsg/live-chat/compare/v0.9.3...HEAD
[0.9.3]: https://github.com/bizdevsg/live-chat/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/bizdevsg/live-chat/compare/v0.9.0...v0.9.2
[0.9.0]: https://github.com/bizdevsg/live-chat/compare/v0.8.2...v0.9.0
[0.8.2]: https://github.com/bizdevsg/live-chat/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/bizdevsg/live-chat/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/bizdevsg/live-chat/compare/v0.6.2...v0.8.0
[0.6.2]: https://github.com/bizdevsg/live-chat/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/bizdevsg/live-chat/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/bizdevsg/live-chat/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/bizdevsg/live-chat/compare/v0.4.7...v0.5.0
[0.4.7]: https://github.com/bizdevsg/live-chat/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/bizdevsg/live-chat/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/bizdevsg/live-chat/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/bizdevsg/live-chat/compare/v0.4.2...v0.4.4
[0.4.2]: https://github.com/bizdevsg/live-chat/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/bizdevsg/live-chat/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/bizdevsg/live-chat/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/bizdevsg/live-chat/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/bizdevsg/live-chat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/bizdevsg/live-chat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bizdevsg/live-chat/releases/tag/v0.1.0
