import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'trainer_service.dart';
import 'widgets/client_card.dart';

class TrainerPage extends StatelessWidget {
  const TrainerPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final service = Provider.of<TrainerService>(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('${service.gymName} | Trainer Hub'),
        actions: [
          Center(child: Text(service.currentTime, style: const TextStyle(fontSize: 16))),
          const SizedBox(width: 16),
        ],
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      drawer: Drawer(
        child: Container(
          color: const Color(0xFF0A0B10),
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              DrawerHeader(
                decoration: const BoxDecoration(color: Colors.transparent),
                child: Row(
                  children: const [
                    Icon(Icons.shield, color: Color(0xFFFF3E3E), size: 28),
                    SizedBox(width: 8),
                    Text('Dragon Gym', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              ListTile(
                leading: const Icon(Icons.people, color: Color(0xFF909090)),
                title: const Text('My Clients', style: TextStyle(color: Color(0xFF909090))),
                selected: true,
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.dashboard, color: Color(0xFF909090)),
                title: const Text('Dashboard', style: TextStyle(color: Color(0xFF909090))),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: Color(0xFF909090)),
                title: const Text('Logout', style: TextStyle(color: Color(0xFF909090))),
                onTap: () {},
              ),
            ],
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Active Clients', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 350,
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 16,
                  childAspectRatio: 1.2,
                ),
                itemCount: service.members.length,
                itemBuilder: (context, index) {
                  final member = service.members[index];
                  return ClientCard(member: member);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
