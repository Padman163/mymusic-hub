// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("node:child_process");
  vi.doUnmock("node:fs/promises");
  vi.restoreAllMocks();
});

describe("Netlify-Umgebung einrichten", () => {
  it("übergibt die Deploy-Abfrage ohne Shell und erhält bestehende Einträge", async () => {
    const siteId = "test-site-id";
    const spawnSync = vi.fn()
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({
          loggedIn: true,
          linked: true,
          siteData: { "site-id": siteId },
        }),
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{
          id: "preview",
          state: "ready",
          context: "deploy-preview",
          branch: "feature",
          published_at: "2026-01-01T00:00:00Z",
          deploy_ssl_url: "https://preview.example.com",
        }]),
      });
    const writeFile = vi.fn().mockResolvedValue(undefined);
    vi.doMock("node:child_process", () => ({ spawnSync }));
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue(
        "OTHER=value\nLOCAL_NETLIFY_ONLINE_DATA=false\n",
      ),
      writeFile,
    }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../scripts/setup-netlify-env.mjs");
    await vi.waitFor(() => expect(writeFile).toHaveBeenCalledOnce());

    expect(spawnSync).toHaveBeenCalledTimes(2);
    const [executable, args, options] = spawnSync.mock.calls[1];
    expect(executable).toBe(process.execPath);
    expect(args.slice(1)).toEqual([
      "api",
      "listSiteDeploys",
      "--data",
      JSON.stringify({ site_id: siteId, per_page: 100 }),
    ]);
    expect(options.shell).toBeUndefined();
    expect(writeFile.mock.calls[0][1]).toBe(
      "OTHER=value\nLOCAL_NETLIFY_IDENTITY_ORIGIN=https://preview.example.com\nLOCAL_NETLIFY_ONLINE_DATA=true\n",
    );
  });
});
