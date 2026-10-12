# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

## [Unreleased]
### Changed
- Memperbarui `package.json`.

## [0.19.0] - 2026-10-12
### Added
- Menambahkan Public Knowledge API read-only pada `GET /api/v1/public/knowledge/documents` dan `GET /api/v1/public/knowledge/documents/:slug`, dengan API key khusus, pagination, pencarian, filter kategori/site, rate limit, dan sanitasi respons; hanya knowledge audience `PUBLIC` yang aktif serta masih berlaku yang dapat diakses consumer eksternal.
- Menambahkan `apps/api/src/knowledge/knowledge.service.public.spec.ts`.
- Menambahkan `apps/api/src/knowledge/public-knowledge-api-key.guard.spec.ts`.
- Menambahkan `apps/api/src/knowledge/public-knowledge-api-key.guard.ts`.
- Menambahkan `apps/api/src/knowledge/public-knowledge.controller.ts`.
- Menambahkan `apps/api/src/realtime/dashboard.gateway.spec.ts`.

### Changed
- Memindahkan project WhatsApp Assistant extension dari `extensions/whatsapp-assistant` ke project mandiri `C:\Website JS\whatsapp-assistant` agar pengembangan extension terpisah dari repository `live-chat`.
- Memperbarui WhatsApp Assistant extension ke versi `0.2.9` agar dapat membaca konfigurasi koneksi lokal dari `config.local.js` tanpa menyimpan Extension Key ke Git.
- Memperbarui `.env.example`.
- Memperbarui `.gitignore`.
- Memperbarui `apps/api/src/agent/agent.service.spec.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/knowledge/dto/knowledge.dto.ts`.
- Memperbarui `apps/api/src/knowledge/knowledge.module.ts`.
- Memperbarui `apps/api/src/knowledge/knowledge.service.ts`.
- Memperbarui `apps/api/src/main.ts`.
- Memperbarui `apps/api/src/realtime/dashboard.gateway.ts`.
- Memperbarui `docs/api.md`.
- Memperbarui `package.json`.
- Mengonfigurasi Public Knowledge API untuk site `solid-gold-main` dan memakai WhatsApp Assistant key sebagai fallback ketika dedicated Public Knowledge key belum diisi, sehingga integrasi eksternal dapat diaktifkan tanpa menyalin secret ke konfigurasi baru.
- Mengubah `GET /api/v1/public/knowledge/documents` agar mengembalikan seluruh knowledge publik yang cocok tanpa pagination; filter site, pencarian, dan kategori tetap tersedia.

### Fixed
- Membuat status agent otomatis berubah menjadi `OFFLINE` setelah seluruh koneksi dashboard terputus selama 45 detik, termasuk saat tab atau browser ditutup tanpa logout; reconnect dan tab/perangkat lain tetap mencegah false offline.

### Removed
- Menghapus `extensions/whatsapp-assistant/README.md`.
- Menghapus `extensions/whatsapp-assistant/background.js`.
- Menghapus `extensions/whatsapp-assistant/content.js`.
- Menghapus `extensions/whatsapp-assistant/manifest.json`.
- Menghapus `extensions/whatsapp-assistant/sidepanel.css`.
- Menghapus `extensions/whatsapp-assistant/sidepanel.html`.
- Menghapus `extensions/whatsapp-assistant/sidepanel.js`.
- Menghapus `extensions/whatsapp-assistant/system-prompt.md`.

## [0.18.2] - 2026-10-09
### Changed
- Memperbarui `package.json`.

## [0.18.1] - 2026-10-09
### Changed
- Memperbarui `package.json`.

