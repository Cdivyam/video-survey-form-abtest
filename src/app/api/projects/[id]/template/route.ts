import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { BuilderPage } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.surveyTemplate.findFirst({
    where: { projectId: id },
    include: {
      pages: {
        orderBy: { orderIndex: "asc" },
        include: { elements: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });
  if (!template) return NextResponse.json(null);

  // Count non-disabled surveys so the builder can warn before structural changes
  const activeSurveyCount = await prisma.survey.count({
    where: { templateId: template.id, status: { not: "disabled" } },
  });

  return NextResponse.json({ ...template, activeSurveyCount });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, setsPerSurvey, pages } = (await req.json()) as {
    name: string;
    setsPerSurvey: number;
    pages: BuilderPage[];
  };

  // Upsert template
  let template = await prisma.surveyTemplate.findFirst({ where: { projectId: id } });
  if (!template) {
    template = await prisma.surveyTemplate.create({
      data: { projectId: id, name, setsPerSurvey },
    });
  } else {
    template = await prisma.surveyTemplate.update({
      where: { id: template.id },
      data: { name, setsPerSurvey },
    });
  }

  // Detect structural change: compare existing element IDs with incoming IDs
  const existingElements = await prisma.templateElement.findMany({
    where: { page: { templateId: template.id } },
    select: { id: true },
  });
  const existingIds = new Set(existingElements.map((e: { id: string }) => e.id));
  const incomingIds = new Set(pages.flatMap((p) => p.elements.map((e) => e.id)));

  const structureChanged =
    [...incomingIds].some((id) => !existingIds.has(id)) ||
    [...existingIds].some((id) => !incomingIds.has(id));

  if (structureChanged) {
    // Structure changed: null out response elementIds and disable surveys
    const existingSurveys = await prisma.survey.findMany({
      where: { templateId: template.id },
      select: { id: true },
    });

    if (existingSurveys.length > 0) {
      const surveyIds = existingSurveys.map((s: { id: string }) => s.id);
      const sessions = await prisma.respondentSession.findMany({
        where: { surveyId: { in: surveyIds } },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: { id: string }) => s.id);

      if (sessionIds.length > 0) {
        await prisma.response.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { elementId: null },
        });
      }

      await prisma.survey.updateMany({
        where: { id: { in: surveyIds } },
        data: { status: "disabled" },
      });
    }

    // Recreate all pages and elements
    await prisma.templateElement.deleteMany({
      where: { page: { templateId: template.id } },
    });
    await prisma.templatePage.deleteMany({ where: { templateId: template.id } });

    for (const page of pages) {
      const created = await prisma.templatePage.create({
        data: { templateId: template.id, section: page.section, orderIndex: page.orderIndex },
      });
      for (const el of page.elements) {
        await prisma.templateElement.create({
          data: {
            id: el.id,
            pageId: created.id,
            elementType: el.elementType,
            config: JSON.stringify(el.config),
            orderIndex: el.orderIndex,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, structureChanged: true, surveysDisabled: existingSurveys.length });
  } else {
    // Text-only change: update configs in place, no surveys affected
    for (const page of pages) {
      await prisma.templatePage.updateMany({
        where: { id: page.id },
        data: { orderIndex: page.orderIndex },
      });
      for (const el of page.elements) {
        await prisma.templateElement.updateMany({
          where: { id: el.id },
          data: { config: JSON.stringify(el.config), orderIndex: el.orderIndex },
        });
      }
    }

    return NextResponse.json({ ok: true, structureChanged: false, surveysDisabled: 0 });
  }
}
