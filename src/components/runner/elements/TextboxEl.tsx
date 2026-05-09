import type { TextboxConfig } from "@/lib/types";

export default function TextboxEl({ config }: { config: TextboxConfig }) {
  // Render markdown as plain paragraphs for now; bold/italic via simple transforms
  const html = config.content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
  return (
    <div
      className="prose prose-zinc max-w-none text-zinc-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
