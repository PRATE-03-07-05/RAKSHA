import 'package:flutter/material.dart';

import 'offline_sync.dart';

export 'offline_sync.dart';

void main() {
  runApp(const RakshaMobileApp());
}

enum RakshaLocale { en, hi }

enum MobileRole { patient, frontlineWorker }

enum TextKey {
  appTitle,
  syntheticLabel,
  patientRole,
  frontlineRole,
  language,
  english,
  hindi,
  online,
  offline,
  offlineBanner,
  onlineBanner,
  patientHome,
  frontlineHome,
  nextAction,
  consentPending,
  consentGranted,
  triageHumanReview,
  appointmentRequested,
  carePlanPending,
  registration,
  patientName,
  village,
  ageYears,
  grantConsent,
  saveRegistration,
  symptomsVitals,
  cough,
  breathlessness,
  fever,
  chestPain,
  severeWeakness,
  cyanosis,
  respiratoryRate,
  spo2,
  temperature,
  saveSymptoms,
  queueTriage,
  offlineQueue,
  emptyQueue,
  syncNext,
  retry,
  markConflict,
  humanReviewRequired,
  decisionSupportOnly,
  riskPreview,
  lowOxygen,
  fastBreathing,
  validationError,
  serverError,
  successSaved,
  successSynced,
  conflictDetected,
  pending,
  syncing,
  synced,
  failed,
  conflict,
  syncMetadata,
  patientGuidance,
  followUpSupport,
  callFrontline,
  registrationDraft,
  symptomDraft,
  triageDraft,
}

class RakshaStrings {
  RakshaStrings(this.locale);

  final RakshaLocale locale;

