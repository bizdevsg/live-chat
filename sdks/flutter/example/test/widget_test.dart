import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:solidchat_flutter_example/main.dart';

void main() {
  test('example exposes a Flutter application', () {
    const app = ExampleApp();

    expect(app, isA<Widget>());
  });
}
