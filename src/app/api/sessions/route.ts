import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/sessions — create a new respondent session for a survey slug
export async function POST(req: Request) {
  const { slug } = await req.json();
  const survey = await prisma.survey.findUnique({ where: { slug } });
  if (!survey || survey.status !== "ready") {
    return NextResponse.json({ error: "Survey not available" }, { status: 404 });
  }
  const session = await prisma.respondentSession.create({ data: { surveyId: survey.id } });
  return NextResponse.json({ token: session.token }, { status: 201 });
}
