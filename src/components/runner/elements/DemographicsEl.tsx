"use client";
import type { DemographicsConfig } from "@/lib/types";

type Props = {
  config: DemographicsConfig;
  values: Record<string, string>; // fieldId → value
  onChange: (fieldId: string, val: string) => void;
};

export default function DemographicsEl({ config, values, onChange }: Props) {
  return (
    <div className="space-y-5">
      {config.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-900">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {field.type === "text" && (
            <input
              type="text"
              value={values[field.id] ?? ""}
              onChange={(e) => onChange(field.id, e.target.value)}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          )}

          {field.type === "select" && (
            <select
              value={values[field.id] ?? ""}
              onChange={(e) => onChange(field.id, e.target.value)}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === "radio" && (
            <div className="space-y-1.5">
              {(field.options ?? []).map((opt) => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`demo-${field.id}`}
                    value={opt}
                    checked={values[field.id] === opt}
                    onChange={() => onChange(field.id, opt)}
                    className="accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">{opt}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
