# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

## [Unreleased]
### Changed
- Memperbarui `.github/workflows/auto-version-release.yml`.

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

[Unreleased]: https://github.com/bizdevsg/live-chat/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/bizdevsg/live-chat/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/bizdevsg/live-chat/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/bizdevsg/live-chat/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/bizdevsg/live-chat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/bizdevsg/live-chat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bizdevsg/live-chat/releases/tag/v0.1.0
