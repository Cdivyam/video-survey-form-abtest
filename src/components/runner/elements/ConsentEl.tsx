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
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={value === "I agree"}
        onChange={(e) => onChange(e.target.checked ? "I agree" : "")}
        className="accent-zinc-900 mt-1 w-4 h-4 shrink-0"
      />
      <span className="text-zinc-700">{config.text}</span>
    </label>
  );
}
