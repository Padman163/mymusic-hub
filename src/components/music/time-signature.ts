import { glyphText } from "./svg.ts";

export interface TimeSignature {
	numerator: number;
	denominator: number;
}

export function validateTimeSignature(time: TimeSignature): void {
	if (
		!Number.isSafeInteger(time.numerator) ||
		time.numerator <= 0 ||
		!Number.isSafeInteger(time.denominator) ||
		time.denominator <= 0 ||
		!Number.isInteger(Math.log2(time.denominator))
	) {
		throw new Error(
			"Ungültige Taktart: Der Zähler muss eine positive ganze Zahl und der Nenner eine positive Zweierpotenz sein.",
		);
	}
}

export function timeSignatureWidth(time: TimeSignature): number {
	return (
		Math.max(String(time.numerator).length, String(time.denominator).length) *
		17
	);
}

export function omitUnchangedTimeSignatures<
	T extends { timeSignature?: TimeSignature },
>(
	systems: readonly (readonly T[])[],
): (Omit<T, "timeSignature"> & { timeSignature?: TimeSignature })[][] {
	let active: TimeSignature | undefined;
	return systems.map((system) =>
		system.map((measure) => {
			let timeSignature = measure.timeSignature;
			if (timeSignature) {
				validateTimeSignature(timeSignature);
				if (
					active &&
					active.numerator === timeSignature.numerator &&
					active.denominator === timeSignature.denominator
				) {
					timeSignature = undefined;
				} else {
					active = timeSignature;
				}
			}
			return { ...measure, timeSignature };
		}),
	);
}

export function renderTimeSignature(
	time: TimeSignature,
	x: number,
	numeratorY: number,
	denominatorY: number,
	className: string,
): string {
	validateTimeSignature(time);
	const glyphs = (value: number) =>
		[...String(value)]
			.map((digit) => String.fromCodePoint(0xe080 + Number(digit)))
			.join("");
	return (
		glyphText(glyphs(time.numerator), x, numeratorY, className, "middle") +
		glyphText(glyphs(time.denominator), x, denominatorY, className, "middle")
	);
}
