import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

enum SyncState { pending, syncing, synced, failed, conflict }

extension SyncStateContract on SyncState {
  String get apiValue {
    switch (this) {
      case SyncState.pending:
        return 'PENDING';
      case SyncState.syncing:
        return 'SYNCING';
      case SyncState.synced:
        return 'SYNCED';
      case SyncState.failed:
        return 'FAILED';
      case SyncState.conflict:
        return 'CONFLICT';
    }
  }
}

SyncState syncStateFromApiValue(String value) {
  switch (value) {
    case 'PENDING':
      return SyncState.pending;
    case 'SYNCING':
      return SyncState.syncing;
    case 'SYNCED':
      return SyncState.synced;
    case 'FAILED':
      return SyncState.failed;
    case 'CONFLICT':
      return SyncState.conflict;
  }
  throw FormatException('Unsupported sync status: $value');
}

enum LocalDraftType { registration, symptomsVitals, respiratoryTriageReview }

extension LocalDraftTypeContract on LocalDraftType {
  String get apiValue {
    switch (this) {
      case LocalDraftType.registration:
        return 'REGISTRATION';
      case LocalDraftType.symptomsVitals:
        return 'SYMPTOMS_VITALS';
      case LocalDraftType.respiratoryTriageReview:
        return 'RESPIRATORY_TRIAGE_REVIEW';
    }
  }
}

LocalDraftType localDraftTypeFromApiValue(String value) {
  switch (value) {
    case 'REGISTRATION':
      return LocalDraftType.registration;
    case 'SYMPTOMS_VITALS':
      return LocalDraftType.symptomsVitals;
    case 'RESPIRATORY_TRIAGE_REVIEW':
      return LocalDraftType.respiratoryTriageReview;
  }
  throw FormatException('Unsupported local draft type: $value');
}

class LocalDraft {
  const LocalDraft({
    required this.id,
    required this.type,
    required this.status,
    required this.updatedAt,
    required this.localVersion,
    this.serverVersion,
    this.payload = const <String, Object?>{},
    this.conflictPayload,
  });

  final String id;
  final LocalDraftType type;
  final SyncState status;
  final DateTime updatedAt;
  final int localVersion;
  final int? serverVersion;
  final Map<String, Object?> payload;
  final Map<String, Object?>? conflictPayload;

  LocalDraft copyWith({
    LocalDraftType? type,
    SyncState? status,
    DateTime? updatedAt,
    int? localVersion,
    int? serverVersion,
    bool clearServerVersion = false,
    Map<String, Object?>? payload,
    Map<String, Object?>? conflictPayload,
    bool clearConflictPayload = false,
  }) {
    return LocalDraft(
      id: id,
      type: type ?? this.type,
      status: status ?? this.status,
      updatedAt: updatedAt ?? this.updatedAt,
      localVersion: localVersion ?? this.localVersion,
      serverVersion: clearServerVersion
          ? null
          : serverVersion ?? this.serverVersion,
      payload: payload ?? this.payload,
      conflictPayload: clearConflictPayload
          ? null
          : conflictPayload ?? this.conflictPayload,
    );
  }

  Map<String, Object?> toJson() {
    return <String, Object?>{
      'id': id,
      'type': type.apiValue,
      'status': status.apiValue,
      'updatedAt': updatedAt.toUtc().toIso8601String(),
      'localVersion': localVersion,
      'serverVersion': serverVersion,
      'payload': payload,
      'conflictPayload': conflictPayload,
    };
  }

  factory LocalDraft.fromJson(Map<String, Object?> json) {
    final localVersion = json['localVersion'] as int? ?? 1;
    final serverVersion = json['serverVersion'] as int?;
    if (localVersion < 1) {
      throw FormatException('Local version must be positive: $localVersion');
    }
    if (serverVersion != null && serverVersion < 0) {
      throw FormatException('Server version must be non-negative: $serverVersion');
    }

    return LocalDraft(
      id: json['id'] as String,
      type: localDraftTypeFromApiValue(json['type'] as String),
      status: syncStateFromApiValue(json['status'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String).toUtc(),
      localVersion: localVersion,
      serverVersion: serverVersion,
      payload: _stringObjectMap(json['payload']),
      conflictPayload: json['conflictPayload'] == null
          ? null
          : _stringObjectMap(json['conflictPayload']),
    );
  }
}

abstract interface class OfflineDraftStore {
  Future<List<LocalDraft>> loadDrafts();
  Future<void> saveDrafts(List<LocalDraft> drafts);
}

class SharedPreferencesDraftStore implements OfflineDraftStore {
  SharedPreferencesDraftStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const storageKey = 'raksha.offline_drafts.v1';

