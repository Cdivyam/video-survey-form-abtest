"use client";
import type { ConsentConfig } from "@/lib/types";

type Props = {
  config: ConsentConfig;
  elementId: string;
  value: string;
  onChange: (val: string) => void;
};

export default function ConsentEl({ config, value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-zinc-700">{config.text}</p>
      <div className="flex flex-col gap-2">
        {["I agree", "I do not agree"].map((opt) => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="consent" value={opt} checked={value === opt}
              onChange={() => onChange(opt)} className="accent-zinc-900" />
            <span className="text-zinc-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
