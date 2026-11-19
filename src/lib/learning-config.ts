export interface LearningShopItem {
  id: string;
  title: string;
  description: string;
  assetUrl?: string;
  priceXp: number;
}

export interface LearningConfiguration {
  shopItems: LearningShopItem[];
}

export const DEFAULT_LEARNING_CONFIGURATION: LearningConfiguration = {
  shopItems: [
    {
      id: "sound-click",
      title: "Click",
      description: "Ein präziser Klick-Sound für Rhythmus- und Tempoübungen.",
      assetUrl: "/sounds/drums/Click.wav",
      priceXp: 10,
    },
    {
      id: "sound-kick",
      title: "Kick",
      description:
        "Ein kräftiger Bassdrum-Sound für Rhythmus- und Produktionsübungen.",
      assetUrl: "/sounds/drums/Kick.wav",
      priceXp: 30,
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLearningConfiguration(
  value: unknown,
): value is LearningConfiguration {
  if (!isRecord(value) || !Array.isArray(value.shopItems)) return false;
  if (value.shopItems.length > 200) return false;

  const ids = new Set<string>();
  return value.shopItems.every((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 100 ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      item.title.length > 120 ||
      typeof item.description !== "string" ||
      item.description.length > 1000 ||
      typeof item.priceXp !== "number" ||
      !Number.isSafeInteger(item.priceXp) ||
      item.priceXp < 0 ||
      (item.assetUrl !== undefined &&
        (typeof item.assetUrl !== "string" ||
          !item.assetUrl.startsWith("/") ||
          item.assetUrl.startsWith("//")))
    ) {
      return false;
    }

    const id = item.id.trim();
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

export async function fetchLearningConfiguration(): Promise<LearningConfiguration> {
  const response = await fetch("/api/modules", { cache: "no-store" });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "Die Lernkonfiguration lieferte keine gültige JSON-Antwort.",
    );
  }
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Die Lernkonfiguration konnte nicht geladen werden.";
    throw new Error(message);
  }
  if (!isRecord(payload) || !isLearningConfiguration(payload.learningConfig)) {
    throw new Error("Die Lernkonfiguration hat ein ungültiges Format.");
  }
  return payload.learningConfig;
}
