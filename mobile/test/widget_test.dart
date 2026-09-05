import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:raksha_mobile/main.dart';

Future<void> pumpRakshaApp(
  WidgetTester tester, {
  OfflineDraftStore? draftStore,
  SyncTransport? syncTransport,
}) async {
  await tester.pumpWidget(
    RakshaMobileApp(
      draftStore: draftStore ?? MemoryDraftStore(),
      syncTransport:
          syncTransport ?? SyntheticSyncTransport(latency: Duration.zero),
    ),
  );
  await tester.pump();
}

void main() {
  test('sync states match backend API contract values', () {
    expect(SyncState.values.map((state) => state.apiValue), [
      'PENDING',
      'SYNCING',
      'SYNCED',
      'FAILED',
      'CONFLICT',
    ]);
  });

  testWidgets('frontline workflow validates consent before saving', (
    tester,
  ) async {
    await tester.pumpWidget(const RakshaMobileApp());

    expect(find.text('Frontline workflow'), findsOneWidget);
    expect(find.text('No local drafts are waiting.'), findsOneWidget);

    await tester.ensureVisible(
      find.byKey(const Key('save-registration-button')),
    );
    await tester.tap(find.byKey(const Key('save-registration-button')));
    await tester.pump();

    expect(find.text('Check required fields before saving.'), findsOneWidget);
    expect(find.text('Registration draft'), findsNothing);
  });

  testWidgets('frontline worker can save local registration draft', (
    tester,
  ) async {
    await tester.pumpWidget(const RakshaMobileApp());

    await tester.tap(find.byKey(const Key('consent-switch')));
    await tester.pump();
    await tester.ensureVisible(
      find.byKey(const Key('save-registration-button')),
    );
    await tester.tap(find.byKey(const Key('save-registration-button')));
    await tester.pump();

    expect(find.text('Saved to local queue.'), findsOneWidget);
    expect(find.text('Registration draft'), findsOneWidget);
    expect(find.text('1 drafts in queue'), findsOneWidget);
    expect(find.textContaining('LOCAL-001'), findsOneWidget);
    expect(find.textContaining('PENDING'), findsOneWidget);
  });

  testWidgets('triage preview shows decision support and safety flags', (
    tester,
  ) async {
    await tester.pumpWidget(const RakshaMobileApp());

    expect(find.text('Respiratory risk preview'), findsOneWidget);
    expect(find.text('Decision support only'), findsAtLeastNWidgets(1));
    expect(find.text('Low oxygen entered'), findsOneWidget);
    expect(find.text('Fast breathing entered'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('queue-triage-button')));
    await tester.tap(find.byKey(const Key('queue-triage-button')));
    await tester.pump();

    expect(find.text('Respiratory triage review'), findsOneWidget);
    expect(find.text('Human review required'), findsAtLeastNWidgets(1));
  });

  testWidgets('offline queue shows failed, retry, and synced states', (
    tester,
  ) async {
    await tester.pumpWidget(const RakshaMobileApp());

    await tester.ensureVisible(find.byKey(const Key('save-symptoms-button')));
    await tester.tap(find.byKey(const Key('save-symptoms-button')));
    await tester.pump();

    await tester.ensureVisible(find.byKey(const Key('sync-next-button')));
    await tester.tap(find.byKey(const Key('sync-next-button')));
    await tester.pump(const Duration(milliseconds: 220));

    expect(
      find.text('Sync failed. The draft remains on this device.'),
      findsOneWidget,
    );
    expect(find.textContaining('FAILED'), findsOneWidget);

    await tester.tap(find.byKey(const Key('retry-button')));
    await tester.pump();
    expect(find.textContaining('PENDING'), findsOneWidget);

    await tester.tap(find.byKey(const Key('connectivity-toggle')));
    await tester.pump();
    await tester.ensureVisible(find.byKey(const Key('sync-next-button')));
    await tester.tap(find.byKey(const Key('sync-next-button')));
    await tester.pump(const Duration(milliseconds: 220));

    expect(find.text('Draft synchronized.'), findsOneWidget);
    expect(find.textContaining('SYNCED'), findsOneWidget);
  });

  testWidgets('patient role and Hindi language are selectable', (tester) async {
    await tester.pumpWidget(const RakshaMobileApp());

    await tester.tap(find.text('Patient'));
    await tester.pump();

    expect(find.text('Patient home'), findsOneWidget);
    expect(find.text('Ask frontline worker for help'), findsOneWidget);

    await tester.tap(find.text('Hindi'));
    await tester.pump();

    expect(find.text('रक्षा'), findsOneWidget);
    expect(find.text('मरीज होम'), findsOneWidget);
  });
}
