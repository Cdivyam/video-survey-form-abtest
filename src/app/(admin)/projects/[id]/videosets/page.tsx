"use client";
import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputDialog } from "@/components/ui/input-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Video = {
  id: string;
  modelName: string;
  fileUrl: string;
  originalFilename: string | null;
};

type VideoSet = {
  id: string;
  name: string;
  layout: "horizontal" | "vertical";
  cropX: number;
  cropY: number;
  padding: number;
  keepOriginalSize: boolean;
  testCompositeUrl: string | null;
  testCompositeHash: string | null;
  videos: Video[];
};

const SLOT_LABELS = ["A", "B", "C", "D", "E"];

export default function VideoSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sets, setSets] = useState<VideoSet[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [generatingPreviews, setGeneratingPreviews] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSetId = useRef<string | null>(null);
  const pendingModelName = useRef<string>("");

  const [modelNameDialog, setModelNameDialog] = useState<{ setId: string } | null>(null);
  const [editDialog, setEditDialog] = useState<(Video & { setName: string }) | null>(null);
  const [setToDelete, setSetToDelete] = useState<VideoSet | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<(Video & { setName: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${id}/videosets`);
    setSets(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  async function createSet() {
    setCreating(true);
    const name = `Video Set ${sets.length + 1}`;
    const res = await fetch(`/api/projects/${id}/videosets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { load(); }
    else toast.error("Failed to create video set");
    setCreating(false);
  }

  async function duplicateSet(vs: VideoSet) {
    setDuplicating(vs.id);
    const res = await fetch(`/api/videosets/${vs.id}/duplicate`, { method: "POST" });
    if (res.ok) { toast.success("Video set duplicated"); load(); }
    else { const err = await res.json(); toast.error(err.error ?? "Duplicate failed"); }
    setDuplicating(null);
  }

  async function generatePreviews() {
    setGeneratingPreviews(true);
    try {
      const res = await fetch(`/api/projects/${id}/test-composites`, { method: "POST" });
      const data = await res.json() as {
        results: { videoSetId: string; status: string; testCompositeUrl: string | null }[]
      };

      // Update testCompositeUrl for each set from the results
      setSets((prev) => prev.map((s) => {
        const result = data.results.find((r) => r.videoSetId === s.id);
        if (!result || result.status === "empty") return s;
        return { ...s, testCompositeUrl: result.testCompositeUrl };
      }));

      const generated = data.results.filter((r) => r.status === "generated").length;
      const skipped = data.results.filter((r) => r.status === "skipped").length;
      const failed = data.results.filter((r) => r.status === "failed").length;

      if (failed > 0) toast.error(`${failed} composite(s) failed — check server logs`);
      else if (generated === 0 && skipped > 0) toast.success("All previews are up to date");
      else toast.success(`Generated ${generated} preview(s)${skipped > 0 ? `, ${skipped} unchanged` : ""}`);
    } catch {
      toast.error("Failed to generate previews");
    }
    setGeneratingPreviews(false);
  }

  async function patchSet(setId: string, patch: Partial<Pick<VideoSet, "layout" | "cropX" | "cropY" | "padding" | "keepOriginalSize">>) {
    const res = await fetch(`/api/videosets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to update settings");
      load();
    }
  }

  function updateSetLocally(setId: string, patch: Partial<VideoSet>) {
    setSets((prev) => prev.map((s) => s.id === setId ? { ...s, ...patch } : s));
  }

  async function confirmDeleteSet() {
    if (!setToDelete) return;
    setDeleting(true);
    await fetch(`/api/videosets/${setToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setSetToDelete(null);
    load();
  }

  async function confirmDeleteVideo() {
    if (!videoToDelete) return;
    setDeleting(true);
    await fetch(`/api/videos/${videoToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setVideoToDelete(null);
    load();
  }

  function openModelNameDialog(setId: string) {
    pendingSetId.current = setId;
    setModelNameDialog({ setId });
  }

  function handleModelNameSubmit(modelName: string) {
    pendingModelName.current = modelName;
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

  async function handleEditModelName(videoId: string, modelName: string) {
    const res = await fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelName }),
    });
    if (res.ok) { toast.success("Model name updated"); load(); }
    else toast.error("Failed to update model name");
  }

  const setsWithVideos = sets.filter((s) => s.videos.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-700 text-sm">← Project</Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-2xl font-bold text-zinc-900">Video Sets</h1>
      </div>

      <p className="text-zinc-500 text-sm">
        Each video set contains outputs from different models for the same prompt (up to 5 videos).
        Composite settings (stacking, crop, padding) apply to all videos in the set.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={createSet} disabled={creating}>
          {creating ? "Creating…" : "+ Add Video Set"}
        </Button>
        {setsWithVideos.length > 0 && (
          <Button
            variant="outline"
            onClick={generatePreviews}
            disabled={generatingPreviews}
          >
            {generatingPreviews ? "Generating previews…" : "Generate Previews"}
          </Button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      {/* Two-column layout: cards left, preview sidebar right */}
      <div className={sets.length > 0 ? "grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start" : ""}>

        {/* Left: VideoSet cards */}
        <div className="space-y-6">
          {sets.map((vs) => (
            <Card key={vs.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{vs.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      className="text-zinc-500 hover:text-zinc-800"
                      onClick={() => duplicateSet(vs)}
                      disabled={duplicating === vs.id}
                    >
                      {duplicating === vs.id ? "Duplicating…" : "Duplicate"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                      onClick={() => setSetToDelete(vs)}>Delete set</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Video grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {vs.videos.map((v, i) => (
                    <div key={v.id} className="relative group rounded-lg border bg-zinc-50 overflow-hidden">
                      <video src={v.fileUrl} className="w-full aspect-video object-cover" muted />
                      <div className="px-2 py-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{SLOT_LABELS[i]}</Badge>
                          <button
                            onClick={() => setVideoToDelete({ ...v, setName: vs.name })}
                            className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >✕</button>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-zinc-700 truncate">{v.modelName}</p>
                          <button
                            onClick={() => setEditDialog({ ...v, setName: vs.name })}
                            className="text-zinc-300 hover:text-zinc-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Edit model name"
                          >✎</button>
                        </div>
                        {v.originalFilename && (
                          <p className="text-xs text-zinc-400 break-all">
                            {v.originalFilename}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {vs.videos.length < 5 && (
                    <button
                      onClick={() => openModelNameDialog(vs.id)}
                      disabled={uploading === vs.id}
                      className="rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center aspect-video text-zinc-400 hover:border-zinc-500 hover:text-zinc-600 transition-colors disabled:opacity-50"
                    >
                      <span className="text-2xl">+</span>
                      <span className="text-xs mt-1">{uploading === vs.id ? "Uploading…" : "Add video"}</span>
                    </button>
                  )}
                </div>

                {/* Composite settings */}
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-zinc-500 mb-3">Composite settings</p>
                  <div className="flex flex-wrap items-end gap-4">
                    {/* Stacking direction */}
                    <div className="space-y-1">
                      <Label className="text-xs">Stacking</Label>
                      <div className="flex rounded-md border border-zinc-200 overflow-hidden">
                        {(["horizontal", "vertical"] as const).map((dir) => (
                          <button
                            key={dir}
                            onClick={() => {
                              updateSetLocally(vs.id, { layout: dir });
                              patchSet(vs.id, { layout: dir });
                            }}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors
                              ${vs.layout === dir
                                ? "bg-zinc-900 text-white"
                                : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                          >
                            {dir === "horizontal" ? "⬛▬ Side by side" : "☰ Stacked"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Crop X */}
                    <div className="space-y-1">
                      <Label className="text-xs">Crop left (px)</Label>
                      <Input
                        type="number" min={0}
                        value={vs.cropX}
                        className="w-24 h-8 text-sm"
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          updateSetLocally(vs.id, { cropX: v });
                        }}
                        onBlur={() => patchSet(vs.id, { cropX: vs.cropX })}
                      />
                    </div>

                    {/* Crop Y */}
                    <div className="space-y-1">
                      <Label className="text-xs">Crop top (px)</Label>
                      <Input
                        type="number" min={0}
                        value={vs.cropY}
                        className="w-24 h-8 text-sm"
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          updateSetLocally(vs.id, { cropY: v });
                        }}
                        onBlur={() => patchSet(vs.id, { cropY: vs.cropY })}
                      />
                    </div>

                    {/* Padding */}
                    <div className="space-y-1">
                      <Label className="text-xs">Gap between videos (px)</Label>
                      <Input
                        type="number" min={0}
                        value={vs.padding}
                        className="w-28 h-8 text-sm"
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          updateSetLocally(vs.id, { padding: v });
                        }}
                        onBlur={() => patchSet(vs.id, { padding: vs.padding })}
                      />
                    </div>

                    {/* Scale */}
                    <div className="space-y-1">
                      <Label className="text-xs">Output size</Label>
                      <div className="flex rounded-md border border-zinc-200 overflow-hidden">
                        {([false, true] as const).map((keep) => (
                          <button
                            key={String(keep)}
                            onClick={() => {
                              updateSetLocally(vs.id, { keepOriginalSize: keep });
                              patchSet(vs.id, { keepOriginalSize: keep });
                            }}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors
                              ${vs.keepOriginalSize === keep
                                ? "bg-zinc-900 text-white"
                                : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                          >
                            {keep ? "Original size" : "Scale to 640×360"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sets.length === 0 && <p className="text-zinc-400 text-sm">No video sets yet. Click "Add Video Set" above.</p>}
        </div>

        {/* Right: preview sidebar */}
        {setsWithVideos.length > 0 && (
          <div className="xl:sticky xl:top-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Composite Previews</p>
              {generatingPreviews && (
                <span className="text-xs text-zinc-400 animate-pulse">Generating…</span>
              )}
            </div>

            {sets.map((vs) => {
              if (vs.videos.length === 0) return null;
              return (
                <div key={vs.id} className="rounded-lg border bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b bg-zinc-50 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-700 truncate">{vs.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {vs.videos.map((_, i) => (
                        <span key={i} className="text-xs bg-zinc-200 text-zinc-600 rounded px-1 font-mono">
                          {SLOT_LABELS[i]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {generatingPreviews ? (
                    <div className="aspect-video bg-zinc-100 flex items-center justify-center">
                      <span className="text-xs text-zinc-400 animate-pulse">Generating…</span>
                    </div>
                  ) : vs.testCompositeUrl ? (
                    <video
                      key={vs.testCompositeUrl}
                      src={vs.testCompositeUrl}
                      controls
                      className="w-full"
                    />
                  ) : (
                    <div className="aspect-video bg-zinc-50 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">No preview — click Generate Previews</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model name dialog for new upload */}
      <InputDialog
        open={!!modelNameDialog}
        onOpenChange={(open) => { if (!open) setModelNameDialog(null); }}
        title="Add video"
        description="Enter the model name for this video, then select the file."
        label="Model name"
        placeholder="e.g. ModelA, LSNR, Baseline"
        submitLabel="Choose file →"
        onSubmit={handleModelNameSubmit}
      />

      {/* Edit model name dialog */}
      <InputDialog
        open={!!editDialog}
        onOpenChange={(open) => { if (!open) setEditDialog(null); }}
        title="Edit model name"
        label="Model name"
        defaultValue={editDialog?.modelName ?? ""}
        submitLabel="Save"
        onSubmit={(name) => editDialog && handleEditModelName(editDialog.id, name)}
      />

      {/* Delete set confirmation */}
      <ConfirmDialog
        open={!!setToDelete}
        onOpenChange={(open) => { if (!open) setSetToDelete(null); }}
        title="Delete video set"
        description={
          <>
            Are you sure you want to delete <strong>{setToDelete?.name}</strong> and all {setToDelete?.videos.length} video{setToDelete?.videos.length !== 1 ? "s" : ""} in it?
          </>
        }
        onConfirm={confirmDeleteSet}
        loading={deleting}
      />

      {/* Delete individual video confirmation */}
      <ConfirmDialog
        open={!!videoToDelete}
        onOpenChange={(open) => { if (!open) setVideoToDelete(null); }}
        title="Remove video"
        description={
          <>
            Remove <strong>{videoToDelete?.modelName}</strong> from <strong>{videoToDelete?.setName}</strong>?
          </>
        }
        onConfirm={confirmDeleteVideo}
        confirmLabel="Remove"
        loading={deleting}
      />
    </div>
  );
}
