import { type Duration, renderDot } from "./rhythm.ts";
import { glyphText } from "./svg.ts";

export const restSymbols: Record<
  Duration,
  { glyph: string; label: string; offset: number }
> = {
  whole: { glyph: "\uE4E3", label: "Ganze Pause", offset: -9 },
  half: { glyph: "\uE4E4", label: "Halbe Pause", offset: 0 },
  quarter: { glyph: "\uE4E5", label: "Viertelpause", offset: 0 },
  eighth: { glyph: "\uE4E6", label: "Achtelpause", offset: 0 },
  sixteenth: { glyph: "\uE4E7", label: "Sechzehntelpause", offset: 0 },
};

export function renderRest(
  duration: Duration,
  x: string | number,
  staffMiddle: number,
  dotted = false,
): string {
  const symbol = restSymbols[duration];
  if (!symbol) throw new Error(`Ungültiger Pausenwert: ${duration}.`);
  return (
    glyphText(
      symbol.glyph,
      x,
      staffMiddle + symbol.offset,
      "notation-rest",
      "middle",
    ) + (dotted ? renderDot(x, staffMiddle - 4.5, 10) : "")
  );
}
