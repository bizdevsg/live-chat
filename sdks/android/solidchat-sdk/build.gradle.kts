plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("maven-publish")
}

group = "com.solidchat"
version = providers.gradleProperty("sdkVersion")
    .orElse(providers.environmentVariable("SDK_VERSION"))
    .orElse("0.0.0-local")
    .get()

android {
    namespace = "com.solidchat.sdk"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    buildFeatures { compose = true }
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.runtime:runtime-livedata")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }
    testImplementation(kotlin("test"))
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                artifactId = "solidchat-android-sdk"
                pom {
                    name.set("SolidChat Android SDK")
                    description.set(
                        "SolidChat Android SDK is a native Kotlin integration for embedding " +
                            "SolidChat AI and human-agent customer support in Android applications " +
                            "without a WebView. It provides a headless REST and Socket.IO client, " +
                            "visitor and conversation persistence, realtime messaging and typing " +
                            "events, AI-to-agent handoff with timeout recovery, pre-chat lead capture, " +
                            "offline ticket submission, image attachments, customer identity, ratings, " +
                            "and an optional production-ready Jetpack Compose chat screen. The SDK " +
                            "uses the same public backend contract as the SolidChat web widget while " +
                            "remaining isolated from the widget runtime."
                    )
                    url.set("https://github.com/bizdevsg/live-chat/tree/dev/sdks/android")
                    inceptionYear.set("2026")
                    developers {
                        developer {
                            id.set("bizdevsg")
                            name.set("SolidChat Development Team")
                            organization.set("BizDev SG")
                            organizationUrl.set("https://github.com/bizdevsg")
                        }
                    }
                    scm {
                        connection.set("scm:git:https://github.com/bizdevsg/live-chat.git")
                        developerConnection.set("scm:git:https://github.com/bizdevsg/live-chat.git")
                        url.set("https://github.com/bizdevsg/live-chat")
                        tag.set("HEAD")
                    }
                    issueManagement {
                        system.set("GitHub Issues")
                        url.set("https://github.com/bizdevsg/live-chat/issues")
                    }
                }
            }
        }
        repositories {
            maven {
                name = "GitHubPackages"
                url = uri("https://maven.pkg.github.com/bizdevsg/live-chat")
                credentials {
                    username = providers.environmentVariable("GITHUB_ACTOR").orNull
                        ?: providers.gradleProperty("gpr.user").orNull
                    password = providers.environmentVariable("GITHUB_TOKEN").orNull
                        ?: providers.gradleProperty("gpr.key").orNull
                }
            }
        }
    }
}
