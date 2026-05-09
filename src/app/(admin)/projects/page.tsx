"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
  createdAt: string;
  _count: { videoSets: number; surveys: number };
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/projects");
    setProjects(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const p: Project = await res.json();
      setNewName("");
      router.push(`/projects/${p.id}`);
    } else {
      toast.error("Failed to create project");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
        <p className="text-zinc-500 mt-1">Each project has a video bank, a survey template, and generated surveys.</p>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="New project name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} disabled={creating || !newName.trim()}>
          {creating ? "Creating…" : "Create project"}
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-zinc-400">No projects yet. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/projects/${p.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <CardDescription>
                  {new Date(p.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Badge variant="secondary">{p._count.videoSets} video sets</Badge>
                <Badge variant="secondary">{p._count.surveys} surveys</Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
