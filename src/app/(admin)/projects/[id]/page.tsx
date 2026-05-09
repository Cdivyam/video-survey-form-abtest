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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Video = { id: string; modelName: string; fileUrl: string; orderIndex: number };
type VideoSet = { id: string; name: string; videos: Video[] };
type Survey = {
  id: string; slug: string; status: string; createdAt: string;
  _count: { sessions: number };
  surveyVideoSets?: { compositeStatus: string }[];
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

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push("/projects"); return; }
    setProject(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  // Poll status for any generating surveys
  useEffect(() => {
    if (!project) return;
    const generating = project.surveys.find((s) => s.status === "generating");
    if (!generating) { setPollingId(null); return; }
    setPollingId(generating.id);
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

  async function generateSurvey() {
    setGenerating(true);
    const res = await fetch(`/api/projects/${id}/surveys`, { method: "POST" });
    if (res.ok) {
      toast.success("Survey generation started");
      load();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to generate");
    }
    setGenerating(false);
  }

  function openDeleteDialog(s: Survey) {
    setDeleteTarget(s);
    setDeleteInput("");
  }

  async function confirmDeleteSurvey() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/surveys/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  async function deleteVideoSet(vsId: string) {
    await fetch(`/api/videosets/${vsId}`, { method: "DELETE" });
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
                      onClick={() => deleteVideoSet(vs.id)}>Delete</Button>
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
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Saving edits to this template will <strong>disable all existing surveys</strong>. Responses already collected are preserved.
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
            <Button onClick={generateSurvey} disabled={generating || !template}>
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
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                            onClick={() => openDeleteDialog(s)}>Delete</Button>
                        </div>
                      </div>
                      {s.status === "generating" && (
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <p className="text-xs text-zinc-400">Rendering composites: {ready}/{total}</p>
                        </div>
                      )}
                      {s.status === "ready" && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-zinc-100 px-2 py-1 rounded">{url}</code>
                          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
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

      {/* ── Delete Survey Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete survey</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget._count.sessions > 0 ? (
                <>
                  This survey has <strong>{deleteTarget._count.sessions} response{deleteTarget._count.sessions !== 1 ? "s" : ""}</strong>. This action cannot be undone.
                  <br /><br />
                  Type <code className="bg-zinc-100 px-1 rounded font-mono">{deleteTarget.slug}</code> to confirm.
                </>
              ) : (
                "Are you sure you want to delete this survey? This action cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && deleteTarget._count.sessions > 0 && (
            <Input
              placeholder={deleteTarget.slug}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="font-mono"
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={
                deleting ||
                (!!deleteTarget && deleteTarget._count.sessions > 0 && deleteInput !== deleteTarget.slug)
              }
              onClick={confirmDeleteSurvey}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
