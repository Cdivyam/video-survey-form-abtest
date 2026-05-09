"use client";
import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputDialog } from "@/components/ui/input-dialog";
import { toast } from "sonner";

type Video = {
  id: string;
  modelName: string;
  fileUrl: string;
  originalFilename: string | null;
};
type VideoSet = { id: string; name: string; videos: Video[] };

const SLOT_LABELS = ["A", "B", "C", "D", "E"];

export default function VideoSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sets, setSets] = useState<VideoSet[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSetId = useRef<string | null>(null);
  const pendingModelName = useRef<string>("");

  // Model name dialog for new uploads
  const [modelNameDialog, setModelNameDialog] = useState<{ setId: string } | null>(null);

  // Edit model name dialog
  const [editDialog, setEditDialog] = useState<(Video & { setName: string }) | null>(null);

  // Delete confirmations
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

      <Button onClick={createSet} disabled={creating}>
        {creating ? "Creating…" : "+ Add Video Set"}
      </Button>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      <div className="grid gap-4">
        {sets.map((vs) => (
          <Card key={vs.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{vs.name}</CardTitle>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                  onClick={() => setSetToDelete(vs)}>Delete set</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
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
                        <p className="text-xs text-zinc-400 truncate" title={v.originalFilename}>
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
            </CardContent>
          </Card>
        ))}
        {sets.length === 0 && <p className="text-zinc-400 text-sm">No video sets yet. Click "Add Video Set" above.</p>}
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
