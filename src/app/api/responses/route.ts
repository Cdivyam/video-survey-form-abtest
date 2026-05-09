import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/responses — bulk-save responses for a session page
export async function POST(req: Request) {
  const { token, responses } = (await req.json()) as {
    token: string;
    responses: Array<{
      surveyVideoSetId?: string;
      elementId: string;
      slotLabel?: string;
      value: string;
    }>;
  };

  const session = await prisma.respondentSession.findUnique({ where: { token } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await prisma.response.createMany({
    data: responses.map((r) => ({
      sessionId: session.id,
      surveyVideoSetId: r.surveyVideoSetId ?? null,
      elementId: r.elementId,
      slotLabel: r.slotLabel ?? null,
      value: r.value,
    })),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
