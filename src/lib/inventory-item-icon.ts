export function renderInventoryItemIcon(
  element: HTMLElement,
  itemId: string,
): void {
  element.replaceChildren();

  if (itemId !== "sound-kick") {
    element.textContent = "●";
    return;
  }

  element.dataset.soundIcon = "kick";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("learning-bass-drum-icon");

  const shell = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "ellipse",
  );
  shell.setAttribute("cx", "24");
  shell.setAttribute("cy", "22");
  shell.setAttribute("rx", "16");
  shell.setAttribute("ry", "14");
  shell.setAttribute("fill", "none");
  shell.setAttribute("stroke", "currentColor");
  shell.setAttribute("stroke-width", "4");

  const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  head.setAttribute("cx", "24");
  head.setAttribute("cy", "22");
  head.setAttribute("r", "3");
  head.setAttribute("fill", "currentColor");

  const leftLeg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  leftLeg.setAttribute("d", "M14 34 L9 43");
  const rightLeg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  rightLeg.setAttribute("d", "M34 34 L39 43");
  for (const leg of [leftLeg, rightLeg]) {
    leg.setAttribute("fill", "none");
    leg.setAttribute("stroke", "currentColor");
    leg.setAttribute("stroke-width", "4");
    leg.setAttribute("stroke-linecap", "round");
  }

  svg.append(shell, head, leftLeg, rightLeg);
  element.append(svg);
}
