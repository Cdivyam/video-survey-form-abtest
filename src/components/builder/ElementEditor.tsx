"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { nanoid } from "nanoid";
import type { BuilderElement, VideoLikertConfig, VideoPreferenceConfig, LikertConfig, VideosetBlockConfig, DemographicsConfig, DemographicsField } from "@/lib/types";

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

// Same deferred pattern for Textarea — prevents Enter from being swallowed
// when onChange filters/trims on every keystroke.
function DeferredTextarea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Textarea
      value={local}
      rows={rows}
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
            <DeferredTextarea rows={4} value={options.join("\n")}
              onChange={(raw) => patch({ options: raw.split("\n").map((s) => s.trim()).filter(Boolean) })} />
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

    case "demographics": {
      const c = element.config as DemographicsConfig;

      function updateField(idx: number, update: Partial<DemographicsField>) {
        patch({ fields: c.fields.map((f, i) => i === idx ? { ...f, ...update } : f) });
      }

      function addField() {
        const f: DemographicsField = { id: nanoid(), label: "New field", type: "text", required: false };
        patch({ fields: [...c.fields, f] });
      }

      function removeField(idx: number) {
        patch({ fields: c.fields.filter((_, i) => i !== idx) });
      }

      return (
        <div className="space-y-3">
          {c.fields.map((field, idx) => (
            <div key={field.id} className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">Field {idx + 1}</span>
                <button onClick={() => removeField(idx)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  value={field.type}
                  onChange={(e) => updateField(idx, { type: e.target.value as DemographicsField["type"], options: field.options })}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="text">Text input</option>
                  <option value="select">Dropdown</option>
                  <option value="radio">Radio buttons</option>
                </select>
              </div>

              {(field.type === "select" || field.type === "radio") && (
                <div className="space-y-1">
                  <Label className="text-xs">Options (one per line)</Label>
                  <DeferredTextarea
                    rows={3}
                    value={(field.options ?? []).join("\n")}
                    onChange={(raw) => updateField(idx, { options: raw.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                  className="accent-zinc-900"
                />
                <span className="text-xs text-zinc-600">Required</span>
              </label>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addField} className="w-full">
            + Add field
          </Button>
        </div>
      );
    }

    default:
      return null;
  }
}