  static const Map<RakshaLocale, Map<TextKey, String>> _values = {
    RakshaLocale.en: {
      TextKey.appTitle: 'RAKSHA',
      TextKey.syntheticLabel: 'Synthetic demo patient',
      TextKey.patientRole: 'Patient',
      TextKey.frontlineRole: 'Frontline worker',
      TextKey.language: 'Language',
      TextKey.english: 'English',
      TextKey.hindi: 'Hindi',
      TextKey.online: 'Online',
      TextKey.offline: 'Offline',
      TextKey.offlineBanner:
          'Offline mode: saved work stays on this device until sync succeeds.',
      TextKey.onlineBanner: 'Online mode: local drafts can be synchronized.',
      TextKey.patientHome: 'Patient home',
      TextKey.frontlineHome: 'Frontline workflow',
      TextKey.nextAction: 'Next action',
      TextKey.consentPending: 'Consent needs review',
      TextKey.consentGranted: 'Consent granted',
      TextKey.triageHumanReview: 'Triage queued for human review',
      TextKey.appointmentRequested: 'Appointment requested',
      TextKey.carePlanPending: 'Care plan pending clinician note',
      TextKey.registration: 'Registration and consent',
      TextKey.patientName: 'Patient name',
      TextKey.village: 'Village',
      TextKey.ageYears: 'Age in years',
      TextKey.grantConsent: 'Grant consent',
      TextKey.saveRegistration: 'Save registration',
      TextKey.symptomsVitals: 'Symptoms and vitals',
      TextKey.cough: 'Cough',
      TextKey.breathlessness: 'Breathlessness',
      TextKey.fever: 'Fever',
      TextKey.chestPain: 'Chest pain',
      TextKey.severeWeakness: 'Severe weakness',
      TextKey.cyanosis: 'Blue lips or face',
      TextKey.respiratoryRate: 'Respiratory rate',
      TextKey.spo2: 'SpO2',
      TextKey.temperature: 'Temperature C',
      TextKey.saveSymptoms: 'Save symptoms',
      TextKey.queueTriage: 'Queue triage review',
      TextKey.offlineQueue: 'Offline queue',
      TextKey.emptyQueue: 'No local drafts are waiting.',
      TextKey.syncNext: 'Sync next',
      TextKey.retry: 'Retry',
      TextKey.markConflict: 'Mark conflict',
      TextKey.humanReviewRequired: 'Human review required',
      TextKey.decisionSupportOnly: 'Decision support only',
      TextKey.riskPreview: 'Respiratory risk preview',
      TextKey.lowOxygen: 'Low oxygen entered',
      TextKey.fastBreathing: 'Fast breathing entered',
      TextKey.validationError: 'Check required fields before saving.',
      TextKey.serverError: 'Sync failed. The draft remains on this device.',
      TextKey.successSaved: 'Saved to local queue.',
      TextKey.successSynced: 'Draft synchronized.',
      TextKey.conflictDetected:
          'Conflict detected. Local data was preserved for review.',
      TextKey.pending: 'Pending',
      TextKey.syncing: 'Syncing',
      TextKey.synced: 'Synced',
      TextKey.failed: 'Failed',
      TextKey.conflict: 'Conflict',
      TextKey.syncMetadata: 'Sync metadata',
      TextKey.patientGuidance:
          'Clinician-approved guidance will appear after review.',
      TextKey.followUpSupport: 'Follow-up support',
      TextKey.callFrontline: 'Ask frontline worker for help',
      TextKey.registrationDraft: 'Registration draft',
      TextKey.symptomDraft: 'Symptoms and vitals draft',
      TextKey.triageDraft: 'Respiratory triage review',
    },
    RakshaLocale.hi: {
      TextKey.appTitle: 'रक्षा',
      TextKey.syntheticLabel: 'सिंथेटिक डेमो मरीज',
      TextKey.patientRole: 'मरीज',
      TextKey.frontlineRole: 'फ्रंटलाइन कार्यकर्ता',
      TextKey.language: 'भाषा',
      TextKey.english: 'अंग्रेजी',
      TextKey.hindi: 'हिंदी',
      TextKey.online: 'ऑनलाइन',
      TextKey.offline: 'ऑफलाइन',
      TextKey.offlineBanner:
          'ऑफलाइन मोड: सिंक सफल होने तक काम इस डिवाइस पर रहेगा.',
      TextKey.onlineBanner: 'ऑनलाइन मोड: स्थानीय ड्राफ्ट सिंक किए जा सकते हैं.',
      TextKey.patientHome: 'मरीज होम',
      TextKey.frontlineHome: 'फ्रंटलाइन वर्कफ्लो',
      TextKey.nextAction: 'अगला कदम',
      TextKey.consentPending: 'सहमति की समीक्षा चाहिए',
      TextKey.consentGranted: 'सहमति दी गई',
      TextKey.triageHumanReview: 'ट्रायेज मानव समीक्षा के लिए कतार में',
      TextKey.appointmentRequested: 'अपॉइंटमेंट अनुरोधित',
      TextKey.carePlanPending: 'केयर प्लान चिकित्सक नोट की प्रतीक्षा में',
      TextKey.registration: 'पंजीकरण और सहमति',
      TextKey.patientName: 'मरीज का नाम',
      TextKey.village: 'गांव',
      TextKey.ageYears: 'उम्र वर्ष में',
      TextKey.grantConsent: 'सहमति दें',
      TextKey.saveRegistration: 'पंजीकरण सेव करें',
      TextKey.symptomsVitals: 'लक्षण और वाइटल',
      TextKey.cough: 'खांसी',
      TextKey.breathlessness: 'सांस फूलना',
      TextKey.fever: 'बुखार',
      TextKey.chestPain: 'सीने में दर्द',
      TextKey.severeWeakness: 'बहुत कमजोरी',
      TextKey.cyanosis: 'नीले होंठ या चेहरा',
      TextKey.respiratoryRate: 'सांस दर',
      TextKey.spo2: 'SpO2',
      TextKey.temperature: 'तापमान C',
      TextKey.saveSymptoms: 'लक्षण सेव करें',
      TextKey.queueTriage: 'ट्रायेज समीक्षा कतार में डालें',
      TextKey.offlineQueue: 'ऑफलाइन कतार',
      TextKey.emptyQueue: 'कोई स्थानीय ड्राफ्ट प्रतीक्षा में नहीं है.',
      TextKey.syncNext: 'अगला सिंक करें',
      TextKey.retry: 'फिर कोशिश करें',
      TextKey.markConflict: 'संघर्ष चिह्नित करें',
      TextKey.humanReviewRequired: 'मानव समीक्षा आवश्यक',
      TextKey.decisionSupportOnly: 'केवल निर्णय-सहायता',
      TextKey.riskPreview: 'श्वसन जोखिम पूर्वावलोकन',
      TextKey.lowOxygen: 'कम ऑक्सीजन दर्ज',
      TextKey.fastBreathing: 'तेज सांस दर्ज',
      TextKey.validationError: 'सेव करने से पहले जरूरी जानकारी जांचें.',
      TextKey.serverError: 'सिंक विफल. ड्राफ्ट इस डिवाइस पर रहेगा.',
      TextKey.successSaved: 'स्थानीय कतार में सेव किया गया.',
      TextKey.successSynced: 'ड्राफ्ट सिंक किया गया.',
      TextKey.conflictDetected:
          'संघर्ष मिला. स्थानीय डेटा समीक्षा के लिए सुरक्षित रखा गया.',
      TextKey.pending: 'प्रतीक्षा में',
      TextKey.syncing: 'सिंक हो रहा',
      TextKey.synced: 'सिंक हुआ',
      TextKey.failed: 'विफल',
      TextKey.conflict: 'संघर्ष',
      TextKey.syncMetadata: 'सिंक मेटाडेटा',
      TextKey.patientGuidance:
          'समीक्षा के बाद चिकित्सक-स्वीकृत मार्गदर्शन दिखेगा.',
      TextKey.followUpSupport: 'फॉलो-अप सहायता',
      TextKey.callFrontline: 'फ्रंटलाइन कार्यकर्ता से मदद मांगें',
      TextKey.registrationDraft: 'पंजीकरण ड्राफ्ट',
      TextKey.symptomDraft: 'लक्षण और वाइटल ड्राफ्ट',
      TextKey.triageDraft: 'श्वसन ट्रायेज समीक्षा',
    },
  };

  String text(TextKey key) => _values[locale]![key]!;

