import type { NotationEvent } from "./notation-renderer.ts";

export function layoutNotationEvents(
  notes: readonly NotationEvent[],
  options: {
    noteInset: number;
    endInset: number;
    rhythmicPositions?: readonly number[];
  },
): { percent: string; fraction: number; offset: number }[] {
  const { noteInset, endInset, rhythmicPositions } = options;
  const wholeMeasureRest =
    notes.length === 1 &&
    notes[0].type === "rest" &&
    notes[0].duration === "whole" &&
    !notes[0].dotted;
  return notes.map((_, index) => {
    const fraction = wholeMeasureRest
      ? 0.5
      : notes.length === 1
        ? 0
        : rhythmicPositions
          ? rhythmicPositions[index]
          : index / (notes.length - 1);
    return {
      percent: `${fraction * 100}%`,
      fraction,
      offset: noteInset * (1 - fraction) - endInset * fraction,
    };
  });
}
