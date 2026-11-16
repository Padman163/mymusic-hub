import { type Expression, parseExpressionAt } from "acorn";
import type { TheoryBlock } from "./module-schema.ts";

function literalValue(node: Expression): unknown {
  if (node.type === "Literal") {
    if (
      node.value === null ||
      typeof node.value === "string" ||
      typeof node.value === "boolean" ||
      (typeof node.value === "number" && Number.isFinite(node.value))
    ) {
      return node.value;
    }
  } else if (node.type === "ArrayExpression") {
    return node.elements.map((item) => {
      if (!item || item.type === "SpreadElement") {
        throw new Error("Leere Array-Einträge und Spread sind nicht erlaubt.");
      }
      return literalValue(item);
    });
  } else if (node.type === "ObjectExpression") {
    const result: Record<string, unknown> = Object.create(null);
    for (const property of node.properties) {
      if (
        property.type !== "Property" ||
        property.kind !== "init" ||
        property.method ||
        property.shorthand ||
        property.computed
      ) {
        throw new Error("Nur einfache Objekt-Eigenschaften sind erlaubt.");
      }
      const key =
        property.key.type === "Identifier"
          ? property.key.name
          : literalValue(property.key);
      if (typeof key !== "string" || key === "__proto__") {
        throw new Error("Ungültiger Objekt-Schlüssel.");
      }
      result[key] = literalValue(property.value);
    }
    return result;
  } else if (
    node.type === "UnaryExpression" &&
    (node.operator === "-" || node.operator === "+")
  ) {
    const value = literalValue(node.argument);
    if (typeof value === "number")
      return node.operator === "-" ? -value : value;
  }
  throw new Error("Nur feste Werte, Arrays und Objekte sind erlaubt.");
}

/** Liest ein selbstschließendes Notation-Element, ohne JavaScript auszuführen. */
export function parseTheoryNotation(
  input: string,
  start: number,
): { props: Record<string, unknown>; end: number } {
  let position = start + "<Notation".length;
  const props: Record<string, unknown> = Object.create(null);
  while (position < input.length) {
    while (/\s/.test(input[position] ?? "")) position += 1;
    if (input.slice(position, position + 2) === "/>") {
      return { props, end: position + 2 };
    }
    const name = /^[A-Za-z][A-Za-z0-9]*/.exec(input.slice(position))?.[0];
    if (!name || name in props)
      throw new Error("Ungültiger oder doppelter Prop-Name.");
    position += name.length;
    while (/\s/.test(input[position] ?? "")) position += 1;
    if (input[position] !== "=") {
      props[name] = true;
      continue;
    }
    position += 1;
    while (/\s/.test(input[position] ?? "")) position += 1;
    if (input[position] === "{") {
      const expression = parseExpressionAt(input, position + 1, {
        ecmaVersion: "latest",
      });
      props[name] = literalValue(expression);
      position = expression.end;
      while (/\s/.test(input[position] ?? "")) position += 1;
      if (input[position] !== "}") throw new Error("Schließende } fehlt.");
      position += 1;
    } else if (input[position] === '"' || input[position] === "'") {
      const expression = parseExpressionAt(input, position, {
        ecmaVersion: "latest",
      });
      if (
        expression.type !== "Literal" ||
        typeof expression.value !== "string"
      ) {
        throw new Error("Ein Textwert wird erwartet.");
      }
      props[name] = expression.value;
      position = expression.end;
    } else {
      throw new Error(
        "Prop-Werte müssen in Anführungszeichen oder {...} stehen.",
      );
    }
  }
  throw new Error("Das Notation-Element muss mit /> enden.");
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hasEquivalentNotation(
  markdown: string,
  props: unknown,
): boolean {
  const tokens = /(`+|\$\$|\$|<Notation(?=[\s/>]))/g;
  for (
    let match = tokens.exec(markdown);
    match;
    match = tokens.exec(markdown)
  ) {
    if (match[0] !== "<Notation") {
      const end = markdown.indexOf(match[0], tokens.lastIndex);
      if (end !== -1) tokens.lastIndex = end + match[0].length;
      continue;
    }
    if (match.index > 0 && markdown[match.index - 1] === "\\") continue;
    try {
      const parsed = parseTheoryNotation(markdown, match.index);
      if (canonicalValue(parsed.props) === canonicalValue(props)) return true;
      tokens.lastIndex = parsed.end;
    } catch {
      // Der Renderer zeigt ungültige Elemente mit einer Fehlermeldung an.
    }
  }
  return false;
}

/** Macht bisher getrennt gespeicherte Notationen im Editor bearbeitbar. */
export function notationToMarkdown(
  block: Partial<TheoryBlock>,
): Partial<TheoryBlock> {
  if (
    block.visualComponent !== "Notation" &&
    block.visualComponent !== "NotationVisual"
  ) {
    return block;
  }
  let props: unknown;
  try {
    props = block.visualPropsJson?.trim()
      ? JSON.parse(block.visualPropsJson)
      : {};
  } catch {
    return block;
  }
  if (!props || typeof props !== "object" || Array.isArray(props)) return block;
  if (Object.keys(props).some((key) => !/^[A-Za-z][A-Za-z0-9]*$/.test(key))) {
    return block;
  }
  const attributes = Object.entries(props)
    .map(([key, value]) => ` ${key}={${JSON.stringify(value)}}`)
    .join("");
  const content = block.markdownContent ?? "";
  const markdownContent = hasEquivalentNotation(content, props)
    ? content
    : [content.trimEnd(), `<Notation${attributes} />`]
        .filter(Boolean)
        .join("\n\n");
  return {
    ...block,
    markdownContent,
    visualComponent: undefined,
    visualPropsJson: undefined,
  };
}
