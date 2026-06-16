import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'trainer_page.dart';
import 'trainer_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final service = TrainerService();
  await service.init(); // load stored user info, etc.
  runApp(MyApp(service: service));
}

class MyApp extends StatelessWidget {
  final TrainerService service;
  const MyApp({Key? key, required this.service}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: service,
      child: MaterialApp(
        title: 'Dragon Gym | Trainer Hub',
        theme: ThemeData.dark().copyWith(
          colorScheme: ColorScheme.dark(
            primary: const Color(0xFFFF3E3E),
            secondary: const Color(0xFFFF9D00),
          ),
          scaffoldBackgroundColor: const Color(0xFF0A0B10),
        ),
        home: const TrainerPage(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
