import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSlotMap, weightedSample } from "@/lib/permutation";
import { localPath, saveFile } from "@/lib/storage";
import { createComposite } from "@/lib/ffmpeg";
import { nanoid } from "nanoid";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surveys = await prisma.survey.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sessions: true } },
      surveyVideoSets: { select: { compositeStatus: true } },
    },
  });
  return NextResponse.json(surveys);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const template = await prisma.surveyTemplate.findFirst({
    where: { projectId: id },
  });
  if (!template) {
    return NextResponse.json({ error: "No template found for this project" }, { status: 400 });
  }

  const isVideoSurvey = template.setsPerSurvey > 0;

  const slug = nanoid(10);
  const survey = await prisma.survey.create({
    data: { templateId: template.id, projectId: id, slug, status: "generating" },
  });

  if (!isVideoSurvey) {
    await prisma.survey.update({ where: { id: survey.id }, data: { status: "ready" } });
    return NextResponse.json({ id: survey.id, slug }, { status: 201 });
  }

  type SetWithVideos = {
    id: string;
    layout: string;
    cropX: number;
    cropY: number;
    padding: number;
    keepOriginalSize: boolean;
    videos: { id: string; fileUrl: string }[];
  };

  // Fetch only enabled videosets for sampling
  const allSets: SetWithVideos[] = await prisma.videoSet.findMany({
    where: { projectId: id, disabled: false },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
  });

  if (allSets.length < template.setsPerSurvey) {
    await prisma.survey.delete({ where: { id: survey.id } });
    return NextResponse.json(
      { error: `Not enough enabled video sets. Need ${template.setsPerSurvey}, found ${allSets.length}.` },
      { status: 400 }
    );
  }

  const completionCounts = await prisma.surveyVideoSet.groupBy({
    by: ["videoSetId"],
    where: {
      survey: { projectId: id, status: "ready" },
      compositeStatus: "ready",
    },
    _count: { id: true },
  });
  const countMap = Object.fromEntries(
    completionCounts.map((c: { videoSetId: string; _count: { id: number } }) => [c.videoSetId, c._count.id])
  );

  // Separate sampling weight data from full set data
  const weightedForSampling = allSets.map((s) => ({
    id: s.id,
    completionCount: (countMap[s.id] as number) ?? 0,
  }));
  const sampledIds = weightedSample(weightedForSampling, template.setsPerSurvey).map((s) => s.id);
  const sampled = sampledIds.map((id) => allSets.find((s) => s.id === id)!);

  // Create SurveyVideoSet rows
  const svs = await Promise.all(
    sampled.map((set, i) => {
      const slotMap = buildSlotMap(set.videos.map((v: { id: string }) => v.id));
      return prisma.surveyVideoSet.create({
        data: {
          surveyId: survey.id,
          videoSetId: set.id,
          positionIndex: i,
          slotMap: JSON.stringify(slotMap),
          compositeStatus: "pending",
        },
      });
    })
  );

  // Kick off composite rendering in the background (fire and forget)
  renderComposites(survey.id, sampled, svs).catch(console.error);

  return NextResponse.json({ id: survey.id, slug }, { status: 201 });
}

async function renderComposites(
  surveyId: string,
  sets: Array<{ id: string; layout: string; cropX: number; cropY: number; padding: number; keepOriginalSize: boolean; videos: Array<{ id: string; fileUrl: string }> }>,
  svs: Array<{ id: string; slotMap: string }>
) {
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const svsRow = svs[i];
    const slotMap = JSON.parse(svsRow.slotMap) as Record<string, string>;

    // Order videos by slot (A, B, C, D, E)
    const slots = Object.entries(slotMap).sort(([a], [b]) => a.localeCompare(b));
    const videoIds = slots.map(([, vid]) => vid);
    const slotLabels = slots.map(([label]) => label);

    const videoIdToUrl = Object.fromEntries(set.videos.map((v) => [v.id, v.fileUrl]));
    const inputPaths = videoIds.map((vid) => localPath(videoIdToUrl[vid]));

    const filename = `${svsRow.id}.mp4`;
    const outputPath = path.join(process.cwd(), "public", "uploads", "composites", filename);
    const compositeUrl = `/api/files/composites/${filename}`;

    await prisma.surveyVideoSet.update({
      where: { id: svsRow.id },
      data: { compositeStatus: "rendering" },
    });

    console.log(`[composite] rendering ${i + 1}/${sets.length} — svsId=${svsRow.id} slots=${slotLabels.join(",")} layout=${set.layout} cropX=${set.cropX} cropY=${set.cropY} padding=${set.padding}`);

    try {
      await createComposite(inputPaths, slotLabels, outputPath, {
        layout: (set.layout === "vertical" ? "vertical" : "horizontal"),
        cropX: set.cropX,
        cropY: set.cropY,
        padding: set.padding,
        keepOriginalSize: set.keepOriginalSize,
      });
      console.log(`[composite] ready — svsId=${svsRow.id}`);
      await prisma.surveyVideoSet.update({
        where: { id: svsRow.id },
        data: { compositeUrl, compositeStatus: "ready" },
      });
    } catch (err) {
      console.error(`[composite] FAILED — svsId=${svsRow.id}:`, err);
      await prisma.surveyVideoSet.update({
        where: { id: svsRow.id },
        data: { compositeStatus: "failed" },
      });
    }
  }

  // Check if all composites are done
  const pending = await prisma.surveyVideoSet.count({
    where: { surveyId, compositeStatus: { in: ["pending", "rendering"] } },
  });
  const failed = await prisma.surveyVideoSet.count({
    where: { surveyId, compositeStatus: "failed" },
  });

  if (pending === 0) {
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: failed > 0 ? "generating" : "ready" },
    });
  }
}

// Suppress unused import warning
void saveFile;
