# SolidChat Flutter SDK

Paket Flutter ini menyediakan layar customer support native yang langsung siap
dipakai di Android dan iOS. Developer aplikasi tidak perlu membuat UI chat,
mengelola REST API, menyimpan visitor session, atau memasang Socket.IO sendiri.

UI bawaan mencakup:

- bootstrap dan resume visitor session per site;
- pre-chat form dan pesan pertama;
- chat realtime, typing, status online, dan optimistic message;
- perpindahan AI ke agent beserta timeout fallback;
- upload gambar ketika chat ditangani agent;
- offline ticket, close/new conversation, dan rating;
- tema warna dari konfigurasi site;
- identity token opsional untuk customer yang sudah login.

Behavior dan bentuk UI mengikuti widget website: header/status yang sama,
background percakapan, warna bubble per role, system message, rich text ringan,
typing indicator, countdown handoff agent yang tetap tersimpan, staged image dan
caption, emoji picker, kategori tiket, serta rating overlay otomatis.

## Instalasi

Sebelum package dipublikasikan ke registry internal, gunakan dependency Git:

```yaml
dependencies:
  solidchat_flutter:
    git:
      url: https://github.com/bizdevsg/live-chat.git
      path: sdks/flutter
      ref: dev
```

Kemudian gunakan layar bawaannya:

```dart
import 'package:flutter/material.dart';
import 'package:solidchat_flutter/solidchat_flutter.dart';

Navigator.of(context).push(
  MaterialPageRoute<void>(
    builder: (_) => const SolidChatView(),
  ),
);
```

Itu sudah cukup untuk aplikasi production Solid Gold. Default package adalah:

- API URL: `https://live-chat.sg-berjangka.com`
- Site ID: `solid-gold-main`
- Bahasa: `id`

Tidak ada API key atau secret backend di aplikasi. `siteId` adalah identifier
publik, sama seperti yang digunakan widget web.

## Konfigurasi environment lain

Konfigurasi hanya diperlukan untuk staging atau site lain:

```dart
const SolidChatView(
  config: SolidChatConfig(
    apiUrl: 'https://staging.example.com',
    siteId: 'site-staging',
  ),
)
```

Untuk customer aplikasi yang sudah login, backend host dapat menerbitkan identity
JWT berumur pendek dan meneruskannya ke `identityToken`. Secret penandatanganan
JWT tidak boleh ditaruh di aplikasi Flutter.

```dart
SolidChatView(identityToken: tokenFromYourBackend)
```

## Headless atau UI custom

`SolidChatController` tetap tersedia jika tim membutuhkan integrasi lanjutan,
tetapi bukan syarat untuk pemakaian normal. `SolidChatView` membuat dan mengelola
controller, lifecycle, storage, API client, dan koneksi realtime secara otomatis.

## Requirement platform

- Flutter 3.19 atau lebih baru dan Dart 3.3 atau lebih baru.
- Android mengikuti minimum SDK aplikasi host dan membutuhkan permission internet.
  Template Flutter standar sudah menambahkan permission ini pada build release.
- iOS memakai koneksi HTTPS production sehingga tidak membutuhkan pengecualian ATS.
- Pemilihan gambar memakai photo picker native; permission tambahan mengikuti
  target SDK dan kebijakan aplikasi host.

Lihat [`example/`](example/) untuk contoh aplikasi paling sederhana.
