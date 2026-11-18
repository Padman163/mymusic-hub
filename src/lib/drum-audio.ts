export class DrumAudioEngine {
  private context?: AudioContext;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer>>();

  private getContext(): AudioContext {
    if (typeof window === "undefined" || !window.AudioContext) {
      throw new Error("Web Audio ist in diesem Browser nicht verfügbar.");
    }
    this.context ??= new window.AudioContext({ latencyHint: "interactive" });
    return this.context;
  }

  private loadSound(url: string): Promise<AudioBuffer> {
    if (!url.trim()) return Promise.reject(new Error("Die Sound-URL fehlt."));
    const cached = this.buffers.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(url);
    if (pending) return pending;

    const loading = (async () => {
      const context = this.getContext();
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Sound konnte nicht geladen werden: HTTP ${response.status}`,
        );
      }
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      this.buffers.set(url, buffer);
      return buffer;
    })();
    this.loading.set(url, loading);
    void loading.then(
      () => this.loading.delete(url),
      () => this.loading.delete(url),
    );
    return loading;
  }

  async preloadSounds(urls: string[]): Promise<void> {
    await Promise.all(
      [...new Set(urls)].map(async (url) => {
        try {
          await this.loadSound(url);
        } catch (error) {
          console.warn(`[DrumAudio] Sound nicht verfügbar: ${url}`, error);
        }
      }),
    );
  }

  async unlock(): Promise<boolean> {
    try {
      const context = this.getContext();
      if (context.state !== "running") await context.resume();
      if (context.state !== "running") {
        throw new Error("Die Audiowiedergabe ist vom Browser blockiert.");
      }
      return true;
    } catch (error) {
      console.warn("[DrumAudio] Audio konnte nicht aktiviert werden.", error);
      return false;
    }
  }

  async playSound(url: string, velocity?: number): Promise<boolean> {
    try {
      if (velocity !== undefined && !Number.isFinite(velocity)) {
        throw new Error("Velocity muss eine endliche Zahl sein.");
      }
      const context = this.getContext();
      // resume() muss vor dem ersten await innerhalb der Nutzerinteraktion starten.
      if (context.state !== "running" && !(await this.unlock())) return false;
      const buffer = this.buffers.get(url) ?? (await this.loadSound(url));
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value =
        velocity === undefined ? 1 : Math.max(0, Math.min(127, velocity)) / 127;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      return true;
    } catch (error) {
      console.warn(
        `[DrumAudio] Sound konnte nicht abgespielt werden: ${url}`,
        error,
      );
      return false;
    }
  }
}

export const drumAudioEngine = new DrumAudioEngine();