## [0.18.0] - 2026-10-09
### Added
- Menambahkan Chrome/Chromium extension `extensions/whatsapp-assistant` berbentuk native side panel untuk memindai chat aktif WhatsApp Web, menerima prompt agent, memasukkan draft ke composer, dan menjalankan guarded auto-reply.
- Menambahkan `apps/api/src/admin/overview.controller.spec.ts`.
- Menambahkan `apps/api/src/ai/whatsapp-assistant-api-key.guard.ts`.
- Menambahkan `apps/api/src/ai/whatsapp-assistant.controller.ts`.
- Menambahkan `apps/api/src/ai/whatsapp-assistant.service.spec.ts`.
- Menambahkan `apps/api/src/ai/whatsapp-assistant.service.ts`.
- Menambahkan `apps/api/src/auth/auth.service.change-password.spec.ts`.
- Menambahkan `apps/api/src/auth/password-hashing.util.spec.ts`.
- Menambahkan `apps/api/src/auth/password-hashing.util.ts`.
- Menambahkan `apps/api/src/widget/widget.service.spec.ts`.
- Menambahkan `apps/dashboard/public/notification/new-massages/universfield-ringtone-030-437513.mp3`.
- Menambahkan `apps/dashboard/public/notification/new-massages/universfield-ringtone-060-495415.mp3`.
- Menambahkan `apps/dashboard/public/notification/on-conversesion/universfield-new-notification-010-352755.mp3`.
- Menambahkan `extensions/whatsapp-assistant/README.md`.
- Menambahkan `extensions/whatsapp-assistant/background.js`.
- Menambahkan `extensions/whatsapp-assistant/content.js`.
- Menambahkan `extensions/whatsapp-assistant/manifest.json`.
- Menambahkan `extensions/whatsapp-assistant/sidepanel.css`.
- Menambahkan `extensions/whatsapp-assistant/sidepanel.html`.
- Menambahkan `extensions/whatsapp-assistant/sidepanel.js`.
- Menambahkan `extensions/whatsapp-assistant/system-prompt.md`.
- Menambahkan `packages/shared/src/password-policy.ts`.
- Menambahkan `scripts/test-whatsapp-extension-scanner.cjs`.
- Menambahkan `sdks/flutter/.gitignore`.
- Menambahkan `sdks/flutter/README.md`.
- Menambahkan `sdks/flutter/analysis_options.yaml`.
- Menambahkan `sdks/flutter/assets/conversation-bg.png`.
- Menambahkan `sdks/flutter/assets/icon-header.png`.
- Menambahkan `sdks/flutter/example/.gitignore`.
- Menambahkan `sdks/flutter/example/.metadata`.
- Menambahkan `sdks/flutter/example/README.md`.
- Menambahkan `sdks/flutter/example/analysis_options.yaml`.
- Menambahkan `sdks/flutter/example/android/.gitignore`.
- Menambahkan `sdks/flutter/example/android/app/build.gradle.kts`.
- Menambahkan `sdks/flutter/example/android/app/src/debug/AndroidManifest.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/main/AndroidManifest.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/main/kotlin/com/example/solidchat_flutter_example/MainActivity.kt`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/drawable-v21/launch_background.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/drawable/launch_background.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/mipmap-hdpi/ic_launcher.png`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/mipmap-mdpi/ic_launcher.png`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/values-night/styles.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/main/res/values/styles.xml`.
- Menambahkan `sdks/flutter/example/android/app/src/profile/AndroidManifest.xml`.
- Menambahkan `sdks/flutter/example/android/build.gradle.kts`.
- Menambahkan `sdks/flutter/example/android/gradle.properties`.
- Menambahkan `sdks/flutter/example/android/gradle/wrapper/gradle-wrapper.properties`.
- Menambahkan `sdks/flutter/example/android/settings.gradle.kts`.
- Menambahkan `sdks/flutter/example/ios/.gitignore`.
- Menambahkan `sdks/flutter/example/ios/Flutter/AppFrameworkInfo.plist`.
- Menambahkan `sdks/flutter/example/ios/Flutter/Debug.xcconfig`.
- Menambahkan `sdks/flutter/example/ios/Flutter/Release.xcconfig`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcodeproj/project.pbxproj`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcodeproj/project.xcworkspace/contents.xcworkspacedata`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcodeproj/xcshareddata/xcschemes/Runner.xcscheme`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcworkspace/contents.xcworkspacedata`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`.
- Menambahkan `sdks/flutter/example/ios/Runner.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`.
- Menambahkan `sdks/flutter/example/ios/Runner/AppDelegate.swift`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@1x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@3x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@1x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@3x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@3x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@3x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@1x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-83.5x83.5@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/Contents.json`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png`.
- Menambahkan `sdks/flutter/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md`.
- Menambahkan `sdks/flutter/example/ios/Runner/Base.lproj/LaunchScreen.storyboard`.
- Menambahkan `sdks/flutter/example/ios/Runner/Base.lproj/Main.storyboard`.
- Menambahkan `sdks/flutter/example/ios/Runner/Info.plist`.
- Menambahkan `sdks/flutter/example/ios/Runner/Runner-Bridging-Header.h`.
- Menambahkan `sdks/flutter/example/ios/RunnerTests/RunnerTests.swift`.
- Menambahkan `sdks/flutter/example/lib/main.dart`.
- Menambahkan `sdks/flutter/example/pubspec.yaml`.
- Menambahkan `sdks/flutter/example/test/widget_test.dart`.
- Menambahkan `sdks/flutter/lib/solidchat_flutter.dart`.
- Menambahkan `sdks/flutter/lib/src/api_client.dart`.
- Menambahkan `sdks/flutter/lib/src/models.dart`.
- Menambahkan `sdks/flutter/lib/src/realtime.dart`.
- Menambahkan `sdks/flutter/lib/src/solidchat_controller.dart`.
- Menambahkan `sdks/flutter/lib/src/solidchat_view.dart`.
- Menambahkan `sdks/flutter/lib/src/storage.dart`.
- Menambahkan `sdks/flutter/pubspec.yaml`.
- Menambahkan `sdks/flutter/test/models_test.dart`.
- Menambahkan `sdks/flutter` sebagai SDK null-safe dengan UI Material siap pakai untuk Android dan iOS, default production otomatis, visitor-session persistence, Widget REST API, Socket.IO realtime, pre-chat, AI/agent handoff, upload gambar, offline ticket, close/new conversation, rating, dan identity token opsional.
- Menambahkan contoh aplikasi Flutter satu layar beserta scaffold Android/iOS yang dapat langsung dijalankan, permission internet Android release, pengujian model/configuration dasar, dokumentasi integrasi tanpa perakitan UI/API, serta job analyze dan test Flutter pada workflow Mobile SDK.
- Menambahkan daftar agent online pada halaman Dashboard yang menampilkan nama, email, dan kapasitas chat aktif serta diperbarui secara realtime saat agent login, logout, atau mengganti status.
- Menambahkan endpoint khusus `api/v1/whatsapp-assistant` dengan constant-time API-key guard, konfigurasi site opsional, validasi payload, dan regression test service.
- Menambahkan fitur ganti password pada halaman Profile Agent/Admin dengan verifikasi password saat ini, konfirmasi password baru, kontrol tampil/sembunyikan, Argon2id salt baru, pencabutan sesi lain, dan audit log keamanan.
- Menambahkan kontrol tampilkan/sembunyikan password yang accessible pada halaman login Agent/Admin.
- Menambahkan notifikasi realtime khusus kepada agent tujuan ketika sebuah chat ditransfer, termasuk toast, browser notification, unread conversation, dan ringtone **New Messages**.
- Menambahkan presence otomatis untuk CS Agent: login password maupun SSO mengubah status menjadi **ONLINE**, sedangkan logout mengubahnya menjadi **OFFLINE** hanya ketika tidak ada sesi aktif lain; perubahan disiarkan realtime ke dashboard dan widget.
- Menambahkan system prompt khusus WhatsApp Extension sebagai `extensions/whatsapp-assistant/system-prompt.md` yang dibundel langsung di paket extension dan terpisah dari prompt Widget/Live Chat; backend hanya mengambil knowledge dari database dan tidak menyimpan prompt extension.
- Menyamakan behavior dan bentuk UI Flutter dengan widget website, termasuk bootstrap session terbaru, header/logo/status, background pola, bubble per role dan system message, rich text, typing animation, handoff agent dengan countdown persisten dan fallback AI, composer berbasis status realtime, staged image/caption dengan validasi, emoji picker, kategori offline ticket, ended state, dan rating overlay otomatis.

