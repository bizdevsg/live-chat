// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SolidChatSDK",
    platforms: [.iOS(.v16)],
    products: [.library(name: "SolidChatSDK", targets: ["SolidChatSDK"])],
    dependencies: [
        .package(url: "https://github.com/socketio/socket.io-client-swift.git", from: "16.1.1")
    ],
    targets: [
        .target(name: "SolidChatSDK", dependencies: [.product(name: "SocketIO", package: "socket.io-client-swift")]),
        .testTarget(name: "SolidChatSDKTests", dependencies: ["SolidChatSDK"])
    ]
)
