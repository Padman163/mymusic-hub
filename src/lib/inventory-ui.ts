import {
  getAvailableXp,
  INVENTORY_SHOP_ITEMS,
  type InventoryShopItem,
  loadLearningProgress,
  purchaseInventoryItem,
  saveLearningProgress,
  type InventoryUnlock,
} from "./learning-progress.ts";
import { renderInventoryItemIcon } from "./inventory-item-icon.ts";

export interface InventoryController {
  refresh(): void;
}

function playInventorySound(
  trigger: HTMLButtonElement,
  title: string,
  assetUrl: string,
): void {
  const audio = new Audio(assetUrl);
  void audio.play().catch(() => {
    trigger.setAttribute("aria-label", `${title} konnte nicht abgespielt werden`);
  });
}

function createUnlockCard(unlock: InventoryUnlock): HTMLElement {
  const item = document.createElement("li");
  item.className = "learning-inventory-item";
  item.dataset.inventoryUnlock = unlock.id;

  const displayTitle = unlock.title;
  const detailsId = `inventory-details-${unlock.id}`;
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "learning-inventory-marker";
  marker.dataset.rarity = "common";
  marker.setAttribute("aria-label", `${displayTitle} anhören`);
  marker.setAttribute("aria-controls", detailsId);
  marker.setAttribute("aria-expanded", "false");
  renderInventoryItemIcon(marker, unlock.id);

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
    if (unlock.assetUrl) {
      playInventorySound(marker, displayTitle, unlock.assetUrl);
      return;
    }
    const isOpen = details.dataset.open === "true";
    details.dataset.open = String(!isOpen);
    details.setAttribute("aria-hidden", String(isOpen));
    marker.setAttribute("aria-expanded", String(!isOpen));
  });

  item.append(marker, details);
  return item;
}

function createShopItem(
  item: InventoryShopItem,
  availableXp: number,
  owned: boolean,
  onPurchase: () => void,
): HTMLElement {
  const container = document.createElement("li");
  container.className = "learning-shop-item";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "learning-inventory-marker learning-shop-preview";
  action.dataset.rarity = "common";
  renderInventoryItemIcon(action, item.id);
  action.setAttribute("aria-label", `${item.title} anhören`);
  action.title = `${item.title} anhören`;
  action.addEventListener("click", () => {
    if (!item.assetUrl) return;
    playInventorySound(action, item.title, item.assetUrl);
  });

  const price = document.createElement("button");
  price.type = "button";
  price.className = "learning-shop-price";
  price.textContent = owned ? "Gekauft" : `${item.priceXp} XP`;
  const purchaseLabel = owned
    ? `${item.title} ist bereits im Inventar`
    : availableXp >= item.priceXp
      ? `${item.title} für ${item.priceXp} XP kaufen`
      : `${item.title} kostet ${item.priceXp} XP. Noch ${item.priceXp - availableXp} XP fehlen.`;
  price.setAttribute("aria-label", purchaseLabel);
  price.title = purchaseLabel;
  price.disabled = owned || availableXp < item.priceXp;
  price.addEventListener("click", onPurchase);

  container.append(action, price);
  return container;
}

export function attachInventory(root: HTMLElement): InventoryController {
  if (root.dataset.inventoryAttached === "true") {
    throw new Error("Inventar wurde bereits initialisiert.");
  }
  root.dataset.inventoryAttached = "true";

  const refresh = () => {
    const state = loadLearningProgress();
    const { inventory } = state;
    const availableXp = getAvailableXp(state);
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
    count.dataset.availableXp = String(availableXp);
    count.textContent = `${availableXp} XP verfügbar`;
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
        "Kaufe Freischaltungen im Shop, damit sie hier erscheinen.";
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

export function attachShop(root: HTMLElement): InventoryController {
  if (root.dataset.shopAttached === "true") {
    throw new Error("Shop wurde bereits initialisiert.");
  }
  root.dataset.shopAttached = "true";

  const refresh = () => {
    const state = loadLearningProgress();
    const { inventory } = state;
    const availableXp = getAvailableXp(state);
    root.replaceChildren();

    const card = document.createElement("div");
    card.className = "learning-card learning-shop-card";
    const header = document.createElement("div");
    header.className = "learning-card-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = "Sounds";
    const balance = document.createElement("span");
    balance.className = "contribution-tag learning-xp-badge";
    balance.textContent = `${availableXp} XP verfügbar`;
    header.append(title, balance);

    const list = document.createElement("ul");
    list.className = "learning-shop-list";
    list.append(
      ...INVENTORY_SHOP_ITEMS.map((item) =>
        createShopItem(
          item,
          availableXp,
          inventory.some((entry) => entry.id === item.id),
          () => {
            const current = loadLearningProgress();
            const purchased = purchaseInventoryItem(current, item.id);
            if (purchased === current) {
              refresh();
              return;
            }
            saveLearningProgress(purchased);
            document.dispatchEvent(
              new CustomEvent("learning-progress:updated", {
                bubbles: true,
                detail: { state: purchased },
              }),
            );
          },
        ),
      ),
    );
    card.append(header, list);
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