### Changed
- Memakai instruksi tambahan agent pada suggested reply tanpa menjadikannya sumber fakta atau mengesampingkan aturan grounding.
- Memasukkan seluruh file audio dari `public/notification/new-massages` ke daftar notifikasi **New Messages** Agent/Admin dan menjadikan `universfield-ringtone-030-437513.mp3` sebagai default; pilihan suara lama tetap tersedia untuk user yang telah memilihnya.
- Membatasi auto-reply untuk chat aktif dan memblokir pengiriman otomatis pada data sensitif, prompt injection, intent berisiko, jawaban kosong, atau confidence rendah.
- Memperbarui `.env.example`.
- Memperbarui `.github/workflows/mobile-sdk.yml`.
- Memperbarui `README.md`.
- Memperbarui `apps/api/src/admin/dto/admin.dto.ts`.
- Memperbarui `apps/api/src/admin/overview.controller.ts`.
- Memperbarui `apps/api/src/admin/users.service.ts`.
- Memperbarui `apps/api/src/agent/agent.service.spec.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/ai/ai.module.ts`.
- Memperbarui `apps/api/src/ai/dto/ai.dto.ts`.
- Memperbarui `apps/api/src/auth/account-settings.constants.ts`.
- Memperbarui `apps/api/src/auth/auth.controller.ts`.
- Memperbarui `apps/api/src/auth/auth.service.ts`.
- Memperbarui `apps/api/src/auth/clara-sso/clara-sso.service.ts`.
- Memperbarui `apps/api/src/auth/dto/auth.dto.ts`.
- Memperbarui `apps/api/src/common/filters/api-exception.filter.ts`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/api/src/leads/leads.service.spec.ts`.
- Memperbarui `apps/api/src/leads/leads.service.ts`.
- Memperbarui `apps/api/src/main.ts`.
- Memperbarui `apps/api/src/widget/widget.controller.ts`.
- Memperbarui `apps/api/src/widget/widget.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/dashboard/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/layout.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/profile/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/users/page.tsx`.
- Memperbarui `apps/dashboard/src/app/login/page.tsx`.
- Memperbarui `apps/dashboard/src/app/reset-password/page.tsx`.
- Memperbarui `apps/dashboard/src/lib/account-settings.ts`.
- Memperbarui `apps/dashboard/src/lib/notification-sounds.ts`.
- Memperbarui `apps/widget/src/App.tsx`.
- Memperbarui `apps/widget/src/hooks/use-conversation.ts`.
- Memperbarui `docs/api.md`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/shared/src/index.ts`.
- Memperbarui `sdks/README.md`.
- Memperbesar teks bubble percakapan WhatsApp Assistant Extension agar lebih mudah dibaca dan menaikkan versi source extension menjadi `0.2.8`.
- Memperketat aturan password Agent/Admin menjadi 8–64 karakter, wajib mengandung huruf besar, huruf kecil, angka, karakter khusus `! @ # $ % ^ & *`, tanpa spasi, serta mewajibkan konfirmasi yang sama pada form ganti dan reset password; seluruh pembuatan serta reset password API tetap memakai helper Argon2id terpusat dengan random salt 128-bit yang tertanam pada setiap hash.
- Menaikkan versi WhatsApp Assistant extension ke `0.2.0` untuk menandai perubahan autentikasi independen.
- Menghapus editor serta versioning system prompt WhatsApp Extension dari Dashboard/API configuration, mengirim prompt bundled bersama request assistant, dan menaikkan versi extension ke `0.2.5`.
- Menghapus login akun CS/Admin dari WhatsApp Assistant extension dan menggantinya dengan Extension Key khusus, sehingga extension berjalan independen dari sesi Dashboard tetapi tetap memakai AI serta knowledge base SolidChat.
- Menghapus seluruh UI konfigurasi koneksi WhatsApp Assistant dan membuat API URL, site, serta Extension Key terisi otomatis saat build; versi extension menjadi `0.2.1` dan koneksi diperiksa otomatis ketika side panel dibuka.
- Menghubungkan WhatsApp Assistant ke knowledge base `PUBLIC` dan `AGENT_ONLY` serta konfigurasi AI site yang sudah ada tanpa bergantung pada identitas agent Dashboard.
- Mengisi Extension Key pada artefak build extension tanpa menyimpan nilai rahasia tersebut di source repository, sehingga paket hasil build dapat langsung digunakan tanpa setup akun.
- Mengubah format file system prompt bundled WhatsApp Extension dari `system-prompt.txt` menjadi Markdown `system-prompt.md` dan menaikkan versi extension ke `0.2.6`.
- Mengubah notifikasi **New Messages** di Dashboard agar ringtone berulang terus-menerus selama maksimal 30 detik; event baru memperpanjang durasi tanpa menumpuk beberapa audio, dan suara langsung berhenti ketika opsi notifikasi dimatikan.
- Menyiapkan rilis production WhatsApp Assistant Extension `1.0.0` sebagai paket terpisah dari build lokal, menggunakan endpoint resmi, Extension Key bundled, UI teks percakapan yang diperbesar, animasi mengetik AI, dan tanpa izin host localhost.
- Menyiapkan varian production WhatsApp Assistant Extension terpisah sebagai versi `0.2.7.1`, terhubung langsung ke `https://live-chat.sg-berjangka.com`, memakai Extension Key bundled, dan tidak menyertakan izin host localhost.

