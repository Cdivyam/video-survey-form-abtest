import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { surveyVideoSets: true },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete composite video files from disk
  await Promise.all(
    survey.surveyVideoSets
      .filter((s: { compositeUrl: string | null }) => s.compositeUrl)
      .map((s: { compositeUrl: string | null }) => deleteFile(s.compositeUrl!))
  );

  // SQLite FK constraints require manual deletion in dependency order:
  // Response → RespondentSession → SurveyVideoSet → Survey

  const sessions = await prisma.respondentSession.findMany({
    where: { surveyId: id },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: { id: string }) => s.id);

  if (sessionIds.length > 0) {
    await prisma.response.deleteMany({ where: { sessionId: { in: sessionIds } } });
  }
  await prisma.respondentSession.deleteMany({ where: { surveyId: id } });
  await prisma.surveyVideoSet.deleteMany({ where: { surveyId: id } });
  await prisma.survey.deleteMany({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
