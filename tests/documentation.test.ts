import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("README-Dokumentation", () => {
  it("verweist auf vorhandene lokale Ziele und npm-Skripte", async () => {
    const files = (await readdir(root)).filter((name) =>
      /^README(?:_.*)?\.md$/.test(name),
    );
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
        const target = encodedPath ? decodeURIComponent(encodedPath.split("?")[0]) : file;
        const resolved = path.resolve(root, path.dirname(file), target);
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
});
