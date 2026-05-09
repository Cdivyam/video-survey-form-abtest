"use client";
import type { VideoPreferenceConfig, SlotLabel } from "@/lib/types";

type Props = {
  config: VideoPreferenceConfig;
  slots: SlotLabel[];
  value: string;
  onChange: (val: string) => void;
};

export default function VideoPreferenceEl({ config, slots, value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-zinc-900">{config.prompt}</p>
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
