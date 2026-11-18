import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrumAudioEngine, drumAudioEngine } from "../src/lib/drum-audio";
import {
  createDrumPatternElement,
  initializeDrumPatterns,
} from "../src/lib/drum-pattern";
import { getDrumStepSeconds } from "../src/lib/drum-playback";
import { getDrumPatternPropsErrors } from "../src/lib/module-schema";

function createSourceMock() {
  return {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: () => {},
  };
}

function createGainMock() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = "running";
  currentTime = 0;
  destination = {};
  buffer = {};
  sources: ReturnType<typeof createSourceMock>[] = [];
  gains: ReturnType<typeof createGainMock>[] = [];
  decodeAudioData = vi.fn(async () => this.buffer);
  resume = vi.fn(async () => {
    this.state = "running";
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createBufferSource() {
    const source = createSourceMock();
    this.sources.push(source);
    return source;
  }

  createGain() {
    const gain = createGainMock();
    this.gains.push(gain);
    return gain;
  }
}

beforeEach(() => {
  MockAudioContext.instances = [];
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ArrayBuffer(8))));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("DrumAudioEngine", () => {
  it("lädt und decodiert identische URLs auch bei parallelem Preloading nur einmal", async () => {
    const engine = new DrumAudioEngine();
    await Promise.all([
      engine.preloadSounds(["/kick.wav", "/kick.wav"]),
      engine.preloadSounds(["/kick.wav", "/snare.ogg"]),
    ]);
    await engine.preloadSounds(["/kick.wav"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(MockAudioContext.instances).toHaveLength(1);
    const context = MockAudioContext.instances[0];
    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);

    const first = engine.playSound("/kick.wav");
    const second = engine.playSound("/kick.wav");
    // Bei laufendem Context und Cache-Treffer startet jeder Schlag synchron.
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0].start).toHaveBeenCalledOnce();
    expect(context.sources[1].start).toHaveBeenCalledOnce();
    expect(context.sources[0]).not.toBe(context.sources[1]);
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(context.sources[0].buffer).toBe(context.buffer);
    expect(context.sources[0].connect).toHaveBeenCalledWith(context.gains[0]);
    expect(context.gains[0].connect).toHaveBeenCalledWith(context.destination);
    context.sources[0].onended();
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce();
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    [0, 0],
    [64, 64 / 127],
    [127, 1],
    [undefined, 1],
    [-1, 0],
    [200, 1],
  ])("bildet Velocity %s auf Gain %s ab", async (velocity, gain) => {
    const engine = new DrumAudioEngine();
    expect(await engine.playSound("/kick.wav", velocity)).toBe(true);
    expect(MockAudioContext.instances[0].gains[0].gain.value).toBe(gain);
  });

  it("entsperrt den Context vor dem Laden in der Nutzerinteraktion", async () => {
    const engine = new DrumAudioEngine();
    await engine.preloadSounds(["/kick.wav"]);
    const context = MockAudioContext.instances[0];
    context.state = "suspended";
    const playing = engine.playSound("/kick.wav");
    expect(context.resume).toHaveBeenCalledOnce();
    expect(await playing).toBe(true);
  });

  it("plant Sounds auf der Audiouhr und stoppt nur die zugehörige Wiedergabe", async () => {
    const engine = new DrumAudioEngine();
    const first = new AbortController();
    const second = new AbortController();
    await engine.playSound("/kick.wav", 127, { when: 0.5, signal: first.signal });
    await engine.playSound("/snare.wav", 64, { when: 1, signal: second.signal });
    const context = MockAudioContext.instances[0];
    expect(context.sources[0].start).toHaveBeenCalledWith(0.5);
    expect(context.sources[1].start).toHaveBeenCalledWith(1);
    first.abort();
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce();
    expect(context.sources[1].stop).not.toHaveBeenCalled();
    context.sources[1].onended();
    second.abort();
    expect(context.sources[1].stop).not.toHaveBeenCalled();
  });

  it("spielt nach Loslassen während eines Ladevorgangs keinen verspäteten Sound", async () => {
    const engine = new DrumAudioEngine();
    const controller = new AbortController();
    let finishLoad!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const playing = engine.playSound("/kick.wav", 127, { signal: controller.signal });
    controller.abort();
    finishLoad(new Response(new ArrayBuffer(8)));
    expect(await playing).toBe(false);
    expect(MockAudioContext.instances[0].sources).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("meldet fehlende und ungültige Sounds und erlaubt einen erneuten Ladeversuch", async () => {
    const engine = new DrumAudioEngine();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(engine.preloadSounds(["/missing.wav"])).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("/missing.wav"), expect.any(Error),
    );
    expect(await engine.playSound("/missing.wav")).toBe(true);
    expect(await engine.playSound(" ")).toBe(false);
    const context = MockAudioContext.instances[0];
    context.decodeAudioData.mockRejectedValueOnce(new Error("Ungültiges Audio"));
    expect(await engine.playSound("/invalid.mp3")).toBe(false);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Netzwerkfehler"));
    expect(await engine.playSound("/offline.ogg")).toBe(false);
    expect(context.sources).toHaveLength(1);
  });

  it("stürzt bei blockiertem Audio nicht ab und kann danach erneut entsperren", async () => {
    const engine = new DrumAudioEngine();
    await engine.preloadSounds(["/kick.wav"]);
    const context = MockAudioContext.instances[0];
    context.state = "suspended";
    context.resume.mockRejectedValueOnce(new Error("NotAllowedError"));
    expect(await engine.playSound("/kick.wav")).toBe(false);
    expect(context.sources).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
    expect(await engine.playSound("/kick.wav")).toBe(true);
  });

  it("meldet auch eine ohne Freigabe aufgelöste resume-Anfrage", async () => {
    const engine = new DrumAudioEngine();
    await engine.preloadSounds(["/kick.wav"]);
    const context = MockAudioContext.instances[0];
    context.state = "suspended";
    context.resume.mockImplementationOnce(async () => {});
    expect(await engine.playSound("/kick.wav")).toBe(false);
    expect(context.sources).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it.each(["SSR", "Browser ohne Web Audio"])("behandelt %s ohne Absturz", async (environment) => {
    if (environment === "SSR") vi.stubGlobal("window", undefined);
    else vi.stubGlobal("AudioContext", undefined);
    const engine = new DrumAudioEngine();
    await expect(engine.preloadSounds(["/kick.wav"])).resolves.toBeUndefined();
    expect(await engine.playSound("/kick.wav")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("Drum-Step-Timing (BPM = Viertelnoten)", () => {
  it.each([
    [120, "1/8", "4/4", 8, 0.25, 2],
    [60, "1/4", "4/4", 4, 1, 4],
    [120, "1/16", "4/4", 16, 0.125, 2],
    [120, "1/8", "3/4", 6, 0.25, 1.5],
    [120, "1/8", "6/8", 6, 0.25, 1.5],
    [120, "1/12", "4/4", 12, 1 / 6, 2],
  ] as const)("berechnet %s BPM, %s, %s korrekt", (bpm, resolution, signature, steps, seconds, loopSeconds) => {
    const duration = getDrumStepSeconds(bpm, resolution, signature);
    expect(duration).toBeCloseTo(seconds, 10);
    expect(duration * steps).toBeCloseTo(loopSeconds, 10);
  });

  it.each([
    [0, "1/8", "4/4"],
    [Number.NaN, "1/8", "4/4"],
    [120, "0/8", "4/4"],
    [120, "1/0", "4/4"],
    [120, "Achtel", "4/4"],
    [120, "1/8", "3/7"],
  ] as const)("weist ungültiges Timing zurück (%s, %s, %s)", (bpm, resolution, signature) => {
    expect(() => getDrumStepSeconds(bpm, resolution, signature)).toThrow();
  });
});

describe("DrumPattern-Audiobedienung", () => {
  const tracks = [
    { name: "Kick", note: "C1", color: "#f00", activeSteps: [0, 2], velocities: [64, 0, 0], soundUrl: "/kick.wav" },
    { name: "Snare", note: "D1", color: "#f90", activeSteps: [0], soundUrl: "/snare.wav" },
    { name: "Stumm", note: "E1", color: "#ff0", activeSteps: [0] },
  ];

  function render(props = {}) {
    document.body.innerHTML = '<div hidden data-visual-template="DrumPattern"><div class="studio-one-pattern"></div></div>';
    const pattern = createDrumPatternElement({
      steps: 4, interactive: false, patternData: tracks, ...props,
    });
    document.body.append(pattern);
    return pattern;
  }

  function cell(pattern: HTMLElement, selector: string): HTMLElement {
    const element = pattern.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Testelement fehlt: ${selector}`);
    return element;
  }

  beforeEach(() => {
    vi.spyOn(drumAudioEngine, "preloadSounds").mockResolvedValue();
    vi.spyOn(drumAudioEngine, "playSound").mockResolvedValue(true);
    vi.spyOn(drumAudioEngine, "unlock").mockResolvedValue(true);
    vi.spyOn(drumAudioEngine, "currentTime", "get").mockImplementation(() => Date.now() / 1000);
  });

  it("lädt vor, spielt nur aktive Audiozellen und Header, ohne doppelte Listener", async () => {
    vi.useFakeTimers();
    const pattern = render();
    initializeDrumPatterns(pattern);
    expect(drumAudioEngine.preloadSounds).toHaveBeenCalledExactlyOnceWith(["/kick.wav", "/snare.wav"]);
    const active = cell(pattern, ".step-cell.active");
    expect(active.getAttribute("role")).toBe("button");
    expect(active.getAttribute("aria-label")).toContain("Kick, Step 1");
    expect(active.tabIndex).toBe(0);
    active.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(drumAudioEngine.unlock).toHaveBeenCalledOnce();
    active.click();
    expect(drumAudioEngine.playSound).toHaveBeenLastCalledWith("/kick.wav", 64);
    await Promise.resolve();
    expect(active.classList.contains("is-playing")).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(active.classList.contains("is-playing")).toBe(false);
    cell(pattern, ".step-cell[data-step='1']").click();
    cell(pattern, ".track-row:nth-child(3) .step-cell").click();
    expect(drumAudioEngine.playSound).toHaveBeenCalledOnce();
    cell(pattern, ".track-info").click();
    expect(drumAudioEngine.playSound).toHaveBeenLastCalledWith("/kick.wav", undefined);
    cell(pattern, ".step-cell[data-step='2']").click();
    expect(drumAudioEngine.playSound).toHaveBeenLastCalledWith("/kick.wav", 0);
    cell(pattern, ".track-row:nth-child(2) .step-cell").click();
    expect(drumAudioEngine.playSound).toHaveBeenLastCalledWith("/snare.wav", undefined);
  });

  it("spielt einzelne Sounds mit Enter genau einmal und ohne Seitenscrollen", () => {
    const pattern = render({ showVelocity: true });
    for (const selector of [".step-cell.active", ".track-info"]) {
      const target = cell(pattern, selector);
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(drumAudioEngine.playSound).toHaveBeenCalledTimes(2);
    expect(cell(pattern, ".track-row").hasAttribute("role")).toBe(false);
    expect(cell(pattern, ".track-info").getAttribute("aria-pressed")).toBe("true");
  });

  it("erhält den Editor und berücksichtigt geänderte Velocity-Werte", () => {
    const pattern = render({ interactive: true, showVelocity: true });
    const active = cell(pattern, ".step-cell.active");
    const slider = cell(pattern, ".velocity-cell");
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    active.click();
    expect(drumAudioEngine.playSound).toHaveBeenLastCalledWith("/kick.wav", 127);
    expect(active.classList.contains("active")).toBe(false);
    expect(active.hasAttribute("role")).toBe(false);
    active.click();
    expect(drumAudioEngine.playSound).toHaveBeenCalledOnce();
    expect(active.getAttribute("role")).toBe("button");
  });

  it("zeigt einen Wiedergabefehler und entfernt ihn nach erfolgreichem Versuch", async () => {
    vi.mocked(drumAudioEngine.playSound).mockResolvedValueOnce(false);
    const pattern = render();
    const active = cell(pattern, ".step-cell.active");
    active.click();
    await Promise.resolve();
    expect(cell(pattern, "[role='status']").hidden).toBe(false);
    expect(cell(pattern, "[role='status']").textContent).toContain("Sound nicht verfügbar");
    active.click();
    await Promise.resolve();
    expect(cell(pattern, "[role='status']").hidden).toBe(true);
  });

  it("belässt Patterns ohne Sounds sowie enableAudio=false ohne Audio-UI oder Aufrufe", () => {
    for (const props of [
      { enableAudio: false },
      { patternData: tracks.map(({ soundUrl: _soundUrl, ...track }) => track) },
    ]) {
      const pattern = render(props);
      cell(pattern, ".step-cell.active").click();
      expect(pattern.querySelector("[data-audio-trigger]")).toBeNull();
      expect(pattern.querySelector(".drum-audio-help")).toBeNull();
      expect(pattern.querySelector(".drum-playback-controls")).toBeNull();
    }
    expect(drumAudioEngine.preloadSounds).not.toHaveBeenCalled();
    expect(drumAudioEngine.playSound).not.toHaveBeenCalled();
  });

  it("akzeptiert Audio-Props im Modul-Schema und weist ungültige Konfiguration zurück", () => {
    expect(getDrumPatternPropsErrors({ enableAudio: true, patternData: tracks })).toEqual([]);
    expect(getDrumPatternPropsErrors({ enableAudio: "true" }).join()).toContain("enableAudio");
    expect(getDrumPatternPropsErrors({ patternData: [{ ...tracks[0], soundUrl: "" }] }).join()).toContain("soundUrl");
    expect(getDrumPatternPropsErrors({ bpm: 93.5 })).toEqual([]);
    for (const bpm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "120"]) {
      expect(getDrumPatternPropsErrors({ bpm }).join()).toContain("bpm");
    }
  });

  describe("Haltewiedergabe", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
    });

    function space(target: HTMLElement, repeat = false): KeyboardEvent {
      const event = new KeyboardEvent("keydown", { key: " ", code: "Space", repeat, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    }

    it("überspringt Step 1 nicht, wenn die Audiouhr vor dem ersten Scheduler-Aufruf weiterläuft", async () => {
      vi.spyOn(drumAudioEngine, "currentTime", "get")
        .mockReturnValueOnce(0)
        .mockReturnValue(0.001);
      const pattern = render();
      space(pattern);
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.mocked(drumAudioEngine.playSound).mock.calls.map(([url, , options]) =>
        [url, options?.when],
      )).toEqual([["/kick.wav", 0], ["/snare.wav", 0]]);
    });

    it("spielt alle Spuren synchron, durchläuft Pausen, loopt und startet nach Loslassen bei Step 1", async () => {
      const pattern = render({
        resolution: "1/4", bpm: 120,
        patternData: [
          { ...tracks[0], activeSteps: [0, 1, 3], velocities: [127, 64, 0, 90] },
          { ...tracks[1], activeSteps: [0, 3] },
        ],
      });
      pattern.focus();
      expect(space(pattern).defaultPrevented).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(pattern.dataset.playing).toBe("true");
      expect(cell(pattern, ".step-number").classList.contains("is-current-step")).toBe(true);
      await vi.advanceTimersByTimeAsync(500);
      expect(cell(pattern, ".pattern-header .step-number:nth-of-type(3)").classList.contains("is-current-step")).toBe(true);
      await vi.advanceTimersByTimeAsync(1425);
      expect(vi.mocked(drumAudioEngine.playSound).mock.calls.map(([url, velocity, options]) =>
        [url, velocity, options?.when],
      )).toEqual([
        ["/kick.wav", 127, 0], ["/snare.wav", undefined, 0],
        ["/kick.wav", 64, 0.5],
        ["/kick.wav", 90, 1.5], ["/snare.wav", undefined, 1.5],
        ["/kick.wav", 127, 2], ["/snare.wav", undefined, 2],
      ]);
      const signal = vi.mocked(drumAudioEngine.playSound).mock.calls[0][2]?.signal;
      document.dispatchEvent(new KeyboardEvent("keyup", { key: " ", cancelable: true }));
      expect(signal?.aborted).toBe(true);
      expect(pattern.dataset.playing).toBeUndefined();
      expect(pattern.querySelector(".is-current-step")).toBeNull();
      await vi.advanceTimersByTimeAsync(1000);
      expect(drumAudioEngine.playSound).toHaveBeenCalledTimes(7);
      space(pattern);
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.mocked(drumAudioEngine.playSound).mock.calls.slice(-2).map(([url, , options]) =>
        [url, options?.when],
      )).toEqual([["/kick.wav", 2.925], ["/snare.wav", 2.925]]);
      expect(cell(pattern, ".step-number").classList.contains("is-current-step")).toBe(true);
    });

    it("übernimmt das BPM-Feld und verhindert ungültiges Tempo", async () => {
      const pattern = render({ resolution: "1/4", patternData: [{ ...tracks[0], activeSteps: [0, 1] }] });
      const tempo = pattern.querySelector<HTMLInputElement>("input");
      if (!tempo) throw new Error("BPM-Feld fehlt");
      expect(tempo.value).toBe("120");
      tempo.value = "0";
      tempo.dispatchEvent(new Event("input"));
      space(pattern);
      await vi.advanceTimersByTimeAsync(0);
      expect(drumAudioEngine.playSound).not.toHaveBeenCalled();
      expect(tempo.getAttribute("aria-invalid")).toBe("true");
      expect(cell(pattern, "[role='status']").hidden).toBe(false);
      tempo.value = "60";
      tempo.dispatchEvent(new Event("input"));
      space(pattern);
      await vi.advanceTimersByTimeAsync(925);
      expect(vi.mocked(drumAudioEngine.playSound).mock.calls.map(([, , options]) => options?.when)).toEqual([0, 1]);
      expect(cell(pattern, "[role='status']").hidden).toBe(true);
    });

    it("ignoriert Tastenwiederholungen, verändert keine Zellen und startet nicht außerhalb des Patterns oder in Feldern", async () => {
      const pattern = render({ interactive: true, showVelocity: true });
      const target = cell(pattern, ".step-cell.active");
      const before = Array.from(pattern.querySelectorAll(".step-cell"), (cell) => cell.classList.contains("active"));
      expect(space(document.body).defaultPrevented).toBe(false);
      expect(space(cell(pattern, "input")).defaultPrevented).toBe(false);
      expect(drumAudioEngine.unlock).not.toHaveBeenCalled();
      target.focus();
      space(target);
      space(target, true);
      await vi.advanceTimersByTimeAsync(500);
      expect(drumAudioEngine.unlock).toHaveBeenCalledOnce();
      expect(Array.from(pattern.querySelectorAll(".step-cell"), (cell) => cell.classList.contains("active"))).toEqual(before);
    });

    it.each(["blur", "focus", "navigation", "removed", "hidden"])("stoppt bei %s samt bereits vorgeplanten Sounds", async (reason) => {
      const pattern = render();
      pattern.focus();
      space(pattern);
      await vi.advanceTimersByTimeAsync(0);
      const signal = vi.mocked(drumAudioEngine.playSound).mock.calls[0][2]?.signal;
      if (reason === "blur") window.dispatchEvent(new Event("blur"));
      if (reason === "focus") {
        const other = document.createElement("button");
        document.body.append(other);
        other.focus();
      }
      if (reason === "navigation") document.dispatchEvent(new Event("astro:before-swap"));
      if (reason === "removed") pattern.remove();
      if (reason === "hidden") {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
      }
      await vi.advanceTimersByTimeAsync(25);
      expect(signal?.aborted).toBe(true);
      const count = vi.mocked(drumAudioEngine.playSound).mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(drumAudioEngine.playSound).toHaveBeenCalledTimes(count);
    });

    it("startet nach Loslassen während der Audiofreigabe nicht verspätet", async () => {
      let unlock!: (unlocked: boolean) => void;
      vi.mocked(drumAudioEngine.unlock).mockImplementationOnce(() => new Promise((resolve) => {
        unlock = resolve;
      }));
      const pattern = render();
      space(pattern);
      document.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
      unlock(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(drumAudioEngine.playSound).not.toHaveBeenCalled();
      expect(pattern.dataset.playing).toBeUndefined();
    });

    it("meldet Audiofehler und beendet den Loop", async () => {
      vi.mocked(drumAudioEngine.playSound).mockResolvedValue(false);
      const pattern = render();
      space(pattern);
      await vi.advanceTimersByTimeAsync(0);
      expect(cell(pattern, "[role='status']").hidden).toBe(false);
      expect(pattern.dataset.playing).toBeUndefined();
      const count = vi.mocked(drumAudioEngine.playSound).mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(drumAudioEngine.playSound).toHaveBeenCalledTimes(count);
    });
  });
});
