# SolidChat Android SDK

SolidChat Android SDK adalah package native Kotlin untuk menghadirkan layanan customer support berbasis AI dan human agent ke aplikasi Android. SDK berkomunikasi langsung dengan REST API dan namespace Socket.IO `/widget`, sehingga seluruh UI dirender secara native dan tidak menggunakan WebView.

Package menyediakan dua lapisan integrasi:

- **Headless SDK** melalui `SolidChatClient` untuk aplikasi yang ingin membuat UI chat sendiri.
- **Ready-to-use UI** melalui `SolidChatScreen` berbasis Jetpack Compose untuk integrasi yang lebih cepat.

SDK menggunakan kontrak backend publik yang sama dengan web widget, tetapi lifecycle, persistence, koneksi realtime, dan UI Android berjalan secara independen. Mengintegrasikan package ini tidak mengganti atau mengganggu web widget yang sudah aktif.

## Kemampuan utama

- Membuat visitor session dan mengambil konfigurasi site dari backend SolidChat.
- Menyimpan visitor ID dan conversation aktif per `siteId`, lalu melanjutkannya saat aplikasi dibuka kembali.
- Mengirim dan menerima pesan secara realtime melalui Socket.IO.
- Optimistic message rendering dengan `clientMessageId` untuk mencegah duplikasi ketika request diulang.
- Menampilkan indikator koneksi serta status mengetik dari AI dan human agent.
- Menangani perpindahan percakapan dari AI ke human agent dan fallback otomatis ketika agent melewati batas waktu respons.
- Menjalankan pre-chat form, lead capture, pesan pertama, dan consent flow.
- Menampilkan offline ticket form saat layanan human chat dimatikan.
- Mengunggah gambar ketika conversation sedang ditangani human agent.
- Menutup conversation, memulai conversation baru, dan mengirim rating setelah percakapan selesai.
- Menghubungkan visitor dengan customer yang login menggunakan identity token dari backend aplikasi.
- Menyediakan state reaktif berbasis `StateFlow<SolidChatState>` untuk UI custom.

## Requirement

| Komponen | Requirement |
|---|---|
| Android | API 24 atau lebih baru |
| Compile SDK | Android 35 |
| Java | JDK 17 |
| UI | Jetpack Compose + Material 3 |
| Realtime | Socket.IO client |
| HTTP | OkHttp |
| Serialization | Kotlinx Serialization |

Host app membutuhkan akses ke base URL API SolidChat dan `siteId` publik. Package tidak membutuhkan API key, database credential, OpenAI key, atau secret penandatanganan.

Konfigurasi production PT Solid Gold Berjangka sudah menjadi default SDK:

- Base URL: `https://live-chat.sg-berjangka.com`
- REST Widget API: `https://live-chat.sg-berjangka.com/api/v1/widget`
- Socket.IO: namespace `/widget`, path `/socket.io/`
- Site ID: `solid-gold-main`

Endpoint `/admin`, `/agent`, dan `/auth` tidak digunakan oleh SDK Android karena hanya ditujukan untuk dashboard CS/admin.

## Arsitektur singkat

```text
Android application
  ├─ SolidChatScreen (opsional, Jetpack Compose)
  └─ SolidChatClient
       ├─ REST API: session, history, message, lead, ticket, rating, upload
       ├─ Socket.IO /widget: message, status, typing, presence
       └─ SharedPreferences: visitor dan conversation persistence
                    │
                    ▼
             SolidChat Backend
```

`SolidChatClient` menjadi satu-satunya sumber state. `SolidChatScreen` hanya mengamati state tersebut dan memanggil API publik client, sehingga host app dapat mengganti seluruh UI tanpa menduplikasi logika session dan realtime.

## Instalasi dari GitHub Packages

Tambahkan credential GitHub pada `~/.gradle/gradle.properties` milik developer atau secret CI. Token memerlukan akses `read:packages` dan, untuk repository private, akses repository:

```properties
gpr.user=GITHUB_USERNAME
gpr.key=GITHUB_TOKEN
```

