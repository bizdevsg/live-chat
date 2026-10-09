import 'package:flutter/material.dart';
import 'package:solidchat_flutter/solidchat_flutter.dart';

void main() => runApp(const ExampleApp());

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(useMaterial3: true),
        home: const SolidChatView(title: 'Bantuan'),
      );
}
