import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:webtui_chat/design_system/components/webtui_components.dart';
import 'package:webtui_chat/design_system/theme/webtui_theme.dart';
import 'package:webtui_chat/design_system/tokens/webtui_colors.dart';
import 'package:webtui_chat/design_system/tokens/webtui_spacing.dart';

void main() {
  testWidgets('chụp màn phone M4 Tin nhắn', (tester) async {
    await _capture(
      tester: tester,
      size: const Size(390, 844),
      outputPath: 'test/screenshots/phase_m4_phone.png',
      child: const _PhoneMessagesPreview(),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('chụp màn tablet M4 list-detail', (tester) async {
    await _capture(
      tester: tester,
      size: const Size(1024, 768),
      outputPath: 'test/screenshots/phase_m4_tablet.png',
      child: const _TabletListDetailPreview(),
    );

    expect(tester.takeException(), isNull);
  });
}

Future<void> _capture({
  required WidgetTester tester,
  required Size size,
  required String outputPath,
  required Widget child,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final key = GlobalKey();
  await tester.pumpWidget(
    RepaintBoundary(
      key: key,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: WebTuiTheme.light(),
        home: child,
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 250));

  await tester.runAsync(() async {
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File(outputPath).parent.create(recursive: true);
    await File(outputPath).writeAsBytes(bytes!.buffer.asUint8List());
  });
}

class _PhoneMessagesPreview extends StatelessWidget {
  const _PhoneMessagesPreview();

  @override
  Widget build(BuildContext context) {
    return WebTuiMobileScaffold(
      title: 'Tin nhắn',
      selectedTab: 0,
      onTabSelected: (_) {},
      actions: const [
        IconButton(
          tooltip: 'Workspace',
          onPressed: null,
          icon: Icon(Icons.business_rounded),
        ),
        IconButton(
          tooltip: 'Tạo hội thoại',
          onPressed: null,
          icon: Icon(Icons.person_add_alt_1_rounded),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.only(bottom: WebTuiSpacing.lg),
        children: const [
          Padding(
            padding: EdgeInsets.fromLTRB(
              WebTuiSpacing.lg,
              WebTuiSpacing.sm,
              WebTuiSpacing.lg,
              WebTuiSpacing.sm,
            ),
            child: WebTuiSearchBar(hintText: 'Tìm hội thoại...'),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: WebTuiSpacing.lg),
            child: WebTuiSegmentedTabs(
              tabs: ['Tất cả', 'Chưa đọc', 'Yêu thích'],
              selectedIndex: 0,
              onChanged: _noop,
            ),
          ),
          WebTuiSectionLabel('Hội thoại gần đây'),
          WebTuiListSurface(
            children: [
              WebTuiConversationListItem(
                title: 'Lam Đức',
                preview: 'Báo cáo hôm nay đã sẵn sàng',
                timeLabel: '16:09',
                avatarLabel: 'Lam Đức',
                unreadCount: 3,
                status: WebTuiPresenceStatus.online,
              ),
              WebTuiConversationListItem(
                title: 'Kế toán',
                preview: 'Kênh công khai trong workspace',
                timeLabel: '12:21',
                avatarLabel: 'Kế toán',
                unreadCount: 1,
              ),
              WebTuiConversationListItem(
                title: 'Server Alert',
                preview: 'Cảnh báo CPU đã được xử lý',
                timeLabel: 'Hôm qua',
                avatarLabel: 'Server Alert',
                muted: true,
              ),
              WebTuiConversationListItem(
                title: 'Tô Thanh Trang',
                preview: 'Chưa có tin nhắn',
                timeLabel: '2 ngày',
                avatarLabel: 'Tô Thanh Trang',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TabletListDetailPreview extends StatelessWidget {
  const _TabletListDetailPreview();

  @override
  Widget build(BuildContext context) {
    return WebTuiMobileScaffold(
      title: 'Tin nhắn',
      selectedTab: 0,
      onTabSelected: (_) {},
      body: Row(
        children: [
          SizedBox(
            width: 360,
            child: ListView(
              children: const [
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    WebTuiSpacing.lg,
                    WebTuiSpacing.sm,
                    WebTuiSpacing.lg,
                    WebTuiSpacing.sm,
                  ),
                  child: WebTuiSearchBar(hintText: 'Tìm hội thoại...'),
                ),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: WebTuiSpacing.lg),
                  child: WebTuiSegmentedTabs(
                    tabs: ['Tất cả', 'Chưa đọc', 'Yêu thích'],
                    selectedIndex: 0,
                    onChanged: _noop,
                  ),
                ),
                WebTuiSectionLabel('Hội thoại gần đây'),
                WebTuiListSurface(
                  children: [
                    WebTuiConversationListItem(
                      title: 'Kênh & Bot',
                      preview: 'Bot hỗ trợ đang theo dõi yêu cầu',
                      timeLabel: '16:09',
                      avatarLabel: 'Kênh Bot',
                      unreadCount: 2,
                    ),
                    WebTuiConversationListItem(
                      title: 'Kỹ thuật',
                      preview: 'Đã ghim lịch bảo trì tối nay',
                      timeLabel: '12:21',
                      avatarLabel: 'Kỹ thuật',
                    ),
                    WebTuiConversationListItem(
                      title: 'Bàn giao cao',
                      preview: 'Cập nhật biên bản bàn giao',
                      timeLabel: '10:39',
                      avatarLabel: 'Bàn giao cao',
                    ),
                  ],
                ),
              ],
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: ColoredBox(
              color: WebTuiColors.backgroundMuted,
              child: Column(
                children: [
                  const Padding(
                    padding: EdgeInsets.all(WebTuiSpacing.lg),
                    child: Row(
                      children: [
                        WebTuiAvatar(
                          label: 'Kênh Bot',
                          icon: Icons.smart_toy_outlined,
                        ),
                        SizedBox(width: WebTuiSpacing.md),
                        Expanded(
                          child: Text(
                            'Kênh & Bot',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.all(WebTuiSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          WebTuiMessageBubble(
                            text: 'Bot đã ghi nhận yêu cầu hỗ trợ mới.',
                            timeLabel: '09:41',
                          ),
                          SizedBox(height: WebTuiSpacing.sm),
                          WebTuiMessageBubble(
                            text: 'Mình sẽ kiểm tra và phản hồi trong kênh.',
                            timeLabel: '09:42',
                            outgoing: true,
                            statusLabel: 'Đã gửi',
                          ),
                        ],
                      ),
                    ),
                  ),
                  Container(
                    height: 56,
                    color: WebTuiColors.surface,
                    padding: const EdgeInsets.symmetric(
                      horizontal: WebTuiSpacing.lg,
                      vertical: WebTuiSpacing.sm,
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.add_circle_outline_rounded),
                        SizedBox(width: WebTuiSpacing.sm),
                        Expanded(
                          child: WebTuiSearchBar(hintText: 'Nhập tin nhắn...'),
                        ),
                        SizedBox(width: WebTuiSpacing.sm),
                        Icon(Icons.send_rounded, color: WebTuiColors.primary),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

void _noop(int _) {}
