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
  hint.textContent =
    "Pattern fokussieren und Leertaste halten: abspielen. Loslassen: stoppen.";
  controls.append(label, hint);
  pattern.prepend(controls);
  pattern.tabIndex = 0;
  pattern.setAttribute("role", "group");
  pattern.setAttribute(
    "aria-label",
    "Schlagzeug-Pattern. Leertaste halten zum Abspielen.",
  );

  const headers = pattern.querySelectorAll<HTMLElement>(
    ".pattern-header .step-number",
  );
  let run: AbortController | undefined;
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

  const start = async (): Promise<void> => {
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
    const { signal } = controller;
    const rows = pattern.querySelectorAll<HTMLElement>(
      ".track-row[data-sound-url]",
    );
    document.addEventListener(
      "keyup",
      (event) => {
        if (!isSpace(event)) return;
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
      if (!event.repeat) void start();
    },
    true,
  );
  pattern.addEventListener("focusout", (event) => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !pattern.contains(event.relatedTarget) ||
      !acceptsSpace(event.relatedTarget)
    )
      stop();
  });
}
