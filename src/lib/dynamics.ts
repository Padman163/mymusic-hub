import { escapeXml, glyphText } from "./svg.ts";

export type Dynamic = "piano" | "forte";
export type Hairpin = "crescendo" | "decrescendo";

export type NotationDynamic =
  | "pppp"
  | "ppp"
  | "pp"
  | "p"
  | "mp"
  | "mf"
  | "pf"
  | "f"
  | "ff"
  | "fff"
  | "ffff"
  | "fp"
  | "fz"
  | "sf"
  | "sfp"
  | "sfpp"
  | "sfz"
  | "sffz"
  | "rf"
  | "rfz"
  | "n"
  | "cresc."
  | "decresc."
  | "dim."
  | "poco cresc."
  | "poco dim."
  | "molto cresc."
  | "molto dim."
  | "più p"
  | "più f"
  | "sub. p"
  | "sub. f"
  | "sempre p"
  | "sempre f";

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
  { glyph?: string; text?: string; label: string }
> = {
  pppp: { glyph: "\uE529", label: "pianissississimo" },
  ppp: { glyph: "\uE52A", label: "pianississimo" },
  pp: { glyph: "\uE52B", label: "pianissimo" },
  p: { glyph: "\uE520", label: "piano" },
  mp: { glyph: "\uE52C", label: "mezzopiano" },
  mf: { glyph: "\uE52D", label: "mezzoforte" },
  pf: { glyph: "\uE52E", label: "poco forte" },
  f: { glyph: "\uE522", label: "forte" },
  ff: { glyph: "\uE52F", label: "fortissimo" },
  fff: { glyph: "\uE530", label: "fortississimo" },
  ffff: { glyph: "\uE531", label: "fortissississimo" },
  fp: { glyph: "\uE534", label: "fortepiano" },
  fz: { glyph: "\uE535", label: "forzando" },
  sf: { glyph: "\uE536", label: "sforzando" },
  sfp: { glyph: "\uE537", label: "sforzando-piano" },
  sfpp: { glyph: "\uE538", label: "sforzando-pianissimo" },
  sfz: { glyph: "\uE539", label: "sforzato" },
  sffz: { glyph: "\uE53B", label: "sforzato-fortissimo" },
  rf: { glyph: "\uE53C", label: "rinforzando" },
  rfz: { glyph: "\uE53D", label: "rinforzando" },
  n: { glyph: "\uE526", label: "niente" },
  "cresc.": { text: "cresc.", label: "crescendo" },
  "decresc.": { text: "decresc.", label: "decrescendo" },
  "dim.": { text: "dim.", label: "diminuendo" },
  "poco cresc.": { text: "poco cresc.", label: "poco crescendo" },
  "poco dim.": { text: "poco dim.", label: "poco diminuendo" },
  "molto cresc.": { text: "molto cresc.", label: "molto crescendo" },
  "molto dim.": { text: "molto dim.", label: "molto diminuendo" },
  "più p": { text: "più p", label: "più piano" },
  "più f": { text: "più f", label: "più forte" },
  "sub. p": { text: "sub. p", label: "subito piano" },
  "sub. f": { text: "sub. f", label: "subito forte" },
  "sempre p": { text: "sempre p", label: "sempre piano" },
  "sempre f": { text: "sempre f", label: "sempre forte" },
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
  if (symbol.glyph) {
    return glyphText(symbol.glyph, x, y, className, "middle");
  }
  return `<text class="${className}-text" x="${x}" y="${y}" text-anchor="middle">${escapeXml(symbol.text ?? dynamic)}</text>`;
}

export function renderDynamicText(
  text: string,
  x: string | number,
  y: number,
  className: string,
  offsetPx?: number,
): string {
  if (offsetPx !== undefined) {
    return `<text class="${className}-text" x="${x}" y="${y}" transform="translate(${offsetPx} 0)" text-anchor="start">${escapeXml(text)}</text>`;
  }
  return `<text class="${className}-text" x="${x}" y="${y}" text-anchor="middle">${escapeXml(text)}</text>`;
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
