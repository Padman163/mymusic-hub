import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrumAudioEngine, drumAudioEngine } from "../src/lib/drum-audio";
import {
  createDrumPatternElement,
  initializeDrumPatterns,
} from "../src/lib/drum-pattern";
import { getDrumPatternPropsErrors } from "../src/lib/module-schema";

function createSourceMock() {
  return {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
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

  it.each(["Enter", " "])("spielt mit %s genau einmal und ohne Seitenscrollen", (key) => {
    const pattern = render({ showVelocity: true });
    for (const selector of [".step-cell.active", ".track-info"]) {
      const target = cell(pattern, selector);
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
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
    }
    expect(drumAudioEngine.preloadSounds).not.toHaveBeenCalled();
    expect(drumAudioEngine.playSound).not.toHaveBeenCalled();
  });

  it("akzeptiert Audio-Props im Modul-Schema und weist ungültige Konfiguration zurück", () => {
    expect(getDrumPatternPropsErrors({ enableAudio: true, patternData: tracks })).toEqual([]);
    expect(getDrumPatternPropsErrors({ enableAudio: "true" }).join()).toContain("enableAudio");
    expect(getDrumPatternPropsErrors({ patternData: [{ ...tracks[0], soundUrl: "" }] }).join()).toContain("soundUrl");
  });
});
