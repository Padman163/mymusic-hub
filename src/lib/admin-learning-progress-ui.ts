import { onAuthChange } from "@netlify/identity";
import type { ModuleProgress } from "./learning-progress";

type Account = { id: string; name?: string; email?: string };
type Course = Pick<ModuleProgress, "status" | "steps" | "completedVia"> & {
  id: string;
  title: string;
  archived?: boolean;
  solved: number;
  resettable: boolean;
};
type AccountDetail = { user: Account; writable: boolean } & (
  | { progress: null }
  | {
      version: string;
      progress: {
        totalXp: number;
        spentXp: number;
        availableXp: number;
        inventory: { id: string; title: string; unlockedAt: string }[];
        modules: Course[];
      };
    }
);
const endpoint = "/api/admin/learning-progress";
const statuses = {
  locked: "Gesperrt",
  unlocked: "Freigeschaltet",
  completed: "Abgeschlossen",
};
const steps = {
  theory: "Theorie",
  leicht: "Aufgaben",
  practice: "Praxis",
  mittel: "Quiz",
} as const;

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  value: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
}

function accountLabel(user: Account) {
  return [user.name, user.email].filter(Boolean).join(" · ") || user.id;
}

class AdminLearningProgressPanel extends HTMLElement {
  #lifecycle?: AbortController;
  #pending?: AbortController;
  #unsubscribe?: () => void;
  #page = 0;
  #id?: string;
  #reset?: { moduleId: string; version: string };
  #trigger?: HTMLButtonElement;

