# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

## [Unreleased]
### Changed
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

[Unreleased]: https://github.com/bizdevsg/live-chat/compare/v0.6.2...HEAD
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
