import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      surveyVideoSets: { select: { compositeStatus: true } },
    },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type SVS = { compositeStatus: string };
  const total = survey.surveyVideoSets.length;
  const ready = survey.surveyVideoSets.filter((s: SVS) => s.compositeStatus === "ready").length;
  const failed = survey.surveyVideoSets.filter((s: SVS) => s.compositeStatus === "failed").length;

  return NextResponse.json({ status: survey.status, total, ready, failed });
}