  String syncState(SyncState state) {
    switch (state) {
      case SyncState.pending:
        return text(TextKey.pending);
      case SyncState.syncing:
        return text(TextKey.syncing);
      case SyncState.synced:
        return text(TextKey.synced);
      case SyncState.failed:
        return text(TextKey.failed);
      case SyncState.conflict:
        return text(TextKey.conflict);
    }
  }

  String queueCount(int count) {
    if (locale == RakshaLocale.hi) {
      return 'कतार में $count ड्राफ्ट';
    }
    return '$count drafts in queue';
  }
}

class RakshaMobileApp extends StatelessWidget {
  const RakshaMobileApp({super.key, this.draftStore, this.syncTransport});

  final OfflineDraftStore? draftStore;
  final SyncTransport? syncTransport;

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF0F766E);
    const secondary = Color(0xFF2563EB);
    const tertiary = Color(0xFFD97706);

    return MaterialApp(
      title: 'RAKSHA',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          primary: primary,
          secondary: secondary,
          tertiary: tertiary,
          error: const Color(0xFFB91C1C),
          surface: const Color(0xFFFFFFFF),
        ),
        scaffoldBackgroundColor: const Color(0xFFF6FAF8),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
          ),
        ),
        segmentedButtonTheme: SegmentedButtonThemeData(
          style: ButtonStyle(
            shape: WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ),
      ),
      home: RakshaHomePage(
        draftStore: draftStore,
        syncTransport: syncTransport,
      ),
    );
  }
}

class RakshaHomePage extends StatefulWidget {
  const RakshaHomePage({super.key, this.draftStore, this.syncTransport});

  final OfflineDraftStore? draftStore;
  final SyncTransport? syncTransport;

  @override
  State<RakshaHomePage> createState() => _RakshaHomePageState();
}

class _RakshaHomePageState extends State<RakshaHomePage> {
  RakshaLocale _locale = RakshaLocale.en;
  MobileRole _role = MobileRole.frontlineWorker;
  bool _isOffline = true;
  bool _consentGranted = false;
  bool _cough = true;
  bool _breathlessness = true;
  bool _fever = true;
  bool _chestPain = false;
  bool _severeWeakness = false;
  bool _cyanosis = false;
  TextKey? _feedbackKey;
  SyncState? _feedbackState;

  final _patientNameController = TextEditingController(text: 'Asha Devi');
  final _villageController = TextEditingController(text: 'Rampur');
  final _ageController = TextEditingController(text: '40');
  final _respiratoryRateController = TextEditingController(text: '32');
  final _spo2Controller = TextEditingController(text: '91');
  final _temperatureController = TextEditingController(text: '38.4');
  final List<LocalDraft> _drafts = [];
  late final OfflineSyncController _syncController;

  @override
  void initState() {
    super.initState();
    _syncController = OfflineSyncController(
      store: widget.draftStore ?? SharedPreferencesDraftStore(),
      transport: widget.syncTransport ?? SyntheticSyncTransport(),
    );
    _loadDrafts();
  }

