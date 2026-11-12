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
  fromBarline?: boolean;
  toBarline?: boolean;
  startOpen?: number;
  endOpen?: number;
}

export type MeasureHairpin = Hairpin | HairpinRange;

export interface ResolvedHairpinSegment {
  type: Hairpin;
  from: number;
  to: number;
  fromBarline: boolean;
  toBarline: boolean;
  startOpen: number;
  endOpen: number;
}

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
): ResolvedHairpinSegment {
  const type = typeof hairpin === "string" ? hairpin : hairpin.type;
  if (type !== "crescendo" && type !== "decrescendo") {
    throw new Error(`Ungültige Dynamikgabel: ${String(type)}.`);
  }
  const fromBarline =
    typeof hairpin === "object" && Boolean(hairpin.fromBarline);
  const toBarline = typeof hairpin === "object" && Boolean(hairpin.toBarline);
  const from =
    typeof hairpin === "object" && hairpin.from !== undefined
      ? hairpin.from
      : 0;
  const to =
    typeof hairpin === "object" && hairpin.to !== undefined
      ? hairpin.to
      : Math.max(0, eventCount - 1);

  if (
    eventCount === 0 ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to >= eventCount ||
    (!fromBarline && !toBarline && from >= to)
  ) {
    throw new Error(
      `Ungültige Dynamikgabel zwischen Noten ${from} und ${to}.`,
    );
  }
  const startOpen =
    typeof hairpin === "object" && hairpin.startOpen !== undefined
      ? hairpin.startOpen
      : type === "crescendo"
        ? 0
        : 1;
  const endOpen =
    typeof hairpin === "object" && hairpin.endOpen !== undefined
      ? hairpin.endOpen
      : type === "crescendo"
        ? 1
        : 0;

  return { type, from, to, fromBarline, toBarline, startOpen, endOpen };
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
  startOpen = type === "crescendo" ? 0 : 1,
  endOpen = type === "crescendo" ? 1 : 0,
): string {
  const half = height / 2;
  const round = (val: number) => Math.round(val * 1000) / 1000;
  const yTop1 = round(half * (1 - startOpen));
  const yBot1 = round(half * (1 + startOpen));
  const yTop2 = round(half * (1 - endOpen));
  const yBot2 = round(half * (1 + endOpen));
  const lines = `<line x1="0" y1="${yTop1}" x2="100" y2="${yTop2}" vector-effect="non-scaling-stroke" /><line x1="0" y1="${yBot1}" x2="100" y2="${yBot2}" vector-effect="non-scaling-stroke" />`;
  return `<svg class="${className} ${type}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 100 ${height}" preserveAspectRatio="none" overflow="visible" aria-hidden="true">${lines}</svg>`;
}
