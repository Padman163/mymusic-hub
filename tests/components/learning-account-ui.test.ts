import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  getUser: vi.fn(),
  handleAuthCallback: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  onAuthChange: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  signup: vi.fn(),
  updateUser: vi.fn(),
}));
const progressSync = vi.hoisted(() => ({
  attachLearningProgressSync: vi.fn(),
  connectLearningProgress: vi.fn(),
  disconnectLearningProgress: vi.fn(),
}));

vi.mock("@netlify/identity", () => identity);
vi.mock("../../src/lib/learning-progress-sync.ts", () => progressSync);

import { attachLearningAccount } from "../../src/lib/learning-account-ui";

const accountMarkup = `
  <details data-learning-account>
    <summary><span data-account-label>Login / Registrierung</span></summary>
    <section>
      <p data-account-status hidden></p>
      <div data-auth-forms>
        <div class="learning-account-switch">
          <button data-show-login></button>
          <button data-show-signup></button>
        </div>
        <form data-login-form>
          <input data-login-email />
          <input data-login-password />
          <button data-login-submit></button>
        </form>
        <form data-signup-form hidden>
          <input data-signup-name />
          <input data-signup-email />
          <input data-signup-password />
          <button data-signup-submit></button>
        </form>
        <form data-invite-form hidden>
          <input data-invite-password />
          <button data-invite-submit></button>
        </form>
        <form data-recovery-request-form hidden>
          <input data-recovery-email />
          <button data-recovery-submit></button>
          <button data-cancel-recovery></button>
        </form>
        <form data-recovery-complete-form hidden>
          <input data-recovery-password />
          <button data-recovery-complete-submit></button>
        </form>
        <button data-show-recovery></button>
      </div>
      <div data-signed-in hidden><button data-logout>Ausloggen</button></div>
    </section>
  </details>
`;

function getElement<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Test element missing: ${selector}`);
  return element;
}

describe("Lernkonto im Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.handleAuthCallback.mockResolvedValue(null);
    identity.getUser.mockResolvedValue(null);
    identity.onAuthChange.mockReturnValue(vi.fn());
    identity.signup.mockResolvedValue(undefined);
    identity.requestPasswordRecovery.mockResolvedValue(undefined);
    progressSync.connectLearningProgress.mockResolvedValue(undefined);
    document.body.innerHTML = accountMarkup;
    attachLearningAccount(
      getElement<HTMLDetailsElement>(document.body, "[data-learning-account]"),
    );
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("registriert Name und E-Mail und zeigt danach Konto und Abmeldung", async () => {
    const user = {
      id: "learner-1",
      email: "musik@example.com",
      name: "Musik Lernende",
    };
    await vi.waitFor(() =>
      expect(identity.getUser).toHaveBeenCalledOnce(),
    );
    identity.getUser.mockResolvedValue(user);

    getElement<HTMLButtonElement>(document.body, "[data-show-signup]").click();
    getElement<HTMLInputElement>(document.body, "[data-signup-name]").value =
      "Musik Lernende";
    getElement<HTMLInputElement>(document.body, "[data-signup-email]").value =
      "musik@example.com";
    getElement<HTMLInputElement>(
      document.body,
      "[data-signup-password]",
    ).value = "passwort123";
    getElement<HTMLFormElement>(
      document.body,
      "[data-signup-form]",
    ).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(progressSync.connectLearningProgress).toHaveBeenCalledWith(
        "learner-1",
      ),
    );
    expect(identity.signup).toHaveBeenCalledWith(
      "musik@example.com",
      "passwort123",
      { full_name: "Musik Lernende" },
    );
    expect(
      getElement<HTMLElement>(document.body, "[data-account-label]").textContent,
    ).toBe("Angemeldet als Musik Lernende");
    expect(
      getElement<HTMLElement>(document.body, "[data-auth-forms]").hidden,
    ).toBe(true);
    expect(
      getElement<HTMLButtonElement>(document.body, "[data-logout]").textContent,
    ).toBe("Ausloggen");
  });

  it("bietet die Passwort-Wiederherstellung im Login-Menü an", async () => {
    await vi.waitFor(() =>
      expect(identity.getUser).toHaveBeenCalledOnce(),
    );
    getElement<HTMLButtonElement>(
      document.body,
      "[data-show-recovery]",
    ).click();
    getElement<HTMLInputElement>(document.body, "[data-recovery-email]").value =
      "musik@example.com";
    getElement<HTMLFormElement>(
      document.body,
      "[data-recovery-request-form]",
    ).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(identity.requestPasswordRecovery).toHaveBeenCalledWith(
        "musik@example.com",
      ),
    );
  });
});
