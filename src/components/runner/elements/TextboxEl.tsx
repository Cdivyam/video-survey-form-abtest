"use client";
import { useMemo } from "react";
import type { TextboxConfig } from "@/lib/types";

// Strip dangerous patterns from Tiptap-generated HTML.
// Content is surveyor-authored so risk is low, but we still sanitize
// event handlers and script tags defensively.
function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export default function TextboxEl({ config }: { config: TextboxConfig }) {
  const clean = useMemo(() => sanitize(config.content ?? ""), [config.content]);
  return (
    <div className="prose-content" dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
