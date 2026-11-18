export function updateXpBadge(badge: HTMLElement, xp: number): void {
  badge.classList.toggle("has-xp", xp > 0);
  badge.textContent = `${xp} XP`;
}

export function createXpBadge(xp = 0): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "contribution-tag learning-xp-badge";
  updateXpBadge(badge, xp);
  return badge;
}
