import { type TimeSignature, validateTimeSignature } from "./time-signature.ts";

export type Duration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type BeamDuration = "eighth" | "sixteenth";
export interface RhythmEvent {
  duration?: Duration;
  beamGroup?: string;
  dotted?: boolean;
}
export interface BeamGroup {
  indices: number[];
  duration: BeamDuration;
}

export const durationLabels: Record<Duration, string> = {
  whole: "Ganze Note",
  half: "Halbe Note",
  quarter: "Viertelnote",
  eighth: "Achtelnote",
  sixteenth: "Sechzehntelnote",
};

const durationUnits: Record<Duration, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  sixteenth: 1,
};

export function timeSignatureDurationUnits(
  timeSignature: TimeSignature,
): number {
  validateTimeSignature(timeSignature);
  return (16 * timeSignature.numerator) / timeSignature.denominator;
}

export function measureDurationUnits(
  events: readonly RhythmEvent[],
): number | undefined {
  if (
    events.length === 0 ||
    events.some((event) => event.duration === undefined)
  ) {
    return undefined;
  }
  return events.reduce((sum, event) => {
    const units =
      event.duration === undefined ? undefined : durationUnits[event.duration];
    if (units === undefined) {
      throw new Error(`Ungültiger Noten- oder Pausenwert: ${event.duration}.`);
    }
    return sum + units * (event.dotted ? 1.5 : 1);
  }, 0);
}

export function rhythmicPositions(
  events: readonly RhythmEvent[],
  timeSignature?: TimeSignature,
): { positions: number[]; overfull: boolean } | undefined {
  if (timeSignature) validateTimeSignature(timeSignature);
  if (events.some((event) => event.duration === undefined)) return undefined;
  const durations = events.map((event) => {
    const units =
      event.duration === undefined ? undefined : durationUnits[event.duration];
    if (units === undefined)
      throw new Error(`Ungültiger Noten- oder Pausenwert: ${event.duration}.`);
    return units * (event.dotted ? 1.5 : 1);
  });
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const measureDuration = timeSignature
    ? (16 * timeSignature.numerator) / timeSignature.denominator
    : total;
  const overfull = timeSignature !== undefined && total > measureDuration;
  const availableDuration = overfull
    ? total - (durations[durations.length - 1] ?? 0)
    : measureDuration;
  let elapsed = 0;
  const positions = durations.map((duration) => {
    const position = availableDuration ? elapsed / availableDuration : 0;
    elapsed += duration;
    return position;
  });
  return { positions, overfull };
}

export function collectBeamGroups(
  events: readonly RhythmEvent[],
): Map<string, BeamGroup> {
  const groups = new Map<string, BeamGroup>();
  events.forEach((event, index) => {
    if (event.beamGroup === undefined) return;
    if (
      !event.beamGroup ||
      (event.duration !== "eighth" && event.duration !== "sixteenth")
    ) {
      throw new Error(
        "Balkengruppen benötigen einen Namen und dürfen nur Achtel- oder Sechzehntelnoten enthalten.",
      );
    }
    const group = groups.get(event.beamGroup);
    if (group) {
      const isAdjacent = group.indices[group.indices.length - 1] === index - 1;
      const candidateIndices = [...group.indices, index];
      const allSameDuration = group.duration === event.duration;
      const isDottedEighthWithSixteenth =
        candidateIndices.every(
          (i) =>
            events[i].duration === "sixteenth" ||
            (events[i].duration === "eighth" && events[i].dotted === true),
        ) && candidateIndices.some((i) => events[i].duration === "sixteenth");
      if (!isAdjacent || (!allSameDuration && !isDottedEighthWithSixteenth)) {
        throw new Error(
          `Balkengruppe "${event.beamGroup}" muss zusammenhängende Noten desselben Werts enthalten.`,
        );
      }
      group.indices.push(index);
      if (event.duration === "sixteenth") {
        group.duration = "sixteenth";
      }
    } else
      groups.set(event.beamGroup, {
        indices: [index],
        duration: event.duration,
      });
  });
  for (const [name, group] of groups) {
    if (group.indices.length < 2)
      throw new Error(`Balkengruppe "${name}" benötigt mindestens zwei Noten.`);
  }
  return groups;
}

export function flagGlyph(duration: BeamDuration, stemUp: boolean): string {
  return duration === "eighth"
    ? stemUp
      ? "\uE240"
      : "\uE241"
    : stemUp
      ? "\uE242"
      : "\uE243";
}

export function renderDot(
  x: string | number,
  y: number,
  offset: number,
): string {
  return `<circle cx="${x}" cy="${y}" r="1.5" transform="translate(${offset} 0)" fill="currentColor" stroke="none" />`;
}

export function renderBeam(
  x1: string,
  y1: number,
  x2: string,
  y2: number,
  width: number,
): string {
  // Clip square caps at the stem edges, even when the beam is sloped.
  const top = Math.min(y1, y2) - width;
  const height = Math.abs(y2 - y1) + 2 * width;
  return `<svg x="${x1}" y="${top}" width="calc(${x2} - ${x1})" height="${height}" overflow="hidden" aria-hidden="true"><line x1="0" y1="${y1 - top}" x2="100%" y2="${y2 - top}" stroke-width="${width}" stroke-linecap="square" /></svg>`;
}

export function renderStem(
  x: string | number,
  startY: number,
  endY: number,
  offset: number,
  width: number,
): string {
  return `<line x1="${x}" y1="${startY}" x2="${x}" y2="${endY}" transform="translate(${offset} 0)" stroke-width="${width}" />`;
}
