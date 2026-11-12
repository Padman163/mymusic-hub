import {
  assertNoClefChanges,
  minimumFirstNoteX,
  type NotationAccidental,
  type NotationClef,
  type NotationRenderOptions,
} from "./notation-renderer.ts";

export function arrangeNotationSystems<
  T extends { clef?: NotationClef | false; accidentals?: NotationAccidental[] },
>(
  measures: readonly T[],
  measuresPerSystem: number | readonly number[],
): (Omit<T, "clef" | "accidentals"> & {
  clef: NotationClef | false;
  accidentals?: NotationAccidental[];
  firstNoteX: number;
})[][] {
  const counts =
    typeof measuresPerSystem === "number"
      ? [measuresPerSystem]
      : measuresPerSystem;
  if (
    counts.length === 0 ||
    counts.some((count) => !Number.isSafeInteger(count) || count < 1)
  ) {
    throw new Error("Ein Notensystem muss mindestens einen Takt enthalten.");
  }
  if (
    typeof measuresPerSystem !== "number" &&
    counts.reduce((sum, count) => sum + count, 0) !== measures.length
  ) {
    throw new Error(
      "Die Taktzahlen der Systeme müssen zusammen alle Takte umfassen.",
    );
  }

  if (measures.length === 0) return [];
  assertNoClefChanges(
    measures.map(({ clef }) => clef),
    "Notensystem",
  );
  const clef = measures[0].clef;
  if (!clef)
    throw new Error(
      "Für den Zeilenumbruch wird ein Anfangsschlüssel benötigt.",
    );

  const systems: (Omit<T, "clef" | "accidentals"> & {
    clef: NotationClef | false;
    accidentals?: NotationAccidental[];
  })[][] = [];
  let active: NotationAccidental[] = [];
  let index = 0;
  let systemIndex = 0;
  while (index < measures.length) {
    const count =
      typeof measuresPerSystem === "number"
        ? measuresPerSystem
        : counts[systemIndex];
    systems.push(
      measures.slice(index, index + count).map((measure, offset) => {
        const next = measure.accidentals;
        if (next?.some((sign) => sign.type === "natural")) {
          throw new Error(
            "Eine Tonartvorzeichnung darf nur Kreuze oder b-Vorzeichen enthalten.",
          );
        }
        const changed =
          next !== undefined &&
          (next.length !== active.length ||
            next.some(
              (sign, i) =>
                sign.type !== active[i]?.type || sign.step !== active[i]?.step,
            ));
        const cancellations: NotationAccidental[] = changed
          ? active
              .filter(
                (old) =>
                  !next.some(
                    (sign) =>
                      sign.type === old.type &&
                      (sign.step - old.step) % 7 === 0,
                  ),
              )
              .map(({ step }) => ({ type: "natural", step }))
          : [];
        if (changed) active = next;
        const accidentals = changed
          ? [...cancellations, ...active]
          : offset === 0
            ? active
            : undefined;
        return { ...measure, clef: offset === 0 ? clef : false, accidentals };
      }),
    );
    index += count;
    systemIndex += 1;
  }
  return alignFirstNotesInSystems(systems);
}

export function alignFirstNotesInSystems<
  T extends Omit<NotationRenderOptions, "clef"> & {
    clef: NotationClef | false;
  },
>(systems: readonly (readonly T[])[]): (T & { firstNoteX: number })[][] {
  const columns: number[] = [];
  for (const system of systems) {
    system.forEach((measure, index) => {
      const minimum = minimumFirstNoteX({
        ...measure,
        clef: measure.clef || undefined,
      });
      columns[index] = Math.max(columns[index] ?? 0, minimum);
    });
  }
  const followingMeasureStart = Math.max(0, ...columns.slice(1));
  return systems.map((system) =>
    system.map((measure, index) => ({
      ...measure,
      firstNoteX: index === 0 ? columns[0] : followingMeasureStart,
    })),
  );
}
