import {
  clearLearningProgress,
  createInitialProgress,
  hasStoredLearningProgress,
  LEARNING_PROGRESS_STORAGE_KEY,
  type LearningProgressState,
  loadLearningProgress,
  sanitizeStoredProgress,
  saveLearningProgress,
  setLearningProgressAccountId,
} from "./learning-progress.ts";

interface ProgressApiResponse {
  progress: LearningProgressState | null;
  version: string | null;
  error?: string;
}

type SyncStatus = "signed-out" | "loading" | "saving" | "ready" | "error";
interface SyncMetadata {
  version: string | null;
  dirty: boolean;
}

let activeAccountId: string | null = null;
let currentVersion: string | null = null;
let hasUnsyncedChanges = false;
let syncStatus: SyncStatus = "signed-out";
let pendingState: LearningProgressState | null = null;
let queuedState: LearningProgressState | null = null;
let saveTask: Promise<void> | null = null;
let connectTask: Promise<void> | null = null;
let syncListenerAttached = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dispatchSyncStatus(status: SyncStatus, message: string): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent("learning-progress:sync-status", {
      detail: { status, message },
    }),
  );
}

function localStorageValue(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function syncMetadataKey(accountId: string): string {
  return `${LEARNING_PROGRESS_STORAGE_KEY}:sync:${accountId}`;
}

function readSyncMetadata(accountId: string): SyncMetadata {
  const raw = localStorageValue(syncMetadataKey(accountId));
  if (!raw) return { version: null, dirty: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      (parsed.version === null || typeof parsed.version === "string") &&
      typeof parsed.dirty === "boolean"
    ) {
      return { version: parsed.version, dirty: parsed.dirty };
    }
  } catch {
    console.warn("Die lokale Lernstand-Synchronisationsmarke ist ungültig.");
  }
  return { version: null, dirty: false };
}

function writeSyncMetadata(accountId: string): void {
  try {
    window.localStorage.setItem(
      syncMetadataKey(accountId),
      JSON.stringify({ version: currentVersion, dirty: hasUnsyncedChanges }),
    );
  } catch {
    dispatchSyncStatus(
      "error",
      "Der lokale Synchronisationsstand konnte nicht gespeichert werden.",
    );
  }
}

function backupAccountProgress(
  accountId: string,
  progress: LearningProgressState,
): void {
  try {
    window.localStorage.setItem(
      `${LEARNING_PROGRESS_STORAGE_KEY}:conflict:${accountId}`,
      JSON.stringify(progress),
    );
  } catch {
    console.error(
      "Der nicht synchronisierte Lernstand konnte nicht lokal gesichert werden.",
    );
  }
}

