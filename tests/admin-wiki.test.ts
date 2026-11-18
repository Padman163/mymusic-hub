// @vitest-environment node

import { readdir } from "node:fs/promises";
import { Window } from "happy-dom";
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

  it("beschriftet verschachtelte Markdown-Checkboxen mit dem eigenen Aufgabentext", async () => {
    const document = adminWikiDocuments.find((item) => item.sourcePath === "README.md");
    if (!document) throw new Error("README.md fehlt im Admin-Wiki.");
    const { code } = await renderAdminWikiDocument({
      ...document,
      source: "# Aufgaben\n\n- [ ] **Plan** bauen\n  - [x] Unterpunkt\n- [x] Datei [speichern](README.md)\n",
    });
    const window = new Window();
    try {
      const rendered = new window.DOMParser().parseFromString(code, "text/html");
      const checkboxes = [...rendered.querySelectorAll('input[type="checkbox"]')];
      expect(checkboxes.map((checkbox) => checkbox.getAttribute("aria-label"))).toEqual([
        "Plan bauen",
        "Unterpunkt",
        "Datei speichern",
      ]);
      expect(checkboxes.map((checkbox) => checkbox.hasAttribute("checked"))).toEqual([false, true, true]);
      expect(checkboxes.every((checkbox) => checkbox.hasAttribute("disabled"))).toBe(true);
    } finally {
      await window.happyDOM.close();
    }
  });

  it("rendert Markdown und funktionierende Anker ohne doppelte Hauptüberschrift", async () => {
    const document = adminWikiDocuments.find((item) => item.sourcePath === "README.md");
    if (!document) throw new Error("README.md fehlt im Admin-Wiki.");
    const { code } = await renderAdminWikiDocument(document);
    const window = new Window();
    try {
      const rendered = new window.DOMParser().parseFromString(code, "text/html");
      expect(rendered.querySelector("h1")).toBeNull();
      expect(rendered.querySelector("#dokumentation")).not.toBeNull();
      expect(rendered.querySelector('a[href="/admin-wiki/readme-testing/"]')).not.toBeNull();
      expect(rendered.querySelector("pre code")?.textContent).toContain("npm install");
    } finally {
      await window.happyDOM.close();
    }
  });
});
