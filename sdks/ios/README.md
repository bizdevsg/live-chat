# SolidChat iOS SDK

Native Swift SDK dengan UI SwiftUI. Tidak menggunakan WKWebView.

## Swift Package Manager

Di Xcode pilih **File → Add Package Dependencies → Add Local**, kemudian arahkan ke folder `sdks/ios`. Package mengambil `socket.io-client-swift` sebagai satu-satunya dependency eksternal.

## UI siap pakai

```swift
import SolidChatSDK
import SwiftUI

struct SupportScreen: View {
    @StateObject private var client = SolidChatClient(
        configuration: .init(
            apiURL: URL(string: "https://chat-api.example.com")!,
            siteId: "solid-gold-main"
        )
    )

    var body: some View {
        SolidChatView(
            client: client,
            imageProvider: {
                // Present PhotosPicker in the host and return SolidChatImage.
                nil
            }
        )
    }
}
```

PhotosPicker tetap dimiliki host app agar permission, PHPicker lifecycle, dan kebijakan akses galeri tetap dikontrol aplikasi.

## Headless

```swift
let client = SolidChatClient(configuration: .init(apiURL: apiURL, siteId: siteId))
await client.initialize()
try await client.sendMessage("Halo")
try await client.requestAgent()
```

`SolidChatClient` adalah `ObservableObject`; UI custom dapat mengamati properti `state`. API publik penting: `initialize`, `sendMessage`, `uploadImage`, `submitPreChat`, `submitTicket`, `requestAgent`, `closeConversation`, `startNewConversation`, `submitFeedback`, `identify`, `notifyTyping`, `markRead`, `reset`.

## Identitas customer

```swift
// Token ditandatangani backend tepercaya. Jangan taruh signing secret di bundle iOS.
try await client.identify(identityToken: tokenFromYourBackend)
```

## Build lokal

```bash
swift test
```

Build iOS/SwiftUI final tetap harus diverifikasi melalui Xcode pada macOS.
