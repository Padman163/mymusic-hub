import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  requestPasswordRecovery,
  signup,
  type User,
  updateUser,
} from "@netlify/identity";
import {
  attachLearningProgressSync,
  connectLearningProgress,
  disconnectLearningProgress,
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

export function attachLearningAccount(root: HTMLDetailsElement): void {
  if (root.dataset.accountAttached === "true") return;
  unsubscribeAuth?.();
  removeSyncStatusListener?.();
  root.dataset.accountAttached = "true";
  attachLearningProgressSync();

  const accountLabel = requireElement<HTMLElement>(
    root,
    "[data-account-label]",
  );
  const authForms = requireElement<HTMLElement>(root, "[data-auth-forms]");
  const modeSwitch = requireElement<HTMLElement>(
    root,
    ".learning-account-switch",
  );
  const status = requireElement<HTMLElement>(root, "[data-account-status]");
  const loginForm = requireElement<HTMLFormElement>(root, "[data-login-form]");
  const signupForm = requireElement<HTMLFormElement>(
    root,
    "[data-signup-form]",
  );
  const inviteForm = requireElement<HTMLFormElement>(
    root,
    "[data-invite-form]",
  );
  const recoveryRequestForm = requireElement<HTMLFormElement>(
    root,
    "[data-recovery-request-form]",
  );
  const recoveryCompleteForm = requireElement<HTMLFormElement>(
    root,
    "[data-recovery-complete-form]",
  );
  const signedIn = requireElement<HTMLElement>(root, "[data-signed-in]");
  const logoutButton = requireElement<HTMLButtonElement>(root, "[data-logout]");

  let inviteToken: string | null = null;

  const setStatus = (message: string, state = "info") => {
    status.textContent = message;
    status.hidden = !message;
    status.dataset.state = state;
  };

  const showError = (error: unknown, fallback: string) => {
    setStatus(error instanceof Error ? error.message : fallback, "error");
  };

  const showLoginForm = () => {
    modeSwitch.hidden = false;
    loginForm.hidden = false;
    signupForm.hidden = true;
    inviteForm.hidden = true;
    recoveryRequestForm.hidden = true;
    recoveryCompleteForm.hidden = true;
    requireElement<HTMLButtonElement>(root, "[data-show-login]").setAttribute(
      "aria-pressed",
      "true",
    );
    requireElement<HTMLButtonElement>(root, "[data-show-signup]").setAttribute(
      "aria-pressed",
      "false",
    );
  };

  const showSignupForm = () => {
    modeSwitch.hidden = false;
    loginForm.hidden = true;
    signupForm.hidden = false;
    inviteForm.hidden = true;
    recoveryRequestForm.hidden = true;
    recoveryCompleteForm.hidden = true;
    requireElement<HTMLButtonElement>(root, "[data-show-login]").setAttribute(
      "aria-pressed",
      "false",
    );
    requireElement<HTMLButtonElement>(root, "[data-show-signup]").setAttribute(
      "aria-pressed",
      "true",
    );
  };

  const setUser = async (user: User | null): Promise<void> => {
    if (!user) {
      disconnectLearningProgress();
      signedIn.hidden = true;
      authForms.hidden = false;
      accountLabel.textContent = "Login / Registrierung";
      showLoginForm();
      return;
    }

    authForms.hidden = true;
    signedIn.hidden = false;
    setStatus("");
    const name = user.name || user.email || "Konto";
    accountLabel.textContent = `Angemeldet als ${name}`;
    root.open = false;
    await connectLearningProgress(user.id);
  };

  const onSyncStatus = (event: Event) => {
    const detail = (event as CustomEvent<{ message?: string; status?: string }>)
      .detail;
    if (detail?.message && detail.status === "error") {
      setStatus(detail.message, "error");
    }
  };
  document.addEventListener("learning-progress:sync-status", onSyncStatus);
  removeSyncStatusListener = () =>
    document.removeEventListener("learning-progress:sync-status", onSyncStatus);

  unsubscribeAuth = onAuthChange((_event, user) => {
    void setUser(user);
  });

  requireElement<HTMLButtonElement>(root, "[data-show-login]").addEventListener(
    "click",
    () => {
      showLoginForm();
      setStatus("");
    },
  );
  requireElement<HTMLButtonElement>(
    root,
    "[data-show-signup]",
  ).addEventListener("click", () => {
    showSignupForm();
    setStatus("");
  });

  requireElement<HTMLButtonElement>(
    root,
    "[data-show-recovery]",
  ).addEventListener("click", () => {
    loginForm.hidden = true;
    signupForm.hidden = true;
    modeSwitch.hidden = true;
    recoveryRequestForm.hidden = false;
    setStatus("Gib die E-Mail-Adresse deines Kontos ein.");
  });
  requireElement<HTMLButtonElement>(
    root,
    "[data-cancel-recovery]",
  ).addEventListener("click", () => {
    showLoginForm();
    setStatus("");
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
    status.hidden = false;
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

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = requireElement<HTMLInputElement>(root, "[data-signup-name]");
    const email = requireElement<HTMLInputElement>(root, "[data-signup-email]");
    const password = requireElement<HTMLInputElement>(
      root,
      "[data-signup-password]",
    );
    const submit = requireElement<HTMLButtonElement>(
      root,
      "[data-signup-submit]",
    );
    submit.disabled = true;
    setStatus("Registrierung läuft …", "loading");
    try {
      await signup(email.value.trim(), password.value, {
        full_name: name.value.trim(),
      });
      password.value = "";
      const user = await getUser();
      if (user) {
        await setUser(user);
      } else {
        setStatus(
          "Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse, um dich anzumelden.",
          "ready",
        );
      }
    } catch (error) {
      showError(error, "Die Registrierung ist fehlgeschlagen.");
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
    setStatus("Einladung wird angenommen …", "loading");
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
    setStatus("Wiederherstellungslink wird angefordert …", "loading");
    try {
      await requestPasswordRecovery(email.value.trim());
      setStatus(
        "Falls ein Konto zu dieser Adresse besteht, wird ein Wiederherstellungslink gesendet.",
      );
    } catch (error) {
      showError(
        error,
        "Der Wiederherstellungslink konnte nicht angefordert werden.",
      );
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
    setStatus("Passwort wird aktualisiert …", "loading");
    try {
      await updateUser({ password: password.value });
      password.value = "";
      showLoginForm();
      setStatus("Das Passwort wurde aktualisiert.", "ready");
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

  async function initialize(): Promise<void> {
    try {
      const callback = await handleAuthCallback();
      if (callback?.type === "invite" && callback.token) {
        root.open = true;
        authForms.hidden = false;
        modeSwitch.hidden = true;
        inviteToken = callback.token;
        loginForm.hidden = true;
        signupForm.hidden = true;
        inviteForm.hidden = false;
        setStatus("Lege ein Passwort für dein eingeladenes Konto fest.");
      } else if (callback?.type === "recovery") {
        root.open = true;
        authForms.hidden = false;
        modeSwitch.hidden = true;
        loginForm.hidden = true;
        signupForm.hidden = true;
        recoveryCompleteForm.hidden = false;
        setStatus("Lege ein neues Passwort fest.");
      }

      const user =
        callback?.type === "invite" || callback?.type === "recovery"
          ? null
          : (callback?.user ?? (await getUser()));
      if (user) await setUser(user);
    } catch (error) {
      showError(
        error,
        "Die Kontofunktion ist nicht verfügbar. Netlify Identity muss auf der Site aktiviert sein.",
      );
    }
  }

  void initialize();
}
