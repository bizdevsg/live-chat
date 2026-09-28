# SolidChat Mobile SDKs

SDK mobile ini adalah consumer native baru untuk kontrak publik `api/v1/widget` dan namespace Socket.IO `/widget` yang sudah digunakan web widget. Tidak ada endpoint, schema database, atau perilaku web widget yang diganti.

## Paket

- [`android/`](android/README.md): Kotlin core SDK + Jetpack Compose UI, minimum Android 7/API 24.
- [`ios/`](ios/README.md): Swift core SDK + SwiftUI UI, minimum iOS 16.

Keduanya dapat dipakai sebagai headless client atau dengan layar chat bawaan. UI bawaan bukan WebView.

## Distribusi untuk tim mobile

- Android: GitHub Packages Maven, coordinate `com.solidchat:solidchat-android-sdk:<version>`.
- iOS: Swift Package URL `https://github.com/bizdevsg/live-chat.git`.
- Versi SDK mengikuti tag release repository, misalnya `v0.16.1` dipakai sebagai dependency `0.16.1`.
- Workflow `.github/workflows/mobile-sdk.yml` membangun kedua platform pada perubahan SDK dan mempublish Android package ketika perubahan SDK masuk ke branch `dev` atau workflow dijalankan manual. Tag `v*` menjadi versi Swift Package yang dapat dipilih Xcode.

Tim mobile hanya menerima API base URL, `siteId`, versi dependency, dan identity token yang diterbitkan backend. Secret penandatanganan tidak pernah ditempatkan dalam aplikasi.

## Parity dengan web widget

| Perilaku | Android | iOS |
|---|---:|---:|
| Bootstrap visitor session dan config site | ✅ | ✅ |
| Resume active conversation per site | ✅ | ✅ |
| Pre-chat lead + pesan pertama | ✅ | ✅ |
| Realtime message/status/typing/presence | ✅ | ✅ |
| Optimistic send + `clientMessageId` idempotency | ✅ | ✅ |
| Minta agent + fallback timeout kembali ke AI | ✅ | ✅ |
| Upload gambar hanya saat agent menangani | ✅ | ✅ |
| Close/new conversation | ✅ | ✅ |
| Offline ticket flow | ✅ | ✅ |
| Rating setelah conversation selesai | ✅ | ✅ |
| Customer identity token | ✅ | ✅ |
| API headless untuk UI custom | ✅ | ✅ |

## Batas keamanan

- SDK tidak menyimpan credential backend atau secret di aplikasi. `siteId` memang identifier publik seperti pada snippet widget.
- Customer yang login sebaiknya dipetakan dengan identity JWT berumur pendek dari backend aplikasi melalui `identify(...)`; jangan menandatangani token itu di mobile app.
- Mobile session tidak mengirim domain web palsu. `pageUrl` hanya dikirim bila host app memberikannya secara eksplisit.
- Visitor token hanya digunakan sebagai Bearer token dan payload auth Socket.IO. Semua ownership dan rate-limit tetap ditegakkan backend yang sama.

## Contract stability

SDK sengaja hanya membaca field backend yang dibutuhkan dan decoder mengabaikan field tambahan. Penambahan field pada API tidak mematahkan SDK. Perubahan nama endpoint/event atau field wajib tetap dianggap breaking change dan perlu diuji terhadap ketiga client: widget, Android, dan iOS.
