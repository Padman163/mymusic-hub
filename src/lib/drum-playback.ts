import { addIcon } from "./contribution-types.ts";
import { drumAudioEngine } from "./drum-audio.ts";
import { DEFAULT_DRUM_PATTERN_PROPS } from "./module-schema.ts";
import { validateTimeSignature } from "./time-signature.ts";

function parseFraction(value: string): {
  numerator: number;
  denominator: number;
} {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(value.trim());
  const numerator = Number(match?.[1]);
  const denominator = Number(match?.[2]);
  if (
    !Number.isSafeInteger(numerator) ||
    numerator <= 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  ) {
    throw new Error(
      "Taktart und Auflösung müssen positive Brüche sein, z. B. 4/4 und 1/8.",
    );
  }
  return { numerator, denominator };
}

export function getDrumStepSeconds(
  bpm: number,
  resolution: string,
  timeSignature: string,
): number {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new Error("Bitte ein endliches Tempo größer 0 BPM eingeben.");
  }
  validateTimeSignature(parseFraction(timeSignature));
  const { numerator, denominator } = parseFraction(resolution);
  const seconds = (60 / bpm) * 4 * (numerator / denominator);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Tempo und Auflösung ergeben keine gültige Step-Dauer.");
  }
  return seconds;
}

const INPUT_SELECTOR =
  "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false'])";
const isSpace = (event: KeyboardEvent): boolean =>
  event.code === "Space" || event.key === " ";

