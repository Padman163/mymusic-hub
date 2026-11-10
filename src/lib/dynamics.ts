export type Dynamic = "piano" | "forte";
export type Hairpin = "crescendo" | "decrescendo";

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
