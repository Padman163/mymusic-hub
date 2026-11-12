import { glyphText } from "./svg.ts";

export type Dynamic = "piano" | "forte";
export type Hairpin = "crescendo" | "decrescendo";

export type NotationDynamic =
  | "ppp"
  | "pp"
  | "p"
  | "mp"
  | "mf"
  | "f"
  | "ff"
  | "fff";

export interface HairpinRange {
  from?: number;
  to?: number;
  type: Hairpin;
}

export type MeasureHairpin = Hairpin | HairpinRange;

export const dynamicSymbols: Record<
  NotationDynamic,
  { glyph: string; label: string }
> = {
  ppp: { glyph: "\uE52A", label: "pianississimo" },
  pp: { glyph: "\uE52B", label: "pianissimo" },
  p: { glyph: "\uE520", label: "piano" },
  mp: { glyph: "\uE52C", label: "mezzopiano" },
  mf: { glyph: "\uE52D", label: "mezzoforte" },
  f: { glyph: "\uE522", label: "forte" },
  ff: { glyph: "\uE52F", label: "fortissimo" },
  fff: { glyph: "\uE530", label: "fortississimo" },
};

export function dynamicsForHairpin(
  type: Hairpin,
  initialDynamic?: Dynamic,
): {
  start: Dynamic;
  end: Dynamic;
  showStart: boolean;
} {
  const start = type === "crescendo" ? "piano" : "forte";
  return {
    start,
    end: type === "crescendo" ? "forte" : "piano",
    showStart: initialDynamic !== start,
  };
}

export function resolveHairpinRange(
  hairpin: MeasureHairpin,
  eventCount: number,
): { type: Hairpin; from: number; to: number } {
  const type = typeof hairpin === "string" ? hairpin : hairpin.type;
  if (type !== "crescendo" && type !== "decrescendo") {
    throw new Error(`Ungültige Dynamikgabel: ${String(type)}.`);
  }
  const from =
    typeof hairpin === "object" && hairpin.from !== undefined
      ? hairpin.from
      : 0;
  const to =
    typeof hairpin === "object" && hairpin.to !== undefined
      ? hairpin.to
      : Math.max(0, eventCount - 1);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to >= eventCount ||
    from >= to
  ) {
    throw new Error(
      `Ungültige Dynamikgabel zwischen Noten ${from} und ${to}.`,
    );
  }
  return { type, from, to };
}

export function renderDynamicMark(
  dynamic: NotationDynamic,
  x: string | number,
  y: number,
  className: string,
): string {
  const symbol = dynamicSymbols[dynamic];
  if (!symbol) {
    throw new Error(`Ungültiges Dynamikzeichen: ${String(dynamic)}.`);
  }
  return glyphText(symbol.glyph, x, y, className, "middle");
}

export function renderHairpinSvg(
  type: Hairpin,
  x: string,
  width: string,
  y: number,
  height: number,
  className: string,
): string {
  const half = height / 2;
  const lines =
    type === "crescendo"
      ? `<line x1="0" y1="${half}" x2="100" y2="0" vector-effect="non-scaling-stroke" /><line x1="0" y1="${half}" x2="100" y2="${height}" vector-effect="non-scaling-stroke" />`
      : `<line x1="0" y1="0" x2="100" y2="${half}" vector-effect="non-scaling-stroke" /><line x1="0" y1="${height}" x2="100" y2="${half}" vector-effect="non-scaling-stroke" />`;
  return `<svg class="${className} ${type}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 100 ${height}" preserveAspectRatio="none" overflow="visible" aria-hidden="true">${lines}</svg>`;
}