  @override
  void dispose() {
    _patientNameController.dispose();
    _villageController.dispose();
    _ageController.dispose();
    _respiratoryRateController.dispose();
    _spo2Controller.dispose();
    _temperatureController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = RakshaStrings(_locale);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.health_and_safety_outlined),
            const SizedBox(width: 8),
            Text(strings.text(TextKey.appTitle)),
          ],
        ),
        actions: [
          IconButton(
            key: const Key('connectivity-toggle'),
            tooltip: _isOffline
                ? strings.text(TextKey.offline)
                : strings.text(TextKey.online),
            onPressed: () {
              setState(() {
                _isOffline = !_isOffline;
                _feedbackKey = null;
                _feedbackState = null;
              });
            },
            icon: Icon(
              _isOffline ? Icons.cloud_off_outlined : Icons.cloud_done_outlined,
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 920),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ModeBar(
                    strings: strings,
                    locale: _locale,
                    role: _role,
                    onLocaleChanged: (locale) =>
                        setState(() => _locale = locale),
                    onRoleChanged: (role) => setState(() => _role = role),
                  ),
                  const SizedBox(height: 12),
                  _ConnectivityBanner(strings: strings, isOffline: _isOffline),
                  if (_feedbackKey != null) ...[
                    const SizedBox(height: 12),
                    _FeedbackBanner(
                      strings: strings,
                      messageKey: _feedbackKey!,
                      state: _feedbackState,
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (_role == MobileRole.patient)
                    _PatientHome(
                      strings: strings,
                      consentGranted: _consentGranted,
                      hasQueuedTriage: _drafts.any(
                        (draft) =>
                            draft.type ==
                            LocalDraftType.respiratoryTriageReview,
                      ),
                      onAskForHelp: () {
                        _addDraft(LocalDraftType.respiratoryTriageReview);
                      },
                    )
                  else
                    _FrontlineWorkflow(
                      strings: strings,
                      consentGranted: _consentGranted,
                      cough: _cough,
                      breathlessness: _breathlessness,
                      fever: _fever,
                      chestPain: _chestPain,
                      severeWeakness: _severeWeakness,
                      cyanosis: _cyanosis,
                      patientNameController: _patientNameController,
                      villageController: _villageController,
                      ageController: _ageController,
                      respiratoryRateController: _respiratoryRateController,
                      spo2Controller: _spo2Controller,
                      temperatureController: _temperatureController,
                      drafts: _drafts,
                      onConsentChanged: (value) =>
                          setState(() => _consentGranted = value),
                      onCoughChanged: (value) => setState(() => _cough = value),
                      onBreathlessnessChanged: (value) =>
                          setState(() => _breathlessness = value),
                      onFeverChanged: (value) => setState(() => _fever = value),
                      onChestPainChanged: (value) =>
                          setState(() => _chestPain = value),
                      onSevereWeaknessChanged: (value) =>
                          setState(() => _severeWeakness = value),
                      onCyanosisChanged: (value) =>
                          setState(() => _cyanosis = value),
                      onSaveRegistration: _saveRegistration,
                      onSaveSymptoms: () {
                        _addDraft(LocalDraftType.symptomsVitals);
                      },
                      onQueueTriage: () {
                        _addDraft(LocalDraftType.respiratoryTriageReview);
                      },
                      onSyncNext: _syncNext,
                      onRetry: _retryFailedDraft,
                      onMarkConflict: _markLatestConflict,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _loadDrafts() async {
    final loadedDrafts = await _syncController.loadDrafts();
    if (!mounted) {
      return;
    }
    _replaceDrafts(loadedDrafts);
  }

  void _replaceDrafts(List<LocalDraft> drafts) {
    setState(() {
      _drafts
        ..clear()
        ..addAll(drafts);
    });
  }

  void _saveRegistration() {
    if (_patientNameController.text.trim().isEmpty || !_consentGranted) {
      setState(() {
        _feedbackKey = TextKey.validationError;
        _feedbackState = SyncState.failed;
      });
      return;
    }
    _addDraft(LocalDraftType.registration);
  }

  Future<void> _addDraft(LocalDraftType type) async {
    await _syncController.addDraft(type: type, payload: _payloadFor(type));
    if (!mounted) {
      return;
    }
    setState(() {
      _drafts
        ..clear()
        ..addAll(_syncController.drafts);
      _feedbackKey = TextKey.successSaved;
      _feedbackState = SyncState.pending;
    });
  }

  Future<void> _syncNext() async {
    if (_drafts.isEmpty) {
      return;
    }

    final result = await _syncController.syncNext(
      isOnline: !_isOffline,
      onDraftsChanged: (drafts) {
        if (!mounted) {
          return;
        }
        _replaceDrafts(drafts);
        setState(() {
          _feedbackKey = null;
          _feedbackState = SyncState.syncing;
        });
      },
    );
    if (!mounted || result == null) {
      return;
    }

    setState(() {
      _feedbackKey = switch (result.status) {
        SyncAttemptStatus.synced => TextKey.successSynced,
        SyncAttemptStatus.failed => TextKey.serverError,
        SyncAttemptStatus.conflict => TextKey.conflictDetected,
      };
      _feedbackState = switch (result.status) {
        SyncAttemptStatus.synced => SyncState.synced,
        SyncAttemptStatus.failed => SyncState.failed,
        SyncAttemptStatus.conflict => SyncState.conflict,
      };
    });
  }

  Future<void> _retryFailedDraft() async {
    final updated = await _syncController.retryFirstFailed();
    if (!mounted) {
      return;
    }
    setState(() {
      if (updated != null) {
        _drafts
          ..clear()
          ..addAll(_syncController.drafts);
        _feedbackKey = TextKey.successSaved;
        _feedbackState = SyncState.pending;
      }
    });
  }

  Future<void> _markLatestConflict() async {
    final updated = await _syncController.markLatestConflict();
    if (!mounted) {
      return;
    }
    setState(() {
      if (updated != null) {
        _drafts
          ..clear()
          ..addAll(_syncController.drafts);
        _feedbackKey = TextKey.conflictDetected;
        _feedbackState = SyncState.conflict;
      }
    });
  }

  Map<String, Object?> _payloadFor(LocalDraftType type) {
    final basePayload = <String, Object?>{
      'patientId': 'SYNTH-RAKSHA-001',
      'patientName': _patientNameController.text.trim(),
      'syntheticDemoData': true,
    };
    switch (type) {
      case LocalDraftType.registration:
        return <String, Object?>{
          ...basePayload,
          'village': _villageController.text.trim(),
          'ageYears': int.tryParse(_ageController.text.trim()),
          'consentGranted': _consentGranted,
        };
      case LocalDraftType.symptomsVitals:
        return <String, Object?>{
          ...basePayload,
          'symptoms': <String, Object?>{
            'cough': _cough,
            'breathlessness': _breathlessness,
            'fever': _fever,
            'chestPain': _chestPain,
            'severeWeakness': _severeWeakness,
            'cyanosis': _cyanosis,
          },
          'vitals': <String, Object?>{
            'respiratoryRate': int.tryParse(
              _respiratoryRateController.text.trim(),
            ),
            'spo2': double.tryParse(_spo2Controller.text.trim()),
            'temperatureC': double.tryParse(_temperatureController.text.trim()),
          },
        };
      case LocalDraftType.respiratoryTriageReview:
        return <String, Object?>{
          ...basePayload,
          'clinicalDecisionSupportOnly': true,
          'humanReviewRequired': true,
          'respiratoryRate': int.tryParse(
            _respiratoryRateController.text.trim(),
          ),
          'spo2': double.tryParse(_spo2Controller.text.trim()),
          'dangerSigns': <String, Object?>{
            'severeWeakness': _severeWeakness,
            'cyanosis': _cyanosis,
          },
        };
    }
  }
}

class _ModeBar extends StatelessWidget {
  const _ModeBar({
    required this.strings,
    required this.locale,
    required this.role,
    required this.onLocaleChanged,
    required this.onRoleChanged,
  });

  final RakshaStrings strings;
  final RakshaLocale locale;
  final MobileRole role;
  final ValueChanged<RakshaLocale> onLocaleChanged;
  final ValueChanged<MobileRole> onRoleChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SegmentedButton<MobileRole>(
          key: const Key('role-selector'),
          segments: [
            ButtonSegment(
              value: MobileRole.patient,
              icon: const Icon(Icons.person_outline),
              label: Text(strings.text(TextKey.patientRole)),
            ),
            ButtonSegment(
              value: MobileRole.frontlineWorker,
              icon: const Icon(Icons.badge_outlined),
              label: Text(strings.text(TextKey.frontlineRole)),
            ),
          ],
          selected: {role},
          onSelectionChanged: (selection) => onRoleChanged(selection.first),
        ),
        SegmentedButton<RakshaLocale>(
          key: const Key('language-selector'),
          segments: [
            ButtonSegment(
              value: RakshaLocale.en,
              icon: const Icon(Icons.translate_outlined),
              label: Text(strings.text(TextKey.english)),
            ),
            ButtonSegment(
              value: RakshaLocale.hi,
              icon: const Icon(Icons.language_outlined),
              label: Text(strings.text(TextKey.hindi)),
            ),
          ],
          selected: {locale},
          onSelectionChanged: (selection) => onLocaleChanged(selection.first),
        ),
      ],
    );
  }
}

class _ConnectivityBanner extends StatelessWidget {
  const _ConnectivityBanner({required this.strings, required this.isOffline});

  final RakshaStrings strings;
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background = isOffline
        ? const Color(0xFFFFFBEB)
        : const Color(0xFFEFF6FF);
    final foreground = isOffline
        ? const Color(0xFF92400E)
        : const Color(0xFF1D4ED8);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: foreground.withValues(alpha: 0.34)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isOffline ? Icons.cloud_off_outlined : Icons.cloud_done_outlined,
              color: foreground,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isOffline
                        ? strings.text(TextKey.offline)
                        : strings.text(TextKey.online),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: foreground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isOffline
                        ? strings.text(TextKey.offlineBanner)
                        : strings.text(TextKey.onlineBanner),
                    style: TextStyle(color: colorScheme.onSurface),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedbackBanner extends StatelessWidget {
  const _FeedbackBanner({
    required this.strings,
    required this.messageKey,
    required this.state,
  });

  final RakshaStrings strings;
  final TextKey messageKey;
  final SyncState? state;

  @override
  Widget build(BuildContext context) {
    final isError = state == SyncState.failed || state == SyncState.conflict;
    final color = isError
        ? Theme.of(context).colorScheme.error
        : const Color(0xFF047857);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: isError ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
        border: Border.all(color: color.withValues(alpha: 0.32)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              color: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                strings.text(messageKey),
                style: TextStyle(color: color, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PatientHome extends StatelessWidget {
  const _PatientHome({
    required this.strings,
    required this.consentGranted,
    required this.hasQueuedTriage,
    required this.onAskForHelp,
  });

  final RakshaStrings strings;
  final bool consentGranted;
  final bool hasQueuedTriage;
  final VoidCallback onAskForHelp;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Section(
          icon: Icons.home_outlined,
          title: strings.text(TextKey.patientHome),
          subtitle: strings.text(TextKey.syntheticLabel),
          child: Column(
            children: [
              _StatusRow(
                icon: consentGranted
                    ? Icons.verified_user_outlined
                    : Icons.assignment_late_outlined,
                label: consentGranted
                    ? strings.text(TextKey.consentGranted)
                    : strings.text(TextKey.consentPending),
              ),
              _StatusRow(
                icon: Icons.health_and_safety_outlined,
                label: hasQueuedTriage
                    ? strings.text(TextKey.triageHumanReview)
                    : strings.text(TextKey.patientGuidance),
              ),
              _StatusRow(
                icon: Icons.event_available_outlined,
                label: strings.text(TextKey.appointmentRequested),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _Section(
          icon: Icons.support_agent_outlined,
          title: strings.text(TextKey.followUpSupport),
          subtitle: strings.text(TextKey.nextAction),
          child: Wrap(
            spacing: 10,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              FilledButton.icon(
                key: const Key('patient-help-button'),
                onPressed: onAskForHelp,
                icon: const Icon(Icons.call_outlined),
                label: Text(strings.text(TextKey.callFrontline)),
              ),
              _StatusChip(
                label: strings.text(TextKey.humanReviewRequired),
                icon: Icons.person_search_outlined,
                color: const Color(0xFF2563EB),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FrontlineWorkflow extends StatelessWidget {
  const _FrontlineWorkflow({
    required this.strings,
    required this.consentGranted,
    required this.cough,
    required this.breathlessness,
    required this.fever,
    required this.chestPain,
    required this.severeWeakness,
    required this.cyanosis,
    required this.patientNameController,
    required this.villageController,
    required this.ageController,
    required this.respiratoryRateController,
    required this.spo2Controller,
    required this.temperatureController,
    required this.drafts,
    required this.onConsentChanged,
    required this.onCoughChanged,
    required this.onBreathlessnessChanged,
    required this.onFeverChanged,
    required this.onChestPainChanged,
    required this.onSevereWeaknessChanged,
    required this.onCyanosisChanged,
    required this.onSaveRegistration,
    required this.onSaveSymptoms,
    required this.onQueueTriage,
    required this.onSyncNext,
    required this.onRetry,
    required this.onMarkConflict,
  });

  final RakshaStrings strings;
  final bool consentGranted;
  final bool cough;
  final bool breathlessness;
  final bool fever;
  final bool chestPain;
  final bool severeWeakness;
  final bool cyanosis;
  final TextEditingController patientNameController;
  final TextEditingController villageController;
  final TextEditingController ageController;
  final TextEditingController respiratoryRateController;
  final TextEditingController spo2Controller;
  final TextEditingController temperatureController;
  final List<LocalDraft> drafts;
  final ValueChanged<bool> onConsentChanged;
  final ValueChanged<bool> onCoughChanged;
  final ValueChanged<bool> onBreathlessnessChanged;
  final ValueChanged<bool> onFeverChanged;
  final ValueChanged<bool> onChestPainChanged;
  final ValueChanged<bool> onSevereWeaknessChanged;
  final ValueChanged<bool> onCyanosisChanged;
  final VoidCallback onSaveRegistration;
  final VoidCallback onSaveSymptoms;
  final VoidCallback onQueueTriage;
  final VoidCallback onSyncNext;
  final VoidCallback onRetry;
  final VoidCallback onMarkConflict;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Section(
          icon: Icons.badge_outlined,
          title: strings.text(TextKey.frontlineHome),
          subtitle: strings.text(TextKey.syntheticLabel),
          child: _RegistrationForm(
            strings: strings,
            consentGranted: consentGranted,
            patientNameController: patientNameController,
            villageController: villageController,
            ageController: ageController,
            onConsentChanged: onConsentChanged,
            onSaveRegistration: onSaveRegistration,
          ),
        ),
        const SizedBox(height: 16),
        _Section(
          icon: Icons.monitor_heart_outlined,
          title: strings.text(TextKey.symptomsVitals),
          subtitle: strings.text(TextKey.decisionSupportOnly),
          child: _SymptomsVitalsForm(
            strings: strings,
            cough: cough,
            breathlessness: breathlessness,
            fever: fever,
            chestPain: chestPain,
            severeWeakness: severeWeakness,
            cyanosis: cyanosis,
            respiratoryRateController: respiratoryRateController,
            spo2Controller: spo2Controller,
            temperatureController: temperatureController,
            onCoughChanged: onCoughChanged,
            onBreathlessnessChanged: onBreathlessnessChanged,
            onFeverChanged: onFeverChanged,
            onChestPainChanged: onChestPainChanged,
            onSevereWeaknessChanged: onSevereWeaknessChanged,
            onCyanosisChanged: onCyanosisChanged,
            onSaveSymptoms: onSaveSymptoms,
            onQueueTriage: onQueueTriage,
          ),
        ),
        const SizedBox(height: 16),
        _TriagePreview(
          strings: strings,
          respiratoryRateController: respiratoryRateController,
          spo2Controller: spo2Controller,
          severeWeakness: severeWeakness,
          cyanosis: cyanosis,
        ),
        const SizedBox(height: 16),
        _OfflineQueue(
          strings: strings,
          drafts: drafts,
          onSyncNext: onSyncNext,
          onRetry: onRetry,
          onMarkConflict: onMarkConflict,
        ),
      ],
    );
  }
}

class _RegistrationForm extends StatelessWidget {
  const _RegistrationForm({
    required this.strings,
    required this.consentGranted,
    required this.patientNameController,
    required this.villageController,
    required this.ageController,
    required this.onConsentChanged,
    required this.onSaveRegistration,
  });

  final RakshaStrings strings;
  final bool consentGranted;
  final TextEditingController patientNameController;
  final TextEditingController villageController;
  final TextEditingController ageController;
  final ValueChanged<bool> onConsentChanged;
  final VoidCallback onSaveRegistration;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ResponsiveFields(
          children: [
            TextField(
              key: const Key('patient-name-field'),
              controller: patientNameController,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.patientName),
                prefixIcon: const Icon(Icons.person_outline),
              ),
              textInputAction: TextInputAction.next,
            ),
            TextField(
              controller: villageController,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.village),
                prefixIcon: const Icon(Icons.location_on_outlined),
              ),
              textInputAction: TextInputAction.next,
            ),
            TextField(
              controller: ageController,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.ageYears),
                prefixIcon: const Icon(Icons.cake_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          key: const Key('consent-switch'),
          value: consentGranted,
          onChanged: onConsentChanged,
          title: Text(strings.text(TextKey.grantConsent)),
          secondary: const Icon(Icons.verified_user_outlined),
          contentPadding: EdgeInsets.zero,
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton.icon(
            key: const Key('save-registration-button'),
            onPressed: onSaveRegistration,
            icon: const Icon(Icons.save_outlined),
            label: Text(strings.text(TextKey.saveRegistration)),
          ),
        ),
      ],
    );
  }
}

class _SymptomsVitalsForm extends StatelessWidget {
  const _SymptomsVitalsForm({
    required this.strings,
    required this.cough,
    required this.breathlessness,
    required this.fever,
    required this.chestPain,
    required this.severeWeakness,
    required this.cyanosis,
    required this.respiratoryRateController,
    required this.spo2Controller,
    required this.temperatureController,
    required this.onCoughChanged,
    required this.onBreathlessnessChanged,
    required this.onFeverChanged,
    required this.onChestPainChanged,
    required this.onSevereWeaknessChanged,
    required this.onCyanosisChanged,
    required this.onSaveSymptoms,
    required this.onQueueTriage,
  });

  final RakshaStrings strings;
  final bool cough;
  final bool breathlessness;
  final bool fever;
  final bool chestPain;
  final bool severeWeakness;
  final bool cyanosis;
  final TextEditingController respiratoryRateController;
  final TextEditingController spo2Controller;
  final TextEditingController temperatureController;
  final ValueChanged<bool> onCoughChanged;
  final ValueChanged<bool> onBreathlessnessChanged;
  final ValueChanged<bool> onFeverChanged;
  final ValueChanged<bool> onChestPainChanged;
  final ValueChanged<bool> onSevereWeaknessChanged;
  final ValueChanged<bool> onCyanosisChanged;
  final VoidCallback onSaveSymptoms;
  final VoidCallback onQueueTriage;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 0,
          children: [
            _SymptomCheck(
              label: strings.text(TextKey.cough),
              value: cough,
              onChanged: onCoughChanged,
            ),
            _SymptomCheck(
              label: strings.text(TextKey.breathlessness),
              value: breathlessness,
              onChanged: onBreathlessnessChanged,
            ),
            _SymptomCheck(
              label: strings.text(TextKey.fever),
              value: fever,
              onChanged: onFeverChanged,
            ),
            _SymptomCheck(
              label: strings.text(TextKey.chestPain),
              value: chestPain,
              onChanged: onChestPainChanged,
            ),
            _SymptomCheck(
              label: strings.text(TextKey.severeWeakness),
              value: severeWeakness,
              onChanged: onSevereWeaknessChanged,
            ),
            _SymptomCheck(
              label: strings.text(TextKey.cyanosis),
              value: cyanosis,
              onChanged: onCyanosisChanged,
            ),
          ],
        ),
        const SizedBox(height: 12),
        _ResponsiveFields(
          children: [
            TextField(
              key: const Key('respiratory-rate-field'),
              controller: respiratoryRateController,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.respiratoryRate),
                prefixIcon: const Icon(Icons.air_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
            TextField(
              key: const Key('spo2-field'),
              controller: spo2Controller,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.spo2),
                prefixIcon: const Icon(Icons.bloodtype_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: temperatureController,
              decoration: InputDecoration(
                labelText: strings.text(TextKey.temperature),
                prefixIcon: const Icon(Icons.thermostat_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            FilledButton.icon(
              key: const Key('save-symptoms-button'),
              onPressed: onSaveSymptoms,
              icon: const Icon(Icons.save_as_outlined),
              label: Text(strings.text(TextKey.saveSymptoms)),
            ),
            OutlinedButton.icon(
              key: const Key('queue-triage-button'),
              onPressed: onQueueTriage,
              icon: const Icon(Icons.person_search_outlined),
              label: Text(strings.text(TextKey.queueTriage)),
            ),
          ],
        ),
      ],
    );
  }
}

class _SymptomCheck extends StatelessWidget {
  const _SymptomCheck({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260,
      child: CheckboxListTile(
        value: value,
        onChanged: (newValue) => onChanged(newValue ?? false),
        title: Text(label),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }
}

class _TriagePreview extends StatelessWidget {
  const _TriagePreview({
    required this.strings,
    required this.respiratoryRateController,
    required this.spo2Controller,
    required this.severeWeakness,
    required this.cyanosis,
  });

  final RakshaStrings strings;
  final TextEditingController respiratoryRateController;
  final TextEditingController spo2Controller;
  final bool severeWeakness;
  final bool cyanosis;

  @override
  Widget build(BuildContext context) {
    final respiratoryRate = int.tryParse(respiratoryRateController.text);
    final spo2 = double.tryParse(spo2Controller.text);
    final flags = <Widget>[];

    if (spo2 != null && spo2 <= 93) {
      flags.add(
        _StatusChip(
          label: strings.text(TextKey.lowOxygen),
          icon: Icons.bloodtype_outlined,
          color: Theme.of(context).colorScheme.error,
        ),
      );
    }
    if (respiratoryRate != null && respiratoryRate > 30) {
      flags.add(
        _StatusChip(
          label: strings.text(TextKey.fastBreathing),
          icon: Icons.air_outlined,
          color: const Color(0xFFD97706),
        ),
      );
    }
    if (severeWeakness || cyanosis) {
      flags.add(
        _StatusChip(
          label: strings.text(TextKey.humanReviewRequired),
          icon: Icons.person_search_outlined,
          color: const Color(0xFF2563EB),
        ),
      );
    }

    return _Section(
      icon: Icons.health_and_safety_outlined,
      title: strings.text(TextKey.riskPreview),
      subtitle: strings.text(TextKey.humanReviewRequired),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          _StatusChip(
            label: strings.text(TextKey.decisionSupportOnly),
            icon: Icons.info_outline,
            color: const Color(0xFF0F766E),
          ),
          ...flags,
        ],
      ),
    );
  }
}

class _OfflineQueue extends StatelessWidget {
  const _OfflineQueue({
    required this.strings,
    required this.drafts,
    required this.onSyncNext,
    required this.onRetry,
    required this.onMarkConflict,
  });

  final RakshaStrings strings;
  final List<LocalDraft> drafts;
  final VoidCallback onSyncNext;
  final VoidCallback onRetry;
  final VoidCallback onMarkConflict;

  @override
  Widget build(BuildContext context) {
    return _Section(
      icon: Icons.sync_alt_outlined,
      title: strings.text(TextKey.offlineQueue),
      subtitle: strings.queueCount(drafts.length),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (drafts.isEmpty)
            _EmptyState(message: strings.text(TextKey.emptyQueue))
          else
            for (final draft in drafts)
              _DraftTile(strings: strings, draft: draft),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                key: const Key('sync-next-button'),
                onPressed: drafts.isEmpty ? null : onSyncNext,
                icon: const Icon(Icons.cloud_upload_outlined),
                label: Text(strings.text(TextKey.syncNext)),
              ),
              OutlinedButton.icon(
                key: const Key('retry-button'),
                onPressed:
                    drafts.any((draft) => draft.status == SyncState.failed)
                    ? onRetry
                    : null,
                icon: const Icon(Icons.refresh_outlined),
                label: Text(strings.text(TextKey.retry)),
              ),
              OutlinedButton.icon(
                key: const Key('mark-conflict-button'),
                onPressed: drafts.isEmpty ? null : onMarkConflict,
                icon: const Icon(Icons.report_problem_outlined),
                label: Text(strings.text(TextKey.markConflict)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DraftTile extends StatelessWidget {
  const _DraftTile({required this.strings, required this.draft});

  final RakshaStrings strings;
  final LocalDraft draft;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(context, draft.status);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: color.withValues(alpha: 0.28)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: ListTile(
          leading: Icon(_statusIcon(draft.status), color: color),
          title: Text(strings.text(_titleForDraftType(draft.type))),
          subtitle: Text(
            '${strings.text(TextKey.syncMetadata)}: ${draft.id} · ${draft.status.apiValue} · local v${draft.localVersion} · server v${draft.serverVersion ?? 'new'}',
          ),
          trailing: _StatusChip(
            label: strings.syncState(draft.status),
            icon: _statusIcon(draft.status),
            color: color,
          ),
        ),
      ),
    );
  }
}

TextKey _titleForDraftType(LocalDraftType type) {
  switch (type) {
    case LocalDraftType.registration:
      return TextKey.registrationDraft;
    case LocalDraftType.symptomsVitals:
      return TextKey.symptomDraft;
    case LocalDraftType.respiratoryTriageReview:
      return TextKey.triageDraft;
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            const Icon(Icons.inbox_outlined),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _ResponsiveFields extends StatelessWidget {
  const _ResponsiveFields({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 720;
        if (!isWide) {
          return Column(
            children: [
              for (final child in children)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: child,
                ),
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final child in children)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: child,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(child: Text(label)),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 18, color: color),
      label: Text(label),
      labelStyle: TextStyle(color: color, fontWeight: FontWeight.w700),
      backgroundColor: color.withValues(alpha: 0.09),
      side: BorderSide(color: color.withValues(alpha: 0.32)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }
}

Color _statusColor(BuildContext context, SyncState state) {
  switch (state) {
    case SyncState.pending:
      return const Color(0xFFD97706);
    case SyncState.syncing:
      return Theme.of(context).colorScheme.secondary;
    case SyncState.synced:
      return const Color(0xFF047857);
    case SyncState.failed:
      return Theme.of(context).colorScheme.error;
    case SyncState.conflict:
      return const Color(0xFF7C3AED);
  }
}

IconData _statusIcon(SyncState state) {
  switch (state) {
    case SyncState.pending:
      return Icons.schedule_outlined;
    case SyncState.syncing:
      return Icons.sync_outlined;
    case SyncState.synced:
      return Icons.cloud_done_outlined;
    case SyncState.failed:
      return Icons.cloud_off_outlined;
    case SyncState.conflict:
      return Icons.report_problem_outlined;
  }
}
