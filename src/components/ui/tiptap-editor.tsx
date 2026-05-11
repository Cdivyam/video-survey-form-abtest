"use client";
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

type BtnProps = {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
};

function Btn({ onClick, active, title, children }: BtnProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-2 py-0.5 rounded text-sm transition-colors
        ${active
          ? "bg-zinc-800 text-white"
          : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
        }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-zinc-300 mx-0.5 self-center" />;
}

export function TiptapEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false, // required in Tiptap v3 to avoid SSR hydration mismatch
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Type content here…" }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "tiptap-prose min-h-[120px] px-3 py-2 focus:outline-none" },
    },
  });

  // Sync when the content prop changes from outside (e.g. switching selected elements).
  // Guard against the editor's own updates to avoid loops.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const isActive = (type: string, opts?: object) => editor.isActive(type, opts);
  const cmd = (fn: () => void) => fn;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 bg-zinc-50">
        <Btn onClick={cmd(() => editor.chain().focus().toggleBold().run())} active={isActive("bold")} title="Bold (Ctrl+B)">
          <strong>B</strong>
        </Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleItalic().run())} active={isActive("italic")} title="Italic (Ctrl+I)">
          <em>I</em>
        </Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleStrike().run())} active={isActive("strike")} title="Strikethrough">
          <s>S</s>
        </Btn>
        <Sep />
        <Btn onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} active={isActive("heading", { level: 1 })} title="Heading 1">H1</Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} active={isActive("heading", { level: 2 })} title="Heading 2">H2</Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} active={isActive("heading", { level: 3 })} title="Heading 3">H3</Btn>
        <Sep />
        <Btn onClick={cmd(() => editor.chain().focus().toggleBulletList().run())} active={isActive("bulletList")} title="Bullet list">• List</Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleOrderedList().run())} active={isActive("orderedList")} title="Numbered list">1. List</Btn>
        <Sep />
        <Btn onClick={cmd(() => editor.chain().focus().toggleBlockquote().run())} active={isActive("blockquote")} title="Blockquote">" Quote</Btn>
        <Btn onClick={cmd(() => editor.chain().focus().toggleCode().run())} active={isActive("code")} title="Inline code">` Code</Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
