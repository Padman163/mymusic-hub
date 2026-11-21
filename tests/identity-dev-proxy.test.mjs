// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLocalIdentityProxy } from "../src/lib/local-identity-proxy.mjs";

describe("Identity-Proxy für Netlify Dev", () => {
  it("leitet nur Identity-Anfragen an die konfigurierte Site weiter", () => {
    const proxy = createLocalIdentityProxy("true", "https://example.netlify.app");
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

  it("aktiviert die Weiterleitung nicht ohne Netlify Dev oder ohne Ziel", () => {
    expect(createLocalIdentityProxy("false", "https://example.netlify.app")).toBeUndefined();
    expect(createLocalIdentityProxy("true", "")).toBeUndefined();
  });

  it("lehnt unsichere oder mit Zugangsdaten versehene Ziele ab", () => {
    const message = "LOCAL_NETLIFY_IDENTITY_ORIGIN muss eine HTTPS-Site-Adresse";
    expect(() => createLocalIdentityProxy("true", "http://example.netlify.app")).toThrow(message);
    expect(() => createLocalIdentityProxy("true", "https://user:pass@example.netlify.app"))
      .toThrow(message);
    expect(() => createLocalIdentityProxy("true", "https://example.netlify.app/path"))
      .toThrow(message);
  });
});