### Fixed
- Memperbaiki error `Could not establish connection. Receiving end does not exist.` dengan injeksi content script otomatis dan retry ketika tab WhatsApp telah terbuka sebelum extension dimuat; versi extension menjadi `0.2.2`.
- Memperbaiki kegagalan menyimpan system prompt Widget atau mengirim prompt bundled WhatsApp Extension yang panjang dengan menaikkan batas JSON API secara terkontrol dari default 100 KB menjadi 1 MB serta mengembalikan pesan validasi yang jelas untuk payload berlebih.
- Memperbaiki opsi ringtone tambahan pada Account Settings dengan menyinkronkan ID **Xylophone**, **Knock**, dan **Bubble** ke allowlist API, memberi ID unik pada tiap suara, serta memperbaiki path preview audio Bubble.
- Memperbaiki scanner WhatsApp Extension yang melewatkan bubble terbaru tanpa ikon `tail-in`/`tail-out`: scanner kini menggabungkan seluruh variasi message row, menghapus duplikasi, mempertahankan urutan DOM, serta menentukan arah pesan melalui marker pengirim, pola `data-id`, dan posisi visual; versi extension menjadi `0.2.7`.
- Memperbaiki scanner WhatsApp Web yang selalu menampilkan `0 pesan` pada DOM terbaru dengan mendeteksi `conv-msg-*`, `msg-container`, serta arah bubble `tail-in`/`tail-out`; versi extension menjadi `0.2.3`.
- Memperbaiki transfer atau accept conversation yang mewarisi sisa timeout dari antrean/agent sebelumnya; setiap assignment agent kini mendapat waktu balas penuh dan countdown widget disinkronkan ulang dari waktu assignment terbaru.
- Memperbaiki warna teks input Flutter agar selalu putih dan terbaca pada composer, pre-chat, offline ticket, dropdown kategori, serta komentar rating meskipun theme aplikasi host menggunakan warna teks gelap.
- Memperbaiki widget website dan Flutter yang memulihkan conversation lama berstatus `CLOSED`/`RESOLVED`; aksi **Pesan Baru** kini hanya membuka pre-chat dan ID conversation baru dibuat setelah pengguna mengirim form, sedangkan backend mencegah pesan ditambahkan ke transcript yang sudah ditutup.
- Menambahkan indikator animasi tiga titik saat WhatsApp Assistant menunggu jawaban AI, termasuk fallback tanpa animasi untuk preferensi reduced motion dan pembersihan indikator ketika request berhasil atau gagal.
- Mencegah event realtime, bootstrap, atau response HTTP lama menimpa status conversation baru setelah pre-chat disubmit; submit pre-chat kini selalu membuat transcript baru sehingga kondisi **Percakapan berakhir** dari chat sebelumnya tidak terbawa ke visitor yang baru bergabung.
- Mengizinkan origin Chrome Extension yang memiliki format ID valid ketika WhatsApp Assistant dikonfigurasi, sehingga request reply tidak lagi gagal karena CORS; versi extension menjadi `0.2.4`.

## [0.17.0] - 2026-10-06
### Changed
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Mengubah tampilan tanggal pada transcript Inbox CS/Admin menjadi pemisah hari bergaya WhatsApp: `Today`, `Yesterday`, atau tanggal `dd/MM/yyyy`, sehingga pergantian hari dalam riwayat chat lebih mudah dikenali.

## [0.16.4] - 2026-09-29
### Added
- Menambahkan default production Android SDK untuk base URL `https://live-chat.sg-berjangka.com` dan site ID `solid-gold-main`.
- Menambahkan pengujian konfigurasi production dan memastikan `pageUrl` sesi native kosong secara default.
- Menambahkan `SolidChatClient.getAttachmentUrl()` agar aplikasi Android dapat meminta signed URL attachment MinIO melalui Widget API tanpa membawa credential storage di APK.

### Changed
- Memperbarui `package.json`.
- Android SDK kini menyimpan `visitorToken` bersama `visitorId` di `SharedPreferences`, menggunakan kembali token saat membuka layar chat, dan hanya membuat session baru ketika token tidak tersedia atau ditolak server.
- Konfigurasi Socket.IO Android kini menetapkan namespace `/widget` dan path `/socket.io/` secara eksplisit serta dokumentasi integrasi menjelaskan endpoint Widget API yang boleh dipakai aplikasi.
- Dokumentasi Android kini menjelaskan alur upload dan pembacaan gambar melalui bucket private MinIO, signed URL berumur pendek, serta pemisahan endpoint internal dan public signing endpoint.

## [0.16.3] - 2026-09-28
### Changed
- Memperbarui `package.json`.
- Memperbarui `sdks/README.md`.
- Memperbarui `sdks/android/README.md`.
- Memperbarui `sdks/android/solidchat-sdk/build.gradle.kts`.
- Memperbarui `sdks/ios/README.md`.
- Memperkaya deskripsi Maven POM untuk `com.solidchat:solidchat-android-sdk` dengan cakupan fitur, arsitektur native, metadata developer, SCM, dan issue tracker agar halaman GitHub Packages menjelaskan fungsi package secara jelas.
- Memperluas dokumentasi Android SDK dengan kemampuan, requirement, arsitektur, konfigurasi environment, lifecycle, batas tanggung jawab, keamanan, error handling, dan kebijakan versioning untuk tim integrator.

## [0.16.2] - 2026-09-28
### Changed
- Memperbarui `.github/workflows/mobile-sdk.yml`.
- Memperbarui `package.json`.
- Memperbarui `sdks/README.md`.
- Memperbarui `sdks/android/README.md`.
- Memperbarui `sdks/ios/README.md`.

### Fixed
- Memperbaiki quoting perintah pembaca versi pada workflow Mobile SDK agar branch `dev` dapat meneruskan versi release ke Gradle.

