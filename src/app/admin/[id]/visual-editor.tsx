"use client";

import "@mdxeditor/editor/style.css";
import {
  activeEditor$,
  rootEditor$,
  useCellValues,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  Button,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  insertJsx$,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  StrikeThroughSupSubToggles,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  NestedLexicalEditor,
  UndoRedo,
  useMdastNodeUpdater,
  usePublisher,
  type JsxComponentDescriptor,
  type JsxEditorProps,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import { $isHeadingNode } from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createRangeSelection,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  type ElementFormatType,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { useRef, useState } from "react";
import { alignmentPlugin } from "./alignment-plugin";

// ---------- Custom block editors ----------

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "list",
  "blockquote",
  "code",
  "thematicBreak",
  "mdxJsxFlowElement",
  "html",
]);

/** `<Label>Intro</Label>` holds bare inline text; `<Card>` holds paragraphs. Pick the nested editor mode to match. */
function hasBlockChildren(node: MdxJsxFlowElement): boolean {
  return node.children.length === 0 || node.children.every((c) => BLOCK_TYPES.has(c.type));
}

/** Generic frame: a tag chip plus the block's content as an editable nested document. */
function FramedEditor({ mdastNode, descriptor }: JsxEditorProps) {
  const name = descriptor.name ?? "Block";
  const block = hasBlockChildren(mdastNode as MdxJsxFlowElement);
  return (
    <div className={`jsx-block jsx-${name.toLowerCase()}`}>
      <span className="jsx-tag">{name}</span>
      <NestedLexicalEditor<MdxJsxFlowElement>
        block={block}
        getContent={(node) => node.children}
        getUpdatedMdastNode={(node, children) => ({ ...node, children } as MdxJsxFlowElement)}
      />
    </div>
  );
}

