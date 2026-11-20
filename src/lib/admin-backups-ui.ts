import { onAuthChange } from "@netlify/identity";
import type {
  BackupOverview,
  BackupSummary,
  RestorePreview,
} from "../../netlify/functions/lib/admin-backups";

const endpoint = "/api/admin/backups";
const date = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "medium",
});

function url(params: Record<string, string>) {
  return `${endpoint}?${new URLSearchParams(params)}`;
}

function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  value: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

class AdminBackupPanel extends HTMLElement {
  #lifecycle?: AbortController;
  #pending?: AbortController;
  #unsubscribe?: () => void;
  #overview?: BackupOverview;
  #preview?: RestorePreview;
  #previewTrigger?: HTMLButtonElement;

  #element<T extends HTMLElement = HTMLElement>(key: string) {
    const element = this.querySelector<T>(`[data-${key}]`);
    if (!element) throw new Error(`Backup-Element fehlt: ${key}`);
    return element;
  }

  connectedCallback() {
    if (this.#lifecycle) return;
    const { signal } = (this.#lifecycle = new AbortController());
    this.#element("refresh").addEventListener("click", this.#refresh, { signal });
    this.#element("more").addEventListener("click", () => {
      if (this.#overview?.next) void this.#load(this.#overview.next);
    }, { signal });
    this.#element("cancel").addEventListener("click", () => this.#closePreview(true), { signal });
    this.#element<HTMLFormElement>("create").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = this.#element<HTMLFormElement>("create");
      void this.#write({ action: "create", note: new FormData(form).get("note") }, form);
    }, { signal });
    this.#element<HTMLFormElement>("restore").addEventListener("submit", (event) => {
      event.preventDefault();
      const preview = this.#preview;
      if (!preview) return;
      const form = this.#element<HTMLFormElement>("restore");
      void this.#write({
        action: "restore",
        id: preview.backup.id,
        revision: preview.revision,
        confirmation: new FormData(form).get("confirmation"),
      }, form);
    }, { signal });
    this.#unsubscribe = onAuthChange(() => {
      this.#pending?.abort();
      this.#overview = undefined;
      this.#element("content").hidden = true;
      this.#element("backups").replaceChildren();
      this.#refresh();
    });
    this.#refresh();
  }

  disconnectedCallback() {
    this.#lifecycle?.abort();
    this.#lifecycle = undefined;
    this.#pending?.abort();
    this.#unsubscribe?.();
  }

  async #request<T>(path: string, signal: AbortSignal, body?: unknown): Promise<T> {
    const response = await fetch(path, {
      cache: "no-store",
      signal,
      ...(body === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Die Backup-API ist nicht erreichbar. Lokal ist Netlify Dev erforderlich.");
    }
    if (!response.ok) {
      const payload: { error?: string } = await response.json();
      throw new Error(payload.error ?? `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`);
    }
    return response.json();
  }

  async #run(message: string, work: (signal: AbortSignal) => Promise<void>) {
    this.#pending?.abort();
    const pending = new AbortController();
    this.#pending = pending;
    const status = this.#element("status");
    const setBusy = (busy: boolean) => {
      for (const control of this.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
        control.disabled = busy;
      }
    };
    status.textContent = message;
    setBusy(true);
    try {
      await work(pending.signal);
    } catch (error) {
      if (pending.signal.aborted) return;
      this.#closePreview();
      status.textContent = error instanceof Error ? error.message : "Die Anfrage ist fehlgeschlagen.";
    } finally {
      if (this.#pending === pending) setBusy(false);
    }
  }

  #refresh = () => {
    this.#closePreview();
    void this.#load(null);
  };

  async #load(before: string | null) {
    await this.#run("Online-Daten werden geladen …", async (signal) => {
      const overview = await this.#request<BackupOverview>(before ? url({ before }) : endpoint, signal);
      signal.throwIfAborted();
      this.#render(overview, before !== null);
      this.#element("status").textContent = "Online-Übersicht geladen.";
    });
  }

  #render(overview: BackupOverview, append = false) {
    this.#overview = overview;
    const ready = overview.contributions !== null && overview.modules !== null;
    this.#element("content").hidden = false;
    this.#element("site").textContent = `${overview.site} · Abgerufen am ${date.format(new Date(overview.checkedAt))}`;
    this.#element("readonly").hidden = overview.writable;
    this.#element("uninitialized").hidden = ready;
    this.#element("create").hidden = !overview.writable || !ready;

    for (const [key, label] of [["contributions", "Beiträge"], ["modules", "Lehrgänge"]] as const) {
      const entries = overview[key];
      this.#element(`${key}-count`).textContent =
        `${label}: ${entries === null ? "noch nicht initialisiert" : entries.length}`;
      this.#element(`${key}-list`).replaceChildren(
        ...(entries?.length ? entries.map(({ title }) => text("li", title)) : [text("li", "Keine Einträge.")]),
      );
    }
    const list = this.#element("backups");
    if (!append) list.replaceChildren();
    if (!append && !overview.backups.length) list.append(text("li", "Noch keine Online-Backups vorhanden."));
    for (const backup of overview.backups) {
      const entry = text("li", "");
      entry.append(text("strong", date.format(new Date(backup.createdAt))));
      entry.append(` · ${backup.contributions} Beiträge, ${backup.modules} Lehrgänge`);
      if (backup.kind === "safety") entry.append(" · Sicherheitsbackup");
      if (backup.note) entry.append(text("p", backup.note));
      if (overview.writable) {
        const download = text("a", "JSON herunterladen");
        download.href = url({ action: "download", id: backup.id });
        entry.append(" ", download);
        if (ready) {
          const button = text("button", "Restore-Vorschau");
          button.type = "button";
          button.addEventListener("click", () => void this.#openPreview(backup.id, button));
          entry.append(" ", button);
        }
      }
      list.append(entry);
    }
    this.#element("more").hidden = overview.next === null;
  }

  #closePreview(focus = false) {
    this.#preview = undefined;
    this.#element("preview").hidden = true;
    this.#element<HTMLFormElement>("restore").reset();
    if (focus) this.#previewTrigger?.focus();
    this.#previewTrigger = undefined;
  }

  async #openPreview(id: string, trigger: HTMLButtonElement) {
    this.#closePreview();
    await this.#run("Restore-Vorschau wird geladen …", async (signal) => {
      const preview = await this.#request<RestorePreview>(url({ action: "preview", id }), signal);
      signal.throwIfAborted();
      this.#preview = preview;
      this.#previewTrigger = trigger;
      this.#element("restore-target").textContent = `Backup vom ${date.format(new Date(preview.backup.createdAt))}`;
      const container = this.#element("diff");
      container.replaceChildren();
      for (const [key, label] of [["contributions", "Beiträge"], ["modules", "Lehrgänge"]] as const) {
        container.append(text("h3", label));
        for (const [change, title] of [
          ["added", "Kommen zurück"],
          ["replaced", "Werden ersetzt"],
          ["removed", "Fehlen danach"],
        ] as const) {
          const titles = preview[key][change];
          const details = document.createElement("details");
          details.append(text("summary", `${title}: ${titles.length}`));
          if (titles.length) {
            const list = document.createElement("ul");
            list.append(...titles.map((item) => text("li", item)));
            details.append(list);
          }
          container.append(details);
        }
      }
      if (preview.settingsChanged.length) {
        container.append(text("p", `Ändern sich ebenfalls: ${preview.settingsChanged.join(", ")}.`));
      }
      this.#element("preview").hidden = false;
      this.querySelector<HTMLElement>("#restore-heading")?.focus();
      this.#element("status").textContent = "Restore-Vorschau geladen.";
    });
  }

  async #write(body: { action: "create" | "restore" } & Record<string, unknown>, form: HTMLFormElement) {
    const restoring = body.action === "restore";
    await this.#run(restoring ? "Online-Stand wird wiederhergestellt …" : "Backup wird gespeichert …", async (signal) => {
      const result = await this.#request<{ safety?: BackupSummary }>(endpoint, signal, body);
      signal.throwIfAborted();
      form.reset();
      this.#closePreview();
      const message = restoring
        ? `Online-Stand wiederhergestellt. Sicherheitsbackup: ${result.safety?.id}.`
        : "Backup gespeichert.";
      try {
        const overview = await this.#request<BackupOverview>(endpoint, signal);
        signal.throwIfAborted();
        this.#render(overview);
        this.#element("status").textContent = message;
      } catch {
        signal.throwIfAborted();
        this.#element("status").textContent = `${message} Die Übersicht konnte nicht aktualisiert werden.`;
      }
    });
  }
}

if (!customElements.get("admin-backups")) {
  customElements.define("admin-backups", AdminBackupPanel);
}
