import type { NotationEvent } from "./notation-renderer.ts";
import { rhythmicPositions } from "./rhythm.ts";

export function layoutNotationEvents(
  notes: readonly NotationEvent[],
  options: {
    noteInset: number;
    endInset: number;
  },
): { percent: string; fraction: number; offset: number }[] {
  const { noteInset, endInset } = options;
  const rhythmic = rhythmicPositions(notes);
  const wholeMeasureRest =
    notes.length === 1 &&
    notes[0].type === "rest" &&
    notes[0].duration === "whole" &&
    !notes[0].dotted;
  const lastRhythmicPosition = rhythmic?.[notes.length - 1];

  return notes.map((_, index) => {
    const fraction = wholeMeasureRest
      ? 0.5
      : notes.length === 1
        ? 0
        : rhythmic && lastRhythmicPosition
          ? rhythmic[index] / lastRhythmicPosition
          : index / (notes.length - 1);
    return {
      percent: `${fraction * 100}%`,
      fraction,
      offset: noteInset * (1 - fraction) - endInset * fraction,
    };
  });
}
