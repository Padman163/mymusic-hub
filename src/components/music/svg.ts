export function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] as string,
  );
}

export function glyphText(
  glyph: string,
  x: string | number,
  y: string | number,
  className: string,
  anchor?: string,
): string {
  return `<text class="${className}" x="${x}" y="${y}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escapeXml(glyph)}</text>`;
}