## [0.16.1] - 2026-09-28
### Changed
- Memperbarui `.github/workflows/mobile-sdk.yml`.
- Memperbarui `package.json`.
- Memperbarui `sdks/README.md`.
- Memperbarui `sdks/android/README.md`.
- Memperbarui `sdks/ios/README.md`.

### Fixed
- Memperbaiki setup Android SDK pada workflow Mobile SDK agar tidak meminta paket legacy `tools` yang sudah tidak tersedia dan hanya memasang `platform-tools` sebelum platform/build-tools versi 35.

## [0.16.0] - 2026-09-28
### Added
- Menambahkan `.github/workflows/mobile-sdk.yml`.
- Menambahkan `Package.swift`.
- Menambahkan distribusi Android SDK melalui GitHub Packages Maven dengan coordinate `com.solidchat:solidchat-android-sdk` dan metadata dependency transitif.
- Menambahkan manifest Swift Package pada root repository agar tim iOS dapat memasang `SolidChatSDK` langsung dari URL GitHub dan tag release.
- Menambahkan workflow Mobile SDK untuk memvalidasi Android/iOS, mengunggah artefak AAR, dan mempublish package Android secara otomatis dari branch `dev` atau manual dispatch.

### Changed
- Memperbarui `sdks/README.md`.
- Memperbarui `sdks/android/README.md`.
- Memperbarui `sdks/android/solidchat-sdk/build.gradle.kts`.
- Memperbarui `sdks/ios/README.md`.
- Memperbarui panduan integrasi tim mobile dengan credential, repository, dependency coordinate, versioning, dan local-development fallback.

## [0.15.0] - 2026-09-28
### Added
- Menambahkan `apps/api/src/ai/ai-answer-source.spec.ts`.
- Menambahkan `apps/api/src/knowledge/official-source-url.spec.ts`.
- Menambahkan `apps/api/src/knowledge/official-source-url.ts`.

