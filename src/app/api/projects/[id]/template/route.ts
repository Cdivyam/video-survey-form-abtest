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
  return NextResponse.json(template ?? null);
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

  // Replace all pages and elements
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

  return NextResponse.json({ ok: true });
}
