"use client";
import { useMemo } from "react";
import type { VideoLikertConfig, SlotLabel } from "@/lib/types";

function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

type Props = {
  config: VideoLikertConfig;
  elementId: string;
  slots: SlotLabel[];
  surveyVideoSetId: string;
  values: Record<string, string>;
  onChange: (slotLabel: SlotLabel, val: string) => void;
};

export default function VideoLikertEl({ config, elementId, slots, values, onChange }: Props) {
  const cleanPrompt = useMemo(() => sanitize(config.prompt ?? ""), [config.prompt]);

  return (
    <div className="space-y-3">
      <div className="prose-content font-medium text-zinc-900" dangerouslySetInnerHTML={{ __html: cleanPrompt }} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 w-20 text-zinc-500 font-medium">Video</th>
              {config.scalePoints.map((pt) => (
                <th key={pt} className="text-center px-2 py-2 min-w-[60px]">
                  <div className="text-zinc-800 font-semibold">{pt}</div>
                  {config.scaleLabels[String(pt)] && (
                    <div className="text-xs text-zinc-400 font-normal">{config.scaleLabels[String(pt)]}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={slot} className={i % 2 === 0 ? "bg-zinc-50" : "bg-white"}>
                <td className="px-3 py-3 font-semibold text-zinc-700">Video {slot}</td>
                {config.scalePoints.map((pt) => (
                  <td key={pt} className="text-center px-2 py-3">
                    <input
                      type="radio"
                      name={`video-likert-${elementId}-${slot}`}
                      value={String(pt)}
                      checked={values[slot] === String(pt)}
                      onChange={() => onChange(slot, String(pt))}
                      className="accent-zinc-900 w-4 h-4 cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