Daftarkan repository pada `settings.gradle.kts` aplikasi:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/bizdevsg/live-chat")
            credentials {
                username = providers.gradleProperty("gpr.user").get()
                password = providers.gradleProperty("gpr.key").get()
            }
        }
    }
}
```

Tambahkan dependency SDK dengan versi release yang disepakati:

```kotlin
dependencies {
    implementation("com.solidchat:solidchat-android-sdk:0.16.3")
}
```

## Menambahkan module secara lokal

Cara ini hanya untuk pengembangan SDK langsung dari monorepo:

```kotlin
// settings.gradle.kts milik aplikasi
include(":solidchat-sdk")
project(":solidchat-sdk").projectDir = file("../live-chat/sdks/android/solidchat-sdk")
```

```kotlin
// app/build.gradle.kts
dependencies {
    implementation(project(":solidchat-sdk"))
}
```

Host app wajib memiliki permission `INTERNET`; manifest SDK sudah mendeklarasikannya dan manifest merger akan membawanya ke app.

## Konfigurasi environment

Jangan menulis URL production langsung di source Activity. Pisahkan konfigurasi menggunakan `BuildConfig` atau mekanisme environment milik aplikasi:

```kotlin
SolidChatConfig(
    apiUrl = BuildConfig.SOLIDCHAT_API_URL,
    siteId = BuildConfig.SOLIDCHAT_SITE_ID,
    language = "id",
)
```

Untuk aplikasi resmi PT Solid Gold Berjangka, konfigurasi default production dapat digunakan langsung:

```kotlin
val config = SolidChatConfig()
```

Untuk Android Emulator yang mengakses backend lokal di komputer gunakan `http://10.0.2.2:4000`. Perangkat fisik harus memakai alamat LAN yang dapat dijangkau atau endpoint HTTPS development.

## UI siap pakai

```kotlin
class ChatActivity : ComponentActivity() {
    private val chatClient by lazy {
        SolidChatClient(
            applicationContext,
            SolidChatConfig(),
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                SolidChatScreen(
                    client = chatClient,
                    onRequestImage = {
                        // Buka Android Photo Picker milik host app, salin URI ke cache,
                        // lalu kembalikan SelectedImage(file, mimeType).
                        null
                    },
                    onClose = ::finish,
                )
            }
        }
    }

    override fun onDestroy() {
        chatClient.close()
        super.onDestroy()
    }
}
```

Photo picker tetap dimiliki host app agar permission dan Activity Result lifecycle tidak dipaksakan oleh SDK.

## Headless

```kotlin
val client = SolidChatClient(context, SolidChatConfig(apiUrl, siteId))
client.initialize()

lifecycleScope.launch {
    client.state.collect { state -> render(state) }
}

lifecycleScope.launch {
    client.sendMessage("Halo")
    client.requestAgent()
}
```

API publik penting: `initialize`, `sendMessage`, `uploadImage`, `getAttachmentUrl`, `submitPreChat`, `submitTicket`, `requestAgent`, `closeConversation`, `startNewConversation`, `submitFeedback`, `identify`, `notifyTyping`, `markRead`, `reset`, dan `close`.

## Penyimpanan gambar dengan MinIO

SDK tidak pernah mengakses MinIO memakai credential secara langsung. APK juga tidak boleh berisi `S3_ACCESS_KEY`, `S3_SECRET_KEY`, atau `MINIO_ROOT_PASSWORD`. Semua operasi storage melewati Widget API:

```text
Android SDK
  ├─ POST /api/v1/widget/conversations/:id/images
  │    └─ API memvalidasi file dan menyimpannya ke bucket private MinIO
  └─ GET /api/v1/widget/conversations/:conversationId/attachments/:attachmentId/url
       └─ API mengembalikan signed URL berumur pendek
```

Upload gambar dilakukan melalui API publik SDK:

```kotlin
client.uploadImage(
    file = cachedImageFile,
    mimeType = "image/jpeg",
    caption = "Bukti pendukung",
)
```

Untuk menampilkan attachment pada UI custom, minta signed URL ketika gambar akan dimuat. Jangan menyimpan URL tersebut karena masa berlakunya terbatas:

```kotlin
val signedUrl = client.getAttachmentUrl(message.attachments.first().id)
// Berikan signedUrl ke image loader Android, misalnya Coil atau Glide.
```

MinIO tetap dikonfigurasi hanya pada environment server. Contoh deployment Docker:

```dotenv
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=https://DOMAIN-MINIO-PUBLIK
S3_REGION=us-east-1
S3_ACCESS_KEY=solidchat
S3_SECRET_KEY=SECRET_YANG_KUAT
S3_BUCKET=solidchat
MINIO_ROOT_USER=solidchat
MINIO_ROOT_PASSWORD=SECRET_YANG_KUAT
```