  #el<T extends HTMLElement = HTMLElement>(key: string) {
    const element = this.querySelector<T>(`[data-${key}]`);
    if (!element) throw new Error(`Lernstand-Element fehlt: ${key}`);
    return element;
  }

  connectedCallback() {
    const { signal } = (this.#lifecycle = new AbortController());
    this.#el("load").addEventListener("click", () => void this.#list(1), {
      signal,
    });
    this.#el("more").addEventListener(
      "click",
      () => void this.#list(this.#page + 1),
      { signal },
    );
    this.#el("refresh").addEventListener(
      "click",
      () => {
        if (this.#id) void this.#detail(this.#id, false);
      },
      { signal },
    );
    this.#el("cancel").addEventListener("click", () => this.#closeReset(true), {
      signal,
    });
    this.#el<HTMLFormElement>("reset").addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        const form = this.#el<HTMLFormElement>("reset");
        if (this.#id && this.#reset) {
          void this.#submit(
            this.#id,
            this.#reset,
            new FormData(form).get("confirmation"),
          );
        }
      },
      { signal },
    );
    this.#unsubscribe = onAuthChange(() => {
      this.#pending?.abort();
      this.#clear();
      this.#el("load").textContent = "Nutzerliste laden";
      this.#el("status").textContent = "";
    });
  }

  disconnectedCallback() {
    this.#lifecycle?.abort();
    this.#pending?.abort();
    this.#unsubscribe?.();
    this.#clear();
  }

  #clear() {
    this.#page = 0;
    this.#el("more").hidden = true;
    this.#el("users").replaceChildren();
    this.#clearDetail();
  }

  #clearDetail() {
    this.#id = undefined;
    this.#el("detail").hidden = true;
    this.#el("account").textContent = "";
    this.#el("progress").replaceChildren();
    this.#closeReset();
  }

  #closeReset(focus = false) {
    this.#reset = undefined;
    const form = this.#el<HTMLFormElement>("reset");
    form.reset();
    form.hidden = true;
    if (focus) this.#trigger?.focus();
    this.#trigger = undefined;
  }

  async #request<T>(
    query: URLSearchParams,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${endpoint}?${query}`, {
      cache: "no-store",
      signal,
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(
        "Die Lernstand-API ist nicht erreichbar. Lokal ist Netlify Dev erforderlich.",
      );
    }
    if (!response.ok) {
      const payload: { error?: string } = await response.json();
      throw new Error(
        payload.error ??
          `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`,
      );
    }
    return response.json();
  }

  async #run(message: string, work: (signal: AbortSignal) => Promise<void>) {
    this.#pending?.abort();
    const pending = new AbortController();
    this.#pending = pending;
    const status = this.#el("status");
    status.textContent = message;
    const setBusy = (busy: boolean) => {
      for (const control of this.querySelectorAll<
        HTMLButtonElement | HTMLInputElement
      >("button, input")) {
        control.disabled = busy;
      }
    };
    setBusy(true);
    try {
      await work(pending.signal);
    } catch (error) {
      if (!pending.signal.aborted) {
        status.textContent =
          error instanceof Error
            ? error.message
            : "Die Anfrage ist fehlgeschlagen.";
      }
    } finally {
      if (this.#pending === pending) setBusy(false);
    }
  }

  async #list(page: number) {
    if (page === 1) this.#clear();
    await this.#run("Nutzerkonten werden geladen …", async (signal) => {
      const { users, hasMore } = await this.#request<{
        users: Account[];
        hasMore: boolean;
      }>(new URLSearchParams({ page: String(page) }), signal);
      signal.throwIfAborted();
      const list = this.#el("users");
      for (const user of users) {
        const row = node("li", "");
        const button = node("button", accountLabel(user));
        button.type = "button";
        button.addEventListener(
          "click",
          () => void this.#detail(user.id, true),
        );
        row.append(button);
        list.append(row);
      }
      this.#page = page;
      this.#el("load").textContent = "Nutzerliste aktualisieren";
      this.#el("more").hidden = !hasMore;
      this.#el("status").textContent = list.childElementCount
        ? `${list.childElementCount} Konten werden angezeigt. Wähle ein Konto aus.`
        : "Keine Nutzerkonten vorhanden.";
    });
  }

  async #detail(id: string, focus: boolean) {
    if (focus) this.#clearDetail();
    else {
      this.#closeReset();
      this.#el("progress").replaceChildren();
    }
    await this.#run("Lernstand wird geladen …", async (signal) => {
      await this.#loadDetail(id, signal);
      if (focus) this.#el("account").focus();
      this.#el("status").textContent = "Lernstand geladen.";
    });
  }

  async #loadDetail(id: string, signal: AbortSignal) {
    const detail = await this.#request<AccountDetail>(
      new URLSearchParams({ id }),
      signal,
    );
    signal.throwIfAborted();
    this.#id = id;
    this.#el("detail").hidden = false;
    this.#el("account").textContent = accountLabel(detail.user);
    const container = this.#el("progress");
    container.replaceChildren();
    if (detail.progress === null) {
      container.append(
        node(
          "p",
          "Für dieses Konto ist noch kein Online-Lernstand gespeichert.",
        ),
      );
      return;
    }
    const progress = detail.progress;
    container.append(
      node(
        "p",
        `${progress.totalXp} XP gesamt · ${progress.availableXp} XP verfügbar · ${progress.spentXp} XP ausgegeben`,
      ),
    );
    if (!detail.writable)
      container.append(
        node(
          "p",
          "Nur Ansicht. Lehrgänge können auf der Produktionsseite und in Deploy Previews zurückgesetzt werden.",
        ),
      );
    container.append(node("h3", "Gekaufte Items & Inventar"));
    const inventory = node("ul", "");
    for (const { title, unlockedAt } of progress.inventory) {
      inventory.append(
        node(
          "li",
          `${title} · ${new Date(unlockedAt).toLocaleDateString("de-DE")}`,
        ),
      );
    }
    container.append(
      inventory.childElementCount
        ? inventory
        : node("p", "Keine Items im Inventar."),
    );
    container.append(node("h3", "Lehrgänge"));
    for (const course of progress.modules) {
      const row = node("details", "");
      row.append(
        node(
          "summary",
          `${course.title} · ${statuses[course.status]}${course.archived ? " · Archiviert" : ""}`,
        ),
      );
      const info = Object.entries(steps).map(
        ([key, title]) =>
          `${title}: ${statuses[course.steps[key as keyof typeof steps]]}`,
      );
      row.append(
        node("p", `${info.join(" · ")} · Gelöste Aufgaben: ${course.solved}`),
      );
      if (course.completedVia === "fastlane")
        row.append(node("p", "Über Fastlane abgeschlossen."));
      if (detail.writable && course.resettable) {
        const button = node("button", "Lehrgang zurücksetzen");
        button.type = "button";
        button.addEventListener("click", () => {
          this.#closeReset();
          this.#trigger = button;
          this.#reset = { moduleId: course.id, version: detail.version };
          this.#el("target").textContent =
            `„${course.title}“ für ${accountLabel(detail.user)} zurücksetzen?`;
          const form = this.#el<HTMLFormElement>("reset");
          form.hidden = false;
          form.querySelector("input")?.focus();
        });
        row.append(button);
      }
      container.append(row);
    }
    if (!progress.modules.length)
      container.append(node("p", "Keine Lehrgänge vorhanden."));
  }

  async #submit(
    id: string,
    reset: { moduleId: string; version: string },
    confirmation: FormDataEntryValue | null,
  ) {
    this.#closeReset();
    this.#el("progress").replaceChildren();
    await this.#run("Lehrgang wird zurückgesetzt …", async (signal) => {
      await this.#request(new URLSearchParams({ id }), signal, {
        ...reset,
        confirmation,
      });
      signal.throwIfAborted();
      try {
        await this.#loadDetail(id, signal);
        this.#el("status").textContent =
          "Lehrgang zurückgesetzt. XP und Inventar wurden nicht geändert.";
      } catch {
        signal.throwIfAborted();
        this.#el("status").textContent =
          "Lehrgang zurückgesetzt. Die Ansicht konnte nicht aktualisiert werden.";
      }
      this.#el("refresh").focus();
    });
  }
}

if (!customElements.get("admin-learning-progress")) {
  customElements.define("admin-learning-progress", AdminLearningProgressPanel);
}
