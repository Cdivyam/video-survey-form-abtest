"use client";
import { useMemo } from "react";
import type { VideoPreferenceConfig, SlotLabel } from "@/lib/types";

function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

type Props = {
  config: VideoPreferenceConfig;
  slots: SlotLabel[];
  value: string;
  onChange: (val: string) => void;
};

export default function VideoPreferenceEl({ config, slots, value, onChange }: Props) {
  const cleanPrompt = useMemo(() => sanitize(config.prompt ?? ""), [config.prompt]);

  return (
    <div className="space-y-3">
      <div className="prose-content font-medium text-zinc-900" dangerouslySetInnerHTML={{ __html: cleanPrompt }} />
      <div className="flex flex-wrap gap-3">
        {slots.map((slot) => (
          <label key={slot}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg border-2 cursor-pointer transition-colors
              ${value === slot ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400 text-zinc-700"}`}>
            <input type="radio" name="video-pref" value={slot} checked={value === slot}
              onChange={() => onChange(slot)} className="sr-only" />
            <span className="font-semibold text-lg">Video {slot}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
