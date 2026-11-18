import { drumAudioEngine } from "./drum-audio.ts";
import {
  DEFAULT_DRUM_PATTERN_PROPS,
  type DrumPatternTrack,
  getDrumPatternPropsErrors,
  isDrumPatternProps,
} from "./module-schema.ts";

const NOTE_COLORS: Record<string, string> = {
  C: "#f87171",
  "C#": "#fb923c",
  D: "#fbbf24",
  "D#": "#f472b6",
  E: "#a3e635",
  F: "#e879f9",
  "F#": "#2dd4bf",
  G: "#60a5fa",
  "G#": "#38bdf8",
  A: "#c084fc",
  "A#": "#4ade80",
  B: "#facc15",
};

interface VisibleTrack extends DrumPatternTrack {
  color: string;
  velocities: number[];
  soundVelocities: number[];
}

function createScopedElement(
  document: Document,
  tagName: string,
  scopeClasses: readonly string[],
  className?: string,
): HTMLElement {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.classList.add(...scopeClasses);
  return element;
}

export function createDrumPatternElement(
  rawProps: unknown,
  templateRoot?: ParentNode,
): HTMLElement {
  const errors = getDrumPatternPropsErrors(rawProps);
  if (errors.length > 0) throw new Error(errors.join(" "));
  if (!isDrumPatternProps(rawProps)) {
    throw new Error("Die DrumPattern-Props sind ungültig.");
  }

  const sourceContainer =
    templateRoot?.querySelector<HTMLElement>(
      '[data-visual-template="DrumPattern"]',
    ) ??
    globalThis.document.querySelector<HTMLElement>(
      '[data-visual-template="DrumPattern"]',
    );
  const source = sourceContainer?.querySelector<HTMLDivElement>(
    ".studio-one-pattern",
  );
  if (!source) throw new Error("Die DrumPattern-Vorlage fehlt.");

  const document = source.ownerDocument;
  const scopeClasses = Array.from(source.classList).filter((className) =>
    className.startsWith("astro-"),
  );
  const {
    steps = DEFAULT_DRUM_PATTERN_PROPS.steps,
    timeSignature = DEFAULT_DRUM_PATTERN_PROPS.timeSignature,
    resolution = DEFAULT_DRUM_PATTERN_PROPS.resolution,
    highlightTrack = DEFAULT_DRUM_PATTERN_PROPS.highlightTrack,
    highlightTracks = DEFAULT_DRUM_PATTERN_PROPS.highlightTracks,
    interactive = DEFAULT_DRUM_PATTERN_PROPS.interactive,
    showVelocity = DEFAULT_DRUM_PATTERN_PROPS.showVelocity,
    showTrackNote = DEFAULT_DRUM_PATTERN_PROPS.showTrackNote,
    showFooter = DEFAULT_DRUM_PATTERN_PROPS.showFooter,
    showFooterInfo = DEFAULT_DRUM_PATTERN_PROPS.showFooterInfo,
    useTrackColors = DEFAULT_DRUM_PATTERN_PROPS.useTrackColors,
    continuous = DEFAULT_DRUM_PATTERN_PROPS.continuous,
    keepEmptyTracks = DEFAULT_DRUM_PATTERN_PROPS.keepEmptyTracks,
    stepSize = DEFAULT_DRUM_PATTERN_PROPS.stepSize,
    stepLabels: customStepLabels,
    patternData = DEFAULT_DRUM_PATTERN_PROPS.patternData,
    enableAudio = patternData.some((track) => Boolean(track.soundUrl)),
  } = rawProps;

  const visibleTracks: VisibleTrack[] = patternData
    .filter(
      (track) =>
        keepEmptyTracks ||
        track.activeSteps.length > 0 ||
        (track.eventPositions?.length ?? 0) > 0,
    )
    .map((track) => ({
      ...track,
      soundVelocities: track.velocities ?? [],
      color: useTrackColors
        ? track.color
        : (NOTE_COLORS[track.note.match(/^[A-G]#?/)?.[0] ?? ""] ?? track.color),
      velocities: Array.from({ length: steps }, (_, stepIndex) =>
        track.activeSteps.includes(stepIndex)
          ? Math.min(127, Math.max(0, track.velocities?.[stepIndex] ?? 90))
          : 0,
      ),
    }));

  const pattern = createScopedElement(
    document,
    "div",
    scopeClasses,
    "studio-one-pattern",
  );
  pattern.style.setProperty("--step-size", `${stepSize}px`);
  pattern.dataset.interactive = String(interactive);
  pattern.dataset.showVelocity = String(showVelocity);
  pattern.dataset.showTrackNote = String(showTrackNote);
  pattern.dataset.continuous = String(continuous);
  if (enableAudio) pattern.dataset.enableAudio = "true";

  const header = createScopedElement(
    document,
    "div",
    scopeClasses,
    "pattern-header",
  );
  header.style.setProperty("--steps", String(steps));
  const spacer = createScopedElement(
    document,
    "div",
    scopeClasses,
    "header-spacer",
  );
  spacer.setAttribute("aria-hidden", "true");
  header.append(spacer);

  const stepLabels = Array.from(
    { length: steps },
    (_, index) =>
      customStepLabels?.[index] ??
      (index % 2 === 0 ? `${(Math.floor(index / 2) % 4) + 1}` : "+"),
  );
  for (const label of stepLabels) {
    const number = createScopedElement(
      document,
      "div",
      scopeClasses,
      "step-number",
    );
    number.textContent = label;
    header.append(number);
  }
  pattern.append(header);

  const grid = createScopedElement(
    document,
    "div",
    scopeClasses,
    "pattern-grid",
  );
  const highlightedTracks = new Set([
    ...highlightTracks.map((track) => track.trim()),
    ...(highlightTrack.trim() ? [highlightTrack.trim()] : []),
  ]);
  const selectedTrackIndex =
    interactive || showVelocity
      ? highlightedTracks.size > 0
        ? visibleTracks.findIndex((track) => highlightedTracks.has(track.name))
        : 0
      : -1;
  for (const [trackIndex, track] of visibleTracks.entries()) {
    const isHighlighted = highlightedTracks.has(track.name);
    const isSelected = trackIndex === selectedTrackIndex;
    const row = createScopedElement(
      document,
      "div",
      scopeClasses,
      `track-row ${isHighlighted ? "highlighted" : ""} ${
        isSelected ? "selected" : ""
      }`,
    );
    row.dataset.color = track.color;
    row.dataset.velocities = JSON.stringify(track.velocities);
    if (enableAudio && track.soundUrl) {
      row.dataset.soundUrl = track.soundUrl;
      row.dataset.soundVelocities = JSON.stringify(track.soundVelocities);
    }
    row.setAttribute(
      "aria-label",
      `Instrument ${track.name}, Note ${track.note}`,
    );
    if (showVelocity) {
      row.setAttribute("role", "button");
      row.setAttribute(
        "aria-pressed",
        String(row.classList.contains("selected")),
      );
      row.tabIndex = 0;
    }

    const info = createScopedElement(
      document,
      "div",
      scopeClasses,
      "track-info",
    );
    info.style.setProperty("--track-color", track.color);
    const name = createScopedElement(
      document,
      "span",
      scopeClasses,
      "track-name",
    );
    name.textContent = track.name;
    info.append(name);
    if (showTrackNote) {
      const note = createScopedElement(
        document,
        "span",
        scopeClasses,
        "track-note",
      );
      note.textContent = track.note;
      info.append(note);
    }

    const columns = createScopedElement(
      document,
      "div",
      scopeClasses,
      "step-columns step-row",
    );
    columns.style.setProperty("--steps", String(steps));
    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      const active = track.activeSteps.includes(stepIndex);
      const cell = createScopedElement(
        document,
        "div",
        scopeClasses,
        `step-cell${active ? " active" : ""}`,
      );
      if (active) cell.style.backgroundColor = track.color;
      cell.dataset.step = String(stepIndex);
      if (stepIndex === steps - 1) cell.dataset.gridEnd = "true";
      if (active && !track.activeSteps.includes(stepIndex - 1)) {
        cell.dataset.runStart = "true";
      }
      if (active && !track.activeSteps.includes(stepIndex + 1)) {
        cell.dataset.runEnd = "true";
      }
      const label = track.cellLabels?.[stepIndex];
      if (label) {
        const labelElement = createScopedElement(
          document,
          "span",
          scopeClasses,
          "step-cell-label",
        );
        labelElement.textContent = label;
        cell.append(labelElement);
      }
      columns.append(cell);
    }

    for (const [eventIndex, position] of (
      track.eventPositions ?? []
    ).entries()) {
      const marker = createScopedElement(
        document,
        "div",
        scopeClasses,
        "event-marker",
      );
      marker.setAttribute("aria-hidden", "true");
      marker.style.setProperty("--event-step", String(position));
      marker.style.setProperty("--event-color", track.color);
      marker.textContent = track.eventLabels?.[eventIndex] ?? "";
      columns.append(marker);
    }

    row.append(info, columns);
    grid.append(row);
  }

  const initialTrack = visibleTracks[0];
  if (showVelocity && initialTrack) {
    const velocityRow = createScopedElement(
      document,
      "div",
      scopeClasses,
      "track-row velocity-row",
    );
    velocityRow.setAttribute(
      "aria-label",
      "Anschlag für ausgewähltes Instrument",
    );
    const info = createScopedElement(
      document,
      "div",
      scopeClasses,
      "track-info velocity-info",
    );
    info.textContent = "Anschlag";
    const columns = createScopedElement(
      document,
      "div",
      scopeClasses,
      "step-columns step-row velocity-columns",
    );
    columns.style.setProperty("--steps", String(steps));
    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      const active = initialTrack.activeSteps.includes(stepIndex);
      const velocity = initialTrack.velocities[stepIndex] ?? 0;
      const cell = createScopedElement(
        document,
        "div",
        scopeClasses,
        "velocity-cell",
      );
      cell.style.setProperty(
        "--velocity-percent",
        `${(velocity / 127) * 100}%`,
      );
      cell.dataset.active = String(active);
      cell.dataset.step = String(stepIndex);
      cell.dataset.velocity = String(velocity);
      cell.setAttribute("role", interactive ? "slider" : "img");
      cell.setAttribute(
        "aria-label",
        `${initialTrack.name}, Step ${stepIndex + 1}, Anschlag ${velocity}`,
      );
      if (interactive) {
        cell.setAttribute("aria-valuemin", "0");
        cell.setAttribute("aria-valuemax", "127");
        cell.setAttribute("aria-valuenow", String(velocity));
        cell.setAttribute("aria-disabled", String(!active));
      }
      cell.tabIndex = interactive && active ? 0 : -1;

      const bar = createScopedElement(
        document,
        "span",
        scopeClasses,
        "velocity-bar",
      );
      bar.style.height = `${(velocity / 127) * 100}%`;
      const label = createScopedElement(
        document,
        "span",
        scopeClasses,
        "velocity-label",
      );
      label.dataset.inBar = String(velocity >= 40);
      label.textContent = active ? String(velocity) : "";
      cell.append(bar, label);
      columns.append(cell);
    }
    velocityRow.append(info, columns);
    grid.append(velocityRow);
  }
  pattern.append(grid);

  if (showFooter) {
    const footer = createScopedElement(
      document,
      "div",
      scopeClasses,
      "pattern-footer",
    );
    footer.style.setProperty("--steps", String(steps));
    if (showFooterInfo) {
      footer.setAttribute(
        "aria-label",
        `Taktart ${timeSignature}, Auflösung ${resolution}, ${steps} Steps`,
      );
      const footerInfo = createScopedElement(
        document,
        "div",
        scopeClasses,
        "footer-info",
      );
      for (const [label, value] of [
        ["Taktart:", timeSignature],
        ["Auflösung:", resolution],
        ["Steps:", String(steps)],
      ]) {
        const item = createScopedElement(document, "span", scopeClasses);
        item.append(document.createTextNode(`${label} `));
        const strong = createScopedElement(document, "strong", scopeClasses);
        strong.textContent = value;
        item.append(strong);
        footerInfo.append(item);
      }
      footer.append(footerInfo);
    } else {
      footer.setAttribute("aria-hidden", "true");
    }
    pattern.append(footer);
  }

  initializeDrumPatterns(pattern);
  return pattern;
}

function updateVelocityCell(cell: HTMLDivElement, velocity: number): void {
  const value = Math.max(0, Math.min(127, Math.round(velocity)));
  const bar = cell.querySelector<HTMLSpanElement>(".velocity-bar");
  const label = cell.querySelector<HTMLSpanElement>(".velocity-label");
  if (!bar || !label) return;

  cell.dataset.velocity = String(value);
  cell.setAttribute("aria-valuenow", String(value));
  cell.style.setProperty("--velocity-percent", `${(value / 127) * 100}%`);
  bar.style.height = `${(value / 127) * 100}%`;
  label.textContent = cell.dataset.active === "true" ? String(value) : "";
  label.dataset.inBar = String(value >= 40);
}

function updateAudioTrigger(cell: HTMLElement, name: string): void {
  const active = cell.classList.contains("active");
  if (active) {
    cell.dataset.audioTrigger = "true";
    cell.setAttribute("role", "button");
    cell.setAttribute(
      "aria-label",
      `${name}, Step ${Number(cell.dataset.step) + 1} abspielen`,
    );
    cell.tabIndex = 0;
  } else {
    delete cell.dataset.audioTrigger;
    cell.removeAttribute("role");
    cell.removeAttribute("aria-label");
    cell.removeAttribute("tabindex");
  }
}

function setTrackVelocity(row: HTMLElement, step: number, value: number): void {
  const values: number[] = JSON.parse(row.dataset.velocities ?? "[]");
  values[step] = value;
  row.dataset.velocities = JSON.stringify(values);
  if (row.dataset.soundUrl) {
    const soundValues: (number | null)[] = JSON.parse(
      row.dataset.soundVelocities ?? "[]",
    );
    soundValues[step] = value;
    row.dataset.soundVelocities = JSON.stringify(soundValues);
  }
}

function initializeDrumPatternAudio(pattern: HTMLElement): void {
  if (
    pattern.dataset.enableAudio !== "true" ||
    pattern.dataset.audioBound === "true"
  )
    return;
  pattern.dataset.audioBound = "true";
  const rows = pattern.querySelectorAll<HTMLElement>(
    ".track-row[data-sound-url]",
  );
  if (!rows.length) return;

  void drumAudioEngine.preloadSounds(
    Array.from(rows, (row) => row.dataset.soundUrl ?? ""),
  );
  const status = pattern.ownerDocument.createElement("p");
  status.className = "drum-audio-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  const help = pattern.ownerDocument.createElement("a");
  help.className = "drum-audio-help";
  help.href = "/wiki/drum-pattern/";
  help.textContent = "Hilfe zur Drum-Audiowiedergabe";
  pattern.append(status, help);
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

  rows.forEach((row) => {
    const name = row.querySelector(".track-name")?.textContent ?? "Instrument";
    const header = row.querySelector<HTMLElement>(".track-info");
    if (header) {
      // Keine verschachtelten Buttons: Die Spurauswahl bleibt am Header bedienbar.
      row.removeAttribute("role");
      row.removeAttribute("aria-pressed");
      row.removeAttribute("tabindex");
      header.dataset.audioTrigger = "true";
      header.setAttribute("role", "button");
      header.setAttribute("aria-label", `${name} abspielen`);
      header.tabIndex = 0;
      if (pattern.dataset.showVelocity === "true") {
        header.setAttribute(
          "aria-pressed",
          String(row.classList.contains("selected")),
        );
      }
    }
    row
      .querySelectorAll<HTMLElement>(".step-cell")
      .forEach((cell) => updateAudioTrigger(cell, name));
  });

  function getTrigger(event: Event): HTMLElement | null {
    return event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-audio-trigger]")
      : null;
  }

  pattern.addEventListener("pointerdown", (event) => {
    if (getTrigger(event)) void drumAudioEngine.unlock();
  });
  pattern.addEventListener(
    "keydown",
    (event) => {
      const trigger = getTrigger(event);
      if (!trigger || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) trigger.click();
    },
    true,
  );
  // Vor dem bestehenden Step-Editor auslösen, der den aktiven Zustand umschaltet.
  pattern.addEventListener(
    "click",
    (event) => {
      const trigger = getTrigger(event);
      const row = trigger?.closest<HTMLElement>(".track-row");
      const url = row?.dataset.soundUrl;
      if (!trigger || !row || !url) return;
      const values: (number | null)[] = JSON.parse(
        row.dataset.soundVelocities ?? "[]",
      );
      const velocity = trigger.classList.contains("step-cell")
        ? (values[Number(trigger.dataset.step)] ?? undefined)
        : undefined;
      void drumAudioEngine.playSound(url, velocity).then((played) => {
        status.hidden = played;
        if (!played)
          status.textContent =
            "Sound nicht verfügbar. Browser-Audiofreigabe und Sounddatei prüfen; danach erneut versuchen.";
        if (!played) return;
        clearTimeout(timers.get(trigger));
        trigger.classList.add("is-playing");
        timers.set(
          trigger,
          setTimeout(() => trigger.classList.remove("is-playing"), 150),
        );
      });
    },
    true,
  );
}

