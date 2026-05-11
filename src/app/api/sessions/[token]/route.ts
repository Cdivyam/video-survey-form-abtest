import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { BuilderPage, BuilderElement, RunnerSession, SlotMap } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await prisma.respondentSession.findUnique({
    where: { token },
    include: {
      survey: {
        include: {
          template: {
            include: {
              pages: {
                orderBy: { orderIndex: "asc" },
                include: { elements: { orderBy: { orderIndex: "asc" } } },
              },
            },
          },
          surveyVideoSets: {
            orderBy: { positionIndex: "asc" },
            include: { videoSet: { include: { videos: true } } },
          },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type DbPage = typeof session.survey.template.pages[0];
  type DbElement = DbPage["elements"][0];
  type DbSVS = typeof session.survey.surveyVideoSets[0];

  const pages: BuilderPage[] = session.survey.template.pages.map((p: DbPage) => ({
    id: p.id,
    section: p.section as BuilderPage["section"],
    orderIndex: p.orderIndex,
    elements: p.elements.map((e: DbElement) => ({
      id: e.id,
      elementType: e.elementType as BuilderElement["elementType"],
      config: JSON.parse(e.config),
      orderIndex: e.orderIndex,
    })),
  }));

  const videoSets = session.survey.surveyVideoSets.map((svs: DbSVS) => {
    const slotMap = JSON.parse(svs.slotMap) as SlotMap;
    return {
      surveyVideoSetId: svs.id,
      positionIndex: svs.positionIndex,
      compositeUrl: svs.compositeUrl ?? "",
      slotMap,
      slots: Object.keys(slotMap).sort() as RunnerSession["survey"]["videoSets"][0]["slots"],
    };
  });

  const result: RunnerSession = {
    token: session.token,
    survey: {
      id: session.survey.id,
      template: {
        name: session.survey.template.name,
        pages,
        setsPerSurvey: session.survey.template.setsPerSurvey,
      },
      videoSets,
    },
  };

  return NextResponse.json(result);
}

// PATCH — mark session as completed
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await prisma.respondentSession.update({
    where: { token },
    data: { completedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
