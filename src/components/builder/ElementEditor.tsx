"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import type { BuilderElement, VideoLikertConfig, LikertConfig } from "@/lib/types";

type Props = { element: BuilderElement; onChange: (el: BuilderElement) => void };

export default function ElementEditor({ element, onChange }: Props) {
  function patch(partial: Record<string, unknown>) {
    onChange({ ...element, config: { ...element.config, ...partial } as typeof element.config });
  }

  const cfg = element.config as Record<string, unknown>;

  switch (element.elementType) {
    case "heading":
      return (
        <div className="space-y-1">
          <Label>Heading text</Label>
          <Input value={String(cfg.text ?? "")} onChange={(e) => patch({ text: e.target.value })} />
        </div>
      );

    case "textbox":
      return (
        <div className="space-y-1">
          <Label>Content</Label>
          <TiptapEditor
            content={String(cfg.content ?? "")}
            onChange={(html) => patch({ content: html })}
            placeholder="Type survey instructions here…"
          />
        </div>
      );

    case "consent":
      return (
        <div className="space-y-1">
          <Label>Consent text</Label>
          <Textarea rows={2} value={String(cfg.text ?? "")} onChange={(e) => patch({ text: e.target.value })} />
        </div>
      );

    case "short_answer":
      return (
        <div className="space-y-2">
          <div className="space-y-1"><Label>Prompt</Label>
            <Input value={String(cfg.prompt ?? "")} onChange={(e) => patch({ prompt: e.target.value })} /></div>
          <div className="space-y-1"><Label>Placeholder</Label>
            <Input value={String(cfg.placeholder ?? "")} onChange={(e) => patch({ placeholder: e.target.value })} /></div>
        </div>
      );

    case "single_choice":
    case "multi_choice": {
      const options = (cfg.options as string[]) ?? [];
      return (
        <div className="space-y-2">
          <div className="space-y-1"><Label>Prompt</Label>
            <Input value={String(cfg.prompt ?? "")} onChange={(e) => patch({ prompt: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Options (one per line)</Label>
            <Textarea rows={4} value={options.join("\n")}
              onChange={(e) => patch({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          </div>
        </div>
      );
    }

    case "likert":
    case "video_likert": {
      const c = element.config as VideoLikertConfig | LikertConfig;
      return (
        <div className="space-y-2">
          <div className="space-y-1"><Label>Prompt</Label>
            <Input value={c.prompt} onChange={(e) => patch({ prompt: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Scale points (comma-separated, e.g. 1,2,3,4,5)</Label>
            <Input value={c.scalePoints.join(",")}
              onChange={(e) => {
                const pts = e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                patch({ scalePoints: pts });
              }} />
          </div>
          <div className="space-y-1">
            <Label>Scale labels (format: 1=Poor,5=Excellent)</Label>
            <Input
              value={Object.entries(c.scaleLabels).map(([k, v]) => `${k}=${v}`).join(",")}
              onChange={(e) => {
                const labels: Record<string, string> = {};
                e.target.value.split(",").forEach((pair) => {
                  const [k, ...rest] = pair.split("=");
                  if (k && rest.length) labels[k.trim()] = rest.join("=").trim();
                });
                patch({ scaleLabels: labels });
              }}
            />
          </div>
        </div>
      );
    }

    case "video_preference":
      return (
        <div className="space-y-1">
          <Label>Prompt</Label>
          <Input value={String(cfg.prompt ?? "")} onChange={(e) => patch({ prompt: e.target.value })} />
        </div>
      );

    case "videoset_block":
      return <p className="text-xs text-zinc-400">This block displays the composite video for each iteration. No configuration needed.</p>;

    case "demographics":
      return <p className="text-xs text-zinc-400">Demographics block (uses default fields). Custom field editor coming soon.</p>;

    default:
      return null;
  }
}
