# SolidChat Android SDK

Native Kotlin SDK dengan UI Jetpack Compose. Tidak menggunakan WebView.

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
    implementation("com.solidchat:solidchat-android-sdk:0.16.2")
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

## UI siap pakai

```kotlin
class ChatActivity : ComponentActivity() {
    private val chatClient by lazy {
        SolidChatClient(
            applicationContext,
            SolidChatConfig(
                apiUrl = "https://chat-api.example.com",
                siteId = "solid-gold-main",
            ),
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

API publik penting: `initialize`, `sendMessage`, `uploadImage`, `submitPreChat`, `submitTicket`, `requestAgent`, `closeConversation`, `startNewConversation`, `submitFeedback`, `identify`, `notifyTyping`, `markRead`, `reset`, dan `close`.

## Identitas customer

```kotlin
// identityToken harus diterbitkan backend tepercaya, bukan dibuat di APK.
client.identify(identityTokenFromYourBackend)
```

## Build lokal

Jalankan dari folder `sdks/android`:

```bash
gradle :solidchat-sdk:test :solidchat-sdk:assembleDebug
```

Repository tidak menyertakan Gradle wrapper baru; host dapat memakai wrapper aplikasi atau Gradle lokal.
