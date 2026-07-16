import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_density.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

class WebTuiMobileScaffold extends StatelessWidget {
  const WebTuiMobileScaffold({
    required this.title,
    required this.body,
    required this.selectedTab,
    required this.onTabSelected,
    this.actions = const [],
    super.key,
  });

  final String title;
  final Widget body;
  final int selectedTab;
  final ValueChanged<int> onTabSelected;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 48,
        titleSpacing: WebTuiSpacing.lg,
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: WebTuiTypography.titleLarge.copyWith(
            color: WebTuiColors.textPrimary,
          ),
        ),
        actions: actions,
      ),
      body: SafeArea(top: false, child: body),
      bottomNavigationBar: NavigationBar(
        height: WebTuiBottomTabTokens.height,
        selectedIndex: selectedTab,
        onDestinationSelected: onTabSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Tin nhắn',
          ),
          NavigationDestination(
            icon: Icon(Icons.contacts_outlined),
            selectedIcon: Icon(Icons.contacts_rounded),
            label: 'Danh bạ',
          ),
          NavigationDestination(
            icon: Icon(Icons.tag_outlined),
            selectedIcon: Icon(Icons.tag_rounded),
            label: 'Khám phá',
          ),
          NavigationDestination(
            icon: Icon(Icons.more_horiz_rounded),
            selectedIcon: Icon(Icons.more_horiz_rounded),
            label: 'Thêm',
          ),
        ],
      ),
    );
  }
}
