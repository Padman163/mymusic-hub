import type {
  NotationEvent,
  NotationRenderOptions,
} from "./notation-renderer.ts";
import { rhythmicPositions } from "./rhythm.ts";

export function layoutNotationEvents(
  notes: readonly NotationEvent[],
  options: {
    noteInset: number;
    repeatEndInset: number;
    aligned: boolean;
    spacing: NonNullable<NotationRenderOptions["spacing"]>;
  },
): { percent: string; fraction: number; offset: number }[] {
  const { noteInset, repeatEndInset, aligned, spacing } = options;
  const rhythmic =
    spacing === "rhythmic" ? rhythmicPositions(notes) : undefined;
  const singleWholeNote =
    notes.length === 1 &&
    notes[0].type !== "rest" &&
    notes[0].duration === "whole";
  const wholeMeasureRest =
    notes.length === 1 &&
    notes[0].type === "rest" &&
    notes[0].duration === "whole" &&
    !notes[0].dotted;
  const centered = wholeMeasureRest || (!aligned && notes.length === 1);
  const start = aligned ? 0 : 1 / (notes.length + 1);

  return notes.map((_, index) => {
    if (singleWholeNote) {
      return { percent: "41%", fraction: 0.41, offset: 0 };
    }
    const fraction = centered
      ? 0.5
      : rhythmic
        ? start + (1 - start) * rhythmic[index]
        : aligned
          ? index / notes.length
          : (index + 1) / (notes.length + 1);
    return {
      percent: `${fraction * 100}%`,
      fraction,
      offset: noteInset * (1 - fraction) - repeatEndInset * fraction,
    };
  });
}