function backupGuestProgress(accountId: string): void {
  const raw = localStorageValue(LEARNING_PROGRESS_STORAGE_KEY);
  if (!raw || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LEARNING_PROGRESS_STORAGE_KEY}:backup:${accountId}`,
      raw,
    );
    clearLearningProgress(LEARNING_PROGRESS_STORAGE_KEY);
  } catch {
    dispatchSyncStatus(
      "error",
      "Der Cloud-Lernstand ist geladen, aber der alte lokale Stand konnte nicht bereinigt werden.",
    );
  }
}

async function requestProgress(
  method: "GET" | "PUT",
  accountId: string,
  progress?: LearningProgressState,
  version?: string | null,
): Promise<ProgressApiResponse> {
  const headers: Record<string, string> = {
    "x-learning-account": accountId,
  };
  if (method === "PUT") {
    headers["Content-Type"] = "application/json";
    if (version) headers["x-learning-version"] = version;
  }
  const response = await fetch("/api/learning-progress", {
    method,
    cache: "no-store",
    headers,
    ...(method === "PUT"
      ? { body: JSON.stringify({ accountId, progress }) }
      : {}),
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Die Lernstand-API lieferte keine gültige JSON-Antwort.");
  }
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Der Lernstand konnte nicht synchronisiert werden.";
    const error = new Error(message);
    if (response.status === 409) error.name = "LearningProgressConflictError";
    throw error;
  }
  if (
    !isRecord(payload) ||
    !("progress" in payload) ||
    !("version" in payload) ||
    payload.version === undefined ||
    (payload.progress !== null && !isRecord(payload.progress)) ||
    (payload.version !== null && typeof payload.version !== "string")
  ) {
    throw new Error("Die Lernstand-API lieferte ungültige Daten.");
  }
  const serverVersion = payload.version;
  const sanitizedProgress =
    payload.progress === null
      ? null
      : sanitizeStoredProgress(payload.progress, []);
  if (payload.progress !== null && !sanitizedProgress) {
    throw new Error("Die Lernstand-API lieferte einen ungültigen Lernstand.");
  }
  return {
    progress: sanitizedProgress,
    version: serverVersion,
  };
}

function applyRemoteProgress(progress: LearningProgressState): void {
  saveLearningProgress(progress, undefined, false);
  document.dispatchEvent(
    new CustomEvent("learning-progress:updated", {
      bubbles: true,
      detail: { state: progress, source: "cloud" },
    }),
  );
}

async function flushQueue(): Promise<void> {
  if (saveTask) return saveTask;
  saveTask = (async () => {
    while (queuedState && activeAccountId && syncStatus === "ready") {
      const accountId = activeAccountId;
      const progress = queuedState;
      queuedState = null;
      dispatchSyncStatus("saving", "Änderung wird online gespeichert …");
      try {
        const result = await requestProgress(
          "PUT",
          accountId,
          progress,
          currentVersion,
        );
        if (activeAccountId !== accountId) return;
        currentVersion = result.version;
        hasUnsyncedChanges = false;
        writeSyncMetadata(accountId);
        if (result.progress) applyRemoteProgress(result.progress);
        dispatchSyncStatus("ready", "Lernstand ist online gespeichert.");
      } catch (error) {
        if (activeAccountId !== accountId) return;
        if (
          error instanceof Error &&
          error.name === "LearningProgressConflictError"
        ) {
          try {
            const latest = await requestProgress("GET", accountId);
            if (activeAccountId !== accountId) return;
            currentVersion = latest.version;
            if (latest.progress) {
              backupAccountProgress(accountId, progress);
              hasUnsyncedChanges = false;
              writeSyncMetadata(accountId);
              applyRemoteProgress(latest.progress);
            }
          } catch (refreshError) {
            console.error(
              "Der aktuelle Cloud-Lernstand konnte nach einem Konflikt nicht geladen werden.",
              refreshError,
            );
          }
          dispatchSyncStatus(
            "error",
            "Ein anderes Gerät hat den Lernstand geändert. Der Cloud-Stand wurde neu geladen; bitte wiederhole die letzte Aktion.",
          );
        } else {
          console.error(
            "Der Lernstand konnte nicht in Netlify Blobs gespeichert werden.",
            error,
          );
          dispatchSyncStatus(
            "error",
            error instanceof Error
              ? error.message
              : "Der Lernstand konnte nicht synchronisiert werden.",
          );
        }
        return;
      }
    }
  })().finally(() => {
    saveTask = null;
    if (queuedState && activeAccountId && syncStatus === "ready") {
      void flushQueue();
    }
  });
  return saveTask;
}

async function connect(accountId: string): Promise<void> {
  if (!accountId.trim()) throw new Error("Die Konto-ID fehlt.");
  activeAccountId = accountId;
  setLearningProgressAccountId(accountId);
  syncStatus = "loading";
  dispatchSyncStatus(
    "loading",
    "Dein Lernstand wird mit der Cloud abgeglichen …",
  );

  const localKey = `${LEARNING_PROGRESS_STORAGE_KEY}:${accountId}`;
  const metadata = readSyncMetadata(accountId);
  const hasAccountProgress = hasStoredLearningProgress(localKey);
  const hasGuestProgress = hasStoredLearningProgress(
    LEARNING_PROGRESS_STORAGE_KEY,
  );
  const localProgress = hasAccountProgress
    ? loadLearningProgress([], localKey)
    : hasGuestProgress
      ? loadLearningProgress([], LEARNING_PROGRESS_STORAGE_KEY)
      : createInitialProgress([]);

  if (!hasAccountProgress) {
    saveLearningProgress(localProgress, localKey, false);
  }

  const remote = await requestProgress("GET", accountId);
  if (activeAccountId !== accountId) return;
  currentVersion = remote.version;

  if (remote.progress) {
    if (
      (metadata.dirty || pendingState) &&
      (hasAccountProgress || pendingState)
    ) {
      if (metadata.version === remote.version) {
        const saved = await requestProgress(
          "PUT",
          accountId,
          pendingState ?? localProgress,
          remote.version,
        );
        if (activeAccountId !== accountId) return;
        currentVersion = saved.version;
        hasUnsyncedChanges = false;
        writeSyncMetadata(accountId);
        if (saved.progress) applyRemoteProgress(saved.progress);
      } else {
        backupAccountProgress(accountId, pendingState ?? localProgress);
        hasUnsyncedChanges = false;
        writeSyncMetadata(accountId);
        applyRemoteProgress(remote.progress);
        syncStatus = "error";
        dispatchSyncStatus(
          "error",
          "Ein anderes Gerät hat den Lernstand geändert. Der Cloud-Stand wurde geladen; die lokale Version bleibt als Sicherung erhalten.",
        );
        return;
      }
    } else {
      applyRemoteProgress(remote.progress);
      hasUnsyncedChanges = false;
      writeSyncMetadata(accountId);
    }
    if (hasGuestProgress) backupGuestProgress(accountId);
  } else {
    const initial = pendingState ?? localProgress;
    const saved = await requestProgress("PUT", accountId, initial, null);
    if (activeAccountId !== accountId) return;
    currentVersion = saved.version;
    hasUnsyncedChanges = false;
    writeSyncMetadata(accountId);
    if (saved.progress) applyRemoteProgress(saved.progress);
    if (hasGuestProgress) backupGuestProgress(accountId);
  }

  pendingState = null;
  syncStatus = "ready";
  dispatchSyncStatus("ready", "Lernstand ist online gespeichert.");
  if (queuedState) void flushQueue();
}

export async function connectLearningProgress(
  accountId: string,
): Promise<void> {
  while (connectTask) {
    await connectTask;
    if (activeAccountId === accountId && syncStatus === "ready") return;
  }
  if (activeAccountId === accountId && syncStatus === "ready") return;
  const task = connect(accountId).catch((error: unknown) => {
    if (activeAccountId !== accountId) return;
    syncStatus = "error";
    console.error(
      "Der Lernstand konnte nicht mit der Cloud synchronisiert werden.",
      error,
    );
    dispatchSyncStatus(
      "error",
      error instanceof Error
        ? error.message
        : "Der Lernstand konnte nicht synchronisiert werden.",
    );
  });
  connectTask = task;
  try {
    await task;
  } finally {
    if (connectTask === task) connectTask = null;
  }
}

export function disconnectLearningProgress(): void {
  activeAccountId = null;
  currentVersion = null;
  hasUnsyncedChanges = false;
  pendingState = null;
  queuedState = null;
  syncStatus = "signed-out";
  setLearningProgressAccountId(null);
  dispatchSyncStatus(
    "signed-out",
    "Nicht angemeldet. Änderungen werden nicht online synchronisiert.",
  );
}

export async function retryLearningProgressSync(): Promise<void> {
  if (activeAccountId) await connectLearningProgress(activeAccountId);
}

export function attachLearningProgressSync(): void {
  if (syncListenerAttached || typeof document === "undefined") return;
  syncListenerAttached = true;
  document.addEventListener("learning-progress:saved", (event) => {
    if (!activeAccountId) return;
    const detail = (event as CustomEvent<{ state?: LearningProgressState }>)
      .detail;
    const state = detail?.state ?? loadLearningProgress();
    if (syncStatus === "loading") {
      pendingState = state;
      hasUnsyncedChanges = true;
      writeSyncMetadata(activeAccountId);
      return;
    }
    if (syncStatus !== "ready") return;
    hasUnsyncedChanges = true;
    writeSyncMetadata(activeAccountId);
    queuedState = state;
    void flushQueue();
  });
}
