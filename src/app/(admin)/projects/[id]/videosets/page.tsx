"use client";
import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Video = { id: string; modelName: string; fileUrl: string };
type VideoSet = { id: string; name: string; videos: Video[] };

const SLOT_LABELS = ["A", "B", "C", "D", "E"];

export default function VideoSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sets, setSets] = useState<VideoSet[]>([]);
  const [newSetName, setNewSetName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // videoSetId being uploaded to
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSetId = useRef<string | null>(null);
  const pendingModelName = useRef<string>("");

  async function load() {
    const res = await fetch(`/api/projects/${id}/videosets`);
    setSets(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  async function createSet() {
    if (!newSetName.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/projects/${id}/videosets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSetName.trim() }),
    });
    if (res.ok) { setNewSetName(""); load(); }
    else toast.error("Failed to create video set");
    setCreating(false);
  }

  async function deleteSet(vsId: string) {
    await fetch(`/api/videosets/${vsId}`, { method: "DELETE" });
    load();
  }

  async function deleteVideo(videoId: string) {
    await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    load();
  }

  function triggerUpload(setId: string) {
    const modelName = prompt("Enter model name for this video (e.g. ModelA):");
    if (!modelName?.trim()) return;
    pendingSetId.current = setId;
    pendingModelName.current = modelName.trim();
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const setId = pendingSetId.current;
    const modelName = pendingModelName.current;
    if (!file || !setId) return;
    e.target.value = "";

    setUploading(setId);
    const form = new FormData();
    form.append("file", file);
    form.append("modelName", modelName);
    const res = await fetch(`/api/videosets/${setId}/videos`, { method: "POST", body: form });
    if (res.ok) { toast.success("Video uploaded"); load(); }
    else { const err = await res.json(); toast.error(err.error ?? "Upload failed"); }
    setUploading(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-700 text-sm">← Project</Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-2xl font-bold text-zinc-900">Video Sets</h1>
      </div>

      <p className="text-zinc-500 text-sm">
        Each video set contains outputs from different models for the same prompt (up to 5 videos).
      </p>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Video set name (e.g. Prompt #1)"
          value={newSetName}
          onChange={(e) => setNewSetName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createSet()}
        />
        <Button onClick={createSet} disabled={creating || !newSetName.trim()}>
          {creating ? "Creating…" : "Add Set"}
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      <div className="grid gap-4">
        {sets.map((vs) => (
          <Card key={vs.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{vs.name}</CardTitle>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                  onClick={() => deleteSet(vs.id)}>Delete set</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {vs.videos.map((v, i) => (
                  <div key={v.id} className="relative group rounded-lg border bg-zinc-50 overflow-hidden">
                    <video src={v.fileUrl} className="w-full aspect-video object-cover" muted />
                    <div className="px-2 py-1 flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="text-xs">{SLOT_LABELS[i]}</Badge>
                        <p className="text-xs text-zinc-600 mt-0.5">{v.modelName}</p>
                      </div>
                      <button onClick={() => deleteVideo(v.id)}
                        className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {vs.videos.length < 5 && (
                  <button
                    onClick={() => triggerUpload(vs.id)}
                    disabled={uploading === vs.id}
                    className="rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center aspect-video text-zinc-400 hover:border-zinc-500 hover:text-zinc-600 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">+</span>
                    <span className="text-xs mt-1">{uploading === vs.id ? "Uploading…" : "Add video"}</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {sets.length === 0 && <p className="text-zinc-400 text-sm">No video sets yet. Create one above.</p>}
      </div>
    </div>
  );
}
