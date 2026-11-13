import { afterEach, describe, expect, it } from "vitest";
import {
  type NotationBuilderConfig,
  renderNotationBuilderSvg,
  setupNotationBuilders,
} from "../../src/lib/notation-builder";

function mountBuilder(
  config: NotationBuilderConfig = {
    clef: "treble",
    showLeftBar: false,
    showRightBar: false,
    showLabel: true,
    initialStep: 4,
  },
): HTMLElement {
  const root = document.createElement("div");
  root.className = "notation-component notation-builder";
  root.tabIndex = 0;
  root.dataset.notationBuilder = "";
  root.dataset.builderConfig = JSON.stringify(config);

  const stage = document.createElement("div");
  stage.className = "notation-builder-stage";
  stage.innerHTML = renderNotationBuilderSvg({
    config,
    cursorStep: config.initialStep ?? 4,
    placedNote: null,
  });

  const footer = document.createElement("div");
  footer.className = "notation-builder-footer";
  const statusNote = document.createElement("span");
  statusNote.className = "notation-builder-status-note";
  const statusAction = document.createElement("span");
  statusAction.className = "notation-builder-status-action";
  footer.append(statusNote, statusAction);

  root.append(stage, footer);
  document.body.append(root);
  setupNotationBuilders();
  return root;
}

function clickStep(root: HTMLElement, step: number) {
  const svg = root.querySelector<SVGSVGElement>("svg.notation-staff");
  if (!svg) throw new Error("SVG fehlt");
  svg.getBoundingClientRect = () =>
    ({ top: 0, height: 92, left: 0, width: 400 }) as DOMRect;
  const y = 64 - step * 5;
  root
    .querySelector(".notation-builder-stage")
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: y }));
}

describe("NotationBuilder-Interaktion", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("zeigt initial den markierten Bereich auf B4 und die Erstell-Aktion an", () => {
    const root = mountBuilder();

    expect(root.dataset.cursorStep).toBe("4");
    expect(root.dataset.cursorNote).toBe("B4");
    expect(root.dataset.canCreate).toBe("true");
    expect(root.dataset.canDelete).toBe("false");
    expect(root.querySelector(".notation-builder-status-note")?.textContent).toContain(
      "B4",
    );
    expect(root.querySelector(".notation-builder-status-action")?.textContent).toContain(
      "Viertelnote B4 erstellen (Num 1)",
    );
    expect(root.querySelector(".notation-builder-cursor-text")?.textContent).toContain(
      "B4",
    );
  });

  it("platziert den markierten Bereich per Mausklick auf einen Step", () => {
    const root = mountBuilder();
    clickStep(root, 0);

    expect(root.dataset.cursorStep).toBe("0");
    expect(root.dataset.cursorNote).toBe("E4");
    expect(root.querySelector(".notation-builder-cursor-text")?.textContent).toContain(
      "E4",
    );
  });

  it("verschiebt den markierten Bereich mit Pfeiltasten hoch und runter innerhalb -2..10", () => {
    const root = mountBuilder();

    root.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(root.dataset.cursorStep).toBe("5");
    expect(root.dataset.cursorNote).toBe("C5");

    for (let i = 0; i < 10; i += 1) {
      root.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
    }
    expect(root.dataset.cursorStep).toBe("10");
    expect(root.dataset.cursorNote).toBe("A5");

    for (let i = 0; i < 20; i += 1) {
      root.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    }
    expect(root.dataset.cursorStep).toBe("-2");
    expect(root.dataset.cursorNote).toBe("C4");
  });

  it("erstellt mit NUM 1 eine Viertelnote und löscht sie mit ENTF", () => {
    const root = mountBuilder();
    clickStep(root, 1);

    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "1",
        code: "Numpad1",
        bubbles: true,
      }),
    );

    expect(root.dataset.placedStep).toBe("1");
    expect(root.dataset.placedNote).toBe("F4");
    expect(root.dataset.placedDuration).toBe("quarter");
    expect(root.dataset.canDelete).toBe("true");
    expect(root.querySelector(".notation-note")).not.toBeNull();
    expect(root.querySelector(".notation-builder-status-action")?.textContent).toContain(
      "Viertelnote F4 löschen (Entf)",
    );

    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
      }),
    );
    expect(root.dataset.cursorNote).toBe("G4");
    expect(root.querySelector(".notation-builder-status-action")?.textContent).toContain(
      "Viertelnote G4 erstellen (Num 1)",
    );
    expect(root.querySelector(".notation-builder-status-action")?.textContent).toContain(
      "F4 löschen (Entf)",
    );

    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        code: "Delete",
        bubbles: true,
      }),
    );

    expect(root.dataset.placedStep).toBeUndefined();
    expect(root.dataset.placedNote).toBeUndefined();
    expect(root.dataset.canDelete).toBe("false");
    expect(root.querySelector(".notation-note")).toBeNull();
    expect(root.querySelector(".notation-builder-status-action")?.textContent).toContain(
      "Viertelnote G4 erstellen (Num 1)",
    );
  });

  it("setzt den Builder über notationbuilder:reset zurück", () => {
    const root = mountBuilder();
    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "1",
        code: "Numpad1",
        bubbles: true,
      }),
    );
    expect(root.dataset.placedNote).toBe("B4");

    root.dispatchEvent(
      new CustomEvent("notationbuilder:reset", { detail: { step: 2 } }),
    );
    expect(root.dataset.placedNote).toBeUndefined();
    expect(root.dataset.cursorStep).toBe("2");
    expect(root.dataset.cursorNote).toBe("G4");
  });
});

