import {
  loadLearningProgress,
  type InventoryUnlock,
} from "./learning-progress.ts";

export interface InventoryController {
  refresh(): void;
}

function createUnlockCard(unlock: InventoryUnlock): HTMLElement {
  const item = document.createElement("li");
  item.className = "learning-inventory-item";
  item.dataset.inventoryUnlock = unlock.id;

  const displayTitle =
    unlock.id === "sound-click" ? "Click" : unlock.title;
  const detailsId = `inventory-details-${unlock.id}`;
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "learning-inventory-marker";
  marker.dataset.rarity = "common";
  marker.setAttribute("aria-label", `Details zu ${displayTitle}`);
  marker.setAttribute("aria-controls", detailsId);
  marker.setAttribute("aria-expanded", "false");
  marker.textContent = unlock.assetUrl ? "●" : "◆";

  const details = document.createElement("div");
  details.id = detailsId;
  details.className = "learning-inventory-item-details";
  details.dataset.open = "false";
  details.setAttribute("aria-hidden", "true");
  const title = document.createElement("h3");
  title.className = "learning-inventory-item-title";
  title.textContent = displayTitle;
  const description = document.createElement("p");
  description.className = "learning-inventory-item-description";
  description.textContent = unlock.description;
  details.append(title, description);

  marker.addEventListener("click", () => {
    const isOpen = details.dataset.open === "true";
    details.dataset.open = String(!isOpen);
    details.setAttribute("aria-hidden", String(isOpen));
    marker.setAttribute("aria-expanded", String(!isOpen));
  });

  item.append(marker, details);
  return item;
}

export function attachInventory(root: HTMLElement): InventoryController {
  if (root.dataset.inventoryAttached === "true") {
    throw new Error("Inventar wurde bereits initialisiert.");
  }
  root.dataset.inventoryAttached = "true";

  const refresh = () => {
    const { inventory } = loadLearningProgress();
    root.replaceChildren();

    const card = document.createElement("div");
    card.className = "learning-card learning-inventory-card";

    const header = document.createElement("div");
    header.className = "learning-card-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = "Dein Inventar";
    const count = document.createElement("span");
    count.className = "contribution-tag learning-xp-badge";
    count.dataset.inventoryCount = String(inventory.length);
    count.textContent = `${inventory.length} Freischaltungen`;
    header.append(title, count);

    card.append(header);

    if (inventory.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "learning-inventory-empty";
      const symbol = document.createElement("span");
      symbol.className = "learning-inventory-empty-symbol";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "◇";
      const heading = document.createElement("h3");
      heading.textContent = "Dein Inventar ist noch leer";
      const text = document.createElement("p");
      text.textContent =
        "Freischaltungen aus deinem Lernfortschritt werden hier gesammelt.";
      emptyState.append(symbol, heading, text);
      card.append(emptyState);
    } else {
      const list = document.createElement("ul");
      list.className = "learning-inventory-list";
      list.append(...inventory.map(createUnlockCard));
      card.append(list);
    }

    root.append(card);
  };

  const onProgressUpdated = () => {
    if (!root.isConnected) {
      document.removeEventListener(
        "learning-progress:updated",
        onProgressUpdated,
      );
      return;
    }
    refresh();
  };

  document.addEventListener("learning-progress:updated", onProgressUpdated);
  refresh();
  return { refresh };
}