`S3_ENDPOINT` dipakai API di jaringan internal. `S3_PUBLIC_ENDPOINT` wajib berupa origin HTTPS yang dapat dijangkau perangkat Android karena hostname tersebut ikut ditandatangani pada signed URL. Bucket tetap private; file hanya dibaca menggunakan signed URL dari endpoint Widget API.

## Lifecycle dan persistence

- Buat satu `SolidChatClient` untuk satu layar/session chat, idealnya melalui dependency injection atau `ViewModel` dengan scope yang sesuai.
- Panggil `initialize()` sekali ketika flow chat dimulai. `SolidChatScreen` melakukannya otomatis.
- SDK membuat `visitorId` UUID satu kali dan menyimpannya di `SharedPreferences` per `siteId`.
- `visitorToken` juga disimpan dan digunakan kembali. Endpoint `/session` hanya dipanggil saat token belum tersedia atau server menyatakan token kedaluwarsa/tidak valid, sehingga tidak membebani rate limit session ketika layar chat dibuka berulang kali.
- `pageUrl` secara default tidak dikirim untuk integrasi native, sehingga validasi allowed domain khusus widget web tidak dijalankan.
- Panggil `close()` ketika owner permanen client dihancurkan agar koneksi Socket.IO dan coroutine scope dilepas.
- `reset()` menghapus visitor dan conversation lokal. Gunakan saat logout hanya bila produk memang ingin memulai identitas chat baru.
- Conversation yang masih aktif otomatis dilanjutkan. Conversation berstatus `RESOLVED` atau `CLOSED` menawarkan flow pesan baru.

## Identitas customer

```kotlin
// identityToken harus diterbitkan backend tepercaya, bukan dibuat di APK.
client.identify(identityTokenFromYourBackend)
```

Identity token harus dibuat oleh backend tepercaya dan berumur pendek. Jangan pernah memasukkan `CUSTOMER_IDENTITY_JWT_SECRET` atau signing secret lain ke APK.

## Batas tanggung jawab SDK

SDK menangani transport, state chat, persistence, dan UI bawaan. Host app tetap bertanggung jawab atas:

- Navigation menuju dan keluar dari layar chat.
- Android Photo Picker serta konversi URI menjadi file cache untuk upload.
- Permission atau kebijakan perangkat yang spesifik terhadap aplikasi.
- Penyediaan identity token dari backend aplikasi.
- Push notification ketika aplikasi tidak sedang aktif.
- Analytics produk di luar event yang tersedia pada state SDK.

Validasi ownership conversation, rate limiting, domain/site configuration, sanitasi konten, routing agent, dan orkestrasi AI tetap dilakukan oleh backend SolidChat.

## Keamanan

- Gunakan HTTPS untuk staging dan production.
- Simpan GitHub Packages token hanya di `~/.gradle/gradle.properties` atau secret CI, bukan di repository aplikasi.
- Token instalasi package hanya membutuhkan `read:packages` dan akses repository private.
- Jangan log visitor token, identity token, isi pesan sensitif, atau signed attachment URL.
- Jangan menggunakan identity token buatan client; mobile app hanya meneruskan token yang diterbitkan backend.

## Penanganan error

Operasi headless dapat melempar `SolidChatException` dengan `code`, `message`, dan `httpStatus`. Host app dapat memetakan kode tersebut ke UI retry atau pesan error aplikasi:

```kotlin
runCatching {
    client.sendMessage("Halo")
}.onFailure { error ->
    val sdkError = error as? SolidChatException
    logger.warn("SolidChat request failed: ${sdkError?.code}")
}
```

State terakhir juga menyimpan `error` agar UI reaktif dapat menampilkan kegagalan bootstrap atau realtime.

## Versioning

Versi package mengikuti release repository. Upgrade patch seperti `0.16.3` berisi perbaikan kompatibel, sedangkan perubahan API publik akan dicatat pada changelog sebelum tim mobile menaikkan dependency. Gunakan versi eksplisit; jangan memakai versi dinamis seperti `0.+`.

## Build lokal

Jalankan dari folder `sdks/android`:

```bash
gradle :solidchat-sdk:test :solidchat-sdk:assembleDebug
```

Repository tidak menyertakan Gradle wrapper baru; host dapat memakai wrapper aplikasi atau Gradle lokal.

Build dan publish resmi dijalankan melalui workflow `Mobile SDK`. Setiap release menjalankan unit test, menghasilkan release AAR beserta sources JAR, lalu mempublish POM dan artefak ke GitHub Packages.
