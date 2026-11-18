import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminWikiDocuments, renderAdminWikiDocument, resolveAdminWikiLink } from "../src/lib/admin-wiki";

describe("Admin-Wiki", () => {
  it("nimmt alle Root- und Feature-READMEs ohne Kopien auf", async () => {
    const expected = (await Promise.all([".", "features"].map(async (directory) =>
      (await readdir(directory))
        .filter((name) => /^README.*\.md$/.test(name))
        .map((name) => directory === "." ? name : `${directory}/${name}`),
    ))).flat().sort();
    expect(adminWikiDocuments.map((document) => document.sourcePath).sort()).toEqual(expected);
    expect(new Set(adminWikiDocuments.map((document) => document.href)).size).toBe(expected.length);
  });

  it("erhält relative Dokumentlinks, Anker, Inhaltsseiten und externe URLs", () => {
    expect(resolveAdminWikiLink("../README_TESTING.md#dokumentationscheck", "features/README_FEAT.md"))
      .toBe("/admin-wiki/readme-testing/#dokumentationscheck");
    expect(resolveAdminWikiLink("README_FEAT_NOTATION.md", "features/README_FEAT.md"))
      .toBe("/admin-wiki/features/readme-feat-notation/");
    expect(resolveAdminWikiLink("src/content/docs/audio/theory/lernpfad.mdx", "README.md"))
      .toBe("/audio/theory/lernpfad/");
    expect(resolveAdminWikiLink("../public/sounds/drums/README.md", "features/README_FEAT.md"))
      .toBe("/sounds/drums/README.md");
    expect(resolveAdminWikiLink("#abschnitt", "README.md")).toBe("#abschnitt");
    expect(resolveAdminWikiLink("https://example.com/", "README.md")).toBe("https://example.com/");
    expect(resolveAdminWikiLink(".github/copilot-instructions.md", "README.md"))
      .toBe("https://github.com/Padman163/mymusic-hub/blob/main/.github/copilot-instructions.md");
  });

  it("rendert Markdown und funktionierende Anker ohne doppelte Hauptüberschrift", async () => {
    const document = adminWikiDocuments.find((item) => item.sourcePath === "README.md");
    if (!document) throw new Error("README.md fehlt im Admin-Wiki.");
    const { code } = await renderAdminWikiDocument(document);
    const rendered = new DOMParser().parseFromString(code, "text/html");
    expect(rendered.querySelector("h1")).toBeNull();
    expect(rendered.querySelector("#dokumentation")).not.toBeNull();
    expect(rendered.querySelector('a[href="/admin-wiki/readme-testing/"]')).not.toBeNull();
    expect(rendered.querySelector("pre code")?.textContent).toContain("npm install");
  });
});
