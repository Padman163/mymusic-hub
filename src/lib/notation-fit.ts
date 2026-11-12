let initialized = false;

export function observeNotationFit(): void {
  if (initialized || !("ResizeObserver" in window) || !CSS.supports("zoom", "0.5")) return;
  initialized = true;

  const observed = new Set<HTMLElement>();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.target;
      if (!(box instanceof HTMLElement) || entry.contentRect.width <= 0) continue;
      const grids = box.querySelectorAll<HTMLElement>(".notation-system-grid, .notation-systems");
      if (!grids.length) throw new Error("Notensystem-Raster nicht gefunden.");

      for (const grid of grids) grid.style.zoom = "1";
      for (const grid of grids) {
        if (!grid.getClientRects().length) continue;
        const width = grid.scrollWidth;
        if (width > 0) {
          grid.style.zoom = String(Math.min(1, entry.contentRect.width / width));
          box.dataset.fitted = "";
        }
      }
    }
  });

  function observeSystems(): void {
    document.querySelectorAll<HTMLElement>("[data-fit-to-width]").forEach((box) => {
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
  });
  document.fonts.addEventListener("loadingdone", () => {
    for (const box of observed) {
      resizeObserver.unobserve(box);
      resizeObserver.observe(box);
    }
  });
}
