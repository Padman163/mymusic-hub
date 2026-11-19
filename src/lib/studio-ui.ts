import {
  equipInventoryItem,
  getEquippedInventoryItem,
  loadLearningProgress,
  saveLearningProgress,
  unequipInventoryItem,
  type InventoryUnlock,
} from "./learning-progress.ts";
import { renderInventoryItemIcon } from "./inventory-item-icon.ts";

export interface StudioController {
  refresh(): void;
}

function dispatchProgressUpdate(state: ReturnType<typeof loadLearningProgress>): void {
  saveLearningProgress(state);
  document.dispatchEvent(
    new CustomEvent("learning-progress:updated", {
      bubbles: true,
      detail: { state },
    }),
  );
}

function previewSound(item: InventoryUnlock): void {
  if (!item.assetUrl) return;
  const audio = new Audio(item.assetUrl);
  void audio.play().catch((error) => {
    console.warn(`[Studio] ${item.title} konnte nicht abgespielt werden.`, error);
  });
}

export function attachStudio(root: HTMLElement): StudioController {
  if (root.dataset.studioAttached === "true") {
    throw new Error("Studio wurde bereits initialisiert.");
  }
  root.dataset.studioAttached = "true";

  const refresh = () => {
    const state = loadLearningProgress();
    const equipped = getEquippedInventoryItem(state);
    const sounds = state.inventory.filter(
      (item) =>
        item.assetUrl !== undefined &&
        item.id !== equipped?.id,
    );
    root.replaceChildren();

    const card = document.createElement("div");
    card.className = "learning-card learning-studio-card";
    const header = document.createElement("div");
    header.className = "learning-card-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = "Studio";
    header.append(title);

    const overview = document.createElement("div");
    overview.className = "learning-studio-overview";
    const metronome = document.createElement("div");
    metronome.className = "learning-studio-metronome";
    const metronomeFace = document.createElement("span");
    metronomeFace.className = "learning-studio-metronome-face";
    const metronomePendulum = document.createElement("span");
    metronomePendulum.className = "learning-studio-metronome-pendulum";
    const metronomeWeight = document.createElement("span");
    metronomeWeight.className = "learning-studio-metronome-weight";
    metronomePendulum.append(metronomeWeight);
    metronome.append(metronomeFace, metronomePendulum);

    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "learning-studio-sound-slot learning-inventory-marker";
    slot.dataset.rarity = "common";
    slot.dataset.filled = String(equipped !== undefined);
    if (equipped) {
      renderInventoryItemIcon(slot, equipped.id);
    } else {
      slot.textContent = "+";
    }
    slot.setAttribute(
      "aria-label",
      equipped ? `${equipped.title} anhören` : "Sound in das Metronom ziehen",
    );
    slot.addEventListener("click", () => {
      if (equipped) previewSound(equipped);
    });
    if (equipped) {
      slot.draggable = true;
      slot.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("application/x-studio-equipped", equipped.id);
      });
    }
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      const itemId = event.dataTransfer?.getData("text/plain");
      if (!itemId) return;
      const current = loadLearningProgress();
      const next = equipInventoryItem(current, itemId);
      if (next !== current) dispatchProgressUpdate(next);
    });

    metronome.append(slot);
    overview.append(metronome);

    const soundsTitle = document.createElement("h3");
    soundsTitle.textContent = "Verfügbare Sounds";
    const list = document.createElement("ul");
    list.className = "learning-inventory-list learning-studio-sounds";
    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      list.classList.add("is-drop-target");
    });
    list.addEventListener("dragleave", () => {
      list.classList.remove("is-drop-target");
    });
    list.addEventListener("drop", (event) => {
      event.preventDefault();
      list.classList.remove("is-drop-target");
      const equippedId =
        event.dataTransfer?.getData("application/x-studio-equipped");
      if (!equippedId) return;
      dispatchProgressUpdate(unequipInventoryItem(loadLearningProgress()));
    });
    for (const item of sounds) {
      const row = document.createElement("li");
      row.className = "learning-studio-sound";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "learning-inventory-marker";
      button.dataset.rarity = "common";
      button.draggable = true;
      renderInventoryItemIcon(button, item.id);
      button.setAttribute("aria-label", `${item.title} ausrüsten`);
      button.setAttribute(
        "aria-pressed",
        String(equipped?.id === item.id),
      );
      button.addEventListener("click", () => {
        const current = loadLearningProgress();
        const next = equipInventoryItem(current, item.id);
        if (next !== current) dispatchProgressUpdate(next);
      });
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", item.id);
      });
      const name = document.createElement("span");
      name.textContent = item.title;
      row.append(button, name);
      list.append(row);
    }

    card.append(header, overview, soundsTitle, list);
    root.append(card);
  };

  const onProgressUpdated = () => {
    if (!root.isConnected) {
      document.removeEventListener("learning-progress:updated", onProgressUpdated);
      return;
    }
    refresh();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);
  refresh();
  return { refresh };
}