### Changed
- Memperbarui `.env.example`.
- Memperbarui `apps/api/src/agent/agent.controller.ts`.
- Memperbarui `apps/api/src/agent/agent.service.spec.ts`.
- Memperbarui `apps/api/src/agent/agent.service.ts`.
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `apps/api/src/ai/ai.controller.ts`.
- Memperbarui `apps/api/src/config/env.validation.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/api/src/knowledge/dto/knowledge.dto.ts`.
- Memperbarui `apps/api/src/knowledge/knowledge.service.ts`.
- Memperbarui `apps/api/src/knowledge/retrieval.service.ts`.
- Memperbarui `apps/api/src/leads/leads.service.spec.ts`.
- Memperbarui `apps/api/src/leads/leads.service.ts`.
- Memperbarui `apps/api/src/realtime/widget.gateway.ts`.
- Memperbarui `apps/api/src/widget/widget.controller.ts`.
- Memperbarui `apps/api/test/widget.e2e-spec.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/ai/runs/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/layout.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/[documentId]/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/new/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `apps/widget/src/lib/rich-text.tsx`.
- Memperbarui `package.json`.
- Memperbarui `packages/ai-core/src/providers/mock-provider.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/ai-core/src/retrieval/knowledge-retriever.spec.ts`.
- Memperbarui `packages/ai-core/src/retrieval/knowledge-retriever.ts`.
- Memperbarui `packages/database/prisma/schema.prisma`.
- Memperbarui `packages/shared/src/ai-provider.ts`.
- Memperbarui `packages/shared/src/enums.ts`.
- Memperbarui `packages/shared/src/types.ts`.

## [0.14.0] - 2026-09-28
### Added
- Menambahkan SDK mobile native yang terisolasi di `sdks/android` dan `sdks/ios`, masing-masing berisi headless client, persistence visitor/conversation, integrasi REST + Socket.IO, serta UI siap pakai berbasis Jetpack Compose dan SwiftUI tanpa WebView.
- Menambahkan URL sumber resmi opsional pada Knowledge Base dari editor dashboard hingga retrieval AI, lengkap dengan allowlist domain resmi dan link aman yang dapat dibuka dari widget.
- Menambahkan `sdks/README.md`.
- Menambahkan `sdks/android/.gitignore`.
- Menambahkan `sdks/android/README.md`.
- Menambahkan `sdks/android/build.gradle.kts`.
- Menambahkan `sdks/android/gradle.properties`.
- Menambahkan `sdks/android/settings.gradle.kts`.
- Menambahkan `sdks/android/solidchat-sdk/build.gradle.kts`.
- Menambahkan `sdks/android/solidchat-sdk/consumer-rules.pro`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/AndroidManifest.xml`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/SolidChatApi.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/SolidChatClient.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/SolidChatModels.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/SolidChatRealtime.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/SolidChatStorage.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/main/kotlin/com/solidchat/sdk/ui/SolidChatScreen.kt`.
- Menambahkan `sdks/android/solidchat-sdk/src/test/kotlin/com/solidchat/sdk/SolidChatStateTest.kt`.
- Menambahkan `sdks/ios/.gitignore`.
- Menambahkan `sdks/ios/Package.swift`.
- Menambahkan `sdks/ios/README.md`.
- Menambahkan `sdks/ios/Sources/SolidChatSDK/SolidChatAPI.swift`.
- Menambahkan `sdks/ios/Sources/SolidChatSDK/SolidChatClient.swift`.
- Menambahkan `sdks/ios/Sources/SolidChatSDK/SolidChatModels.swift`.
- Menambahkan `sdks/ios/Sources/SolidChatSDK/SolidChatStorage.swift`.
- Menambahkan `sdks/ios/Sources/SolidChatSDK/SolidChatView.swift`.
- Menambahkan `sdks/ios/Tests/SolidChatSDKTests/SolidChatStateTests.swift`.
- Menambahkan dokumentasi integrasi, matriks parity, contoh host app, pedoman keamanan token, dan pengujian state dasar untuk SDK Android/iOS.
- Menambahkan parity flow widget pada kedua SDK: bootstrap session, resume conversation, pre-chat lead, realtime message/status/typing/presence, handoff dan timeout agent, upload gambar, offline ticket, close/new conversation, rating, serta customer identity token.
- Menambahkan timeline handoff pada halaman AI Runs dengan sumber request eksplisit: tombol user, keputusan AI, rule sistem, fallback error, atau data lama yang belum memiliki sumber.
- Menambahkan tombol Detail dan modal informasi AI Run yang menampilkan alasan handoff, hasil pengalihan, status model, confidence, latensi, dan error terkait.
- Menambahkan tombol backup seluruh percakapan ke file JSON pada Inbox Superadmin, lengkap dengan pesan, metadata lampiran, context, event, assignment, ringkasan, AI run, feedback, lead, dan tiket terkait.

### Changed
- Memperbarui `README.md`.
- Memperbarui `docs/architecture.md`.
- Memperbarui `package.json`.

### Fixed
- Memastikan chat baru tetap membuat conversation terpisah meskipun email atau nomor telepon sudah pernah digunakan, sehingga riwayat conversation lama tidak dilanjutkan atau dipindahkan ke visitor baru.
- Mencatat AI Run yang benar-benar memicu handoff serta membatasi data AI Runs agar hanya dapat diakses oleh organisasi pemiliknya.

## [0.13.1] - 2026-09-21
### Changed
- Memperbarui `apps/widget-loader/src/loader.ts`.
- Memperbarui `package.json`.
- Menyesuaikan ukuran ikon bubble Live Chat menjadi 120×120px pada desktop dan 100×100px pada perangkat mobile, termasuk posisi badge agar tetap proporsional.

### Fixed
- Memastikan panel Live Chat tampil fullscreen pada viewport mobile, termasuk ketika diuji melalui mode responsif browser yang masih melaporkan pointer desktop.
- Memastikan ukuran bubble mobile 100×100px diterapkan berdasarkan lebar viewport tanpa bergantung pada kemampuan pointer perangkat.
- Menghilangkan celah kosong di sisi kanan panel fullscreen dengan memberi iframe aturan `left: 0; width: 100%; max-width: none`. Iframe adalah elemen replaced sehingga `left: 0; right: 0; width: auto` tidak melebarkannya (tetap 300px), dan `max-width: calc(100vw - 40px)` dari mode desktop sebelumnya menyisakan celah di kanan. `visualViewport` tetap menangani tinggi saat keyboard mobile terbuka.

## [0.13.0] - 2026-09-21
### Added
- Tombol Upload Knowledge kini membuka modal upload batch Markdown dengan area drag & drop dan progres unggahan.

### Changed
- Kontrol status Knowledge kini menampilkan indikator loading ringkas di dalam switch saat perubahan individual sedang disimpan, serta loading pada aksi massal.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `package.json`.
- Upload Knowledge kini meminta konfirmasi setelah file dipilih atau dijatuhkan sebelum menyimpan artikel ke server.

### Fixed
- Index Knowledge kini menampilkan seluruh artikel melalui pagination server-side, bukan berhenti pada 20 artikel pertama.

## [0.12.0] - 2026-09-21
### Added
- Dashboard Knowledge kini mendukung upload batch hingga 50 file Markdown sekaligus, lengkap dengan progres dan laporan file yang gagal.

### Changed
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/new/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `apps/widget-loader/src/loader.ts`.
- Memperbarui `package.json`.
- Mengecilkan bubble icon widget menjadi 120px pada desktop dan 90px pada perangkat mobile agar tampil lebih proporsional.

### Fixed
- Setelah artikel Knowledge baru berhasil dibuat, Dashboard kini kembali ke halaman index Knowledge agar daftar artikel terbaru langsung terlihat.

## [0.11.1] - 2026-09-16
### Changed
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `apps/api/src/ai/handoff-evaluator.service.spec.ts`.
- Memperbarui `apps/api/src/ai/handoff-evaluator.service.ts`.
- Memperbarui `apps/api/src/knowledge/retrieval.service.ts`.
- Memperbarui `packages/ai-core/src/providers/mock-provider.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/ai-core/src/retrieval/knowledge-retriever.spec.ts`.
- Memperbarui `packages/ai-core/src/retrieval/knowledge-retriever.ts`.
- Memperbarui `packages/shared/src/types.ts`.

## [0.11.0] - 2026-09-16
### Added
- Memakai nama user pada header dan pengirim pesan transkrip Inbox, bukan label generik “Customer”.
- Menambahkan fitur transkrip chat pada detail Inbox untuk melihat dan mengunduh riwayat percakapan sebagai file `.txt`.

### Changed
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.

### Fixed
- Stop forcing agent transfer solely from the classifier's `HUMAN_REQUEST` label; the AI now evaluates the full message and conversation context, preventing explanatory questions about agents from being routed away with an empty answer.
- Preserve AI-verified calculation results during grounding review, so valid conversions such as a Rupiah top-up divided by the documented fixed rate are no longer replaced by an unnecessary fallback response.
- Memperluas calculation reviewer agar AI membandingkan nominal customer dengan batas minimum/maksimum yang tersedia di Knowledge, termasuk memverifikasi mata uang sebelum membuat kesimpulan kelayakan transaksi.
- Memprioritaskan retrieval dari pertanyaan customer terbaru, lalu menambahkan konteks riwayat sebagai evidence pendukung agar pertanyaan nominal yang jelas tidak kehilangan rate atau batas resmi karena chat lama yang tidak relevan.
- Membatasi full context retrieval pada chunk Knowledge yang bertetangga dengan hasil relevan agar jawaban AI tidak tercampur bagian dokumen yang jauh dan tidak terkait.
- Menambahkan retrieval query yang disusun AI saat klasifikasi intent agar pertanyaan konversi, produk, atau syarat transaksi dapat menemukan konsep Knowledge yang diperlukan meski bahasa customer santai atau nominalnya spesifik.

## [0.10.4] - 2026-09-16
### Changed
- Memperbarui `apps/api/src/common/utils/content-guard.spec.ts`.
- Memperbarui `packages/shared/src/constants.ts`.

### Fixed
- Memperbaiki content guard agar nominal enam digit untuk top-up atau transaksi tidak lagi dimasking sebagai OTP/PIN dan tidak memicu handoff keliru.

## [0.10.3] - 2026-09-16
### Changed
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.

### Fixed
- Menambahkan fallback handoff yang memberi respons ketika proses AI gagal total, sehingga customer tidak mengalami chat tanpa balasan.
- Menstabilkan jawaban AI berbasis Knowledge dengan temperature rendah, validasi grounding angka yang lebih akurat, serta instruksi agar seluruh evidence dinilai bersama sebelum menyimpulkan konversi lintas mata uang atau batas minimum.

## [0.10.2] - 2026-09-16
### Changed
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.

### Fixed
- Mencegah jawaban AI biasa—termasuk jawaban top-up yang valid—secara otomatis memindahkan customer ke antrean agent. Transfer reguler kini hanya terjadi dari keputusan handoff terstruktur `TRANSFER` atau eskalasi keselamatan yang wajib.

## [0.10.1] - 2026-09-16
### Changed
- Memperbarui `package.json`.

## [0.10.0] - 2026-09-16
### Added
- Menambahkan batch select pada tabel Dashboard Knowledge, termasuk pilih semua artikel yang tampil serta aksi massal aktifkan, nonaktifkan, dan hapus dengan konfirmasi.

### Changed
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `package.json`.

## [0.9.6] - 2026-09-16
### Added
- Menambahkan `apps/api/src/market-data/market-data.service.spec.ts`.
- Menambahkan `packages/database/prisma/migrations/20260916064500_expand_ai_prompt_content_to_longtext/migration.sql`.

### Changed
- Memasukkan konteks percakapan terbaru ke query retrieval knowledge agar pertanyaan lanjutan seperti konversi top-up tetap memuat rate atau rumus resmi yang baru dibahas.
- Membuat penyimpanan versi System Prompt atomik: prompt lama baru dinonaktifkan setelah prompt baru berhasil dibuat, sehingga kegagalan simpan tidak mengosongkan prompt aktif.
- Memperbaiki Inbox Dashboard agar chat berstatus `AI_ACTIVE` hanya menampilkan satu tombol `Take Over`, bukan duplikat tombol accept dan takeover.
- Memperbaiki grounding review agar hasil aritmetika yang diturunkan dari rate atau rumus eksplisit di knowledge base tidak salah ditolak sebagai fakta yang dibuat-buat; validasi hasilnya tetap dilakukan oleh calculation reviewer.
- Memperbaiki penilaian AI untuk pertanyaan market agar Gold/forex tetap diproses sebagai topik layanan dan respons keputusan mengikuti bahasa customer.
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `apps/api/src/ai/ai.controller.ts`.
- Memperbarui `apps/api/src/conversations/conversation-timeout.constants.ts`.
- Memperbarui `apps/api/src/conversations/conversation-timeout.processor.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/api/src/market-data/market-data.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/inbox/[conversationId]/page.tsx`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/knowledge/page.tsx`.
- Memperbarui `package.json`.
- Memperbarui `packages/ai-core/src/providers/mock-provider.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.spec.ts`.
- Memperbarui `packages/ai-core/src/providers/openai-provider.ts`.
- Memperbarui `packages/database/prisma/schema.prisma`.
- Memperbarui `packages/shared/src/ai-provider.ts`.
- Memperbarui `packages/shared/src/queues.ts`.
- Memperhalus notifikasi saat tidak ada agent online dengan permohonan maaf yang jelas untuk customer.
- Memperjelas pembeda semantik antara kebutuhan mengirim gambar dan persetujuan handoff, sehingga AI menawarkan agent terlebih dahulu sebelum memasukkan chat ke antrean.
- Memperluas kolom `ai_prompts.content` dari MySQL `TEXT` ke `LONGTEXT` agar System Prompt panjang dapat disimpan dari Dashboard tanpa error server 500.
- Mempersempit routing harga market real-time agar pertanyaan transaksi seperti top-up, deposit, kurs, atau saldo tidak mewarisi simbol market dari konteks chat sebelumnya dan melewati respons AI.
- Menambahkan dukungan respons Bahasa Inggris: AI kini menjawab sesuai bahasa pesan customer (Indonesia atau Inggris) sambil tetap menggunakan knowledge base berbahasa Indonesia sebagai sumber fakta.
- Menambahkan keputusan AI `OUT_OF_SCOPE` sebelum generasi jawaban agar permintaan kode atau tugas umum dihentikan secara konsisten tanpa rule berbasis kata kunci.
- Menambahkan penilaian handoff terstruktur oleh model AI (`NONE`, `OFFER`, atau `TRANSFER`) sebelum jawaban reguler, agar keputusan dan teks pengalihan konsisten dengan konteks percakapan tanpa regex backend.
- Menambahkan sinyal bahasa output pada pesan ke model agar default situs Indonesia tidak menimpa pertanyaan customer berbahasa Inggris.
- Menambahkan tombol unduh `.md` pada setiap dokumen di Dashboard Knowledge untuk mengekspor isi knowledge base langsung dari browser.
- Mencegah AI menghasilkan kode atau bantuan teknis umum di luar scope customer service Solid Gold; permintaan tersebut kini diarahkan kembali ke layanan yang relevan.
- Mengembalikan lifecycle percakapan AI tidak aktif: reminder pada menit ke-5, peringatan penutupan pada sekitar menit ke-9:40, lalu auto-close pada menit ke-10; timer direset ketika customer mengirim pesan baru dan dibatalkan saat chat dialihkan atau ditutup.
- Menghapus respons dan handoff berbasis regex untuk permintaan gambar di `AiOrchestratorService`; AI kini menilai konteks percakapan dan menentukan jawaban sendiri, sementara validasi teknis upload tetap berlaku.
- Mengubah prioritas respons AI agar model menyusun jawaban secara mandiri dari konteks dan fakta knowledge base, sementara aturan stage/CTA/script hanya menjadi guardrail dan tidak lagi dijalankan sebagai template mekanis.
- Mengubah verifikasi kalkulasi AI menjadi model-driven untuk seluruh jawaban berbasis knowledge, sehingga AI dapat mengenali konversi kurs/top-up dari konteks alami tanpa bergantung pada regex kata kunci; hasil numerik tetap divalidasi oleh code terhadap ekspresi yang diberikan model.
- Menyerahkan keputusan handoff kepada output model AI, termasuk saat customer ingin mengirim gambar; AI kini menawarkan agent terlebih dahulu dan hanya mengalihkan setelah memahami persetujuan customer dari konteks percakapan.
- Menyesuaikan instruksi handoff AI agar setelah customer menyetujui pengalihan, respons mengonfirmasi proses transfer tanpa mengulang tawaran agent.
- Menyesuaikan respons harga market real-time agar label dan waktu pembaruan mengikuti Bahasa Indonesia atau Inggris dari pesan customer.