export function attachDrumPatternPlayback(
  pattern: HTMLElement,
  setStatus: (message: string) => void,
): void {
  const document = pattern.ownerDocument;
  const window = document.defaultView;
  if (!window) return;
  const buttonContainer =
    pattern.dataset.showPlaybackButton === "false"
      ? null
      : pattern.querySelector<HTMLElement>(".pattern-header .header-spacer");
  const controls = document.createElement("div");
  controls.className = "drum-playback-controls";
  const label = document.createElement("label");
  label.className = "drum-playback-tempo";
  label.append("Tempo (Viertel-BPM)");
  const tempo = document.createElement("input");
  tempo.type = "number";
  tempo.min = "0";
  tempo.step = "any";
  tempo.required = true;
  tempo.value = pattern.dataset.bpm ?? String(DEFAULT_DRUM_PATTERN_PROPS.bpm);
  label.append(tempo);
  const hint = document.createElement("span");
  hint.className = "drum-playback-hint";
  hint.textContent = buttonContainer
    ? "Play/Stop oder Leertaste halten. Spurauswahl wird beim Start übernommen."
    : "Leertaste halten. Spurauswahl wird beim Start übernommen.";
  if (pattern.dataset.showTempo !== "false") controls.append(label);
  if (pattern.dataset.showPlaybackHint !== "false") controls.append(hint);
  if (controls.hasChildNodes()) pattern.prepend(controls);
  pattern.tabIndex = 0;
  pattern.setAttribute("role", "group");
  pattern.setAttribute(
    "aria-label",
    "Schlagzeug-Pattern. Leertaste halten zum Abspielen.",
  );

  const tracks = Array.from(
    pattern.querySelectorAll<HTMLElement>(".track-row:not(.velocity-row)"),
  );
  if (pattern.dataset.interactive === "true") {
    tracks.forEach((row) => {
      const header = row.querySelector<HTMLElement>(".track-info");
      const name = header?.querySelector<HTMLElement>(".track-name");
      if (!header || !name) return;
      row.removeAttribute("role");
      row.removeAttribute("aria-pressed");
      row.removeAttribute("tabindex");
      header.setAttribute("role", "group");
      header.setAttribute("aria-label", `Spur ${name.textContent}`);
      header.removeAttribute("aria-pressed");
      header.removeAttribute("tabindex");
      if (row.dataset.soundUrl) {
        name.dataset.audioTrigger = "true";
        name.setAttribute("role", "button");
        name.setAttribute("aria-label", `${name.textContent} abspielen`);
        name.tabIndex = 0;
      }
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "drum-track-toggle";
      checkbox.checked = row.classList.contains("highlighted");
      checkbox.setAttribute(
        "aria-label",
        `${name.textContent} für Pattern-Wiedergabe auswählen`,
      );
      header.prepend(checkbox);
      checkbox.addEventListener("change", () => {
        row.classList.toggle("highlighted", checkbox.checked);
      });
      header.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("input"))
          return;
        const selected = new Set(
          event.shiftKey
            ? tracks.filter((track) => track.classList.contains("highlighted"))
            : [],
        );
        if (event.shiftKey && selected.has(row)) selected.delete(row);
        else selected.add(row);
        tracks.forEach((track) => {
          const checked = selected.has(track);
          track.classList.toggle("highlighted", checked);
          const toggle =
            track.querySelector<HTMLInputElement>(".drum-track-toggle");
          if (toggle) toggle.checked = checked;
        });
      });
    });
  }

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "drum-playback-toggle";
  addIcon(playButton, ["M8 5L19 12L8 19Z"]);
  const icon = playButton.querySelector("svg");
  icon?.setAttribute("fill", "currentColor");
  icon?.setAttribute("stroke", "none");

  function setButtonPlaying(playing: boolean): void {
    const label = playing ? "Pattern stoppen" : "Pattern abspielen";
    playButton.setAttribute("aria-label", label);
    playButton.setAttribute("aria-pressed", String(playing));
    playButton.title = label;
    icon?.querySelector("path")?.setAttribute(
      "d",
      playing ? "M6 6h12v12H6Z" : "M8 5L19 12L8 19Z",
    );
  }

  setButtonPlaying(false);
  if (buttonContainer) {
    buttonContainer.removeAttribute("aria-hidden");
    buttonContainer.classList.add("has-playback-controls");
    buttonContainer.append(playButton);
  }
  const headers = pattern.querySelectorAll<HTMLElement>(
    ".pattern-header .step-number",
  );
  let run: AbortController | undefined;
  let playbackMode: "hold" | "toggle" | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visualTimers = new Set<ReturnType<typeof setTimeout>>();

  function clearPlayhead(): void {
    pattern
      .querySelectorAll(".is-current-step")
      .forEach((cell) => cell.classList.remove("is-current-step"));
  }

  function stop(): void {
    run?.abort();
    run = undefined;
    playbackMode = undefined;
    setButtonPlaying(false);
    clearTimeout(timer);
    visualTimers.forEach(clearTimeout);
    visualTimers.clear();
    clearPlayhead();
    delete pattern.dataset.playing;
  }

  function acceptsSpace(target: EventTarget | null): boolean {
    return target instanceof Element && !target.closest(INPUT_SELECTOR);
  }

  tempo.addEventListener("input", () => {
    stop();
    const valid =
      Number.isFinite(tempo.valueAsNumber) && tempo.valueAsNumber > 0;
    tempo.setCustomValidity(
      valid ? "" : "Bitte ein Tempo größer 0 BPM eingeben.",
    );
    tempo.setAttribute("aria-invalid", String(!valid));
    if (valid) pattern.dataset.bpm = tempo.value;
    setStatus(valid ? "" : "Bitte ein endliches Tempo größer 0 BPM eingeben.");
  });

  const start = async (mode: "hold" | "toggle"): Promise<void> => {
    if (run) return;
    let stepSeconds: number;
    try {
      stepSeconds = getDrumStepSeconds(
        tempo.valueAsNumber,
        pattern.dataset.resolution ?? DEFAULT_DRUM_PATTERN_PROPS.resolution,
        pattern.dataset.timeSignature ??
          DEFAULT_DRUM_PATTERN_PROPS.timeSignature,
      );
      if (!headers.length) throw new Error("Das Pattern enthält keine Steps.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      return;
    }

    const controller = new AbortController();
    run = controller;
    playbackMode = mode;
    setButtonPlaying(true);
    const { signal } = controller;
    const marked = tracks.filter((row) =>
      row.classList.contains("highlighted"),
    );
    const rows = (marked.length ? marked : tracks).filter(
      (row) => row.dataset.soundUrl,
    );
    document.addEventListener(
      "keyup",
      (event) => {
        if (!isSpace(event) || mode !== "hold") return;
        event.preventDefault();
        stop();
      },
      { capture: true, signal },
    );
    window.addEventListener("blur", stop, { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) stop();
      },
      { signal },
    );
    document.addEventListener("astro:before-swap", stop, { signal });

    const [unlocked] = await Promise.all([
      drumAudioEngine.unlock(),
      drumAudioEngine.preloadSounds(
        Array.from(rows, (row) => row.dataset.soundUrl ?? ""),
      ),
    ]);
    if (signal.aborted) return;
    if (!unlocked) {
      setStatus(
        "Audio konnte nicht aktiviert werden. Bitte die Browser-Audiofreigabe prüfen.",
      );
      stop();
      return;
    }
    pattern.dataset.playing = "true";
    setStatus("");
    let nextTime = drumAudioEngine.currentTime;
    let nextStep = 0;

    function schedule(): void {
      if (signal.aborted) return;
      if (!pattern.isConnected) {
        stop();
        return;
      }
      const now = drumAudioEngine.currentTime;
      // Nach einem blockierten Hauptthread verpasste Steps überspringen, nicht bündeln.
      if (nextTime < now) {
        const missed = Math.floor((now - nextTime) / stepSeconds);
        nextTime += missed * stepSeconds;
        nextStep = (nextStep + missed) % headers.length;
      }
      while (nextTime < now + 0.1) {
        const step = nextStep;
        const when = nextTime;
        rows.forEach((row) => {
          const cell = row.querySelector<HTMLElement>(
            `.step-cell[data-step="${step}"].active`,
          );
          const url = row.dataset.soundUrl;
          if (!cell || !url) return;
          const velocities: (number | null)[] = JSON.parse(
            row.dataset.soundVelocities ?? "[]",
          );
          void drumAudioEngine
            .playSound(url, velocities[step] ?? undefined, { when, signal })
            .then((played) => {
              if (played || signal.aborted) return;
              setStatus(
                "Sound nicht verfügbar. Browser-Audiofreigabe und Sounddatei prüfen; danach erneut versuchen.",
              );
              stop();
            });
        });
        const visualTimer = setTimeout(
          () => {
            visualTimers.delete(visualTimer);
            if (signal.aborted) return;
            clearPlayhead();
            headers[step].classList.add("is-current-step");
            pattern
              .querySelectorAll(`.step-cell[data-step="${step}"]`)
              .forEach((cell) => cell.classList.add("is-current-step"));
          },
          Math.max(0, (when - now) * 1000),
        );
        visualTimers.add(visualTimer);
        nextTime += stepSeconds;
        nextStep = (step + 1) % headers.length;
      }
      timer = setTimeout(schedule, 25);
    }
    schedule();
  };

  playButton.addEventListener("click", () => {
    if (run) stop();
    else void start("toggle");
  });
  pattern.addEventListener("pointerdown", (event) => {
    if (
      acceptsSpace(event.target) &&
      !(
        event.target instanceof Element &&
        event.target.closest("[data-audio-trigger]")
      )
    ) {
      pattern.focus({ preventScroll: true });
    }
  });
  pattern.addEventListener(
    "keydown",
    (event) => {
      if (
        !isSpace(event) ||
        !acceptsSpace(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) void start("hold");
    },
    true,
  );
  pattern.addEventListener("focusout", (event) => {
    if (playbackMode !== "hold" || event.relatedTarget === playButton) return;
    if (
      !(event.relatedTarget instanceof Node) ||
      !pattern.contains(event.relatedTarget) ||
      !acceptsSpace(event.relatedTarget)
    )
      stop();
  });
}
