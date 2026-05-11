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
      surveyVideoSets: {
        include: {
          videoSet: true,
          responses: {
            include: { session: true, element: true },
          },
        },
      },
      sessions: true,
    },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type SVS = typeof survey.surveyVideoSets[0];
  type SvsResponse = SVS["responses"][0];

  // Collect all videos for id → modelName lookup
  const allVideoIds = survey.surveyVideoSets.flatMap((svs: SVS) => {
    const slotMap = JSON.parse(svs.slotMap) as SlotMap;
    return Object.values(slotMap).filter(Boolean) as string[];
  });
  const videos = await prisma.video.findMany({
    where: { id: { in: allVideoIds } },
    select: { id: true, modelName: true },
  });
  const videoMap = Object.fromEntries(videos.map((v: { id: string; modelName: string }) => [v.id, v.modelName]));

  const rows: string[][] = [];
  const header = [
    "survey_id", "session_id", "completed_at",
    "video_set_id", "video_set_name", "position_index",
    "element_id", "element_type", "element_name",
    "slot_label", "video_id", "model_name", "value",
  ];
  rows.push(header);

  for (const svs of survey.surveyVideoSets as SVS[]) {
    const slotMap = JSON.parse(svs.slotMap) as SlotMap;
    for (const response of svs.responses as SvsResponse[]) {
      const videoId = response.slotLabel
        ? slotMap[response.slotLabel as keyof SlotMap] ?? ""
        : "";
      const modelName = videoId ? (videoMap[videoId] ?? "") : "";

      // Extract element name from config JSON if present
      let elementName = "";
      if (response.element?.config) {
        try {
          const cfg = JSON.parse(response.element.config) as Record<string, unknown>;
          elementName = typeof cfg.name === "string" ? cfg.name : "";
        } catch { /* ignore */ }
      }

      rows.push([
        survey.id,
        response.session.id,
        response.session.completedAt?.toISOString() ?? "",
        svs.videoSetId,
        svs.videoSet.name,
        String(svs.positionIndex),
        response.elementId ?? "",
        response.element?.elementType ?? "",
        elementName,
        response.slotLabel ?? "",
        videoId,
        modelName,
        response.value,
      ]);
    }
  }

  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="survey-${id}.csv"`,
    },
  });
}