## [0.9.5] - 2026-09-15
### Changed
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `package.json`.
- Mengubah handoff dari widget menjadi antrean manual: chat tidak lagi auto-assigned ke agent mana pun, sehingga agent mengambilnya sendiri dari inbox.

## [0.9.4] - 2026-09-15
### Added
- Menambahkan pengeditan nama, upload, tampil, dan hapus foto profil pengguna pada Dashboard, termasuk penyimpanan avatar privat dan URL unduhan bertanda tangan.
- Menambahkan respons AI khusus untuk permintaan kirim gambar: gambar hanya dapat dikirim setelah agent menangani percakapan, dengan tawaran menghubungkan user ke agent yang tersedia.

### Changed
- Memisahkan status Live Chat dari availability agent: indikator header kini mengikuti toggle `Live Chat Online` di Widget Settings, sedangkan status agent tetap khusus mengatur alur handoff dan tiket.
- Memperbarui `apps/api/src/ai/ai-orchestrator.service.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.spec.ts`.
- Memperbarui `apps/api/src/conversations/conversations.service.ts`.
- Memperbarui `apps/dashboard/src/app/(dashboard)/widget/page.tsx`.
- Memperbarui `apps/widget/src/App.tsx`.
- Memperbarui `apps/widget/src/components/Header.tsx`.
- Memperbarui `package.json`.
- Memperluas deteksi pertanyaan kirim gambar/foto agar bahasa santai seperti “Bisa kirim gambar gak?” selalu menawarkan koneksi ke agent, termasuk pada preview knowledge AI.
- Menambahkan validasi permintaan agent: bila tidak ada agent online, widget menampilkan notifikasi bahwa AI tetap siap membantu dan percakapan tidak masuk antrean kosong.
- Mengganti seluruh checkbox perilaku pada Widget Settings menjadi toggle On/Off agar status setiap pengaturan lebih jelas dan mudah dikendalikan.
- Mengubah alur offline widget agar hanya toggle `Live Chat Online` yang memunculkan form tiket; availability agent tidak lagi mengalihkan percakapan AI menjadi tiket.
- Mengunci launcher icon widget dengan `clamp(100px, 8vw, 135px)` agar responsif tanpa pernah mengecil di bawah 100px atau membesar melewati 135px.
- Menjalankan handoff agent otomatis saat user mengonfirmasi tawaran koneksi untuk kirim gambar, sehingga jawaban seperti “iya” tidak lagi berhenti sebagai respons teks AI.
- Menyederhanakan queue timeout percakapan menjadi timeout balasan agent dan menonaktifkan lifecycle penutupan otomatis saat AI tidak aktif.
- Menyesuaikan Inbox Superadmin agar menggunakan tab Waiting dan All Chats, serta memperbarui aset dan dependensi workspace terkait.

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

