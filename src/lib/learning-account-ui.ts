import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  requestPasswordRecovery,
  updateUser,
  type User,
} from "@netlify/identity";
import {
  attachLearningProgressSync,
  connectLearningProgress,
  disconnectLearningProgress,
  retryLearningProgressSync,
} from "./learning-progress-sync.ts";

let unsubscribeAuth: (() => void) | null = null;
let removeSyncStatusListener: (() => void) | null = null;

function requireElement<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Lernkonto-Element fehlt: ${selector}`);
  return element;
}

export function attachLearningAccount(root: HTMLElement): void {
  if (root.dataset.accountAttached === "true") return;
  unsubscribeAuth?.();
  removeSyncStatusListener?.();
  root.dataset.accountAttached = "true";
  attachLearningProgressSync();

  const status = requireElement<HTMLElement>(root, "[data-account-status]");
  const loginForm = requireElement<HTMLFormElement>(root, "[data-login-form]");
  const inviteForm = requireElement<HTMLFormElement>(root, "[data-invite-form]");
  const recoveryRequestForm = requireElement<HTMLFormElement>(
    root,
    "[data-recovery-request-form]",
  );
  const recoveryCompleteForm = requireElement<HTMLFormElement>(
    root,
    "[data-recovery-complete-form]",
  );
  const signedIn = requireElement<HTMLElement>(root, "[data-signed-in]");
  const userEmail = requireElement<HTMLElement>(root, "[data-user-email]");
  const logoutButton = requireElement<HTMLButtonElement>(
    root,
    "[data-logout]",
  );
  const retryButton = requireElement<HTMLButtonElement>(root, "[data-sync-retry]");

  let inviteToken: string | null = null;
  let currentUserId: string | null = null;

  const showError = (error: unknown, fallback: string) => {
    status.textContent = error instanceof Error ? error.message : fallback;
    status.dataset.state = "error";
  };

  const setUser = async (user: User | null): Promise<void> => {
    if (!user) {
      currentUserId = null;
      disconnectLearningProgress();
      signedIn.hidden = true;
      loginForm.hidden = false;
      return;
    }

    currentUserId = user.id;
    signedIn.hidden = false;
    loginForm.hidden = true;
    inviteForm.hidden = true;
    recoveryRequestForm.hidden = true;
    recoveryCompleteForm.hidden = true;
    userEmail.textContent = user.email ?? "Angemeldet";
    await connectLearningProgress(user.id);
  };

  const onSyncStatus = (event: Event) => {
    const detail = (event as CustomEvent<{ message?: string; status?: string }>)
      .detail;
    if (detail?.message) status.textContent = detail.message;
    status.dataset.state = detail?.status ?? "info";
    retryButton.hidden = detail?.status !== "error" || !currentUserId;
  };
  document.addEventListener("learning-progress:sync-status", onSyncStatus);
  removeSyncStatusListener = () =>
    document.removeEventListener("learning-progress:sync-status", onSyncStatus);

  unsubscribeAuth = onAuthChange((_event, user) => {
    void setUser(user);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = requireElement<HTMLInputElement>(root, "[data-login-email]");
    const password = requireElement<HTMLInputElement>(
      root,
      "[data-login-password]",
    );
    const submit = requireElement<HTMLButtonElement>(
      root,
      "[data-login-submit]",
    );
    submit.disabled = true;
    status.textContent = "Anmeldung läuft …";
    status.dataset.state = "loading";
    try {
      await setUser(await login(email.value.trim(), password.value));
      password.value = "";
    } catch (error) {
      showError(
        error,
        "Anmeldung fehlgeschlagen. Prüfe deine Einladung und Zugangsdaten.",
      );
    } finally {
      submit.disabled = false;
    }
  });

  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!inviteToken) {
      showError(null, "Der Einladungslink ist ungültig oder abgelaufen.");
      return;
    }
    const password = requireElement<HTMLInputElement>(
      root,
      "[data-invite-password]",
    );
    const submit = requireElement<HTMLButtonElement>(
      root,
      "[data-invite-submit]",
    );
    submit.disabled = true;
    status.textContent = "Einladung wird angenommen …";
    status.dataset.state = "loading";
    try {
      const user = await acceptInvite(inviteToken, password.value);
      inviteToken = null;
      password.value = "";
      await setUser(user);
    } catch (error) {
      showError(error, "Die Einladung konnte nicht angenommen werden.");
    } finally {
      submit.disabled = false;
    }
  });

  recoveryRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = requireElement<HTMLInputElement>(
      root,
      "[data-recovery-email]",
    );
    const submit = requireElement<HTMLButtonElement>(
      root,
      "[data-recovery-submit]",
    );
    submit.disabled = true;
    status.textContent = "Wiederherstellungslink wird angefordert …";
    status.dataset.state = "loading";
    try {
      await requestPasswordRecovery(email.value.trim());
      status.textContent =
        "Falls ein Konto zu dieser Adresse besteht, wird ein Wiederherstellungslink gesendet.";
      status.dataset.state = "info";
    } catch (error) {
      showError(error, "Der Wiederherstellungslink konnte nicht angefordert werden.");
    } finally {
      submit.disabled = false;
    }
  });

  recoveryCompleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = requireElement<HTMLInputElement>(
      root,
      "[data-recovery-password]",
    );
    const submit = requireElement<HTMLButtonElement>(
      root,
      "[data-recovery-complete-submit]",
    );
    submit.disabled = true;
    status.textContent = "Passwort wird aktualisiert …";
    status.dataset.state = "loading";
    try {
      await updateUser({ password: password.value });
      password.value = "";
      recoveryCompleteForm.hidden = true;
      status.textContent = "Das Passwort wurde aktualisiert.";
      status.dataset.state = "ready";
    } catch (error) {
      showError(error, "Das Passwort konnte nicht aktualisiert werden.");
    } finally {
      submit.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      await logout();
      await setUser(null);
    } catch (error) {
      showError(error, "Abmeldung fehlgeschlagen.");
    } finally {
      logoutButton.disabled = false;
    }
  });

  retryButton.addEventListener("click", () => {
    void retryLearningProgressSync();
  });

  root
    .querySelector<HTMLButtonElement>("[data-show-recovery]")
    ?.addEventListener("click", () => {
      recoveryRequestForm.hidden = false;
      status.textContent = "Gib die E-Mail-Adresse deines Kontos ein.";
      status.dataset.state = "info";
    });

  async function initialize(): Promise<void> {
    try {
      const callback = await handleAuthCallback();
      if (callback?.type === "invite" && callback.token) {
        root.hidden = false;
        inviteToken = callback.token;
        loginForm.hidden = true;
        inviteForm.hidden = false;
        status.textContent = "Lege ein Passwort für dein eingeladenes Konto fest.";
        status.dataset.state = "info";
      } else if (callback?.type === "recovery") {
        root.hidden = false;
        loginForm.hidden = true;
        recoveryCompleteForm.hidden = false;
        status.textContent = "Lege ein neues Passwort fest.";
        status.dataset.state = "info";
      }

      const user =
        callback?.type === "invite" || callback?.type === "recovery"
          ? null
          : (callback?.user ?? (await getUser()));
      if (user) await setUser(user);
      else if (!inviteToken && callback?.type !== "recovery") {
        status.textContent =
          "Melde dich mit einem eingeladenen Konto an, damit dein Lernstand online gespeichert wird.";
        status.dataset.state = "info";
      }
    } catch (error) {
      showError(
        error,
        "Die Kontofunktion ist nicht verfügbar. Netlify Identity muss auf der Site aktiviert sein.",
      );
    }
  }

  void initialize();
}