export function initializeDrumPatterns(root: ParentNode): void {
  const patterns = Array.from(
    root.querySelectorAll<HTMLElement>(".studio-one-pattern"),
  );
  if (root instanceof HTMLElement && root.matches(".studio-one-pattern")) {
    patterns.unshift(root);
  }

  patterns.forEach((pattern) => {
    initializeDrumPatternAudio(pattern);
    const rows = pattern.querySelectorAll<HTMLDivElement>(
      ".track-row:not(.velocity-row)",
    );
    const velocityRow = pattern.querySelector<HTMLDivElement>(".velocity-row");
    const velocityCells =
      pattern.querySelectorAll<HTMLDivElement>(".velocity-cell");
    const isInteractive = pattern.dataset.interactive === "true";
    const hasVelocity = pattern.dataset.showVelocity === "true";
    let selectedTrack =
      pattern.querySelector<HTMLDivElement>(".track-row.selected") ?? rows[0];

    if (!isInteractive && !hasVelocity) return;

    function renderVelocity(row: HTMLDivElement): void {
      const values = JSON.parse(row.dataset.velocities ?? "[]") as number[];
      const stepCells = row.querySelectorAll<HTMLDivElement>(".step-cell");

      velocityCells.forEach((velocityCell, stepIndex) => {
        const isActive = stepCells[stepIndex].classList.contains("active");
        const value = isActive ? values[stepIndex] : 0;
        velocityCell.dataset.active = String(isActive);
        velocityCell.dataset.velocity = String(value);
        if (isInteractive) {
          velocityCell.setAttribute("aria-valuenow", String(value));
          velocityCell.setAttribute("aria-disabled", String(!isActive));
        }
        velocityCell.setAttribute(
          "aria-label",
          `${row.querySelector<HTMLElement>(".track-name")?.textContent ?? ""}, Step ${stepIndex + 1}, Anschlag`,
        );
        velocityCell.tabIndex = isInteractive && isActive ? 0 : -1;
        updateVelocityCell(velocityCell, value);
      });
    }

    function selectRow(row: HTMLDivElement): void {
      selectedTrack = row;
      rows.forEach((candidate) =>
        candidate.classList.toggle("selected", candidate === row),
      );
      if (hasVelocity) {
        rows.forEach((candidate) => {
          const target = candidate.dataset.soundUrl
            ? candidate.querySelector<HTMLElement>(".track-info")
            : candidate;
          target?.setAttribute("aria-pressed", String(candidate === row));
        });
      }
      velocityRow?.classList.remove("selected");
      if (hasVelocity) renderVelocity(row);
    }

    rows.forEach((row) => {
      const color = row.dataset.color ?? "#18181b";
      const cells = row.querySelectorAll<HTMLDivElement>(".step-cell");
      if (row.dataset.bound !== "true") {
        row.dataset.bound = "true";
        row.addEventListener("click", () => selectRow(row));
        row.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selectRow(row);
        });
      }

      cells.forEach((cell) => {
        if (!isInteractive || cell.dataset.bound === "true") return;
        cell.dataset.bound = "true";
        cell.addEventListener("click", () => {
          selectRow(row);
          const isActive = cell.classList.toggle("active");
          cell.style.backgroundColor = isActive ? color : "#18181b";

          const values = JSON.parse(row.dataset.velocities ?? "[]") as number[];
          const stepIndex = Number(cell.dataset.step);
          setTrackVelocity(
            row,
            stepIndex,
            isActive ? values[stepIndex] || 90 : 0,
          );
          if (row.dataset.soundUrl) {
            updateAudioTrigger(
              cell,
              row.querySelector(".track-name")?.textContent ?? "Instrument",
            );
          }
          renderVelocity(row);
        });
      });
    });

    const selectedRow =
      pattern.querySelector<HTMLDivElement>(".track-row.selected") ?? rows[0];
    if (selectedRow) selectRow(selectedRow);

    velocityCells.forEach((cell) => {
      if (!isInteractive || cell.dataset.bound === "true") return;
      cell.dataset.bound = "true";
      const setFromPointer = (event: PointerEvent): void => {
        const bounds = cell.getBoundingClientRect();
        const ratio = 1 - (event.clientY - bounds.top) / bounds.height;
        updateVelocityCell(cell, ratio * 127);

        if (selectedTrack) {
          setTrackVelocity(
            selectedTrack,
            Number(cell.dataset.step),
            Number(cell.dataset.velocity),
          );
        }
      };

      cell.addEventListener("pointerdown", (event) => {
        if (cell.dataset.active !== "true") return;
        event.preventDefault();
        cell.setPointerCapture(event.pointerId);
        setFromPointer(event);
      });
      cell.addEventListener("pointermove", (event) => {
        if (cell.hasPointerCapture(event.pointerId)) setFromPointer(event);
      });
      cell.addEventListener("keydown", (event) => {
        if (cell.dataset.active !== "true") return;
        const current = Number(cell.dataset.velocity);
        const changes: Record<string, number> = {
          ArrowUp: 1,
          ArrowRight: 1,
          ArrowDown: -1,
          ArrowLeft: -1,
          PageUp: 10,
          PageDown: -10,
          Home: -current,
          End: 127 - current,
        };
        if (!(event.key in changes)) return;
        event.preventDefault();
        updateVelocityCell(cell, current + changes[event.key]);

        if (selectedTrack) {
          setTrackVelocity(
            selectedTrack,
            Number(cell.dataset.step),
            Number(cell.dataset.velocity),
          );
        }
      });
    });
  });
}
