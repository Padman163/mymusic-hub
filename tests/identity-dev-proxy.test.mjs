// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProxy(netlifyDev, origin) {
  vi.resetModules();
  vi.stubEnv("NETLIFY_DEV", netlifyDev);
  vi.stubEnv("LOCAL_NETLIFY_IDENTITY_ORIGIN", origin);
  const { default: config } = await import("../astro.config.mjs");
  return config.vite.server.proxy;
}

describe("Identity-Proxy für Netlify Dev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leitet nur Identity-Anfragen an die konfigurierte Site weiter", async () => {
    const proxy = await loadProxy("true", "https://example.netlify.app");
    const [pattern, options] = Object.entries(proxy)[0];
    expect(new RegExp(pattern).test("/.netlify/identity/token")).toBe(true);
    expect(new RegExp(pattern).test("/api/modules")).toBe(false);
    expect(options.target).toBe("https://example.netlify.app");

    let onProxyRequest;
    options.configure({
      on(event, handler) {
        expect(event).toBe("proxyReq");
        onProxyRequest = handler;
      },
    });
    const request = { removeHeader: vi.fn(), setHeader: vi.fn() };
    onProxyRequest(request, { headers: { origin: "http://localhost:8888" } });
    expect(request.removeHeader).toHaveBeenCalledWith("cookie");
    expect(request.removeHeader).toHaveBeenCalledWith("referer");
    expect(request.setHeader).toHaveBeenCalledWith(
      "origin",
      "https://example.netlify.app",
    );
  });

  it("aktiviert die Weiterleitung nicht ohne Netlify Dev oder ohne Ziel", async () => {
    expect(await loadProxy("false", "https://example.netlify.app")).toBeUndefined();
    expect(await loadProxy("true", "")).toBeUndefined();
  });

  it("lehnt unsichere oder mit Zugangsdaten versehene Ziele ab", async () => {
    const message = "LOCAL_NETLIFY_IDENTITY_ORIGIN muss eine HTTPS-Site-Adresse";
    await expect(loadProxy("true", "http://example.netlify.app")).rejects.toThrow(message);
    await expect(loadProxy("true", "https://user:pass@example.netlify.app"))
      .rejects.toThrow(message);
    await expect(loadProxy("true", "https://example.netlify.app/path"))
      .rejects.toThrow(message);
  });
});
