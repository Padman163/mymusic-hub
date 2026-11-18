import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { Root, RootContent } from "mdast";

const sources = import.meta.glob<string>(
  ["../../README*.md", "../../features/README*.md"],
  { query: "?raw", import: "default", eager: true },
);

export const adminWikiDocuments = Object.entries(sources)
  .map(([file, source]) => {
    const sourcePath = file.replace(/^\.\.\/\.\.\//, "");
    const slug = sourcePath
      .replace(/\.md$/, "")
      .replaceAll("_", "-")
      .toLowerCase();
    const title = /^#\s+(.+)$/m.exec(source)?.[1]?.trim();
    if (!title) throw new Error(`README ohne Hauptüberschrift: ${sourcePath}`);
    return { sourcePath, slug, title, source, href: `/admin-wiki/${slug}/` };
  })
  .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, "de"));

export function resolveAdminWikiLink(href: string, sourcePath: string): string {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return href;

  const resolved = new URL(href, `https://repository.invalid/${sourcePath}`);
  const target = decodeURIComponent(resolved.pathname.slice(1));
  const document = adminWikiDocuments.find(
    (item) => item.sourcePath === target,
  );
  const suffix = `${resolved.search}${resolved.hash}`;
  if (document) return `${document.href}${suffix}`;
  if (target.startsWith("src/content/docs/")) {
    const route = target
      .slice("src/content/docs/".length)
      .replace(/\.mdx?$/, "")
      .replace(/(?:^|\/)index$/, "");
    return `/${route}${route ? "/" : ""}${suffix}`;
  }
  if (target.startsWith("public/"))
    return `/${target.slice("public/".length)}${suffix}`;
  return `https://github.com/Padman163/mymusic-hub/blob/main/${resolved.pathname.slice(1)}${suffix}`;
}

export async function renderAdminWikiDocument(
  document: (typeof adminWikiDocuments)[number],
) {
  function rewriteLinks() {
    return (tree: Root) => {
      function walk(node: Root | RootContent) {
        if (
          node.type === "link" ||
          node.type === "definition" ||
          node.type === "image"
        ) {
          node.url = resolveAdminWikiLink(node.url, document.sourcePath);
        }
        if ("children" in node) node.children.forEach(walk);
      }
      walk(tree);
    };
  }

  const processor = await createMarkdownProcessor({
    remarkPlugins: [rewriteLinks],
  });
  return processor.render(document.source.replace(/^#\s+.+\r?\n/m, ""));
}
