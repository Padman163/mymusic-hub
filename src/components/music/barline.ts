export function renderBarLine(
	x: string | number,
	top: number,
	bottom: number,
	width?: number,
): string {
	return `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"${width === undefined ? "" : ` stroke-width="${width}"`} />`;
}

export function renderRepeatStart(
	x: number,
	top: number,
	bottom: number,
	thinOffset = 4,
	dotOffset = 8,
	dotGap = 5,
): string {
	const middle = (top + bottom) / 2;
	return (
		renderBarLine(x, top, bottom, 4) +
		renderBarLine(x + thinOffset, top, bottom) +
		`<circle cx="${x + dotOffset}" cy="${middle - dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
		`<circle cx="${x + dotOffset}" cy="${middle + dotGap}" r="1.5" fill="currentColor" stroke="none" />`
	);
}

export function renderRepeatEnd(
	dotX: string | number,
	thinX: string | number,
	thickX: string | number,
	top: number,
	bottom: number,
	dotGap = 5,
): string {
	const middle = (top + bottom) / 2;
	return (
		`<circle cx="${dotX}" cy="${middle - dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
		`<circle cx="${dotX}" cy="${middle + dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
		renderBarLine(thinX, top, bottom) +
		renderBarLine(thickX, top, bottom, 4)
	);
}

export function renderRepeatEndSymbol(height: number): string {
	return renderRepeatEnd(2, 5.5, 11, 0, height, height / 8);
}

export function renderRepeatEndAtBoundary(top: number, bottom: number): string {
	const height = bottom - top;
	return `<svg x="100%" y="${top}" width="13" height="${height}" overflow="visible" aria-hidden="true"><g transform="translate(-13 0)">${renderRepeatEndSymbol(height)}</g></svg>`;
}