  final SharedPreferencesAsync _preferences;

  @override
  Future<List<LocalDraft>> loadDrafts() async {
    final encodedDrafts =
        await _preferences.getStringList(storageKey) ?? const <String>[];
    return encodedDrafts
        .map((encoded) => jsonDecode(encoded) as Map<String, Object?>)
        .map(LocalDraft.fromJson)
        .toList(growable: false);
  }

  @override
  Future<void> saveDrafts(List<LocalDraft> drafts) {
    final encodedDrafts = drafts
        .map((draft) => jsonEncode(draft.toJson()))
        .toList(growable: false);
    return _preferences.setStringList(storageKey, encodedDrafts);
  }
}

class MemoryDraftStore implements OfflineDraftStore {
  MemoryDraftStore([List<LocalDraft> drafts = const <LocalDraft>[]])
    : _drafts = List<LocalDraft>.of(drafts);

  List<LocalDraft> _drafts;

  @override
  Future<List<LocalDraft>> loadDrafts() async {
    return List<LocalDraft>.of(_drafts);
  }

  @override
  Future<void> saveDrafts(List<LocalDraft> drafts) async {
    _drafts = List<LocalDraft>.of(drafts);
  }
}

enum SyncAttemptStatus { synced, failed, conflict }

class SyncAttemptResult {
  const SyncAttemptResult._({
    required this.status,
    this.serverVersion,
    this.message,
    this.conflictPayload,
  });

  const SyncAttemptResult.synced({required int serverVersion})
    : this._(
        status: SyncAttemptStatus.synced,
        serverVersion: serverVersion,
      );

  const SyncAttemptResult.failed(String message)
    : this._(status: SyncAttemptStatus.failed, message: message);

  const SyncAttemptResult.conflict({
    required int serverVersion,
    required Map<String, Object?> conflictPayload,
  }) : this._(
         status: SyncAttemptStatus.conflict,
         serverVersion: serverVersion,
         conflictPayload: conflictPayload,
       );

  final SyncAttemptStatus status;
  final int? serverVersion;
  final String? message;
  final Map<String, Object?>? conflictPayload;
}

abstract interface class SyncTransport {
  Future<SyncAttemptResult> push(LocalDraft draft, {required bool isOnline});
}

class SyntheticSyncTransport implements SyncTransport {
  SyntheticSyncTransport({
    this.latency = const Duration(milliseconds: 180),
    Set<String> conflictDraftIds = const <String>{},
  }) : conflictDraftIds = Set<String>.of(conflictDraftIds);

  final Duration latency;
  final Set<String> conflictDraftIds;

  @override
  Future<SyncAttemptResult> push(
    LocalDraft draft, {
    required bool isOnline,
  }) async {
    if (latency > Duration.zero) {
      await Future<void>.delayed(latency);
    }
    if (!isOnline) {
      return const SyncAttemptResult.failed('OFFLINE');
    }
    if (conflictDraftIds.contains(draft.id) ||
        draft.payload['simulateConflict'] == true) {
      final serverVersion = (draft.serverVersion ?? 0) + 1;
      return SyncAttemptResult.conflict(
        serverVersion: serverVersion,
        conflictPayload: <String, Object?>{
          'reason': 'REMOTE_VERSION_AHEAD',
          'localPayload': draft.payload,
          'serverPayload': <String, Object?>{
            'serverVersion': serverVersion,
            'requiresHumanResolution': true,
          },
        },
      );
    }
    return SyncAttemptResult.synced(
      serverVersion: (draft.serverVersion ?? 0) + 1,
    );
  }
}

class OfflineSyncController {
  OfflineSyncController({
    required OfflineDraftStore store,
    required SyncTransport transport,
  }) : _store = store,
       _transport = transport;

  final OfflineDraftStore _store;
  final SyncTransport _transport;
  List<LocalDraft> _drafts = <LocalDraft>[];

  List<LocalDraft> get drafts => List<LocalDraft>.unmodifiable(_drafts);

