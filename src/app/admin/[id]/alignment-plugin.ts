/**
 * Paragraph alignment for MDXEditor.
 *
 * In the editor, alignment is a property of the paragraph or heading (Lexical's element
 * format), so it looks and behaves like a word processor: no wrapper box, and the toolbar
 * aligns exactly the blocks the cursor is in.
 *
 * In the MDX it is stored as `<Align to="center">…</Align>` around those blocks, which is
 * what the public site renders. This plugin translates between the two on import/export.
 */
import { addExportVisitor$, addImportVisitor$, realmPlugin, type LexicalExportVisitor, type MdastImportVisitor } from "@mdxeditor/editor";
import { $isHeadingNode, type HeadingNode } from "@lexical/rich-text";
import {
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  type ElementFormatType,
  type LexicalNode,
  type LineBreakNode,
  type ParagraphNode,
} from "lexical";
import type { Break } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

export const ALIGNABLE: ElementFormatType[] = ["center", "right"];

type AlignableNode = ParagraphNode | HeadingNode;

function isAlignable(node: LexicalNode | null | undefined): node is AlignableNode {
  return $isParagraphNode(node) || $isHeadingNode(node);
}

function attrTo(node: MdxJsxFlowElement): ElementFormatType {
  const attr = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "to");
  const v = attr && typeof attr.value === "string" ? attr.value : "";
  return v === "center" || v === "right" ? v : "left";
}

/** `<Align to="x">` whose children are only paragraphs/headings becomes formatted paragraphs. Anything else falls through to the JSX block editor. */
const alignImportVisitor: MdastImportVisitor<MdxJsxFlowElement> = {
  testNode: (node) =>
    node.type === "mdxJsxFlowElement" &&
    node.name === "Align" &&
    node.children.length > 0 &&
    node.children.every((c) => c.type === "paragraph" || c.type === "heading"),
  priority: 100,
  visitNode({ mdastNode, lexicalParent, actions }) {
    const to = attrTo(mdastNode);
    if (!$isElementNode(lexicalParent)) {
      actions.visitChildren(mdastNode, lexicalParent);
      return;
    }
    const before = lexicalParent.getChildrenSize();
    actions.visitChildren(mdastNode, lexicalParent);
    if (to === "left") return;
    for (const child of lexicalParent.getChildren().slice(before)) {
      if (isAlignable(child)) child.setFormat(to);
    }
  },
};

// Nodes currently being exported through the Align wrapper, so the visitor doesn't re-match them.
const exporting = new WeakSet<object>();

/** Paragraphs/headings with a center/right format export as `<Align to="…">` around the block. */
const alignExportVisitor: LexicalExportVisitor<AlignableNode, MdxJsxFlowElement> = {
  priority: 100,
  testLexicalNode: (node): node is AlignableNode =>
    isAlignable(node) && ALIGNABLE.includes(node.getFormatType()) && !exporting.has(node),
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    const align = actions.appendToParent(mdastParent, {
      type: "mdxJsxFlowElement",
      name: "Align",
      attributes: [{ type: "mdxJsxAttribute", name: "to", value: lexicalNode.getFormatType() }],
      children: [],
    }) as MdxJsxFlowElement;
    exporting.add(lexicalNode);
    try {
      actions.visit(lexicalNode, align);
    } finally {
      exporting.delete(lexicalNode);
    }
  },
  // Merge neighbouring blocks with the same alignment into one <Align>.
  shouldJoin: (prev, cur) =>
    prev.type === "mdxJsxFlowElement" &&
    prev.name === "Align" &&
    cur.type === "mdxJsxFlowElement" &&
    cur.name === "Align" &&
    attrTo(prev) === attrTo(cur),
  join: (prev, cur) => {
    const p = prev as unknown as MdxJsxFlowElement;
    const c = cur as unknown as MdxJsxFlowElement;
    return { ...p, children: [...p.children, ...c.children] } as unknown as typeof prev;
  },
};

/**
 * MDXEditor exports a line break (Shift+Enter, or an imported `\` break) as a bare newline,
 * which Markdown renders as a space. Export it as a real hard break instead, so multi-line
 * blocks like an address keep their lines on the site.
 */
const hardBreakExportVisitor: LexicalExportVisitor<LineBreakNode, Break> = {
  priority: 100,
  testLexicalNode: (node): node is LineBreakNode => $isLineBreakNode(node),
  visitLexicalNode({ mdastParent, actions }) {
    actions.appendToParent(mdastParent, { type: "break" });
  },
};

export const alignmentPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addImportVisitor$]: alignImportVisitor as MdastImportVisitor<never>,
      [addExportVisitor$]: [
        alignExportVisitor as LexicalExportVisitor<never, never>,
        hardBreakExportVisitor as LexicalExportVisitor<never, never>,
      ],
    });
  },
});
