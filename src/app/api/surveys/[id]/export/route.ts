import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SlotMap } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          pages: {
            include: { elements: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      sessions: {
        orderBy: { startedAt: "asc" },
        include: {
          responses: {
            include: { element: true },
          },
        },
      },
      surveyVideoSets: {
        orderBy: { positionIndex: "asc" },
        include: { videoSet: true },
      },
    },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Template structure ─────────────────────────────────────────────────────
  const allElements = survey.template.pages.flatMap((p) => p.elements);

  // Demographics fields (from first demographics element in template)
  const demoEl = allElements.find((e) => e.elementType === "demographics");
  const demoFields: { id: string; label: string }[] = demoEl
    ? (JSON.parse(demoEl.config) as { fields: { id: string; label: string }[] }).fields
    : [];

  // Video Likert elements: id → display name
  const likertEls = allElements
    .filter((e) => e.elementType === "video_likert")
    .map((e) => {
      const cfg = JSON.parse(e.config) as { name?: string };
      return { id: e.id, name: cfg.name?.trim() || e.id };
    });

  // Video Preference elements: id → display name
  const prefEls = allElements
    .filter((e) => e.elementType === "video_preference")
    .map((e) => {
      const cfg = JSON.parse(e.config) as { name?: string };
      return { id: e.id, name: cfg.name?.trim() || e.id };
    });

  // ── Video lookup tables ────────────────────────────────────────────────────
  // slotMap per SurveyVideoSet
  const svsSlotMap: Record<string, SlotMap> = {};
  const svsName: Record<string, string> = {};
  const svsPosition: Record<string, number> = {};
  for (const svs of survey.surveyVideoSets) {
    svsSlotMap[svs.id] = JSON.parse(svs.slotMap) as SlotMap;
    svsName[svs.id] = svs.videoSet.name;
    svsPosition[svs.id] = svs.positionIndex;
  }

  // Fetch model names for all videos referenced
  const allVideoIds = Object.values(svsSlotMap).flatMap((sm) =>
    Object.values(sm).filter(Boolean)
  ) as string[];
  const videos = await prisma.video.findMany({
    where: { id: { in: allVideoIds } },
    select: { id: true, modelName: true },
  });
  const videoModelMap = Object.fromEntries(videos.map((v) => [v.id, v.modelName]));

  // ── Column structure ───────────────────────────────────────────────────────
  const setsPerSurvey = survey.template.setsPerSurvey;

  // Determine max slots across all SurveyVideoSets
  const maxSlots = survey.surveyVideoSets.reduce(
    (m, svs) => Math.max(m, Object.keys(svsSlotMap[svs.id]).length),
    0
  );
  const slotLabels = (["A", "B", "C", "D", "E"] as const).slice(0, maxSlots);

  // Video-set column headers (repeated per position)
  const vsColHeaders: string[] = [];
  for (let p = 0; p < setsPerSurvey; p++) {
    const px = `vs${p + 1}`;
    vsColHeaders.push(`${px}_name`);
    for (const slot of slotLabels) vsColHeaders.push(`${px}_${slot}_model`);
    for (const el of likertEls) {
      for (const slot of slotLabels) vsColHeaders.push(`${px}_${el.name}_${slot}`);
    }
    for (const el of prefEls) vsColHeaders.push(`${px}_${el.name}`);
  }

  const header = [
    "session_id", "survey_id", "started_at", "completed_at",
    ...demoFields.map((f) => f.label),
    ...vsColHeaders,
  ];

  // ── Build rows ─────────────────────────────────────────────────────────────
  const rows: string[][] = [header];

  for (const session of survey.sessions) {
    // Demographics: find the response for the demographics element
    const demoResponse = session.responses.find(
      (r) => r.element?.elementType === "demographics"
    );
    const demoValues: Record<string, string> = demoResponse
      ? (() => { try { return JSON.parse(demoResponse.value); } catch { return {}; } })()
      : {};

    // Rating lookup: svsId::elementId::slotLabel → value
    const ratingMap: Record<string, string> = {};
    // Preference lookup: svsId::elementId → chosen slot
    const prefMap: Record<string, string> = {};

    for (const r of session.responses) {
      if (!r.surveyVideoSetId || !r.elementId) continue;
      if (r.element?.elementType === "video_likert" && r.slotLabel) {
        ratingMap[`${r.surveyVideoSetId}::${r.elementId}::${r.slotLabel}`] = r.value;
      } else if (r.element?.elementType === "video_preference") {
        prefMap[`${r.surveyVideoSetId}::${r.elementId}`] = r.value;
      }
    }

    // Which SurveyVideoSets did this session see? (sorted by position)
    const sessionSvsIds = [
      ...new Set(
        session.responses
          .filter((r) => r.surveyVideoSetId)
          .map((r) => r.surveyVideoSetId!)
      ),
    ].sort((a, b) => (svsPosition[a] ?? 0) - (svsPosition[b] ?? 0));

    // Build video-set columns
    const vsData: string[] = [];
    for (let p = 0; p < setsPerSurvey; p++) {
      const svsId = sessionSvsIds[p] ?? "";
      const slotMap = svsId ? (svsSlotMap[svsId] ?? {}) : {};

      vsData.push(svsId ? (svsName[svsId] ?? "") : "");

      for (const slot of slotLabels) {
        const videoId = slotMap[slot as keyof SlotMap] ?? "";
        vsData.push(videoId ? (videoModelMap[videoId] ?? "") : "");
      }
      for (const el of likertEls) {
        for (const slot of slotLabels) {
          vsData.push(ratingMap[`${svsId}::${el.id}::${slot}`] ?? "");
        }
      }
      for (const el of prefEls) {
        vsData.push(prefMap[`${svsId}::${el.id}`] ?? "");
      }
    }

    rows.push([
      session.id,
      survey.id,
      session.startedAt.toISOString(),
      session.completedAt?.toISOString() ?? "",
      ...demoFields.map((f) => demoValues[f.id] ?? ""),
      ...vsData,
    ]);
  }

  const csv = rows
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="survey-${id}.csv"`,
    },
  });
}
