"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Video = { id: string; modelName: string; fileUrl: string; orderIndex: number };
type VideoSet = { id: string; name: string; disabled: boolean; videos: Video[] };
type Survey = {
  id: string; slug: string; status: string; createdAt: string;
  _count: { sessions: number };
  surveyVideoSets?: {
    compositeStatus: string;
    positionIndex: number;
    videoSet: { id: string; name: string; disabled: boolean };
  }[];
};
type Project = {
  id: string; name: string;
  videoSets: VideoSet[];
  surveyTemplates: { id: string; name: string; setsPerSurvey: number }[];
  surveys: Survey[];
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMode, setGenerateMode] = useState<"random" | "manual">("random");
  const [manualSelected, setManualSelected] = useState<VideoSet[]>([]);

  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [videoSetToDelete, setVideoSetToDelete] = useState<VideoSet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [surveyToClear, setSurveyToClear] = useState<Survey | null>(null);
  const [clearing, setClearing] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push("/projects"); return; }
    setProject(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!project) return;
    const gen = project.surveys.find((s) => s.status === "generating");
    if (!gen) { setPollingId(null); return; }
    setPollingId(gen.id);
  }, [project]);

  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/surveys/${pollingId}/status`);
      const data = await res.json();
      if (data.status === "ready") { clearInterval(interval); load(); }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId]);

  function openGenerateModal() {
    setGenerateMode("random");
    setManualSelected([]);
    setShowGenerateModal(true);
  }

  async function confirmGenerate() {
    setGenerating(true);
    const body = generateMode === "manual"
      ? { manualSetIds: manualSelected.map((s) => s.id) }
      : {};
    const res = await fetch(`/api/projects/${id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Survey generation started");
      setShowGenerateModal(false);
      load();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to generate");
    }
    setGenerating(false);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for HTTP (non-secure) contexts — e.g. LAN access via IP
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy"); // deprecated but only option on plain HTTP
      document.body.removeChild(el);
    }
    toast.success("Link copied");
  }

  async function confirmDeleteSurvey() {
    if (!surveyToDelete) return;
    setDeleting(true);
    await fetch(`/api/surveys/${surveyToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setSurveyToDelete(null);
    load();
  }

  async function confirmClearResponses() {
    if (!surveyToClear) return;
    setClearing(true);
    await fetch(`/api/surveys/${surveyToClear.id}/responses`, { method: "DELETE" });
    setClearing(false);
    setSurveyToClear(null);
    toast.success("Responses cleared");
    load();
  }

  async function confirmDeleteVideoSet() {
    if (!videoSetToDelete) return;
    setDeleting(true);
    await fetch(`/api/videosets/${videoSetToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setVideoSetToDelete(null);
    load();
  }

  if (!project) return <div className="text-zinc-400">Loading…</div>;

  const template = project.surveyTemplates[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-zinc-400 hover:text-zinc-700 text-sm">← Projects</Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
      </div>

      <Tabs defaultValue="videosets">
        <TabsList>
          <TabsTrigger value="videosets">Video Sets ({project.videoSets.length})</TabsTrigger>
          <TabsTrigger value="template">Survey Template</TabsTrigger>
          <TabsTrigger value="surveys">Surveys ({project.surveys.length})</TabsTrigger>
        </TabsList>

        {/* ── Video Sets ── */}
        <TabsContent value="videosets" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-500 text-sm">Upload video sets (up to 5 videos each) to build your bank.</p>
            <Button onClick={() => router.push(`/projects/${id}/videosets`)}>Manage Video Sets</Button>
          </div>
          {project.videoSets.length === 0 ? (
            <p className="text-zinc-400 text-sm">No video sets yet.</p>
          ) : (
            <div className="grid gap-3">
              {project.videoSets.map((vs) => (
                <Card key={vs.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{vs.name}</p>
                      <p className="text-sm text-zinc-500">{vs.videos.length} video{vs.videos.length !== 1 ? "s" : ""}: {vs.videos.map((v) => v.modelName).join(", ")}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                      onClick={() => setVideoSetToDelete(vs)}>Delete</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Template ── */}
        <TabsContent value="template" className="space-y-4 mt-4">
          {template ? (
            <Card>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-zinc-500">Sets per survey: <span className="font-medium text-zinc-800">{template.setsPerSurvey}</span></p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-zinc-400 text-sm">No template yet.</p>
          )}
          {template && project.surveys.some((s) => s.status === "ready" || s.status === "generating") && (
            <p className="text-sm text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
              Text edits (prompts, labels, headings) apply instantly to existing surveys.
              Adding or removing blocks will prompt you to confirm before disabling them.
            </p>
          )}
          <Button onClick={() => router.push(`/projects/${id}/template`)}>
            {template ? "Edit Template" : "Create Template"}
          </Button>
        </TabsContent>

        {/* ── Surveys ── */}
        <TabsContent value="surveys" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-500 text-sm">Each generated survey gets a unique link.</p>
            <Button
              onClick={() => template && template.setsPerSurvey > 0 ? openGenerateModal() : confirmGenerate()}
              disabled={generating || !template}
            >
              {generating ? "Generating…" : "Generate Survey"}
            </Button>
          </div>
          {project.surveys.length === 0 ? (
            <p className="text-zinc-400 text-sm">No surveys generated yet.</p>
          ) : (
            <div className="grid gap-3">
              {project.surveys.map((s) => {
                const svs = s.surveyVideoSets ?? [];
                const ready = svs.filter((v) => v.compositeStatus === "ready").length;
                const total = svs.length;
                const pct = total > 0 ? Math.round((ready / total) * 100) : 100;
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${s.slug}`;
                return (
                  <Card key={s.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            s.status === "ready" ? "default" :
                            s.status === "generating" ? "secondary" :
                            s.status === "disabled" ? "destructive" : "outline"
                          }>
                            {s.status}
                          </Badge>
                          <span className="text-sm text-zinc-500">{new Date(s.createdAt).toLocaleString()}</span>
                          <span className="text-sm text-zinc-500">{s._count.sessions} response{s._count.sessions !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex gap-2">
                          {s.status === "ready" && (
                            <a href={`/api/surveys/${s.id}/export`} download>
                              <Button variant="outline" size="sm">Export CSV</Button>
                            </a>
                          )}
                          {s._count.sessions > 0 && (
                            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800"
                              onClick={() => setSurveyToClear(s)}>Clear responses</Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                            onClick={() => setSurveyToDelete(s)}>Delete</Button>
                        </div>
                      </div>
                      {s.status === "generating" && (
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <p className="text-xs text-zinc-400">Rendering composites: {ready}/{total}</p>
                        </div>
                      )}
                      {svs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-zinc-400">Sampled:</span>
                          {svs.map((v, i) => (
                            <span key={i}
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium
                                ${v.videoSet.disabled
                                  ? "border-amber-200 bg-amber-50 text-amber-600"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
                              title={v.videoSet.disabled ? "This video set is now disabled" : undefined}
                            >
                              {v.videoSet.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.status === "ready" && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-zinc-100 px-2 py-1 rounded">{url}</code>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(url)}>
                            Copy
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Clear responses ── */}
      <ConfirmDialog
        open={!!surveyToClear}
        onOpenChange={(open) => { if (!open) setSurveyToClear(null); }}
        title="Clear all responses"
        description={
          surveyToClear && (
            <>
              This will permanently delete all <strong>{surveyToClear._count.sessions} response{surveyToClear._count.sessions !== 1 ? "s" : ""}</strong> for this survey. The survey link stays active and can still receive new responses.
            </>
          )
        }
        confirmLabel="Clear responses"
        onConfirm={confirmClearResponses}
        loading={clearing}
      />

      {/* ── Survey delete ── */}
      <ConfirmDialog
        open={!!surveyToDelete}
        onOpenChange={(open) => { if (!open) setSurveyToDelete(null); }}
        title="Delete survey"
        description={
          surveyToDelete && surveyToDelete._count.sessions > 0 ? (
            <>
              This survey has <strong>{surveyToDelete._count.sessions} response{surveyToDelete._count.sessions !== 1 ? "s" : ""}</strong>. This action cannot be undone.
            </>
          ) : (
            "Are you sure you want to delete this survey? This action cannot be undone."
          )
        }
        confirmText={surveyToDelete && surveyToDelete._count.sessions > 0 ? surveyToDelete.slug : undefined}
        onConfirm={confirmDeleteSurvey}
        loading={deleting}
      />

      {/* ── VideoSet delete ── */}
      <ConfirmDialog
        open={!!videoSetToDelete}
        onOpenChange={(open) => { if (!open) setVideoSetToDelete(null); }}
        title="Delete video set"
        description={
          <>
            This will permanently delete <strong>{videoSetToDelete?.name}</strong> and all its videos. This action cannot be undone.
          </>
        }
        onConfirm={confirmDeleteVideoSet}
        loading={deleting}
      />

      {/* ── Generate survey modal ── */}
      {template && template.setsPerSurvey > 0 && (() => {
        const enabledSets = project.videoSets.filter((s) => !s.disabled);
        const availableSets = enabledSets.filter((s) => !manualSelected.some((m) => m.id === s.id));
        const needed = template.setsPerSurvey;
        const canGenerate = generateMode === "random" || manualSelected.length === needed;

        return (
          <Dialog open={showGenerateModal} onOpenChange={(open) => { if (!open) setShowGenerateModal(false); }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate Survey</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <p className="text-sm text-zinc-500">
                  This survey will include <strong>{needed}</strong> video set{needed !== 1 ? "s" : ""}.
                </p>

                {/* Mode radios */}
                <div className="space-y-3">
                  {(["random", "manual"] as const).map((mode) => (
                    <label key={mode} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={generateMode === mode}
                        onChange={() => { setGenerateMode(mode); setManualSelected([]); }}
                        className="accent-zinc-900 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {mode === "random" ? "Random" : "Manual selection"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {mode === "random"
                            ? "Video sets sampled automatically, preferring under-shown sets"
                            : "Choose exactly which video sets to include"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Manual selection UI */}
                {generateMode === "manual" && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Select {needed} video set{needed !== 1 ? "s" : ""}</span>
                      <span className={`text-xs font-medium ${manualSelected.length === needed ? "text-green-600" : "text-zinc-400"}`}>
                        {manualSelected.length} / {needed} selected
                      </span>
                    </div>

                    {/* Dropdown */}
                    {manualSelected.length < needed && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const vs = availableSets.find((s) => s.id === e.target.value);
                          if (vs) setManualSelected((prev) => [...prev, vs]);
                          e.target.value = "";
                        }}
                        className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      >
                        <option value="" disabled>Select a video set…</option>
                        {availableSets.map((vs) => (
                          <option key={vs.id} value={vs.id}>
                            {vs.name} ({vs.videos.length} video{vs.videos.length !== 1 ? "s" : ""})
                          </option>
                        ))}
                      </select>
                    )}
                    {availableSets.length === 0 && manualSelected.length < needed && (
                      <p className="text-xs text-amber-600">No more enabled video sets available.</p>
                    )}

                    {/* Selected pills */}
                    {manualSelected.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {manualSelected.map((vs) => (
                          <div key={vs.id}
                            className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border border-zinc-200 bg-zinc-50">
                            <span className="text-zinc-700">{vs.name}</span>
                            <button
                              onClick={() => setManualSelected((prev) => prev.filter((s) => s.id !== vs.id))}
                              className="text-zinc-400 hover:text-red-500 transition-colors leading-none"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <Button onClick={confirmGenerate} disabled={generating || !canGenerate}>
                  {generating ? "Generating…" : "Generate Survey"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
