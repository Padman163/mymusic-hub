export interface TagDefinition {
  description: string;
  multiplier: number;
}

export const TAG_DEFINITIONS: Record<string, TagDefinition> = {
  Allgemein: {
    description: "Grundlagen und allgemeine Musiktheorie",
    multiplier: 1.0,
  },
  Notensystem: {
    description: "Lesen und Platzieren im Notensystem",
    multiplier: 1.5,
  },
  Tonsystem: {
    description: "Töne, Tonhöhen, Oktaven und Tonschritte",
    multiplier: 1.1,
  },
  Vortragslehre: {
    description: "Tempo, Dynamik, Artikulation und musikalischer Ausdruck",
    multiplier: 1.1,
  },
  Harmonielehre: {
    description: "Akkorde, harmonische Funktionen und Akkordfolgen",
    multiplier: 1.2,
  },
  Violinschlüssel: {
    description: "Notation im Violinschlüssel (G-Schlüssel)",
    multiplier: 1.0,
  },
  Bassschlüssel: {
    description: "Notation im Bassschlüssel (F-Schlüssel)",
    multiplier: 1.1,
  },
  Tabulatur: {
    description: "Saiten- und Bund-Notation in Tabulatur",
    multiplier: 1.0,
  },
  Gitarre: {
    description: "Gitarrenspezifische Griffbrett- und Spielpraxis",
    multiplier: 1.2,
  },
  Rhythmus: {
    description: "Taktarten, Notenwerte und Zählzeiten",
    multiplier: 1.2,
  },
};

export const BASE_XP_DEFAULTS = {
  theoryBlock: 30,
  practice: 20,
  leicht: 10,
  mittel: 15,
  schwer: 25,
} as const;

export type MultiTagStrategy = "highest" | "average";

export const MULTI_TAG_STRATEGY: MultiTagStrategy = "highest";

/** Gibt alle verfügbaren Tag-Namen aus der zentralen Konfiguration zurück. */
export function getAvailableTags(): string[] {
  return Object.keys(TAG_DEFINITIONS);
}

/** Ermittelt den XP-Multiplikator für einen Tag (Fallback: 1.0). */
export function getTagMultiplier(tag: string): number {
  if (!Object.hasOwn(TAG_DEFINITIONS, tag)) {
    return 1.0;
  }
  return TAG_DEFINITIONS[tag].multiplier;
}

/** Berechnet die effektiven XP einer Aufgabe anhand von Basis-XP und Tag-Multiplikatoren. */
export function calculateQuestionXp(
  baseXp: number,
  tags: readonly string[],
  strategy: MultiTagStrategy = MULTI_TAG_STRATEGY,
): number {
  if (!Number.isFinite(baseXp) || baseXp <= 0) {
    return 0;
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    return Math.round(baseXp);
  }

  const multipliers = tags.map((tag) => getTagMultiplier(tag));
  const effectiveMultiplier =
    strategy === "average"
      ? multipliers.reduce((sum, value) => sum + value, 0) / multipliers.length
      : Math.max(...multipliers);

  return Math.round(baseXp * effectiveMultiplier);
}

export function calculateTheoryBlockXp(
  block: { baseXp?: number; tags?: readonly string[] },
  defaultBaseXp: number,
): number {
  return calculateQuestionXp(block.baseXp ?? defaultBaseXp, block.tags ?? []);
}
