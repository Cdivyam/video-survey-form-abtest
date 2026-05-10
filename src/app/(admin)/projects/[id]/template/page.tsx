"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ElementEditor from "@/components/builder/ElementEditor";
import { ELEMENT_LABELS, VIDEO_ELEMENTS, GENERAL_ELEMENTS, defaultConfig } from "@/components/builder/elements/configs";
import { toast } from "sonner";
import type { BuilderPage, BuilderElement, ElementType, PageSection } from "@/lib/types";
import { nanoid } from "nanoid";

const SECTION_LABELS: Record<PageSection, string> = {
  before: "Static Before",
  dynamic: "Dynamic Template",
  after: "Static After",
};

function SortableElement({
  el, selected, onSelect, onDelete,
}: {
  el: BuilderElement; selected: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: el.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors
        ${selected ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
      onClick={onSelect}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-zinc-300 select-none">⠿</span>
      <span className="flex-1 font-medium text-zinc-700">{ELEMENT_LABELS[el.elementType]}</span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-zinc-300 hover:text-red-500 transition-colors">✕</button>
    </div>
  );
}

export default function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor));

  const [name, setName] = useState("Survey Template");
  const [setsPerSurvey, setSetsPerSurvey] = useState(6);
  const [pages, setPages] = useState<BuilderPage[]>([
    { id: nanoid(), section: "before", orderIndex: 0, elements: [] },
    { id: nanoid(), section: "dynamic", orderIndex: 0, elements: [] },
    { id: nanoid(), section: "after", orderIndex: 0, elements: [] },
  ]);
  const [activeSection, setActiveSection] = useState<PageSection>("before");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing template
  useEffect(() => {
    fetch(`/api/projects/${id}/template`).then((r) => r.json()).then((t) => {
      if (!t) return;
      setName(t.name);
      setSetsPerSurvey(t.setsPerSurvey);
      if (t.pages?.length) {
        const mapped: BuilderPage[] = (["before", "dynamic", "after"] as PageSection[]).map((section) => {
          const page = t.pages.find((p: { section: string }) => p.section === section);
          return page
            ? { id: page.id, section, orderIndex: page.orderIndex, elements: page.elements.map((e: { id: string; elementType: ElementType; config: string; orderIndex: number }) => ({ ...e, config: typeof e.config === "string" ? JSON.parse(e.config) : e.config })) }
            : { id: nanoid(), section, orderIndex: 0, elements: [] };
        });
        setPages(mapped);
      }
    });
  }, [id]);

  const activePage = pages.find((p) => p.section === activeSection)!;
  const selectedElement = activePage.elements.find((e) => e.id === selectedElementId) ?? null;

  function updatePage(updated: BuilderPage) {
    setPages((ps) => ps.map((p) => (p.section === updated.section ? updated : p)));
  }

  function addElement(type: ElementType) {
    const el: BuilderElement = {
      id: nanoid(),
      elementType: type,
      config: defaultConfig(type),
      orderIndex: activePage.elements.length,
    };
    updatePage({ ...activePage, elements: [...activePage.elements, el] });
    setSelectedElementId(el.id);
  }

  function deleteElement(elId: string) {
    updatePage({ ...activePage, elements: activePage.elements.filter((e) => e.id !== elId).map((e, i) => ({ ...e, orderIndex: i })) });
    if (selectedElementId === elId) setSelectedElementId(null);
  }

  function updateElement(updated: BuilderElement) {
    updatePage({ ...activePage, elements: activePage.elements.map((e) => (e.id === updated.id ? updated : e)) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activePage.elements.findIndex((e) => e.id === active.id);
    const newIdx = activePage.elements.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(activePage.elements, oldIdx, newIdx).map((e, i) => ({ ...e, orderIndex: i }));
    updatePage({ ...activePage, elements: reordered });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${id}/template`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, setsPerSurvey, pages }),
    });
    if (res.ok) { toast.success("Template saved"); router.push(`/projects/${id}`); }
    else toast.error("Failed to save");
    setSaving(false);
  }

  const isVideoSection = activeSection === "dynamic";
  const palette = isVideoSection ? [...GENERAL_ELEMENTS, ...VIDEO_ELEMENTS] : GENERAL_ELEMENTS;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-700 text-sm">← Project</Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-2xl font-bold text-zinc-900">Survey Template Builder</h1>
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-1">
          <Label>Template name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
        </div>
        <div className="space-y-1">
          <Label>Video sets per survey</Label>
          <Input type="number" min={0} value={setsPerSurvey}
            onChange={(e) => setSetsPerSurvey(Number(e.target.value))} className="w-32" />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</Button>
      </div>

      <div className="flex gap-2">
        {(["before", "dynamic", "after"] as PageSection[]).map((s) => (
          <button key={s} onClick={() => { setActiveSection(s); setSelectedElementId(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeSection === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[240px_1fr_280px] gap-4 h-[calc(100vh-280px)]">
        {/* Element palette */}
        <Card className="overflow-auto">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Add element</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            {palette.map((type) => (
              <button key={type} onClick={() => addElement(type)}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-2">
                {VIDEO_ELEMENTS.includes(type) && <Badge variant="secondary" className="text-xs px-1 py-0">video</Badge>}
                {ELEMENT_LABELS[type]}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Properties panel — centre, wide */}
        <Card className="overflow-auto">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm text-zinc-500">Properties</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {selectedElement ? (
              <ElementEditor element={selectedElement} onChange={updateElement} />
            ) : (
              <p className="text-zinc-400 text-sm">Select an element from the canvas to edit its properties</p>
            )}
          </CardContent>
        </Card>

        {/* Canvas — right, narrow */}
        <Card className="overflow-auto">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm text-zinc-500">{SECTION_LABELS[activeSection]}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3 space-y-2">
            {activePage.elements.length === 0 && (
              <p className="text-zinc-400 text-sm text-center py-8">Click an element in the palette to add it here</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activePage.elements.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                {activePage.elements.map((el) => (
                  <SortableElement key={el.id} el={el}
                    selected={el.id === selectedElementId}
                    onSelect={() => setSelectedElementId(el.id)}
                    onDelete={() => deleteElement(el.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
