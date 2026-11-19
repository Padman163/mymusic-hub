import { afterEach, describe, expect, it, vi } from "vitest";
import { attachInventory, attachShop } from "../../src/lib/inventory-ui";
import {
  clearLearningProgress,
  createInitialProgress,
  getAvailableXp,
  loadLearningProgress,
  saveLearningProgress,
} from "../../src/lib/learning-progress";

describe("Inventar-Shop", () => {
  afterEach(() => {
    document.body.replaceChildren();
    clearLearningProgress();
    vi.unstubAllGlobals();
  });

  it("lädt den Online-Katalog und kauft den Click nach ausreichender Gutschrift", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        learningConfig: {
          shopItems: [
            {
              id: "sound-click",
              title: "Click",
              description: "Test-Click",
              assetUrl: "/sounds/drums/Click.wav",
              priceXp: 10,
            },
            {
              id: "sound-kick",
              title: "Kick",
              description: "Test-Kick",
              assetUrl: "/sounds/drums/Kick.wav",
              priceXp: 30,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const play = vi.fn().mockResolvedValue(undefined);
    const AudioMock = vi.fn(function AudioMock(src: string) {
      return { src, play };
    });
    vi.stubGlobal("Audio", AudioMock);

    const progress = createInitialProgress([]);
    progress.totalXp = 9;
    saveLearningProgress(progress);

    const shop = document.createElement("section");
    const inventory = document.createElement("section");
    document.body.append(shop, inventory);
    attachShop(shop);
    attachInventory(inventory);

    await vi.waitFor(() =>
      expect(shop.querySelectorAll(".learning-shop-item")).toHaveLength(2),
    );
    const preview = shop.querySelector<HTMLButtonElement>(
      ".learning-shop-preview",
    );
    const purchase = shop.querySelector<HTMLButtonElement>(
      ".learning-shop-price",
    );
    expect(preview?.getAttribute("aria-label")).toBe("Click anhören");
    expect(preview?.disabled).toBe(false);
    expect(purchase?.disabled).toBe(true);
    expect(purchase?.getAttribute("aria-label")).toContain("Noch 1 XP fehlen");
    expect(shop.querySelector(".learning-shop-price")?.textContent).toBe("10 XP");
    const items = shop.querySelectorAll(".learning-shop-item");
    expect(items).toHaveLength(2);
    expect(items[1].querySelector(".learning-shop-preview")?.getAttribute("aria-label"))
      .toBe("Kick anhören");
    expect(items[1].querySelector(".learning-shop-price")?.textContent).toBe("30 XP");
    preview?.click();
    expect(AudioMock).toHaveBeenCalledWith("/sounds/drums/Click.wav");
    expect(play).toHaveBeenCalledOnce();

    const funded = loadLearningProgress();
    funded.totalXp = 10;
    saveLearningProgress(funded);
    document.dispatchEvent(new CustomEvent("learning-progress:updated"));

    const enabledPurchase = shop.querySelector<HTMLButtonElement>(
      ".learning-shop-price",
    );
    expect(enabledPurchase?.disabled).toBe(false);
    enabledPurchase?.click();

    const purchased = loadLearningProgress();
    expect(purchased.inventory).toMatchObject([{ id: "sound-click" }]);
    expect(getAvailableXp(purchased)).toBe(0);
    expect(
      shop.querySelector<HTMLButtonElement>(".learning-shop-price")
        ?.getAttribute("aria-label"),
    ).toBe("Click ist bereits im Inventar");
    expect(
      inventory.querySelector('[data-inventory-unlock="sound-click"]'),
    ).not.toBeNull();
  });
});