  Future<List<LocalDraft>> loadDrafts() async {
    _drafts = await _store.loadDrafts();
    _sortDrafts();
    return drafts;
  }

  Future<LocalDraft> addDraft({
    required LocalDraftType type,
    Map<String, Object?> payload = const <String, Object?>{},
  }) async {
    final draft = LocalDraft(
      id: _nextLocalId(),
      type: type,
      status: SyncState.pending,
      updatedAt: DateTime.now().toUtc(),
      localVersion: 1,
      payload: Map<String, Object?>.unmodifiable(payload),
    );
    _drafts = <LocalDraft>[draft, ..._drafts];
    await _persist();
    return draft;
  }

  Future<LocalDraft?> retryFirstFailed() async {
    final index = _drafts.indexWhere((draft) => draft.status == SyncState.failed);
    if (index == -1) {
      return null;
    }
    final updated = _drafts[index].copyWith(
      status: SyncState.pending,
      updatedAt: DateTime.now().toUtc(),
    );
    await _replaceAt(index, updated);
    return updated;
  }

  Future<LocalDraft?> markLatestConflict() async {
    if (_drafts.isEmpty) {
      return null;
    }
    final draft = _drafts.first;
    final conflictPayload = <String, Object?>{
      'reason': 'MANUAL_CONFLICT_REVIEW_REQUIRED',
      'localPayload': draft.payload,
      'serverPayload': <String, Object?>{
        'serverVersion': draft.serverVersion ?? 0,
        'requiresHumanResolution': true,
      },
    };
    final updated = draft.copyWith(
      status: SyncState.conflict,
      updatedAt: DateTime.now().toUtc(),
      conflictPayload: conflictPayload,
    );
    await _replaceAt(0, updated);
    return updated;
  }

  Future<SyncAttemptResult?> syncNext({
    required bool isOnline,
    void Function(List<LocalDraft> drafts)? onDraftsChanged,
  }) async {
    final index = _drafts.indexWhere(
      (draft) =>
          draft.status == SyncState.pending || draft.status == SyncState.failed,
    );
    if (index == -1) {
      return null;
    }

    final syncingDraft = _drafts[index].copyWith(
      status: SyncState.syncing,
      updatedAt: DateTime.now().toUtc(),
    );
    await _replaceAt(index, syncingDraft);
    onDraftsChanged?.call(drafts);

    final result = await _transport.push(syncingDraft, isOnline: isOnline);
    final completedDraft = _draftFromResult(syncingDraft, result);
    await _replaceAt(index, completedDraft);
    onDraftsChanged?.call(drafts);
    return result;
  }

  LocalDraft _draftFromResult(LocalDraft draft, SyncAttemptResult result) {
    switch (result.status) {
      case SyncAttemptStatus.synced:
        return draft.copyWith(
          status: SyncState.synced,
          updatedAt: DateTime.now().toUtc(),
          serverVersion: result.serverVersion,
          clearConflictPayload: true,
        );
      case SyncAttemptStatus.failed:
        return draft.copyWith(
          status: SyncState.failed,
          updatedAt: DateTime.now().toUtc(),
        );
      case SyncAttemptStatus.conflict:
        return draft.copyWith(
          status: SyncState.conflict,
          updatedAt: DateTime.now().toUtc(),
          serverVersion: result.serverVersion,
          conflictPayload: result.conflictPayload,
        );
    }
  }

  Future<void> _replaceAt(int index, LocalDraft updatedDraft) async {
    _drafts = <LocalDraft>[
      for (var i = 0; i < _drafts.length; i += 1)
        if (i == index) updatedDraft else _drafts[i],
    ];
    await _persist();
  }

  Future<void> _persist() {
    return _store.saveDrafts(_drafts);
  }

  void _sortDrafts() {
    _drafts.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  String _nextLocalId() {
    final expression = RegExp(r'^LOCAL-(\d+)$');
    var highest = 0;
    for (final draft in _drafts) {
      final match = expression.firstMatch(draft.id);
      if (match == null) {
        continue;
      }
      final number = int.tryParse(match.group(1)!);
      if (number != null && number > highest) {
        highest = number;
      }
    }
    return 'LOCAL-${(highest + 1).toString().padLeft(3, '0')}';
  }
}

Map<String, Object?> _stringObjectMap(Object? value) {
  if (value == null) {
    return const <String, Object?>{};
  }
  return Map<String, Object?>.from(value as Map);
}
