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
                    description.set("Native Android client and Jetpack Compose UI for SolidChat.")
                    url.set("https://github.com/bizdevsg/live-chat")
                    scm {
                        connection.set("scm:git:https://github.com/bizdevsg/live-chat.git")
                        url.set("https://github.com/bizdevsg/live-chat")
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
