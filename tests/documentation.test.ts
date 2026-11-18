import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".astro",
  ".git",
  ".netlify",
  "coverage",
  "dist",
  "node_modules",
  "test-results",
]);
const textExtensions = new Set([
  ".astro",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const citationMarkerPattern = String.raw`\[${"cite"}\b[^\]]*\]`;

async function findCitationMarkers(
  directory: string,
  relativeDirectory: string,
  includeExtensionlessFiles = false,
): Promise<string[]> {
  const violations: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        violations.push(
          ...(await findCitationMarkers(fullPath, relativePath, includeExtensionlessFiles)),
        );
      }
      continue;
    }

    if (
      !entry.isFile() ||
      (!includeExtensionlessFiles &&
        !textExtensions.has(path.extname(entry.name).toLowerCase()))
    ) {
      continue;
    }

    const content = await readFile(fullPath, "utf8");
    const matches = [...content.matchAll(new RegExp(citationMarkerPattern, "gi"))];
    if (matches.length > 0) {
      violations.push(`${relativePath}: ${matches.length} Quellenmarker`);
    }
  }
  return violations;
}

async function findLocalBlobCitationMarkers(): Promise<string[]> {
  const entriesPath = path.join(root, ".netlify", "blobs-serve", "entries");
  try {
    await stat(entriesPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return findCitationMarkers(entriesPath, path.join(".netlify", "blobs-serve", "entries"), true);
}

describe("README-Dokumentation", () => {
  it("verweist auf vorhandene lokale Ziele und npm-Skripte", async () => {
    const files = (
      await Promise.all(
        ["", "features"].map(async (dir) =>
          (await readdir(path.join(root, dir)))
            .filter((name) => /^README(?:_.*)?\.md$/.test(name))
            .map((name) => path.join(dir, name)),
        ),
      )
    ).flat();
    files.push(".github/copilot-instructions.md");
    const processor = await createMarkdownProcessor({ syntaxHighlight: false });
    const documents = new Map<string, Document>();
    for (const file of files) {
      const { code } = await processor.render(
        await readFile(path.join(root, file), "utf8"),
      );
      documents.set(file, new DOMParser().parseFromString(code, "text/html"));
    }

    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const errors: string[] = [];

    for (const [file, doc] of documents) {
      for (const link of doc.querySelectorAll("a[href]")) {
        const href = link.getAttribute("href") ?? "";
        if (!href || href === "#" || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
        const [encodedPath, encodedFragment] = href.split("#", 2);
        const target = decodeURIComponent(encodedPath.split("?")[0]);
        const resolved = target
          ? path.resolve(root, path.dirname(file), target)
          : path.resolve(root, file);
        try {
          await stat(resolved);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          errors.push(`${file}: Ziel fehlt: ${href}`);
          continue;
        }
        if (encodedFragment && path.extname(resolved) === ".md") {
          const targetFile = path.relative(root, resolved);
          let targetDoc = documents.get(targetFile);
          if (!targetDoc) {
            const { code } = await processor.render(await readFile(resolved, "utf8"));
            targetDoc = new DOMParser().parseFromString(code, "text/html");
            documents.set(targetFile, targetDoc);
          }
          if (!targetDoc.getElementById(decodeURIComponent(encodedFragment))) {
            errors.push(`${file}: Abschnitt fehlt: ${href}`);
          }
        }
      }

      for (const code of doc.querySelectorAll("code")) {
        for (const match of (code.textContent ?? "").matchAll(/\bnpm run ([\w:-]+)/g)) {
          if (!(match[1] in pkg.scripts)) {
            errors.push(`${file}: npm-Skript fehlt: ${match[1]}`);
          }
        }
      }
    }

    expect(errors).toEqual([]);
  });

  it("enthält keine Quellenmarker in Projekttexten oder lokalen Modul-Blobs", async () => {
    const violations = [
      ...(await findCitationMarkers(root, ".", false)),
      ...(await findLocalBlobCitationMarkers()),
    ];

    expect(violations).toEqual([]);
  });
});
