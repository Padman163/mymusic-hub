export interface MusicCurve {
	from: number;
	to: number;
	type: "tie" | "slur";
	placement?: "above" | "below";
}

export function validateCurves(
	curves: readonly MusicCurve[],
	eventCount: number,
): void {
	curves.forEach(({ from, to }) => {
		if (
			!Number.isInteger(from) ||
			!Number.isInteger(to) ||
			from < 0 ||
			to >= eventCount ||
			from >= to
		) {
			throw new Error(`Ungültiger Bogen zwischen Noten ${from} und ${to}.`);
		}
	});
}

export function renderCurve(
	type: MusicCurve["type"],
	x: string,
	width: string,
	height: number,
	startY: number,
	endY: number,
	above: boolean,
	className: string,
): string {
	const outerControlY = (startY + endY) / 2 + (above ? -18 : 18);
	const innerControlY =
		outerControlY + (above ? 1 : -1) * (type === "tie" ? 3 : 5);
	return `<svg class="${className} ${type}" x="${x}" y="0" width="${width}" height="${height}" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 ${startY} Q 50 ${outerControlY} 100 ${endY} Q 50 ${innerControlY} 0 ${startY} Z" /></svg>`;
}
