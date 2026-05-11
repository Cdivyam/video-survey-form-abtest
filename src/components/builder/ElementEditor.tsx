"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import type { BuilderElement, VideoLikertConfig, VideoPreferenceConfig, LikertConfig, VideosetBlockConfig } from "@/lib/types";

// Holds raw string locally; only fires onChange on blur so commas/equals
// can be typed mid-entry without being immediately stripped by the parser.
function DeferredInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
    />
  );
}

export type VideosetBlockRef = { id: string; name: string };

type Props = {
  element: BuilderElement;
  onChange: (el: BuilderElement) => void;
  /** All videoset_block elements in the current dynamic page — for the ref dropdown */
  videosetBlocks?: VideosetBlockRef[];
};

export default function ElementEditor({ element, onChange, videosetBlocks = [] }: Props) {
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

    case "likert": {
      const c = element.config as LikertConfig;
      return (
        <div className="space-y-2">
          <div className="space-y-1"><Label>Prompt</Label>
            <Input value={c.prompt} onChange={(e) => patch({ prompt: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Scale points (comma-separated, e.g. 1,2,3,4,5)</Label>
            <DeferredInput
              value={c.scalePoints.join(",")}
              placeholder="1,2,3,4,5"
              onChange={(raw) => {
                const pts = raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                patch({ scalePoints: pts });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Scale labels (format: 1=Poor,5=Excellent)</Label>
            <DeferredInput
              value={Object.entries(c.scaleLabels).map(([k, v]) => `${k}=${v}`).join(",")}
              placeholder="1=Poor,5=Excellent"
              onChange={(raw) => {
                const labels: Record<string, string> = {};
                raw.split(",").forEach((pair) => {
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

    case "video_likert": {
      const c = element.config as VideoLikertConfig;
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Block name <span className="text-zinc-400 font-normal">(used as CSV column header)</span></Label>
            <Input value={c.name ?? ""} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Clarity" />
          </div>
          <div className="space-y-1">
            <Label>Video Set reference</Label>
            <select
              value={c.videosetBlockRef ?? ""}
              onChange={(e) => patch({ videosetBlockRef: e.target.value || null })}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">None</option>
              {videosetBlocks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Prompt</Label>
            <TiptapEditor
              content={c.prompt ?? ""}
              onChange={(html) => patch({ prompt: html })}
              placeholder="Rate each video…"
            />
          </div>
          <div className="space-y-1">
            <Label>Scale points (comma-separated, e.g. 1,2,3,4,5)</Label>
            <DeferredInput
              value={c.scalePoints.join(",")}
              placeholder="1,2,3,4,5"
              onChange={(raw) => {
                const pts = raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                patch({ scalePoints: pts });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Scale labels (format: 1=Poor,5=Excellent)</Label>
            <DeferredInput
              value={Object.entries(c.scaleLabels).map(([k, v]) => `${k}=${v}`).join(",")}
              placeholder="1=Poor,5=Excellent"
              onChange={(raw) => {
                const labels: Record<string, string> = {};
                raw.split(",").forEach((pair) => {
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

    case "video_preference": {
      const c = element.config as VideoPreferenceConfig;
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Block name <span className="text-zinc-400 font-normal">(used as CSV column header)</span></Label>
            <Input value={c.name ?? ""} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Preference" />
          </div>
          <div className="space-y-1">
            <Label>Video Set reference</Label>
            <select
              value={c.videosetBlockRef ?? ""}
              onChange={(e) => patch({ videosetBlockRef: e.target.value || null })}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">None</option>
              {videosetBlocks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Prompt</Label>
            <TiptapEditor
              content={c.prompt ?? ""}
              onChange={(html) => patch({ prompt: html })}
              placeholder="Which video do you prefer most?"
            />
          </div>
        </div>
      );
    }

    case "videoset_block": {
      const c = element.config as VideosetBlockConfig;
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Block name <span className="text-zinc-400 font-normal">(used as CSV reference)</span></Label>
            <Input value={c.name ?? ""} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Video Set Block" />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400">Block ID <span className="font-normal">(read-only)</span></Label>
            <div className="px-3 py-2 rounded-md border border-zinc-100 bg-zinc-50 text-xs text-zinc-500 font-mono break-all select-all">
              {element.id}
            </div>
          </div>
          <p className="text-xs text-zinc-400">This block displays the composite video for each survey iteration.</p>
        </div>
      );
    }

    case "demographics":
      return <p className="text-xs text-zinc-400">Demographics block (uses default fields). Custom field editor coming soon.</p>;

    default:
      return null;
  }
}
