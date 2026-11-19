import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { RootContent as HtmlContent, Root as HtmlRoot } from "hast";
import type { Root, RootContent } from "mdast";

function labelTaskLists() {
  return (tree: HtmlRoot) => {
    function taskText(node: HtmlRoot | HtmlContent): string {
      if (node.type === "text") return node.value;
      if (node.type === "element" && ["ul", "ol"].includes(node.tagName))
        return "";
      if ("children" in node) return node.children.map(taskText).join(" ");
      return "";
    }

    function walk(node: HtmlRoot | HtmlContent, label?: string) {
      if (node.type === "element") {
        if (node.tagName === "li") {
          const classes = node.properties.className;
          label =
            Array.isArray(classes) && classes.includes("task-list-item")
              ? taskText(node).replace(/\s+/g, " ").trim()
              : undefined;
        }
        if (
          node.tagName === "input" &&
          node.properties.type === "checkbox" &&
          !node.properties.ariaLabel &&
          !node.properties.ariaLabelledBy &&
          label
        ) {
          node.properties.ariaLabel = label;
        }
      }
      if ("children" in node) {
        node.children.forEach((child) => walk(child, label));
      }
    }
    walk(tree);
  };
}

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
    rehypePlugins: [labelTaskLists],
    shikiConfig: { theme: "github-dark-high-contrast" },
  });
  return processor.render(document.source.replace(/^#\s+.+\r?\n/m, ""));
}
