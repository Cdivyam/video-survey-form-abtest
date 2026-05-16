import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all responses then all sessions for this survey
  const sessions = await prisma.respondentSession.findMany({
    where: { surveyId: id },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: { id: string }) => s.id);

  if (sessionIds.length > 0) {
    await prisma.response.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.respondentSession.deleteMany({ where: { surveyId: id } });
  }

  return NextResponse.json({ ok: true, cleared: sessionIds.length });
}
