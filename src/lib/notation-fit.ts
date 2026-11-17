let initialized = false;

export function observeNotationFit(): void {
  if (
    initialized ||
    !("ResizeObserver" in window) ||
    !CSS.supports("zoom", "0.5")
  )
    return;
  initialized = true;

  const observed = new Set<HTMLElement>();
  const sizes = new Map<HTMLElement, { width: number; height: number }>();
  const pending = new Map<HTMLElement, { width: number; height: number }>();
  let frame: number | undefined;
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.target;
      const { width, height } = entry.contentRect;
      if (!(box instanceof HTMLElement) || width <= 0) continue;
      const previous = sizes.get(box);
      if (
        previous?.width === width &&
        previous.height === height &&
        !pending.has(box)
      )
        continue;
      pending.set(box, { width, height });
    }

    if (pending.size === 0 || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      for (const [box, size] of pending) {
        if (!observed.has(box)) continue;
        sizes.set(box, size);
        const grids = box.querySelectorAll<HTMLElement>(".notation-systems");
        if (!grids.length)
          throw new Error("Notensystem-Raster nicht gefunden.");

        const baseScale = Number(box.dataset.scale || "1") || 1;
        for (const grid of grids) grid.style.zoom = "1";
        for (const grid of grids) {
          if (!grid.getClientRects().length) continue;
          const gridWidth = grid.scrollWidth;
          if (gridWidth > 0) {
            grid.style.zoom = String(
              Math.min(baseScale, size.width / gridWidth),
            );
            box.dataset.fitted = "";
          }
        }
      }
      pending.clear();
    });
  });

  function observeSystems(): void {
    document
      .querySelectorAll<HTMLElement>("[data-fit-to-width]")
      .forEach((box) => {
        if (!observed.has(box)) {
          observed.add(box);
          resizeObserver.observe(box);
        }
      });
  }

  observeSystems();
  document.addEventListener("astro:page-load", observeSystems);
  document.addEventListener("astro:before-swap", () => {
    resizeObserver.disconnect();
    observed.clear();
    sizes.clear();
    pending.clear();
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  });
  document.fonts.addEventListener("loadingdone", () => {
    for (const box of observed) {
      sizes.delete(box);
      resizeObserver.unobserve(box);
      resizeObserver.observe(box);
    }
  });
}
