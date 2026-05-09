import type { HeadingConfig } from "@/lib/types";
export default function HeadingEl({ config }: { config: HeadingConfig }) {
  return <h2 className="text-2xl font-bold text-zinc-900">{config.text}</h2>;
}