[Unreleased]: https://github.com/bizdevsg/live-chat/compare/v0.19.0...HEAD
[0.19.0]: https://github.com/bizdevsg/live-chat/compare/v0.18.2...v0.19.0
[0.18.2]: https://github.com/bizdevsg/live-chat/compare/v0.18.1...v0.18.2
[0.18.1]: https://github.com/bizdevsg/live-chat/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/bizdevsg/live-chat/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/bizdevsg/live-chat/compare/v0.16.4...v0.17.0
[0.16.4]: https://github.com/bizdevsg/live-chat/compare/v0.16.3...v0.16.4
[0.16.3]: https://github.com/bizdevsg/live-chat/compare/v0.16.2...v0.16.3
[0.16.2]: https://github.com/bizdevsg/live-chat/compare/v0.16.1...v0.16.2
[0.16.1]: https://github.com/bizdevsg/live-chat/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/bizdevsg/live-chat/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/bizdevsg/live-chat/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/bizdevsg/live-chat/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/bizdevsg/live-chat/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/bizdevsg/live-chat/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/bizdevsg/live-chat/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/bizdevsg/live-chat/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/bizdevsg/live-chat/compare/v0.10.4...v0.11.0
[0.10.4]: https://github.com/bizdevsg/live-chat/compare/v0.10.3...v0.10.4
[0.10.3]: https://github.com/bizdevsg/live-chat/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/bizdevsg/live-chat/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/bizdevsg/live-chat/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/bizdevsg/live-chat/compare/v0.9.6...v0.10.0
[0.9.6]: https://github.com/bizdevsg/live-chat/compare/v0.9.5...v0.9.6
[0.9.5]: https://github.com/bizdevsg/live-chat/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/bizdevsg/live-chat/compare/v0.9.3...v0.9.4
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