function attrValue(node: MdxJsxFlowElement, name: string): string {
  const attr = node.attributes.find((a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === name);
  return typeof attr?.value === "string" ? attr.value : "";
}

/** One editable field of a JSX block's props. Commits on blur/Enter so typing stays snappy. */
function PropField({
  node,
  name,
  placeholder,
  className,
}: {
  node: MdxJsxFlowElement;
  name: string;
  placeholder: string;
  className?: string;
}) {
  const update = useMdastNodeUpdater<MdxJsxFlowElement>();
  const [value, setValue] = useState(() => attrValue(node, name));
  const commit = () => {
    const clean = value.trim();
    if (clean !== value) setValue(clean);
    if (clean === attrValue(node, name)) return;
    const attributes = node.attributes.filter((a) => !(a.type === "mdxJsxAttribute" && a.name === name));
    attributes.push({ type: "mdxJsxAttribute", name, value: clean });
    update({ attributes });
  };
  return (
    <input
      className={className}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Project row: number, title and link inline, description below. */
function ProjectEditor({ mdastNode }: JsxEditorProps) {
  const node = mdastNode as MdxJsxFlowElement;
  const block = hasBlockChildren(node);
  return (
    <div className="jsx-block jsx-project">
      <div className="jsx-block-head">
        <span className="jsx-tag">Project</span>
        <PropField node={node} name="n" placeholder="No." className="jsx-field jsx-field-n" />
        <PropField node={node} name="title" placeholder="Project title" className="jsx-field jsx-field-title" />
        <PropField node={node} name="href" placeholder="https://link (optional)" className="jsx-field jsx-field-href" />
      </div>
      <NestedLexicalEditor<MdxJsxFlowElement>
        block={block}
        getContent={(n) => n.children}
        getUpdatedMdastNode={(n, children) => ({ ...n, children } as MdxJsxFlowElement)}
      />
    </div>
  );
}

const ALIGNMENTS = ["left", "center", "right"] as const;

/** Alignment block: segmented left/center/right control plus the aligned content. */
function AlignEditor({ mdastNode }: JsxEditorProps) {
  const node = mdastNode as MdxJsxFlowElement;
  const update = useMdastNodeUpdater<MdxJsxFlowElement>();
  const current = attrValue(node, "to") || "left";
  const block = hasBlockChildren(node);
  const setTo = (to: string) => {
    const attributes = node.attributes.filter((a) => !(a.type === "mdxJsxAttribute" && a.name === "to"));
    attributes.push({ type: "mdxJsxAttribute", name: "to", value: to });
    update({ attributes });
  };
  return (
    <div className={`jsx-block jsx-align jsx-align-${current}`}>
      <div className="jsx-block-head">
        <span className="jsx-tag">Align</span>
        <span className="segmented small" role="group" aria-label="Alignment">
          {ALIGNMENTS.map((a) => (
            <button key={a} type="button" className={a === current ? "on" : ""} onClick={() => setTo(a)} title={`Align ${a}`}>
              {a}
            </button>
          ))}
        </span>
      </div>
      <NestedLexicalEditor<MdxJsxFlowElement>
        block={block}
        getContent={(n) => n.children}
        getUpdatedMdastNode={(n, children) => ({ ...n, children } as MdxJsxFlowElement)}
      />
    </div>
  );
}

const SPACER_SIZES = ["sm", "md", "lg"] as const;

/** Spacer: a thin bar with a size picker. No content. */
function SpacerEditor({ mdastNode }: JsxEditorProps) {
  const node = mdastNode as MdxJsxFlowElement;
  const update = useMdastNodeUpdater<MdxJsxFlowElement>();
  const current = attrValue(node, "size") || "md";
  const setSize = (size: string) => {
    const attributes = node.attributes.filter((a) => !(a.type === "mdxJsxAttribute" && a.name === "size"));
    attributes.push({ type: "mdxJsxAttribute", name: "size", value: size });
    update({ attributes });
  };
  return (
    <div className={`jsx-block jsx-spacer jsx-spacer-${current}`}>
      <div className="jsx-block-head">
        <span className="jsx-tag">Spacer</span>
        <span className="segmented small" role="group" aria-label="Spacer size">
          {SPACER_SIZES.map((sz) => (
            <button key={sz} type="button" className={sz === current ? "on" : ""} onClick={() => setSize(sz)} title={`Spacer ${sz}`}>
              {sz}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

/** Button link: URL field plus the button's text. */
function ButtonEditor({ mdastNode }: JsxEditorProps) {
  const node = mdastNode as MdxJsxFlowElement;
  const block = hasBlockChildren(node);
  return (
    <div className="jsx-block jsx-button">
      <div className="jsx-block-head">
        <span className="jsx-tag">Button</span>
        <PropField node={node} name="href" placeholder="https://link or mailto:" className="jsx-field jsx-field-href" />
      </div>
      <NestedLexicalEditor<MdxJsxFlowElement>
        block={block}
        getContent={(n) => n.children}
        getUpdatedMdastNode={(n, children) => ({ ...n, children } as MdxJsxFlowElement)}
      />
    </div>
  );
}

/**
 * Tells MDXEditor about the custom tags used in section content so it can
 * show them as editable blocks instead of refusing to load the document.
 * Keep in sync with src/components/mdx-components.tsx.
 */
const descriptors: JsxComponentDescriptor[] = [
  { name: "Label", kind: "flow", props: [], hasChildren: true, Editor: FramedEditor },
  { name: "Card", kind: "flow", props: [], hasChildren: true, Editor: FramedEditor },
  {
    name: "Project",
    kind: "flow",
    props: [
      { name: "n", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "href", type: "string" },
    ],
    hasChildren: true,
    Editor: ProjectEditor,
  },
  { name: "Columns", kind: "flow", props: [], hasChildren: true, Editor: FramedEditor },
  { name: "Align", kind: "flow", props: [{ name: "to", type: "string" }], hasChildren: true, Editor: AlignEditor },
  { name: "Spacer", kind: "flow", props: [{ name: "size", type: "string" }], hasChildren: false, Editor: SpacerEditor },
  { name: "Button", kind: "flow", props: [{ name: "href", type: "string" }], hasChildren: true, Editor: ButtonEditor },
];

function paragraph(text: string) {
  return { type: "paragraph" as const, children: [{ type: "text" as const, value: text }] };
}

const isAlignableBlock = (n: LexicalNode): n is ElementNode => $isParagraphNode(n) || $isHeadingNode(n);

/** Drop line breaks at the start/end of a block (left over when a line is split out of a paragraph). */
function trimLineBreaks(block: ElementNode) {
  let first = block.getFirstChild();
  while (first && $isLineBreakNode(first)) {
    first.remove();
    first = block.getFirstChild();
  }
  let last = block.getLastChild();
  while (last && $isLineBreakNode(last)) {
    last.remove();
    last = block.getLastChild();
  }
}

/**
 * If the selection is a part of one paragraph (e.g. a single line of a multi-line block),
 * split that part out into its own paragraph and return it. Returns null when the selection
 * is collapsed, spans several blocks, or already covers the whole block.
 */
function isolateSelectedText(selection: RangeSelection): ElementNode | null {
  if (selection.isCollapsed()) return null;
  const backward = selection.isBackward();
  const start = backward ? selection.focus : selection.anchor;
  const end = backward ? selection.anchor : selection.focus;
  const startBlock = $findMatchingParent(start.getNode(), isAlignableBlock);
  const endBlock = $findMatchingParent(end.getNode(), isAlignableBlock);
  if (!startBlock || !endBlock || startBlock.getKey() !== endBlock.getKey()) return null;
  if (!$isElementNode(startBlock)) return null;
  const block = startBlock;
  if (selection.getTextContent().trim() === block.getTextContent().trim()) return null;

  // Split at the end first so the start point's node/offset stay valid.
  const endSel = $createRangeSelection();
  endSel.anchor.set(end.key, end.offset, end.type);
  endSel.focus.set(end.key, end.offset, end.type);
  $setSelection(endSel);
  const after = endSel.insertParagraph();

  const startSel = $createRangeSelection();
  startSel.anchor.set(start.key, start.offset, start.type);
  startSel.focus.set(start.key, start.offset, start.type);
  $setSelection(startSel);
  const middle = startSel.insertParagraph();
  if (!middle) return null;

  // The selected text now sits in `middle`; `block` holds what came before, `after` what came after.
  trimLineBreaks(middle);
  trimLineBreaks(block);
  if (after && $isElementNode(after)) trimLineBreaks(after);
  if (block.getTextContent().trim() === "" && block.getChildrenSize() === 0) block.remove();
  if (after && $isElementNode(after) && after.getTextContent().trim() === "" && after.getChildrenSize() === 0) after.remove();
  middle.selectEnd();
  return middle;
}

/**
 * Toolbar alignment buttons. Alignment is a property of the paragraph/heading, like a word
 * processor. With the cursor in a block (or several blocks selected) the whole block(s) are
 * aligned; with part of one block selected, that part is split out first. See
 * alignment-plugin.ts for how alignment is written to MDX.
 */
function AlignButtons() {
  const [activeEditor, rootEditor] = useCellValues(activeEditor$, rootEditor$);

  const apply = (to: (typeof ALIGNMENTS)[number]) => {
    const editor = activeEditor ?? rootEditor;
    if (!editor) return;
    // Clicking a toolbar button moves focus away from the editor; restore it so the selection is available.
    editor.focus(
      () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const format: ElementFormatType = to === "left" ? "" : to;

          const isolated = isolateSelectedText(selection);
          if (isolated) {
            isolated.setFormat(format);
            return;
          }

          const seen = new Set<string>();
          for (const node of selection.getNodes()) {
            const block = $findMatchingParent(node, isAlignableBlock);
            if (!block || seen.has(block.getKey())) continue;
            seen.add(block.getKey());
            block.setFormat(format);
          }
        });
      },
      { defaultSelection: "rootStart" },
    );
  };

  const icon = (a: (typeof ALIGNMENTS)[number]) => {
    const x = a === "left" ? [2, 2, 2] : a === "center" ? [4, 2, 5] : [6, 2, 8];
    const w = [12, 16, 8];
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        {w.map((width, i) => (
          <rect key={i} x={x[i]} y={4 + i * 5} width={width} height="2.2" rx="1" fill="currentColor" />
        ))}
      </svg>
    );
  };
  return (
    <>
      {ALIGNMENTS.map((a) => (
        <Button key={a} title={`Align ${a}`} onClick={() => apply(a)}>
          {icon(a)}
        </Button>
      ))}
    </>
  );
}

/** Toolbar menu that drops one of the custom blocks at the cursor. */
function InsertBlock() {
  const insertJsx = usePublisher(insertJsx$);
  const items: Array<{ label: string; insert: () => void }> = [
    {
      label: "Label",
      insert: () => insertJsx({ kind: "flow", name: "Label", props: {}, children: [paragraph("Label")] }),
    },
    {
      label: "Card",
      insert: () => insertJsx({ kind: "flow", name: "Card", props: {}, children: [paragraph("Card text…")] }),
    },
    {
      label: "Project",
      insert: () =>
        insertJsx({
          kind: "flow",
          name: "Project",
          props: { n: "00", title: "Project title", href: "https://" },
          children: [paragraph("One-line description.")],
        }),
    },
    {
      label: "Columns",
      insert: () =>
        insertJsx({
          kind: "flow",
          name: "Columns",
          props: {},
          children: [paragraph("Left"), paragraph("Middle"), paragraph("Right")],
        }),
    },
    {
      label: "Button",
      insert: () =>
        insertJsx({ kind: "flow", name: "Button", props: { href: "https://" }, children: [paragraph("Button text")] }),
    },
    {
      label: "Spacer",
      insert: () => insertJsx({ kind: "flow", name: "Spacer", props: { size: "md" }, children: [] }),
    },
  ];
  return (
    <>
      <span className="mdx-toolbar-label">Insert:</span>
      {items.map((it) => (
        <Button key={it.label} onClick={it.insert} title={`Insert ${it.label}`}>
          {it.label}
        </Button>
      ))}
    </>
  );
}

interface Props {
  markdown: string;
  onChange: (markdown: string) => void;
  onError: (message: string) => void;
}

export default function VisualEditor({ markdown, onChange, onError }: Props) {
  const ref = useRef<MDXEditorMethods>(null);
  return (
    <MDXEditor
      ref={ref}
      className="visual-editor"
      contentEditableClassName="visual-editor-content"
      markdown={markdown}
      onChange={(md, initialNormalize) => {
        // The first change event is MDXEditor re-serialising the document; keep the
        // author's original text until they actually type something.
        if (!initialNormalize) onChange(md);
      }}
      onError={(payload) => onError(payload.error)}
      plugins={[
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        // No upload handler: the image dialog takes a URL. Uploads would need a storage bucket.
        imagePlugin(),
        jsxPlugin({ jsxComponentDescriptors: descriptors }),
        alignmentPlugin(),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <StrikeThroughSupSubToggles options={["Strikethrough"]} />
              <Separator />
              <AlignButtons />
              <Separator />
              <ListsToggle options={["bullet", "number"]} />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertThematicBreak />
              <Separator />
              <InsertBlock />
            </>
          ),
        }),
      ]}
    />
  );
}
