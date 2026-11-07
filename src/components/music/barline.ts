export function renderBarLine(x: string | number, top: number, bottom: number, width?: number): string {
  return `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"${width === undefined ? '' : ` stroke-width="${width}"`} />`;
}

export function renderRepeatStart(x: number, top: number, bottom: number, thinOffset = 4, dotOffset = 8, dotGap = 5): string {
  const middle = (top + bottom) / 2;
  return renderBarLine(x, top, bottom, 4) + renderBarLine(x + thinOffset, top, bottom) +
    `<circle cx="${x + dotOffset}" cy="${middle - dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
    `<circle cx="${x + dotOffset}" cy="${middle + dotGap}" r="1.5" fill="currentColor" stroke="none" />`;
}

export function renderRepeatEnd(dotX: string | number, thinX: string | number, thickX: string | number, top: number, bottom: number, dotGap = 5): string {
  const middle = (top + bottom) / 2;
  return `<circle cx="${dotX}" cy="${middle - dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
    `<circle cx="${dotX}" cy="${middle + dotGap}" r="1.5" fill="currentColor" stroke="none" />` +
    renderBarLine(thinX, top, bottom) + renderBarLine(thickX, top, bottom, 4);
}
